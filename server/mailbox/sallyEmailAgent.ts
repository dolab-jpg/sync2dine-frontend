/**
 * Sync2Dine Sally inbound email agent ù handles all home-org mailbox traffic.
 * Auto-sends replies from offer KB (no staff confirm). Large contracts ? callback request only.
 */
import { handleOrchestrator } from '../orchestrator-handler';
import type { OrchestratorRequest } from '../orchestrator-types';
import { executeChannelActions } from '../channel-action-executor';
import { getDataStore } from '../data-store';
import { getSallyOfferTerms } from '../sally-sales';
import { speechContactName } from '../contact-display-name';
import type { CachedEmailMessage } from './types';
import {
  addInboxItem,
  isMessageProcessed,
  markInboxNotified,
  markMessageProcessed,
  notifyStaff,
  type LeadInboxItem,
} from '../leads/leadInboxStore';
import { executeMailboxTool } from '../mailbox-routes';

export type SallyEmailAgentResult = {
  inboxItem: LeadInboxItem;
  skipped?: boolean;
  sent?: boolean;
};

function extractEmailBody(message: CachedEmailMessage): string {
  if (message.textBody?.trim()) return message.textBody.trim();
  if (message.htmlBody?.trim()) {
    return message.htmlBody
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return message.snippet ?? '';
}

function offerFactsForPrompt(): string {
  try {
    const t = getSallyOfferTerms();
    return [
      'SYNC2DINE OFFER FACTS (authoritative ù do not invent prices):',
      JSON.stringify(t, null, 0).slice(0, 3500),
    ].join('\n');
  } catch {
    return 'SYNC2DINE OFFER FACTS: use getOfferTerms / known public Sync2Dine pricing only ù never invent.';
  }
}

function buildSallyEmailPrompt(knownName: string): string {
  return [
    'You are Sally, Sync2Dine sales AI (email). You work for Sync2Dine (sync2dine.io). Never say you are Cyrus, Cynthia, Judie, Lizzie, or Builder Diddies.',
    'You own ALL inbound email to this Sync2Dine mailbox. Deal with every message: sales enquiries, pricing, demos, support about Sync2Dine products, spam (ignore politely).',
    offerFactsForPrompt(),
    'WORKFLOW:',
    '1. Classify the email (sales lead, existing customer, spam/newsletter, large-contract/enterprise signup).',
    '2. searchLeads/searchCustomers then saveCustomer/linkCustomer when this is a real prospect (status lead, source email).',
    '3. For normal sales/support: compose a British English reply from offer facts and call sendEmailReply (to, subject, body). You MAY send without staff approval.',
    '4. For LARGE CONTRACT / enterprise / complex multi-site signup: do NOT close the deal by email alone. sendEmailReply explaining someone from Sync2Dine will call them back. escalateToStaff or logFollowUp. Never invent a transfer.',
    '5. Spam/newsletters: no CRM save, no send ù say so in your summary.',
    knownName
      ? `6. Known contact name: ${knownName} ù greet them by name in the reply.`
      : '6. Unknown sender ù greet normally without a placeholder name (never Guest/Unknown).',
    'End with a one-line staff summary of what you did.',
  ].join('\n');
}

function buildStaffContext(orgId: string): OrchestratorRequest['staffContext'] {
  const store = getDataStore(orgId);
  return {
    role: 'staff',
    userId: 'sally-email-agent',
    userName: 'Sally',
    customers: store.customers.slice(0, 50).map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      email: String(c.email ?? ''),
      phone: String(c.phone ?? ''),
      status: String(c.status ?? ''),
      source: c.source ? String(c.source) : undefined,
      notes: c.notes ? String(c.notes) : undefined,
    })),
    quotes: (store.quotes ?? []).slice(0, 30).map((q) => ({
      id: String(q.id ?? ''),
      customerId: String(q.customerId ?? ''),
      customerName: String(q.customerName ?? ''),
      total: Number(q.total ?? 0),
      status: String(q.status ?? ''),
    })),
  };
}

function extractCustomerIdFromResults(
  results: Array<{ action: string; executed: boolean; output: Record<string, unknown> }>,
): string | undefined {
  for (const r of results) {
    if (!r.executed) continue;
    if (r.action === 'saveCustomer' || r.action === 'linkCustomer') {
      const id = r.output.customerId ?? r.output.id;
      if (id) return String(id);
    }
  }
  return undefined;
}

function extractSentReply(
  results: Array<{ action: string; executed: boolean; output: Record<string, unknown> }>,
): LeadInboxItem['draftReply'] | undefined {
  for (const r of results) {
    if (r.action !== 'sendEmailReply' && r.action !== 'draftEmailReply') continue;
    const to = String(r.output.to ?? '');
    const subject = String(r.output.subject ?? '');
    const body = String(r.output.body ?? '');
    if (to && body) return { to, subject, body };
  }
  return undefined;
}

