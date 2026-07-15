/**
 * Client-side executors for gap-closing tools (G1–G30).
 */
import { mailboxService } from '../mailbox/mailboxService';
import { getActiveOrgId } from '../platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../platform/homeOrg';
import { getProject, updateProject } from '../project/projectStore';
import type { CopilotAction } from './orchestratorService';

export type GapToolExecutionResult = {
  action: string;
  summary: string;
  openRoute?: string;
  entityLabel?: string;
  entityId?: string;
  output: Record<string, unknown>;
  executed: boolean;
};

/** Minimal context shape — avoids circular import with toolRuntime. */
export interface GapToolContext {
  app: import('../../App').AppContextType | null;
  projectId?: string | null;
  userId?: string | null;
}

const GAP_TOOL_NAME_SET = new Set([
  'generateInvoicePdf', 'generateContractPdf', 'sendQuote', 'sendInvoice', 'closeProject', 'archiveQuote',
  'duplicateQuote', 'createReminder', 'schedulePaymentReminder', 'mergeCustomers', 'requestReview',
  'searchEmails', 'sendSms', 'processRefund', 'flagTransaction', 'exportReport', 'manageSubscription',
  'initiatePayment', 'bulkUpdateLeadStatus', 'scheduleRecurringJob', 'sendWhatsAppTemplate',
  'sendWhatsAppMedia', 'createCalendarEvent', 'manageFiles', 'draftSupplierOrder',
]);

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function isGapTool(name: string): boolean {
  return GAP_TOOL_NAME_SET.has(name);
}

function reminderStoreKey(orgId: string): string {
  return `tradepro:reminders:${orgId}`;
}

function loadReminders(orgId: string): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(reminderStoreKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReminders(orgId: string, items: Array<Record<string, unknown>>) {
  localStorage.setItem(reminderStoreKey(orgId), JSON.stringify(items.slice(0, 500)));
}

async function sendMailWithAttachments(
  ctx: GapToolContext,
  opts: {
    to: string;
    subject: string;
    body: string;
    connectionId?: string;
    attachments?: Array<{ filename: string; mimeType: string; content: string }>;
  }
): Promise<{ ok: boolean; summary: string; mock?: boolean }> {
  const userId = ctx.userId ?? ctx.app?.user?.id ?? 'default-user';
  const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  const connections = await mailboxService.getConnections(userId, orgId);
  const connectionId = opts.connectionId ?? connections[0]?.id;
  if (!connectionId) {
    return { ok: false, summary: 'No mailbox connected — connect in Settings → Email & Inbox.' };
  }
  const result = await mailboxService.send({
    connectionId,
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    attachments: opts.attachments,
  }, userId, orgId) as { success?: boolean; error?: string; mock?: boolean };
  if (result.success) {
    return {
      ok: true,
      summary: result.mock ? `Email to ${opts.to} sent (mock).` : `Email sent to ${opts.to}.`,
      mock: Boolean(result.mock),
    };
  }
  return { ok: false, summary: result.error ?? 'Email send failed.' };
}

function buildIcs(opts: {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
}): string {
  const uid = `tp-${Date.now()}@tradepro`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return stamp;
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TradePro//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(opts.end)}`,
    `SUMMARY:${opts.title.replace(/\n/g, ' ')}`,
  ];
  if (opts.location) lines.push(`LOCATION:${opts.location.replace(/\n/g, ' ')}`);
  if (opts.description) lines.push(`DESCRIPTION:${opts.description.replace(/\n/g, '\\n')}`);
  for (const email of opts.attendees ?? []) {
    lines.push(`ATTENDEE:MAILTO:${email}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

export async function executeGapTool(
  name: string,
  action: CopilotAction,
  ctx: GapToolContext
): Promise<GapToolExecutionResult> {
  const output = { ...(action.output ?? {}), ...(action.input ?? {}) };
  const app = ctx.app;

  if (name === 'generateInvoicePdf') {
    const { generateInvoicePdf } = await import('../messaging/pdfGenerator');
    const customerName = str(output.customerName) || 'Customer';
    const projectName = str(output.projectName) || 'Project';
    const total = num(output.total) ?? 0;
    const invoiceId = str(output.invoiceId) || `INV-${Date.now()}`;
    const lineItems = Array.isArray(output.lineItems)
      ? (output.lineItems as Array<{ description?: string; amount?: number }>).map((i) => ({
          description: String(i.description ?? 'Item'),
          amount: Number(i.amount ?? 0),
        }))
      : [{ description: 'Amount due', amount: total }];
    try {
      const pdf = await generateInvoicePdf(customerName, projectName, lineItems, total, invoiceId);
      return {
        action: name,
        summary: `Invoice PDF ready (${invoiceId}).`,
        openRoute: '/cynthia',
        output: {
          ...output,
          invoiceId,
          pdfDataUrl: `data:${pdf.mimeType};base64,${pdf.content}`,
          pdfFilename: pdf.filename,
        },
        executed: true,
      };
    } catch (err) {
      return { action: name, summary: err instanceof Error ? err.message : 'Invoice PDF failed.', output, executed: false };
    }
  }

  if (name === 'generateContractPdf') {
    const { generateContractPdf } = await import('../messaging/pdfGenerator');
    const customerName = str(output.customerName) || 'Customer';
    const projectName = str(output.projectName) || 'Project';
    const terms = str(output.terms) || 'Standard terms apply.';
    const total = num(output.total) ?? 0;
    try {
      const pdf = await generateContractPdf(customerName, projectName, terms, total);
      return {
        action: name,
        summary: `Contract PDF ready for ${customerName}.`,
        openRoute: '/cynthia',
        output: {
          ...output,
          pdfDataUrl: `data:${pdf.mimeType};base64,${pdf.content}`,
          pdfFilename: pdf.filename,
        },
        executed: true,
      };
    } catch (err) {
      return { action: name, summary: err instanceof Error ? err.message : 'Contract PDF failed.', output, executed: false };
    }
  }

  if (name === 'sendQuote') {
    const to = str(output.to);
    if (!to) return { action: name, summary: 'Need recipient email (to).', output, executed: false };
    const { generateQuotePdf } = await import('../messaging/pdfGenerator');
    let customerName = str(output.customerName) || 'Customer';
    let total = num(output.total) ?? 0;
    let tradeName = str(output.tradeName);
    let lineItems = Array.isArray(output.lineItems)
      ? (output.lineItems as Array<{ description?: string; amount?: number }>).map((i) => ({
          description: String(i.description ?? 'Item'),
          amount: Number(i.amount ?? 0),
        }))
      : undefined;
    const quoteId = str(output.quoteId);
    if (quoteId && app) {
      const q = app.quotes.find((x) => x.id === quoteId);
      if (q) {
        customerName = q.customerName || customerName;
        total = Number(q.total ?? total);
        tradeName = tradeName || String(q.tradeId ?? '');
        if (!lineItems?.length && Array.isArray(q.lines)) {
          lineItems = q.lines.map((l) => ({
            description: String(l.description ?? 'Item'),
            amount: Number(l.total ?? (Number(l.quantity ?? 1) * Number(l.rate ?? 0))),
          }));
        }
      }
    }
    const pdf = await generateQuotePdf(customerName, total, tradeName, lineItems);
    const subject = str(output.subject) || `Quotation for ${customerName}`;
    const body = str(output.body) || `Please find your quotation attached.\n\nTotal: £${total.toFixed(2)}`;
    const sent = await sendMailWithAttachments(ctx, {
      to,
      subject,
      body,
      connectionId: str(output.connectionId),
      attachments: [{ filename: pdf.filename, mimeType: pdf.mimeType, content: pdf.content }],
    });
    return {
      action: name,
      summary: sent.ok ? `Quote emailed to ${to}.` : sent.summary,
      openRoute: '/cynthia',
      output: { ...output, to, sent: sent.ok, pdfFilename: pdf.filename },
      executed: sent.ok,
    };
  }

  if (name === 'sendInvoice') {
    const to = str(output.to);
    if (!to) return { action: name, summary: 'Need recipient email (to).', output, executed: false };
    const { generateInvoicePdf } = await import('../messaging/pdfGenerator');
    const customerName = str(output.customerName) || 'Customer';
    const projectName = str(output.projectName) || 'Project';
    const total = num(output.total) ?? 0;
    const invoiceId = str(output.invoiceId) || `INV-${Date.now()}`;
    const lineItems = Array.isArray(output.lineItems)
      ? (output.lineItems as Array<{ description?: string; amount?: number }>).map((i) => ({
          description: String(i.description ?? 'Item'),
          amount: Number(i.amount ?? 0),
        }))
      : [{ description: 'Amount due', amount: total }];
    const pdf = await generateInvoicePdf(customerName, projectName, lineItems, total, invoiceId);
    const subject = str(output.subject) || `Invoice ${invoiceId}`;
    const body = str(output.body) || `Please find invoice ${invoiceId} attached.\n\nAmount due: £${total.toFixed(2)}`;
    const sent = await sendMailWithAttachments(ctx, {
      to,
      subject,
      body,
      connectionId: str(output.connectionId),
      attachments: [{ filename: pdf.filename, mimeType: pdf.mimeType, content: pdf.content }],
    });
    return {
      action: name,
      summary: sent.ok ? `Invoice emailed to ${to}.` : sent.summary,
      openRoute: '/projects',
      output: { ...output, to, invoiceId, sent: sent.ok },
      executed: sent.ok,
    };
  }

  if (name === 'closeProject') {
    const projectId = str(output.projectId) || ctx.projectId || undefined;
    const rawStatus = str(output.status);
    const status = rawStatus === 'cancelled' || rawStatus === 'archived' ? 'archived' : rawStatus === 'completed' ? 'completed' : undefined;
    if (!projectId || !status) {
      return { action: name, summary: 'Need projectId and status (completed|archived).', output, executed: false };
    }
    const project = getProject(projectId);
    if (!project) return { action: name, summary: `Project ${projectId} not found.`, output, executed: false };
    const note = str(output.note);
    updateProject(projectId, {
      status,
      archivedAt: status === 'archived' ? new Date().toISOString() : project.archivedAt,
      description: note
        ? `${project.description}\n[Close] ${note}`
        : project.description,
      tasks: project.tasks.map((t) =>
        t.status === 'completed' ? t : { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
      ),
    });
    return {
      action: name,
      summary: `Project marked ${status}.`,
      entityId: projectId,
      openRoute: `/projects/${projectId}`,
      output: { ...output, projectId, status },
      executed: true,
    };
  }

  if (name === 'archiveQuote') {
    if (!app) return { action: name, summary: 'App not ready.', output, executed: false };
    const quoteId = str(output.quoteId);
    if (!quoteId) return { action: name, summary: 'Need quoteId.', output, executed: false };
    const quote = app.quotes.find((q) => q.id === quoteId);
    if (!quote) return { action: name, summary: `Quote ${quoteId} not found.`, output, executed: false };
    app.updateQuote(quoteId, {
      status: 'archived',
      approval: {
        ...(quote.approval ?? { state: 'rejected' as const }),
        note: str(output.reason) || quote.approval?.note || 'Archived',
        at: new Date().toISOString(),
      },
    });
    return {
      action: name,
      summary: `Quote ${quoteId} archived.`,
      entityId: quoteId,
      openRoute: '/quotes',
      output: { ...output, quoteId, status: 'archived' },
      executed: true,
    };
  }

  if (name === 'duplicateQuote') {
    if (!app) return { action: name, summary: 'App not ready.', output, executed: false };
    const quoteId = str(output.quoteId);
    if (!quoteId) return { action: name, summary: 'Need quoteId.', output, executed: false };
    const quote = app.quotes.find((q) => q.id === quoteId);
    if (!quote) return { action: name, summary: `Quote ${quoteId} not found.`, output, executed: false };
    const { id: _id, createdAt: _createdAt, projectId: _projectId, ...rest } = quote;
    const created = app.addQuote({
      ...rest,
      status: 'draft',
      projectId: undefined,
    });
    return {
      action: name,
      summary: `Duplicated as draft quote ${created.id}.`,
      entityId: created.id,
      openRoute: '/quotes',
      output: { ...output, sourceQuoteId: quoteId, quoteId: created.id, status: 'draft' },
      executed: true,
    };
  }

  if (name === 'createReminder' || name === 'schedulePaymentReminder') {
    const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
    const title =
      str(output.title)
      || (name === 'schedulePaymentReminder'
        ? `Payment reminder: ${str(output.stageName) ?? 'stage'}`
        : undefined);
    const dueDate = str(output.dueDate) || str(output.reminderDate);
    if (!title || !dueDate) {
      return { action: name, summary: 'Need title and dueDate/reminderDate.', output, executed: false };
    }
    const reminder = {
      id: `REM-${Date.now()}`,
      title,
      dueDate,
      customerId: str(output.customerId),
      projectId: str(output.projectId) || ctx.projectId,
      stageName: str(output.stageName),
      channel: str(output.channel),
      assignee: str(output.assignee),
      note: str(output.note),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    const list = loadReminders(orgId);
    list.unshift(reminder);
    saveReminders(orgId, list);
    return {
      action: name,
      summary: `Reminder saved for ${dueDate}: ${title}`,
      openRoute: '/cynthia',
      output: { ...output, reminder },
      executed: true,
    };
  }

  if (name === 'mergeCustomers') {
    if (!app) return { action: name, summary: 'App not ready.', output, executed: false };
    const keepId = str(output.keepCustomerId);
    const mergeId = str(output.mergeCustomerId);
    if (!keepId || !mergeId || keepId === mergeId) {
      return { action: name, summary: 'Need distinct keepCustomerId and mergeCustomerId.', output, executed: false };
    }
    const keep = app.customers.find((c) => c.id === keepId);
    const merge = app.customers.find((c) => c.id === mergeId);
    if (!keep || !merge) {
      return { action: name, summary: 'One or both customers not found.', output, executed: false };
    }
    for (const q of app.quotes.filter((x) => x.customerId === mergeId)) {
      app.updateQuote(q.id, { customerId: keepId, customerName: keep.name });
    }
    app.updateCustomer(mergeId, {
      status: 'lost',
      notes: `${merge.notes ? `${merge.notes}\n` : ''}Merged into ${keepId} on ${new Date().toISOString()}`,
    });
    return {
      action: name,
      summary: `Merged ${merge.name} into ${keep.name}.`,
      openRoute: '/customers',
      output: { ...output, keepCustomerId: keepId, mergeCustomerId: mergeId },
      executed: true,
    };
  }

  if (name === 'requestReview') {
    const to = str(output.to);
    const message =
      str(output.message)
      || 'Thanks for choosing us — would you mind leaving a short review of your experience?';
    const channel = str(output.channel) || 'email';
    if (channel === 'email') {
      if (!to) return { action: name, summary: 'Need customer email (to) for review request.', output, executed: false };
      const sent = await sendMailWithAttachments(ctx, {
        to,
        subject: 'How did we do?',
        body: message,
      });
      return {
        action: name,
        summary: sent.ok ? `Review request emailed to ${to}.` : sent.summary,
        output: { ...output, channel, sent: sent.ok },
        executed: sent.ok,
      };
    }
    if (channel === 'sms' && to) {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body: message }),
      });
      const data = await res.json().catch(() => ({}));
      return {
        action: name,
        summary: res.ok ? `Review request SMS queued to ${to}.` : String((data as { error?: string }).error ?? 'SMS failed'),
        output: { ...output, channel, ...(data as object) },
        executed: res.ok,
      };
    }
    return {
      action: name,
      summary: `Review request drafted for ${channel}${to ? ` → ${to}` : ''}.`,
      output: { ...output, channel, message, draft: true },
      executed: true,
    };
  }

  if (name === 'searchEmails') {
    const userId = ctx.userId ?? app?.user?.id ?? 'default-user';
    const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
    const connections = await mailboxService.getConnections(userId, orgId);
    const connectionId = str(output.connectionId) ?? connections[0]?.id;
    if (!connectionId) {
      return { action: name, summary: 'No mailbox connected.', output, executed: false };
    }
    const res = await fetch(`/api/mailbox/search?${new URLSearchParams({
      connectionId,
      query: str(output.query) ?? '',
      from: str(output.from) ?? '',
      dateFrom: str(output.dateFrom) ?? '',
      dateTo: str(output.dateTo) ?? '',
      limit: String(num(output.limit) ?? 20),
      userId,
      orgId,
    })}`);
    const data = await res.json().catch(() => ({})) as { emails?: unknown[]; error?: string; count?: number };
    if (!res.ok) {
      // Fallback: filter recent threads client-side
      const { messages } = await mailboxService.listThreads(connectionId, userId, orgId);
      const q = (str(output.query) ?? '').toLowerCase();
      const from = (str(output.from) ?? '').toLowerCase();
      const filtered = messages.filter((m) => {
        const hay = `${m.subject} ${m.snippet} ${m.fromAddr}`.toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (from && !String(m.fromAddr).toLowerCase().includes(from)) return false;
        return true;
      }).slice(0, num(output.limit) ?? 20);
      return {
        action: name,
        summary: `Found ${filtered.length} email(s) (local filter).`,
        output: { ...output, count: filtered.length, emails: filtered },
        executed: true,
      };
    }
    return {
      action: name,
      summary: `Found ${data.count ?? data.emails?.length ?? 0} email(s).`,
      output: { ...output, ...data },
      executed: true,
    };
  }

  if (name === 'sendSms') {
    const to = str(output.to);
    const body = str(output.body);
    if (!to || !body) return { action: name, summary: 'Need to and body.', output, executed: false };
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; sid?: string; stub?: boolean };
    return {
      action: name,
      summary: res.ok
        ? (data.stub ? `SMS queued (stub) to ${to}.` : `SMS sent to ${to}.`)
        : (data.error ?? 'SMS failed'),
      output: { ...output, ...data },
      executed: res.ok,
    };
  }

  if (name === 'processRefund') {
    const res = await fetch('/api/stripe/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: str(output.paymentIntentId),
        chargeId: str(output.chargeId),
        amount: num(output.amount),
        reason: str(output.reason),
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; refundId?: string };
    return {
      action: name,
      summary: res.ok ? `Refund processed${data.refundId ? ` (${data.refundId})` : ''}.` : (data.error ?? 'Refund failed'),
      output: { ...output, ...data },
      executed: res.ok,
    };
  }

  if (name === 'flagTransaction') {
    const transactionId = str(output.transactionId);
    const reason = str(output.reason);
    if (!transactionId || !reason) {
      return { action: name, summary: 'Need transactionId and reason.', output, executed: false };
    }
    const res = await fetch('/api/banking/flag-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId,
        reason,
        flagType: str(output.flagType) || 'query',
      }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      action: name,
      summary: res.ok ? `Transaction ${transactionId} flagged.` : String((data as { error?: string }).error ?? 'Flag failed'),
      openRoute: '/banking',
      output: { ...output, ...data as object },
      executed: res.ok,
    };
  }

  if (name === 'exportReport') {
    if (!app) return { action: name, summary: 'App not ready.', output, executed: false };
    const reportType = str(output.reportType) || 'leads';
    const format = str(output.format) || 'csv';
    const limit = num(output.limit) ?? 200;
    let rows: Array<Record<string, unknown>> = [];
    if (reportType === 'quotes') {
      rows = app.quotes.slice(0, limit).map((q) => ({
        id: q.id, customer: q.customerName, total: q.total, status: q.status, trade: q.tradeId,
      }));
    } else if (reportType === 'customers' || reportType === 'leads') {
      rows = app.customers
        .filter((c) => reportType === 'customers' || c.status === 'lead')
        .slice(0, limit)
        .map((c) => ({ id: c.id, name: c.name, status: c.status, phone: c.phone, email: c.email }));
    } else if (reportType === 'projects') {
      // Projects live in projectStore; export quote+customer proxy when app.projects unavailable
      rows = app.quotes
        .filter((q) => q.projectId)
        .slice(0, limit)
        .map((q) => ({
          id: q.projectId,
          quoteId: q.id,
          customer: q.customerName,
          status: q.status,
          total: q.total,
        }));
    } else {
      rows = [{ note: 'Open Costing for detailed costs', reportType }];
    }
    if (format === 'markdown') {
      const md = [
        `# ${reportType} report`,
        '',
        ...rows.map((r) => `- ${Object.values(r).join(' · ')}`),
      ].join('\n');
      return {
        action: name,
        summary: `${reportType} report ready (${rows.length} rows).`,
        openRoute: '/cynthia',
        output: { ...output, reportMarkdown: md, count: rows.length },
        executed: true,
      };
    }
    const csv = toCsv(rows);
    const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    return {
      action: name,
      summary: `CSV export ready (${rows.length} ${reportType}).`,
      openRoute: '/cynthia',
      output: { ...output, csvDataUrl: dataUrl, filename: `${reportType}-export.csv`, count: rows.length },
      executed: true,
    };
  }

  if (name === 'manageSubscription') {
    const res = await fetch('/api/stripe/manage-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: str(output.action),
        subscriptionId: str(output.subscriptionId),
        orgId: str(output.orgId),
        newPlanId: str(output.newPlanId),
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
    return {
      action: name,
      summary: res.ok ? (data.message ?? 'Subscription updated.') : (data.error ?? 'Subscription change failed'),
      output: { ...output, ...data },
      executed: res.ok,
    };
  }

  if (name === 'initiatePayment') {
    const res = await fetch('/api/banking/initiate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: num(output.amount),
        beneficiaryName: str(output.beneficiaryName),
        sortCode: str(output.sortCode),
        accountNumber: str(output.accountNumber),
        reference: str(output.reference),
        currency: str(output.currency) || 'GBP',
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; paymentId?: string; authUrl?: string };
    return {
      action: name,
      summary: res.ok
        ? `Payment initiated${data.paymentId ? ` (${data.paymentId})` : ''}.`
        : (data.error ?? 'Payment initiation failed'),
      output: { ...output, ...data },
      executed: res.ok,
    };
  }

  if (name === 'bulkUpdateLeadStatus') {
    if (!app) return { action: name, summary: 'App not ready.', output, executed: false };
    const ids = Array.isArray(output.customerIds) ? output.customerIds.map(String) : [];
    const status = str(output.status);
    if (!ids.length || !status) {
      return { action: name, summary: 'Need customerIds[] and status.', output, executed: false };
    }
    let updated = 0;
    for (const id of ids) {
      const c = app.customers.find((x) => x.id === id);
      if (!c) continue;
      app.updateCustomer(id, {
        status: status as 'lead' | 'quoted' | 'won' | 'lost',
        notes: str(output.note)
          ? `${c.notes ? `${c.notes}\n` : ''}${str(output.note)}`
          : c.notes,
      });
      updated += 1;
    }
    return {
      action: name,
      summary: `Updated ${updated} lead(s) to ${status}.`,
      openRoute: '/customers',
      output: { ...output, updated },
      executed: updated > 0,
    };
  }

  if (name === 'scheduleRecurringJob') {
    const projectId = str(output.projectId) || ctx.projectId || undefined;
    const cadence = str(output.cadence);
    const scope = str(output.scope);
    if (!projectId || !cadence || !scope) {
      return { action: name, summary: 'Need projectId, cadence, and scope.', output, executed: false };
    }
    const project = getProject(projectId);
    if (!project) return { action: name, summary: `Project ${projectId} not found.`, output, executed: false };
    updateProject(projectId, {
      // Store recurring schedule in description trailer if field unsupported — keep typed via cast
      description: `${project.description}\n[Recurring ${cadence}] ${scope}${str(output.nextDate) ? ` next=${str(output.nextDate)}` : ''}`,
    });
    return {
      action: name,
      summary: `Recurring ${cadence} job noted on project.`,
      entityId: projectId,
      openRoute: `/projects/${projectId}`,
      output: { ...output, projectId, cadence, scope },
      executed: true,
    };
  }

  if (name === 'sendWhatsAppTemplate') {
    const to = str(output.to);
    const templateName = str(output.templateName);
    if (!to || !templateName) {
      return { action: name, summary: 'Need to and templateName.', output, executed: false };
    }
    const res = await fetch('/api/messages/whatsapp-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        templateName,
        templateParams: Array.isArray(output.templateParams) ? output.templateParams : [],
        language: str(output.language) || 'en_GB',
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    return {
      action: name,
      summary: res.ok ? `WhatsApp template ${templateName} sent to ${to}.` : (data.error ?? 'WhatsApp template failed'),
      output: { ...output, ...data },
      executed: res.ok,
    };
  }

  if (name === 'sendWhatsAppMedia') {
    const to = str(output.to);
    const mediaUrl = str(output.mediaUrl);
    const mediaType = str(output.mediaType) || 'document';
    if (!to || !mediaUrl) {
      return { action: name, summary: 'Need to and mediaUrl.', output, executed: false };
    }
    const res = await fetch('/api/messages/whatsapp-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        mediaUrl,
        mediaType,
        caption: str(output.caption),
        filename: str(output.filename),
      }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    return {
      action: name,
      summary: res.ok ? `WhatsApp ${mediaType} sent to ${to}.` : (data.error ?? 'WhatsApp media failed'),
      output: { ...output, ...data },
      executed: res.ok,
    };
  }

  if (name === 'createCalendarEvent') {
    const title = str(output.title);
    const start = str(output.start);
    const end = str(output.end);
    if (!title || !start || !end) {
      return { action: name, summary: 'Need title, start, and end.', output, executed: false };
    }
    const attendees = Array.isArray(output.attendees) ? output.attendees.map(String) : [];
    const ics = buildIcs({
      title,
      start,
      end,
      location: str(output.location),
      description: str(output.description),
      attendees,
    });
    const b64 = btoa(unescape(encodeURIComponent(ics)));
    const sendTo = str(output.sendEmailTo) || attendees[0];
    let emailed = false;
    if (sendTo) {
      const sent = await sendMailWithAttachments(ctx, {
        to: sendTo,
        subject: `Invite: ${title}`,
        body: str(output.description) || `Calendar invite attached for ${title}.`,
        attachments: [{ filename: 'invite.ics', mimeType: 'text/calendar', content: b64 }],
      });
      emailed = sent.ok;
    }
    return {
      action: name,
      summary: emailed ? `Calendar invite emailed to ${sendTo}.` : 'Calendar .ics ready.',
      openRoute: '/cynthia',
      output: {
        ...output,
        icsDataUrl: `data:text/calendar;base64,${b64}`,
        icsFilename: 'invite.ics',
        emailed,
      },
      executed: true,
    };
  }

  if (name === 'manageFiles') {
    const projectId = str(output.projectId) || ctx.projectId || undefined;
    const fileAction = str(output.action) || 'list';
    if (!projectId) return { action: name, summary: 'Need projectId.', output, executed: false };
    const project = getProject(projectId);
    if (!project) return { action: name, summary: `Project ${projectId} not found.`, output, executed: false };
    const files = [...project.files];
    if (fileAction === 'list') {
      return {
        action: name,
        summary: `${files.length} file(s) on project.`,
        openRoute: `/projects/${projectId}`,
        output: { ...output, projectId, files },
        executed: true,
      };
    }
    if (fileAction === 'delete') {
      const fileId = str(output.fileId);
      const fileName = str(output.fileName);
      const next = files.filter((f) => {
        if (fileId && f.id === fileId) return false;
        if (fileName && f.filename === fileName) return false;
        return true;
      });
      if (next.length === files.length) {
        return { action: name, summary: 'File not found.', output, executed: false };
      }
      updateProject(projectId, { files: next });
      return {
        action: name,
        summary: 'File removed from project.',
        entityId: projectId,
        openRoute: `/projects/${projectId}`,
        output: { ...output, projectId, remaining: next.length },
        executed: true,
      };
    }
    return { action: name, summary: 'Unsupported file action (use list|delete).', output, executed: false };
  }

  if (name === 'draftSupplierOrder') {
    const supplierName = str(output.supplierName);
    const items = Array.isArray(output.items) ? output.items as Array<Record<string, unknown>> : [];
    if (!supplierName || !items.length) {
      return { action: name, summary: 'Need supplierName and items[].', output, executed: false };
    }
    const lines = items.map((i) => {
      const qty = Number(i.quantity ?? 1);
      const unit = String(i.unit ?? '');
      return `• ${qty}${unit ? ` ${unit}` : ''} × ${String(i.description ?? 'Item')}`;
    });
    const body = [
      `Supplier order for ${supplierName}`,
      str(output.deliveryAddress) ? `Delivery: ${str(output.deliveryAddress)}` : '',
      str(output.projectId) ? `Project: ${str(output.projectId)}` : '',
      '',
      ...lines,
    ].filter(Boolean).join('\n');
    const email = str(output.supplierEmail);
    const shouldSend = Boolean(output.send) && Boolean(email);
    if (shouldSend && email) {
      const sent = await sendMailWithAttachments(ctx, {
        to: email,
        subject: `Materials order — ${supplierName}`,
        body,
      });
      return {
        action: name,
        summary: sent.ok ? `Order emailed to ${email}.` : sent.summary,
        output: { ...output, draftBody: body, sent: sent.ok },
        executed: sent.ok,
      };
    }
    return {
      action: name,
      summary: `Supplier order draft for ${supplierName} (${items.length} lines).`,
      openRoute: '/cynthia',
      output: { ...output, draftBody: body, draftMarkdown: body },
      executed: true,
    };
  }

  return { action: name, summary: `Unhandled gap tool: ${name}`, output, executed: false };
}