export async function runSallyEmailAgent(
  message: CachedEmailMessage,
  orgId: string,
  knownName = '',
): Promise<SallyEmailAgentResult> {
  const msgKey = message.messageId || message.id;
  if (isMessageProcessed(msgKey)) {
    return {
      inboxItem: {
        id: '',
        orgId,
        messageId: msgKey,
        emailCacheId: message.id,
        subject: message.subject,
        fromAddr: message.fromAddr,
        summary: 'Already processed',
        recommendation: 'No action',
        status: 'skipped',
        toolsUsed: [],
        createdAt: new Date().toISOString(),
      },
      skipped: true,
    };
  }

  const body = extractEmailBody(message);
  const safeName = speechContactName(knownName || message.fromName);
  const emailContent = [
    `From: ${message.fromName ?? message.fromAddr} <${message.fromAddr}>`,
    `Subject: ${message.subject}`,
    `Received: ${message.receivedAt}`,
    '',
    body.slice(0, 8000),
  ].join('\n');

  let summary = `Sally handled: ${message.subject}`;
  let recommendation = 'Sally auto-replied or triaged';
  let status: LeadInboxItem['status'] = 'action_required';
  let toolsUsed: string[] = [];
  let customerId: string | undefined;
  let draftReply: LeadInboxItem['draftReply'];
  let sent = false;

  try {
    const orchestratorBody: OrchestratorRequest = {
      messages: [{ role: 'user', content: emailContent }],
      orchestratorMode: 'sally',
      channel: 'overlay_chat',
      systemPrompt: buildSallyEmailPrompt(safeName),
      staffContext: buildStaffContext(orgId),
      aiStudio: { autonomyLevel: 'autopilot' },
    };

    const result = await handleOrchestrator(orchestratorBody);
    const allActions = [...result.proposedActions, ...(result.autoActions ?? [])];

    const enriched = allActions.map((a) => {
      if (a.action === 'sendEmailReply' || a.action === 'sendEmailWithAttachment') {
        return {
          ...a,
          input: {
            ...a.input,
            confirmed: true,
            fromSally: true,
            connectionId: message.connectionId,
            orgId,
            to: a.input.to || message.fromAddr,
          },
        };
      }
      return a;
    });

    const standardResults = await executeChannelActions(enriched, {
      role: 'staff',
      orgId,
      approvedBy: 'Sally',
      orchestratorBody,
      skipConfirm: true,
    });

    // Fallback: if model drafted but channel write failed org resolution, send directly
    const sendAttempt = enriched.find((a) => a.action === 'sendEmailReply');
    const sendOk = standardResults.some((r) => r.action === 'sendEmailReply' && r.executed);
    if (sendAttempt && !sendOk) {
      const direct = await executeMailboxTool(
        'sendEmailReply',
        {
          ...sendAttempt.input,
          confirmed: true,
          connectionId: message.connectionId,
          to: String(sendAttempt.input.to || message.fromAddr),
          subject: String(sendAttempt.input.subject || `Re: ${message.subject}`),
          body: String(sendAttempt.input.body || ''),
        },
        orgId,
        'sally-email-agent',
      );
      if (!direct.error) {
        sent = true;
        standardResults.push({
          action: 'sendEmailReply',
          executed: true,
          summary: 'Sent via mailbox fallback',
          output: direct,
        });
      }
    } else if (sendOk) {
      sent = true;
    }

    toolsUsed = standardResults.filter((r) => r.executed).map((r) => r.action);
    customerId = extractCustomerIdFromResults(standardResults);
    draftReply = extractSentReply(standardResults);

    if (result.content) {
      summary = result.content.split('\n')[0].slice(0, 200) || summary;
    }
    status = sent ? 'handled' : toolsUsed.length ? 'action_required' : 'handled';
    recommendation = sent
      ? 'Sally sent email reply'
      : 'Sally triaged ó review Lead Inbox if needed';
  } catch (err) {
    console.error('[sallyEmailAgent]', err);
    summary = `Sally email agent error: ${err instanceof Error ? err.message : 'unknown'}`;
    recommendation = 'Staff review required';
    status = 'action_required';
  }

  markMessageProcessed(msgKey);
  const inboxItem = addInboxItem({
    orgId,
    messageId: msgKey,
    emailCacheId: message.id,
    subject: message.subject,
    fromAddr: message.fromAddr,
    fromName: message.fromName,
    summary,
    recommendation,
    status,
    toolsUsed,
    customerId,
    customerName: safeName || undefined,
    draftReply,
  });

  try {
    if (status === 'action_required') {
      await notifyStaff(orgId, summary, customerId, 'normal');
      markInboxNotified(inboxItem.id);
    }
  } catch {
    /* notify is best-effort */
  }

  return { inboxItem, sent };
}
