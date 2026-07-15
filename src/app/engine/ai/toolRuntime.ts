import { autoSendReceiptAfterMarkPaid, sendReceiptForStage } from '../banking/paymentReceiptService';
import type { AppContextType, ExtraItem, LabourItem, QuoteItem, QuoteLine } from '../../App';
import type { TradeId } from '../../config/types';
import { getTrade, isValidTradeId } from '../../config/trades';
import type { CopilotAction } from './orchestratorService';
import {
  applyProjectAction,
  fillQuoteFields,
  isProjectAction,
  navigate as navigateToRoute,
  searchCustomers,
  searchProjects,
  searchQuotes,
  type FillQuoteFieldsHandlers,
  type SearchResult,
} from './actionExecutor';
import { executeForemanAutoAction } from './foremanExecutor';
import { approveChangeOrderForCustomer } from '../projectAi/projectAiService';
import { notifyCustomerChangeOrder } from './foremanExecutor';
import { requiresSafetyConfirm } from './actionPolicy';
import { executeWriteData, type WriteDataInput } from './dataAccess';
import type { DataPolicyContext } from './dataPolicy';
import type { AgentRole } from './agentContext';
import { createProjectFromQuote, syncToServer } from '../project/projectStore';
import { priceSmallJob } from '../pricing/smallJobsService';
import { generatePaymentSchedule } from '../contracts/contractAiService';
import { saveContract as saveContractRecord, getContract } from '../contracts/contractStore';
import { sendContractEmail } from '../contracts/contractSend';
import { getContractTemplate } from '../contracts/contractTemplateStore';
import type { PaymentStage } from '../contracts/types';
import { renderTemplate, formatPaymentSchedule, formatJobLineItems } from '../messaging/templateRenderer';
import { messagingHub } from '../messaging/messagingHub';
import { integrationService } from '../integrations/integrationService';
import { getOfficeTeamRoster, getTopPerformer } from '../team/teamSnapshot';
import { getProject, updateProject } from '../project/projectStore';
import { isPlanningAction } from '../planning/planningActionNames';
import { executePlanningActions } from '../planning/planningAiService';
import { mailboxService } from '../mailbox/mailboxService';

export interface ToolRuntimeContext {
  app: AppContextType | null;
  navigate: NavigateFunction;
  projectId?: string | null;
  planningApplicationId?: string | null;
  tradeId?: TradeId | null;
  approvedBy?: string;
  role?: AgentRole;
  userId?: string | null;
  customerId?: string | null;
  builderId?: string | null;
  quoteHandlers: FillQuoteFieldsHandlers;
  onDetectedTrades?: (trades: Array<{ tradeId: TradeId; confidence: number }>) => void;
}

export interface ToolExecutionResult {
  action: string;
  summary: string;
  openRoute?: string;
  entityLabel?: string;
  entityId?: string;
  output: Record<string, unknown>;
  executed: boolean;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Map save* aliases and legacy propose* names to canonical executors. */
export function normalizeToolAction(action: string): string {
  const aliases: Record<string, string> = {
    saveCustomer: 'linkCustomer',
    savePaymentPlan: 'proposePaymentPlan',
    saveProjectSchedule: 'proposeSchedule',
  };
  return aliases[action] ?? action;
}

function buildQuoteRoute(tradeId?: string, customerId?: string): string {
  const trade = tradeId && isValidTradeId(tradeId) ? tradeId : '';
  const customer = customerId ?? '';
  return `/quote/${trade}/${customer}`.replace(/\/+$/, '');
}

function parseLineItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = readOptionalString(row.name) ?? readOptionalString(row.description) ?? `Item ${index + 1}`;
      const quantity = readOptionalNumber(row.quantity) ?? 1;
      const price = readOptionalNumber(row.price) ?? readOptionalNumber(row.unitPrice) ?? 0;
      const total = readOptionalNumber(row.total) ?? quantity * price;
      return {
        productId: readOptionalString(row.productId) ?? `ai-${index}`,
        name,
        quantity,
        price,
        total,
      };
    })
    .filter((item): item is QuoteItem => Boolean(item));
}

function parseLabourItems(raw: unknown): LabourItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const description = readOptionalString(row.description) ?? 'Labour';
      const rate = readOptionalNumber(row.rate) ?? 0;
      const total = readOptionalNumber(row.total) ?? rate;
      const rateType = (readOptionalString(row.rateType) ?? 'fixed') as LabourItem['rateType'];
      return {
        description,
        days: readOptionalNumber(row.days),
        area: readOptionalNumber(row.area),
        quantity: readOptionalNumber(row.quantity),
        rateType,
        rate,
        total,
      };
    })
    .filter((item): item is LabourItem => Boolean(item));
}

function parseExtraItems(raw: unknown): ExtraItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        description: readOptionalString(row.description) ?? 'Extra',
        price: readOptionalNumber(row.price) ?? 0,
      };
    })
    .filter((item): item is ExtraItem => Boolean(item));
}

function summariseSearch(label: string, results: SearchResult[]): string {
  if (results.length === 0) return `No ${label} found.`;
  const preview = results.slice(0, 3).map((r) => r.title).join(', ');
  return `${label}: ${preview}${results.length > 3 ? '…' : ''}`;
}

function buildDefaultPaymentStages(total: number) {
  const defs = [
    { name: 'Booking Deposit', percentage: 10, notes: 'Secures start date' },
    { name: 'Project Start', percentage: 40, notes: 'Released when work begins' },
    { name: 'Mid-point', percentage: 30, notes: 'At 50% completion' },
    { name: 'Completion', percentage: 20, notes: 'On sign-off' },
  ];
  return defs.map((d) => ({
    ...d,
    amount: Math.round((total * d.percentage) / 100),
  }));
}

function findQuoteForConversion(
  app: NonNullable<ToolRuntimeContext['app']>,
  output: Record<string, unknown>
) {
  const quoteId = readOptionalString(output.quoteId);
  if (quoteId) {
    return app.quotes.find((q) => q.id === quoteId);
  }
  const customerName = readOptionalString(output.customerName);
  if (customerName) {
    const lower = customerName.toLowerCase();
    return app.quotes.find((q) => q.customerName.toLowerCase().includes(lower))
      ?? app.quotes.find((q) => lower.includes(q.customerName.toLowerCase().split(' ')[0] ?? ''));
  }
  return undefined;
}

function executeConvertQuoteToProject(
  output: Record<string, unknown>,
  ctx: ToolRuntimeContext
): ToolExecutionResult {
  const { app } = ctx;
  if (!app) {
    return { action: 'convertQuoteToProject', summary: 'App not ready.', output, executed: false };
  }
  const quote = findQuoteForConversion(app, output);
  if (!quote) {
    return {
      action: 'convertQuoteToProject',
      summary: 'Could not find a matching quote — check customer name or quote id.',
      output,
      executed: false,
    };
  }
  const customer = app.customers.find((c) => c.id === quote.customerId);
  if (!customer) {
    return {
      action: 'convertQuoteToProject',
      summary: `Customer record missing for ${quote.customerName}.`,
      output,
      executed: false,
    };
  }
  if (quote.projectId) {
    const existingId = quote.projectId;
    return {
      action: 'convertQuoteToProject',
      summary: `Project already exists for this quote (${existingId}).`,
      entityId: existingId,
      openRoute: `/projects/${existingId}`,
      output: { ...output, projectId: existingId, quoteId: quote.id },
      executed: true,
    };
  }
  if (output.markQuoteAccepted !== false && quote.status !== 'accepted') {
    app.updateQuote(quote.id, { status: 'accepted' });
  }
  const project = createProjectFromQuote(quote, customer);
  app.updateQuote(quote.id, { status: 'accepted', projectId: project.id });
  syncToServer();

  const withPlan = output.withPaymentPlan === true;
  let planNote = '';
  if (withPlan) {
    const stages = buildDefaultPaymentStages(project.totalCustomerCost);
    applyProjectAction(project.id, 'proposePaymentPlan', { stages, projectId: project.id }, ctx.approvedBy ?? 'TradePro AI');
    planNote = ' Default payment plan applied (10/40/30/20).';
  }

  return {
    action: 'convertQuoteToProject',
    summary: `Created project ${project.id} for ${quote.customerName}.${planNote}`,
    entityLabel: project.projectName,
    entityId: project.id,
    openRoute: `/projects/${project.id}`,
    output: { ...output, projectId: project.id, quoteId: quote.id },
    executed: true,
  };
}

function executeLinkCustomer(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) {
    return { action: 'linkCustomer', summary: 'Customer save failed — app not ready.', output, executed: false };
  }
  const trades = (output.interestedTrades as TradeId[]) ?? (ctx.tradeId ? [ctx.tradeId] : []);
  if (output.customerId && typeof output.customerId === 'string') {
    app.updateCustomer(output.customerId, { interestedTrades: trades });
    const existing = app.customers.find((c) => c.id === output.customerId);
    return {
      action: 'linkCustomer',
      summary: `Updated customer ${existing?.name ?? output.customerId}.`,
      entityLabel: existing?.name ?? String(output.customerId),
      entityId: output.customerId,
      openRoute: '/crm',
      output,
      executed: true,
    };
  }
  const name = readOptionalString(output.name);
  if (!name) {
    return { action: 'linkCustomer', summary: 'Customer name missing — not saved.', output, executed: false };
  }
  const created = app.addCustomer({
    name,
    email: String(output.email ?? ''),
    phone: String(output.phone ?? ''),
    address: String(output.address ?? ''),
    status: 'lead',
    notes: 'Created via TradePro AI',
    photos: [],
    interestedTrades: trades,
    whatsappOptIn: false,
    preferredChannel: 'email',
  });
  return {
    action: 'linkCustomer',
    summary: `Saved customer ${created.name}.`,
    entityLabel: created.name,
    entityId: created.id,
    openRoute: '/crm',
    output: { ...output, customerId: created.id },
    executed: true,
  };
}

function executeSaveQuote(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) {
    return { action: 'saveQuote', summary: 'Quote save failed — app not ready.', output, executed: false };
  }
  const tradeId = readOptionalString(output.tradeId);
  if (!tradeId || !isValidTradeId(tradeId)) {
    return { action: 'saveQuote', summary: 'Quote needs a valid tradeId.', output, executed: false };
  }
  let customerId = readOptionalString(output.customerId);
  let customerName = readOptionalString(output.customerName);
  if (!customerId) {
    customerName = customerName ?? readOptionalString(output.name);
    const match = customerName
      ? app.customers.find((c) => c.name.toLowerCase().includes(customerName!.toLowerCase()))
      : undefined;
    customerId = match?.id;
    customerName = match?.name ?? customerName;
  } else {
    customerName = customerName ?? app.customers.find((c) => c.id === customerId)?.name ?? 'Customer';
  }
  if (!customerId || !customerName) {
    return { action: 'saveQuote', summary: 'Quote needs a customer — save or link customer first.', output, executed: false };
  }

  const items = parseLineItems(output.items);
  const labour = parseLabourItems(output.labour);
  const extras = parseExtraItems(output.extras);
  const computedTotal =
    readOptionalNumber(output.total)
    ?? items.reduce((s, i) => s + i.total, 0)
    + labour.reduce((s, i) => s + i.total, 0)
    + extras.reduce((s, i) => s + i.price, 0);
  const discount = readOptionalNumber(output.discount) ?? 0;
  const total = Math.max(0, computedTotal - discount);
  const status = (readOptionalString(output.status) ?? 'draft') as Quote['status'];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  const quotesBefore = app.quotes.length;

  app.addQuote({
    tradeId,
    tradeName: getTrade(tradeId).name,
    customerId,
    customerName,
    expiresAt: expiresAt.toISOString(),
    items,
    labour,
    extras,
    discount,
    total,
    status,
    wizardAnswers: (output.wizardAnswers as Record<string, unknown>) ?? undefined,
    aiAcceptedFields: (output.wizardAnswers as Record<string, unknown>) ?? undefined,
    jobGroupId: readOptionalString(output.jobGroupId),
  });
  const quoteId = app.quotes[quotesBefore]?.id ?? String(quotesBefore + 1);
  const openAfter = output.openQuote !== false;
  const route = `${buildQuoteRoute(tradeId, customerId)}?prefill=ai`;

  if (output.prefillFields || output.fields) {
    fillQuoteFields(output, { ...ctx.quoteHandlers, openQuoteAfterFill: false });
  }

  if (openAfter && ctx.quoteHandlers.navigate) {
    ctx.quoteHandlers.navigate(route);
  }

  return {
    action: 'saveQuote',
    summary: `Saved ${status} quote for ${customerName} — £${total.toLocaleString('en-GB')} (${getTrade(tradeId).name}).`,
    entityLabel: `${quoteId} • ${customerName}`,
    entityId: quoteId,
    openRoute: route,
    output: { ...output, quoteId, customerId, total },
    executed: true,
  };
}

function executeUpdateQuote(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) {
    return { action: 'updateQuote', summary: 'Quote update failed.', output, executed: false };
  }
  const quoteId = readOptionalString(output.quoteId);
  const quote = quoteId
    ? app.quotes.find((q) => q.id === quoteId)
    : app.quotes[app.quotes.length - 1];
  if (!quote) {
    return { action: 'updateQuote', summary: 'No quote found to update.', output, executed: false };
  }
  const patch: Record<string, unknown> = {};
  if (output.items) patch.items = parseLineItems(output.items);
  if (output.labour) patch.labour = parseLabourItems(output.labour);
  if (output.extras) patch.extras = parseExtraItems(output.extras);
  if (output.total !== undefined) patch.total = readOptionalNumber(output.total);
  if (output.status) patch.status = output.status;
  app.updateQuote(quote.id, patch);
  return {
    action: 'updateQuote',
    summary: `Updated quote ${quote.id}.`,
    entityLabel: quote.id,
    entityId: quote.id,
    openRoute: '/quotes',
    output: { ...output, quoteId: quote.id },
    executed: true,
  };
}

function executeStartQuote(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const tradeId = readOptionalString(output.tradeId) ?? ctx.tradeId ?? undefined;
  if (!tradeId || !isValidTradeId(tradeId)) {
    return { action: 'startQuote', summary: 'Need a trade to open quote.', output, executed: false };
  }
  fillQuoteFields(
    { ...output, tradeId },
    { ...ctx.quoteHandlers, openQuoteAfterFill: true }
  );
  const route = `${buildQuoteRoute(tradeId, readOptionalString(output.customerId))}?prefill=ai`;
  return {
    action: 'startQuote',
    summary: `Opened ${getTrade(tradeId).name} quote wizard.`,
    openRoute: route,
    output,
    executed: true,
  };
}

function executeProposeQuoteFields(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const filled = fillQuoteFields(output, { ...ctx.quoteHandlers, openQuoteAfterFill: false });
  const tradeId = readOptionalString(output.tradeId);
  return {
    action: 'proposeQuoteFields',
    summary: filled
      ? `Staged quote fields${tradeId ? ` for ${tradeId}` : ''}.`
      : 'Quote fields prepared.',
    output,
    executed: filled,
  };
}

function executeProjectAction(
  action: string,
  output: Record<string, unknown>,
  ctx: ToolRuntimeContext
): ToolExecutionResult {
  const projectId = readOptionalString(output.projectId) ?? ctx.projectId;
  if (!projectId) {
    return { action, summary: `${action} needs an open project.`, output, executed: false };
  }
  const approvedBy = ctx.approvedBy ?? 'TradePro AI';
  const createdChangeOrderId = applyProjectAction(projectId, action, output, approvedBy);
  if (action === 'proposeChangeOrder' && createdChangeOrderId) {
    approveChangeOrderForCustomer(projectId, createdChangeOrderId, approvedBy);
    void notifyCustomerChangeOrder(projectId, createdChangeOrderId);
  }
  const labels: Record<string, string> = {
    proposePaymentPlan: 'Payment plan saved',
    proposeSchedule: 'Schedule saved',
    proposePlan: 'Plan saved',
    draftInvoice: 'Invoice draft saved',
    draftContract: 'Contract draft saved',
    proposeChangeOrder: 'Change order saved',
    recordCostEntry: 'Cost entry recorded',
    fixCostEntry: 'Cost entry fixed',
    logHours: 'Hours logged',
    correctTimesheet: 'Timesheet corrected',
  };
  return {
    action,
    summary: labels[action] ?? `${action} applied to project.`,
    entityLabel: projectId,
    entityId: projectId,
    openRoute: `/projects`,
    output,
    executed: true,
  };
}

function resolveCustomerFromOutput(
  app: NonNullable<ToolRuntimeContext['app']>,
  output: Record<string, unknown>
) {
  const customerId = readOptionalString(output.customerId);
  if (customerId) {
    const byId = app.customers.find((c) => c.id === customerId);
    if (byId) return byId;
  }
  const name = readOptionalString(output.customerName) ?? readOptionalString(output.name);
  if (name) {
    const lower = name.toLowerCase();
    return app.customers.find((c) => c.name.toLowerCase().includes(lower));
  }
  return undefined;
}

async function executePriceSmallJob(output: Record<string, unknown>, ctx: ToolRuntimeContext): Promise<ToolExecutionResult> {
  const { app } = ctx;
  if (!app) return { action: 'priceSmallJob', summary: 'App not ready.', output, executed: false };
  const rawTasks = Array.isArray(output.tasks)
    ? (output.tasks as unknown[]).map(String).join('\n')
    : readOptionalString(output.tasks) ?? readOptionalString(output.taskList) ?? '';
  if (!rawTasks.trim()) {
    return { action: 'priceSmallJob', summary: 'Provide a task list to price.', output, executed: false };
  }
  const customer = resolveCustomerFromOutput(app, output);
  const draft = await priceSmallJob(rawTasks, {
    tradeName: readOptionalString(output.tradeName) ?? 'Small Jobs',
    postcode: readOptionalString(output.postcode) ?? customer?.address,
  });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  const before = app.quotes.length;
  app.addQuote({
    customerId: customer?.id ?? '',
    customerName: customer?.name ?? readOptionalString(output.customerName) ?? 'Customer',
    tradeName: 'Small Jobs',
    expiresAt: expiresAt.toISOString(),
    items: draft.items,
    labour: [],
    extras: draft.extras,
    discount: 0,
    total: draft.total,
    status: 'awaiting_approval',
    pricingResearch: draft.pricingResearch,
    approval: { state: 'pending', originalTotal: draft.total },
  });
  const quoteId = app.quotes[before]?.id ?? String(before + 1);
  return {
    action: 'priceSmallJob',
    summary: `Priced ${draft.items.length} task(s) at £${draft.total.toLocaleString('en-GB')} — sent to the approval queue.`,
    entityId: quoteId,
    openRoute: '/approvals',
    output: { ...output, quoteId, total: draft.total },
    executed: true,
  };
}

function executeSubmitForApproval(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) return { action: 'submitForApproval', summary: 'App not ready.', output, executed: false };
  const quoteId = readOptionalString(output.quoteId);
  const quote = quoteId ? app.quotes.find((q) => q.id === quoteId) : app.quotes[app.quotes.length - 1];
  if (!quote) return { action: 'submitForApproval', summary: 'No quote found to submit.', output, executed: false };
  app.updateQuote(quote.id, {
    status: 'awaiting_approval',
    approval: { state: 'pending', originalTotal: quote.total },
  });
  return {
    action: 'submitForApproval',
    summary: `Quote for ${quote.customerName} submitted for approval.`,
    entityId: quote.id,
    openRoute: '/approvals',
    output: { ...output, quoteId: quote.id },
    executed: true,
  };
}

function executeApproveQuote(output: Record<string, unknown>, ctx: ToolRuntimeContext, approved: boolean): ToolExecutionResult {
  const action = approved ? 'approveQuote' : 'rejectQuote';
  const { app } = ctx;
  if (!app) return { action, summary: 'App not ready.', output, executed: false };
  if (ctx.role !== 'super_admin' && ctx.role !== 'manager') {
    return { action, summary: 'Only a manager or admin can approve or reject prices.', output, executed: false };
  }
  const quoteId = readOptionalString(output.quoteId);
  const quote = quoteId ? app.quotes.find((q) => q.id === quoteId) : undefined;
  if (!quote) return { action, summary: 'Specify which quote (quoteId) to handle.', output, executed: false };
  const total = readOptionalNumber(output.total) ?? quote.total;
  app.updateQuote(quote.id, {
    status: approved ? 'approved' : 'rejected',
    total,
    approval: {
      state: approved ? 'approved' : 'rejected',
      by: ctx.approvedBy ?? 'Manager',
      at: new Date().toISOString(),
      note: readOptionalString(output.note),
      originalTotal: quote.approval?.originalTotal ?? quote.total,
    },
  });
  return {
    action,
    summary: approved
      ? `Approved quote for ${quote.customerName} at £${total.toLocaleString('en-GB')}.`
      : `Rejected quote for ${quote.customerName}.`,
    entityId: quote.id,
    openRoute: approved ? '/contracts' : '/approvals',
    output: { ...output, quoteId: quote.id },
    executed: true,
  };
}

async function executeGeneratePaymentSchedule(output: Record<string, unknown>, ctx: ToolRuntimeContext): Promise<ToolExecutionResult> {
  const { app } = ctx;
  const quoteId = readOptionalString(output.quoteId);
  const quote = quoteId && app ? app.quotes.find((q) => q.id === quoteId) : undefined;
  const total = readOptionalNumber(output.total) ?? quote?.total ?? 0;
  if (total <= 0) return { action: 'generatePaymentSchedule', summary: 'Need an approved total to build a schedule.', output, executed: false };
  const stages = await generatePaymentSchedule({
    total,
    tradeName: readOptionalString(output.tradeName) ?? quote?.tradeName,
    context: quote?.items.map((i) => i.name).join(', '),
  });
  const summary = stages.map((s) => `${s.label} ${s.percent}% (£${s.amount.toLocaleString('en-GB')})`).join(', ');
  return {
    action: 'generatePaymentSchedule',
    summary: `Suggested schedule: ${summary}.`,
    output: { ...output, stages, total },
    executed: true,
  };
}

async function executeSaveContract(output: Record<string, unknown>, ctx: ToolRuntimeContext): Promise<ToolExecutionResult> {
  const { app } = ctx;
  if (!app) return { action: 'saveContract', summary: 'App not ready.', output, executed: false };
  const quoteId = readOptionalString(output.quoteId);
  const quote = quoteId ? app.quotes.find((q) => q.id === quoteId) : undefined;
  if (!quote) return { action: 'saveContract', summary: 'Specify an approved quote (quoteId).', output, executed: false };
  if (quote.status !== 'approved') {
    return { action: 'saveContract', summary: 'That quote is not approved yet — approve the price first.', output, executed: false };
  }
  const customer = app.customers.find((c) => c.id === quote.customerId);
  if (!customer) return { action: 'saveContract', summary: 'Customer record missing for the quote.', output, executed: false };

  const template = getContractTemplate(readOptionalString(output.templateId) ?? '');
  let stages: PaymentStage[] = Array.isArray(output.stages) ? (output.stages as PaymentStage[]) : [];
  if (stages.length === 0) {
    stages = await generatePaymentSchedule({
      total: quote.total,
      tradeName: quote.tradeName,
      context: quote.items.map((i) => i.name).join(', '),
      preferredStages: template?.defaultStages,
    });
  }
  const deposit = stages.find((s) => /deposit|booking/i.test(s.label))?.amount ?? stages[0]?.amount ?? 0;
  const company = integrationService.getConfig('company');
  const bodyRendered = renderTemplate(template?.bodyMarkdown ?? '', {
    CUSTOMER_NAME: customer.name,
    CUSTOMER_EMAIL: customer.email,
    CUSTOMER_PHONE: customer.phone,
    CUSTOMER_ADDRESS: customer.address,
    USER_NAME: ctx.approvedBy ?? company.companyName ?? 'TradePro',
    CONTRACT_TOTAL: quote.total.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
    DEPOSIT_AMOUNT: deposit.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
    PAYMENT_SCHEDULE: formatPaymentSchedule(stages),
    JOB_LINE_ITEMS: formatJobLineItems(quote.items, quote.labour, quote.extras),
  });
  const contract = saveContractRecord({
    customerId: customer.id,
    customerName: customer.name,
    quoteId: quote.id,
    templateId: template?.id,
    tradeName: quote.tradeName,
    total: quote.total,
    depositAmount: deposit,
    stages,
    bodyRendered,
    status: 'draft',
  });
  return {
    action: 'saveContract',
    summary: `Saved draft contract for ${customer.name} (£${quote.total.toLocaleString('en-GB')}).`,
    entityId: contract.id,
    openRoute: '/contracts',
    output: { ...output, contractId: contract.id },
    executed: true,
  };
}

async function executeSendContract(output: Record<string, unknown>, ctx: ToolRuntimeContext): Promise<ToolExecutionResult> {
  const { app } = ctx;
  if (!app) return { action: 'sendContract', summary: 'App not ready.', output, executed: false };
  const contractId = readOptionalString(output.contractId);
  const contract = contractId ? getContract(contractId) : undefined;
  if (!contract) return { action: 'sendContract', summary: 'Specify which contract (contractId) to send.', output, executed: false };
  if (contract.status === 'signed') {
    return { action: 'sendContract', summary: 'Contract is already signed.', output, executed: false };
  }
  const customer = app.customers.find((c) => c.id === contract.customerId);
  if (!customer?.email) return { action: 'sendContract', summary: 'Customer has no email address.', output, executed: false };
  const userName = app.user?.name ?? 'TradePro Team';
  const result = await sendContractEmail(contract, customer, userName);
  if (result.success) {
    return {
      action: 'sendContract',
      summary: result.mock
        ? `Signing link sent to ${customer.name} (mock mode).`
        : `Secure signing link emailed to ${customer.name}.`,
      entityId: contract.id,
      openRoute: '/contracts',
      output: { ...output, contractId: contract.id, signUrl: result.signUrl },
      executed: true,
    };
  }
  return { action: 'sendContract', summary: result.error ?? 'Failed to send contract.', output, executed: false };
}

function parseQuoteLines(raw: unknown): QuoteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const quantity = readOptionalNumber(row.quantity) ?? readOptionalNumber(row.qty) ?? 1;
      const rate = readOptionalNumber(row.rate) ?? readOptionalNumber(row.price) ?? readOptionalNumber(row.unitPrice) ?? 0;
      const total = readOptionalNumber(row.total) ?? quantity * rate;
      return {
        id: readOptionalString(row.id) ?? `ai-line-${index}`,
        description: readOptionalString(row.description) ?? readOptionalString(row.name) ?? `Line ${index + 1}`,
        quantity,
        unit: (readOptionalString(row.unit) ?? 'item') as QuoteLine['unit'],
        rate,
        total,
        category: readOptionalString(row.category) as QuoteLine['category'],
      };
    })
    .filter((line): line is QuoteLine => Boolean(line));
}

function executeGetTeamPerformance(ctx: ToolRuntimeContext): ToolExecutionResult {
  if (ctx.role !== 'super_admin' && ctx.role !== 'manager') {
    return {
      action: 'getTeamPerformance',
      summary: 'Team performance is available to managers and admins only.',
      output: { allowed: false },
      executed: false,
    };
  }
  const roster = getOfficeTeamRoster();
  const topPerformer = getTopPerformer();
  return {
    action: 'getTeamPerformance',
    summary: topPerformer
      ? `Top performer: ${topPerformer.name} (£${topPerformer.performance.revenue.toLocaleString('en-GB')} revenue).`
      : `Office team: ${roster.length} members.`,
    output: { allowed: true, roster, topPerformer: topPerformer ?? null },
    executed: true,
  };
}

function executeSearchLeads(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) return { action: 'searchLeads', summary: 'App not ready.', output, executed: false };
  const query = readOptionalString(output.query)?.toLowerCase() ?? '';
  const statusFilter = readOptionalString(output.status)?.toLowerCase();
  const sourceFilter = readOptionalString(output.source)?.toLowerCase();
  const limit = Number(output.limit) || 10;
  const results = app.customers
    .filter((c) => {
      const status = c.status.toLowerCase();
      const isLead = status === 'lead' || status === 'quoted' || Boolean(c.source);
      if (!isLead && !query) return false;
      if (statusFilter && status !== statusFilter) return false;
      if (sourceFilter && String(c.source ?? '').toLowerCase() !== sourceFilter) return false;
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query)
        || c.email.toLowerCase().includes(query)
        || c.phone.toLowerCase().includes(query)
        || String(c.source ?? '').toLowerCase().includes(query)
        || c.notes.toLowerCase().includes(query)
        || status.includes(query)
      );
    })
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      source: c.source ?? null,
      leadScore: c.leadScore ?? null,
      nextFollowUp: c.nextFollowUp ?? null,
      budget: c.budget ?? null,
      route: '/crm',
    }));
  return {
    action: 'searchLeads',
    summary: summariseSearch('Leads', results.map((r) => ({ id: r.id, title: r.name, subtitle: r.status }))),
    output: { ...output, count: results.length, results },
    executed: true,
  };
}

function executeUpdateLeadStatus(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) return { action: 'updateLeadStatus', summary: 'App not ready.', output, executed: false };
  const customerId = readOptionalString(output.customerId);
  const status = readOptionalString(output.status) as 'lead' | 'quoted' | 'won' | 'lost' | undefined;
  if (!customerId || !status) {
    return { action: 'updateLeadStatus', summary: 'Need customerId and status.', output, executed: false };
  }
  const customer = app.customers.find((c) => c.id === customerId);
  if (!customer) {
    return { action: 'updateLeadStatus', summary: 'Customer not found.', output, executed: false };
  }
  const note = readOptionalString(output.note);
  const notes = note ? `${customer.notes}\n${note}`.trim() : customer.notes;
  app.updateCustomer(customerId, {
    status,
    notes,
    lastContact: new Date().toISOString(),
  });
  return {
    action: 'updateLeadStatus',
    summary: `Updated ${customer.name} to ${status}.`,
    entityId: customerId,
    openRoute: '/crm',
    output: { ...output, customerId, status },
    executed: true,
  };
}

function executeLogFollowUp(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) return { action: 'logFollowUp', summary: 'App not ready.', output, executed: false };
  const customerId = readOptionalString(output.customerId);
  if (!customerId) {
    return { action: 'logFollowUp', summary: 'Need customerId.', output, executed: false };
  }
  const customer = app.customers.find((c) => c.id === customerId);
  if (!customer) {
    return { action: 'logFollowUp', summary: 'Customer not found.', output, executed: false };
  }
  const note = readOptionalString(output.note) ?? 'Follow-up logged via AI';
  const nextFollowUp = readOptionalString(output.nextFollowUp);
  const notes = `${customer.notes}\n[${new Date().toISOString().slice(0, 10)}] ${note}`.trim();
  app.updateCustomer(customerId, {
    notes,
    lastContact: new Date().toISOString(),
    ...(nextFollowUp ? { nextFollowUp } : {}),
  });
  return {
    action: 'logFollowUp',
    summary: `Follow-up logged for ${customer.name}${nextFollowUp ? ` — next: ${nextFollowUp}` : ''}.`,
    entityId: customerId,
    openRoute: '/crm',
    output: { ...output, customerId, nextFollowUp: nextFollowUp ?? null },
    executed: true,
  };
}

function executeAddQuoteLines(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  const newLines = parseQuoteLines(output.lines ?? output.items);
  if (newLines.length === 0) {
    return { action: 'addQuoteLines', summary: 'No line items provided.', output, executed: false };
  }
  const quoteId = readOptionalString(output.quoteId);
  if (app && quoteId) {
    const quote = app.quotes.find((q) => q.id === quoteId);
    if (quote) {
      const existing = quote.lines ?? [];
      const merged = [...existing, ...newLines];
      const items = parseLineItems(merged.map((l) => ({
        name: l.description,
        quantity: l.quantity,
        price: l.rate,
        total: l.total,
      })));
      const total = items.reduce((s, i) => s + i.total, 0);
      app.updateQuote(quote.id, { lines: merged, items, total });
      return {
        action: 'addQuoteLines',
        summary: `Added ${newLines.length} line(s) to quote ${quote.id}.`,
        entityId: quote.id,
        openRoute: '/quotes',
        output: { ...output, quoteId: quote.id, lineCount: merged.length },
        executed: true,
      };
    }
  }
  const existingRaw = sessionStorage.getItem('aiQuotePrefill');
  let existing: QuoteLine[] = [];
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw) as { lines?: QuoteLine[] };
      existing = Array.isArray(parsed.lines) ? parsed.lines : [];
    } catch { /* ignore */ }
  }
  const merged = [...existing, ...newLines];
  sessionStorage.setItem('aiQuotePrefill', JSON.stringify({ lines: merged }));
  const tradeId = readOptionalString(output.tradeId) ?? ctx.tradeId ?? '';
  const customerId = readOptionalString(output.customerId) ?? ctx.customerId ?? '';
  const route = `${buildQuoteRoute(tradeId, customerId)}?prefill=ai`;
  if (ctx.quoteHandlers.navigate) {
    ctx.quoteHandlers.navigate(route);
  }
  return {
    action: 'addQuoteLines',
    summary: `Staged ${newLines.length} line(s) for quote wizard.`,
    openRoute: route,
    output: { ...output, lineCount: merged.length, prefill: true },
    executed: true,
  };
}

function executeUpdateQuoteLines(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const { app } = ctx;
  if (!app) return { action: 'updateQuoteLines', summary: 'App not ready.', output, executed: false };
  const quoteId = readOptionalString(output.quoteId);
  const quote = quoteId
    ? app.quotes.find((q) => q.id === quoteId)
    : app.quotes[app.quotes.length - 1];
  if (!quote) {
    return { action: 'updateQuoteLines', summary: 'No quote found.', output, executed: false };
  }
  const lines = parseQuoteLines(output.lines ?? output.items);
  if (lines.length === 0) {
    return { action: 'updateQuoteLines', summary: 'No line items provided.', output, executed: false };
  }
  const items = parseLineItems(lines.map((l) => ({
    name: l.description,
    quantity: l.quantity,
    price: l.rate,
    total: l.total,
  })));
  const total = readOptionalNumber(output.total) ?? items.reduce((s, i) => s + i.total, 0);
  app.updateQuote(quote.id, { lines, items, total });
  return {
    action: 'updateQuoteLines',
    summary: `Updated ${lines.length} line(s) on quote ${quote.id}.`,
    entityId: quote.id,
    openRoute: '/quotes',
    output: { ...output, quoteId: quote.id, total },
    executed: true,
  };
}

function executeCompleteHandover(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const projectId = readOptionalString(output.projectId) ?? ctx.projectId;
  if (!projectId) {
    return { action: 'completeHandover', summary: 'Need an open project.', output, executed: false };
  }
  const project = getProject(projectId);
  if (!project) {
    return { action: 'completeHandover', summary: 'Project not found.', output, executed: false };
  }
  const signedBy = readOptionalString(output.signedBy) ?? ctx.approvedBy ?? 'Customer';
  updateProject(projectId, {
    status: 'completed',
    handover: {
      signedAt: new Date().toISOString(),
      signedBy,
      customerNotes: readOptionalString(output.customerNotes),
      retentionReleased: false,
    },
  });
  return {
    action: 'completeHandover',
    summary: `Handover completed for ${project.projectName}.`,
    entityId: projectId,
    openRoute: '/projects',
    output: { ...output, projectId },
    executed: true,
  };
}

function executeAssignContractor(output: Record<string, unknown>, ctx: ToolRuntimeContext): ToolExecutionResult {
  const projectId = readOptionalString(output.projectId) ?? ctx.projectId;
  if (!projectId) {
    return { action: 'assignContractor', summary: 'Need an open project.', output, executed: false };
  }
  const project = getProject(projectId);
  if (!project) {
    return { action: 'assignContractor', summary: 'Project not found.', output, executed: false };
  }
  const contractorId = readOptionalString(output.contractorId) ?? `CTR${Date.now()}`;
  const name = readOptionalString(output.name) ?? 'Contractor';
  const tradeId = readOptionalString(output.tradeId);
  const trade = readOptionalString(output.trade) ?? tradeId;
  const existing = project.assignedContractors ?? [];
  const next = [
    ...existing.filter((c) => c.id !== contractorId),
    { id: contractorId, name, tradeId, trade, contractorId },
  ];
  updateProject(projectId, { assignedContractors: next });
  return {
    action: 'assignContractor',
    summary: `Assigned ${name} to ${project.projectName}.`,
    entityId: projectId,
    openRoute: '/projects',
    output: { ...output, projectId, contractorId, name },
    executed: true,
  };
}

async function executeMarkPaymentReceived(output: Record<string, unknown>, ctx: ToolRuntimeContext): Promise<ToolExecutionResult> {
  const projectId = readOptionalString(output.projectId) ?? ctx.projectId;
  if (!projectId) {
    return { action: 'markPaymentReceived', summary: 'Need an open project.', output, executed: false };
  }
  const project = getProject(projectId);
  if (!project) {
    return { action: 'markPaymentReceived', summary: 'Project not found.', output, executed: false };
  }
  const stageId = readOptionalString(output.stageId);
  const stageName = readOptionalString(output.stageName)?.toLowerCase();
  const paidDate = readOptionalString(output.paidDate) ?? new Date().toISOString().slice(0, 10);
  let matchedStageId: string | undefined;
  const stages = project.paymentStages.map((stage) => {
    const matchesId = stageId && stage.id === stageId;
    const matchesName = stageName && stage.name.toLowerCase().includes(stageName);
    if (!matchesId && !matchesName) return stage;
    matchedStageId = stage.id;
    return { ...stage, status: 'paid' as const, paidDate };
  });
  const matched = stages.some((s, i) => s !== project.paymentStages[i]);
  if (!matched || !matchedStageId) {
    return { action: 'markPaymentReceived', summary: 'Payment stage not found.', output, executed: false };
  }
  updateProject(projectId, { paymentStages: stages });

  let summary = `Payment marked received on ${project.projectName}.`;
  const customer = ctx.app?.customers.find((c) => c.id === project.customerId);
  if (customer) {
    const receiptResult = await autoSendReceiptAfterMarkPaid(projectId, matchedStageId, customer);
    if (receiptResult && !receiptResult.skipped) {
      summary += receiptResult.success
        ? ` ${receiptResult.message}`
        : ` Receipt not sent: ${receiptResult.message}`;
    }
  }

  return {
    action: 'markPaymentReceived',
    summary,
    entityId: projectId,
    openRoute: '/projects',
    output: { ...output, projectId, paidDate, stageId: matchedStageId },
    executed: true,
  };
}

async function executeSendClientReceipt(output: Record<string, unknown>, ctx: ToolRuntimeContext): Promise<ToolExecutionResult> {
  const projectId = readOptionalString(output.projectId) ?? ctx.projectId;
  if (!projectId) {
    return { action: 'sendClientReceipt', summary: 'Need projectId.', output, executed: false };
  }
  const project = getProject(projectId);
  if (!project) {
    return { action: 'sendClientReceipt', summary: 'Project not found.', output, executed: false };
  }
  const customerId = readOptionalString(output.customerId) ?? project.customerId;
  const customer = ctx.app?.customers.find((c) => c.id === customerId);
  if (!customer) {
    return { action: 'sendClientReceipt', summary: 'Customer not found.', output, executed: false };
  }
  const result = await sendReceiptForStage({
    projectId,
    stageId: readOptionalString(output.stageId),
    stageName: readOptionalString(output.stageName),
    customer,
    force: output.force === true || output.force === 'true',
  });
  return {
    action: 'sendClientReceipt',
    summary: result.message,
    entityId: projectId,
    openRoute: '/projects',
    output: { ...output, projectId },
    executed: result.success,
  };
}

async function executeMailboxEmailTool(
  toolName: string,
  output: Record<string, unknown>,
  ctx: ToolRuntimeContext
): Promise<ToolExecutionResult> {
  const userId = ctx.userId ?? ctx.app?.user?.id ?? 'default-user';
  const { getActiveOrgId } = await import('../platform/orgContext');
  const { BDIDDIES_HOME_ORG_ID } = await import('../platform/homeOrg');
  const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  const connections = await mailboxService.getConnections(userId, orgId);
  const connectionId = readOptionalString(output.connectionId) ?? connections[0]?.id;
  if (!connectionId) {
    return {
      action: toolName,
      summary: 'No mailbox connected — connect in Settings → Email & Inbox.',
      output,
      executed: false,
    };
  }

  if (toolName === 'listRecentEmails') {
    const { messages } = await mailboxService.listThreads(connectionId, userId, orgId);
    const limit = Number(output.limit) || 10;
    const emails = messages.slice(0, limit).map(m => ({
      id: m.id,
      from: m.fromAddr,
      subject: m.subject,
      snippet: m.snippet,
      receivedAt: m.receivedAt,
    }));
    return {
      action: toolName,
      summary: emails.length ? `Found ${emails.length} recent email(s).` : 'Inbox is empty.',
      output: { ...output, count: emails.length, emails },
      executed: true,
    };
  }

  if (toolName === 'getEmailThread') {
    const { messages } = await mailboxService.listThreads(connectionId, userId, orgId);
    const threadId = readOptionalString(output.threadId);
    const messageId = readOptionalString(output.messageId);
    const threadMessages = messages.filter(m =>
      threadId ? m.threadId === threadId : m.id === messageId
    );
    return {
      action: toolName,
      summary: threadMessages.length
        ? `Thread has ${threadMessages.length} message(s).`
        : 'Thread not found.',
      output: {
        ...output,
        threadId: threadId ?? threadMessages[0]?.threadId,
        messages: threadMessages,
      },
      executed: threadMessages.length > 0,
    };
  }

  if (toolName === 'draftEmailReply') {
    const draft = {
      to: readOptionalString(output.to),
      subject: readOptionalString(output.subject),
      body: readOptionalString(output.body),
    };
    return {
      action: toolName,
      summary: 'Email draft prepared — review before sending.',
      output: { ...output, draft },
      executed: Boolean(draft.to && draft.subject && draft.body),
    };
  }

  if (toolName === 'sendEmailReply' || toolName === 'sendEmailWithAttachment') {
    const to = readOptionalString(output.to);
    const subject = readOptionalString(output.subject);
    const body = readOptionalString(output.body) ?? '';
    if (!to || !subject) {
      return { action: toolName, summary: 'Email needs to, subject, and body.', output, executed: false };
    }
    const result = await mailboxService.send({
      connectionId,
      to,
      subject,
      body,
      attachments: Array.isArray(output.attachments)
        ? output.attachments as Array<{ filename: string; mimeType: string; content: string }>
        : undefined,
    }, userId, orgId) as { success?: boolean; error?: string; mock?: boolean };
    if (result.success) {
      return {
        action: toolName,
        summary: result.mock ? `Email to ${to} sent (mock).` : `Email sent to ${to}.`,
        output: { ...output, to, subject, sent: true },
        executed: true,
      };
    }
    return {
      action: toolName,
      summary: result.error ?? 'Email send failed.',
      output,
      executed: false,
    };
  }

  return { action: toolName, summary: `Unknown email tool: ${toolName}`, output, executed: false };
}

async function executePlanningToolAction(
  name: string,
  action: CopilotAction,
  ctx: ToolRuntimeContext
): Promise<ToolExecutionResult> {
  const input = action.input ?? action.output ?? {};
  const appId = readOptionalString(input.applicationId)
    ?? readOptionalString(ctx.planningApplicationId);
  if (!appId) {
    return {
      action: name,
      summary: 'Open a planning application first (Planning → select an application).',
      output: input,
      executed: false,
    };
  }
  const by = ctx.approvedBy ?? 'TradePro AI';
  const applied = await executePlanningActions(
    appId,
    [{ action: name, input, output: action.output ?? input }],
    by
  );
  return {
    action: name,
    summary: applied[applied.length - 1] ?? `${name} applied.`,
    entityId: appId,
    openRoute: `/planning/${appId}`,
    output: input,
    executed: true,
  };
}

async function executeSingleTool(
  action: CopilotAction,
  ctx: ToolRuntimeContext
): Promise<ToolExecutionResult> {
  const name = normalizeToolAction(action.action);
  const output = action.output ?? {};

  if (name === 'detectTrades') {
    const trades = output.trades as Array<{ tradeId: string; confidence: number }> | undefined;
    const valid = trades?.filter((t) => isValidTradeId(t.tradeId)) ?? [];
    if (valid.length && ctx.onDetectedTrades) {
      ctx.onDetectedTrades(valid.map((t) => ({ tradeId: t.tradeId as TradeId, confidence: t.confidence })));
    }
    const names = valid.map((t) => t.tradeId).join(', ');
    return {
      action: name,
      summary: valid.length ? `Detected trades: ${names}.` : 'No trades detected.',
      output,
      executed: valid.length > 0,
    };
  }

  if (name === 'linkCustomer') return executeLinkCustomer(output, ctx);
  if (name === 'convertQuoteToProject') return executeConvertQuoteToProject(output, ctx);
  if (name === 'saveQuote') return executeSaveQuote(output, ctx);
  if (name === 'updateQuote') return executeUpdateQuote(output, ctx);
  if (name === 'startQuote') return executeStartQuote(output, ctx);
  if (name === 'proposeQuoteFields') return executeProposeQuoteFields(output, ctx);
  if (name === 'priceSmallJob') return executePriceSmallJob(output, ctx);
  if (name === 'submitForApproval') return executeSubmitForApproval(output, ctx);
  if (name === 'approveQuote') return executeApproveQuote(output, ctx, true);
  if (name === 'rejectQuote') return executeApproveQuote(output, ctx, false);
  if (name === 'generatePaymentSchedule') return executeGeneratePaymentSchedule(output, ctx);
  if (name === 'saveContract') return executeSaveContract(output, ctx);
  if (name === 'sendContract') return executeSendContract(output, ctx);
  if (name === 'getTeamPerformance') return executeGetTeamPerformance(ctx);
  if (name === 'searchLeads') return executeSearchLeads(output, ctx);
  if (name === 'updateLeadStatus') return executeUpdateLeadStatus(output, ctx);
  if (name === 'logFollowUp') return executeLogFollowUp(output, ctx);
  if (name === 'addQuoteLines') return executeAddQuoteLines(output, ctx);
  if (name === 'updateQuoteLines') return executeUpdateQuoteLines(output, ctx);
  if (name === 'completeHandover') return executeCompleteHandover(output, ctx);
  if (name === 'assignContractor') return executeAssignContractor(output, ctx);
  if (name === 'markPaymentReceived') return executeMarkPaymentReceived(output, ctx);
  if (name === 'sendClientReceipt' || name === 'draftClientReceipt') return executeSendClientReceipt(output, ctx);

  if (
    name === 'listRecentEmails'
    || name === 'getEmailThread'
    || name === 'draftEmailReply'
    || name === 'sendEmailReply'
    || name === 'sendEmailWithAttachment'
  ) {
    return executeMailboxEmailTool(name, output, ctx);
  }

  if (isPlanningAction(name)) {
    return executePlanningToolAction(name, action, ctx);
  }

  if (name === 'navigateTo' || name === 'navigate') {
    const routeOutput = name === 'navigate' ? { route: output.route ?? output.path } : output;
    const ok = navigateToRoute(routeOutput, ctx.navigate);
    const route = readOptionalString(output.route) ?? readOptionalString(output.path);
    return {
      action: name,
      summary: ok ? `Navigated to ${route}.` : 'Navigation failed — no route.',
      openRoute: route,
      output,
      executed: ok,
    };
  }

  if (name === 'requestCodeFix') {
    const { emitSelfHealError } = await import('./selfHealEvents');
    const errorCode = readOptionalString(output.errorCode) || readOptionalString(output.code) || 'MANUAL';
    const description =
      readOptionalString(output.description) ||
      readOptionalString(output.message) ||
      'Staff requested a code fix from chat';
    const route = readOptionalString(output.route) || (typeof window !== 'undefined' ? window.location.pathname : '');
    emitSelfHealError({ errorCode, description, route });
    return {
      action: name,
      summary: `Offered code fix for ${errorCode} in chat (Yes/No).`,
      output: { errorCode, description, route },
      executed: true,
    };
  }

  if (name === 'draftQuote') {
    const customerName = readOptionalString(output.customerName) || 'Customer';
    const total = Number(output.total ?? 0);
    const tradeName = readOptionalString(output.tradeName) || 'General';
    const notes = readOptionalString(output.notes) || '';
    const lineItems = Array.isArray(output.lineItems)
      ? (output.lineItems as Array<{ description?: string; amount?: number }>).map((i) => ({
          description: String(i.description ?? 'Item'),
          amount: Number(i.amount ?? 0),
        }))
      : [];
    const linesText = lineItems.length
      ? lineItems.map((i) => `• ${i.description}: £${i.amount.toFixed(2)}`).join('\n')
      : `• Total: £${total.toFixed(2)}`;
    return {
      action: name,
      summary: `Quote draft for ${customerName} (£${total.toLocaleString('en-GB')}). Say “make the PDF” when you’re happy.`,
      openRoute: '/cynthia',
      output: {
        ...output,
        title: `Quote draft — ${customerName}`,
        draftMarkdown: `**Quote draft — ${customerName}**\n\nTrade: ${tradeName}\n\n${linesText}\n\n**Total: £${total.toFixed(2)}**${notes ? `\n\n_Notes:_ ${notes}` : ''}\n\n_Reply “yes” or “make the PDF” to convert this to a PDF._`,
        customerName,
        total,
        tradeName,
        lineItems,
        awaitingPdfConfirm: true,
      },
      executed: true,
    };
  }

  if (name === 'generateQuotePdf') {
    const { generateQuotePdf } = await import('../messaging/pdfGenerator');
    const customerName = readOptionalString(output.customerName) || 'Customer';
    const total = Number(output.total ?? 0);
    const tradeName = readOptionalString(output.tradeName);
    const lineItems = Array.isArray(output.lineItems)
      ? (output.lineItems as Array<{ description?: string; amount?: number }>).map((i) => ({
          description: String(i.description ?? 'Item'),
          amount: Number(i.amount ?? 0),
        }))
      : undefined;
    try {
      const pdf = await generateQuotePdf(customerName, total, tradeName, lineItems);
      const dataUrl = `data:${pdf.mimeType};base64,${pdf.content}`;
      return {
        action: name,
        summary: `Quote PDF ready for ${customerName} (£${total.toLocaleString('en-GB')}).`,
        openRoute: '/cynthia',
        output: {
          ...output,
          title: `Quote — ${customerName}`,
          pdfDataUrl: dataUrl,
          pdfFilename: pdf.filename,
        },
        executed: true,
      };
    } catch (err) {
      return {
        action: name,
        summary: err instanceof Error ? err.message : 'Could not generate quote PDF.',
        output,
        executed: false,
      };
    }
  }

  if (name === 'generateOpsReport') {
    const title = readOptionalString(output.title) || 'Operations report';
    const reportType = readOptionalString(output.reportType) || 'custom';
    let markdown = readOptionalString(output.markdown) || '';
    if (!markdown && ctx.app) {
      const customers = ctx.app.customers ?? [];
      const quotes = ctx.app.quotes ?? [];
      const awaiting = quotes.filter((q) => String(q.status).includes('await') || q.status === 'sent');
      const leads = customers.filter((c) => c.status === 'lead' || c.status === 'enquiry');
      markdown = [
        `# ${title}`,
        '',
        `Generated: ${new Date().toLocaleString('en-GB')}`,
        `Type: ${reportType}`,
        '',
        `## Snapshot`,
        `- Customers: ${customers.length}`,
        `- Quotes: ${quotes.length}`,
        `- Awaiting / sent quotes: ${awaiting.length}`,
        `- Leads: ${leads.length}`,
        '',
        `## Recent quotes`,
        ...quotes.slice(0, 8).map(
          (q) => `- ${q.customerName}: £${Number(q.total).toLocaleString('en-GB')} (${q.status})`,
        ),
        '',
        `## Recent leads`,
        ...leads.slice(0, 8).map((c) => `- ${c.name}${c.phone ? ` · ${c.phone}` : ''}`),
      ].join('\n');
    }
    return {
      action: name,
      summary: `${title} ready.`,
      openRoute: '/cynthia',
      output: { ...output, title, reportMarkdown: markdown },
      executed: true,
    };
  }

  if (name === 'placeOutboundCall') {
    const to = readOptionalString(output.to);
    if (!to) {
      return { action: name, summary: 'Need a phone number to call.', output, executed: false };
    }
    const template =
      readOptionalString(output.template)
      || 'lead_callback';
    const customerName = readOptionalString(output.customerName);
    const reason = readOptionalString(output.reason) || 'Staff requested from Cynthia';
    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          template,
          context: {
            customerName,
            reason,
            source: 'cynthia',
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || data.success === false) {
        const errMsg =
          (typeof data.error === 'string' && data.error)
          || `Outbound call failed (${res.status}).`;
        return {
          action: name,
          summary: errMsg,
          output,
          executed: false,
        };
      }
      return {
        action: name,
        summary: `Calling ${customerName || to}…`,
        openRoute: '/calls',
        output: { ...output, ...data, template },
        executed: true,
      };
    } catch (err) {
      return {
        action: name,
        summary: err instanceof Error ? err.message : 'Outbound call failed.',
        output,
        executed: false,
      };
    }
  }

  if (name === 'sendToStaffCynthia') {
    // Server / phone / channel paths may have already persisted the card.
    if (output.sent === true || readOptionalString(output.cardId)) {
      const title = readOptionalString(output.title) || 'Details for you';
      return {
        action: name,
        summary: readOptionalString(output.spokenConfirm) || `Sent to Cynthia chat: ${title}`,
        openRoute: readOptionalString(output.route) || '/cynthia',
        output,
        executed: true,
      };
    }
    const title = readOptionalString(output.title) || 'Details for you';
    try {
      const res = await fetch('/api/cynthia/send-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: readOptionalString(output.staffUserId) || readOptionalString(output.userId) || ctx.userId,
          title,
          customerName: readOptionalString(output.customerName),
          phone: readOptionalString(output.phone),
          address: readOptionalString(output.address),
          amount: output.amount != null ? Number(output.amount) : undefined,
          summary: readOptionalString(output.summary),
          notes: readOptionalString(output.notes),
          quoteId: readOptionalString(output.quoteId),
          projectId: readOptionalString(output.projectId),
          customerId: readOptionalString(output.customerId),
          staffUserId: readOptionalString(output.staffUserId) || ctx.userId,
          source: 'cynthia',
        }),
      });
      if (!res.ok) {
        return { action: name, summary: 'Could not send Cynthia card.', output, executed: false };
      }
      const data = (await res.json()) as { card?: { id?: string }; route?: string };
      return {
        action: name,
        summary: `Sent to Cynthia chat: ${title}`,
        openRoute: data.route || '/cynthia',
        output: { ...output, cardId: data.card?.id, route: data.route, sent: true },
        executed: true,
      };
    } catch (err) {
      return {
        action: name,
        summary: err instanceof Error ? err.message : 'Could not send Cynthia card.',
        output,
        executed: false,
      };
    }
  }

  if (name === 'writeData') {
    const collection = readOptionalString(output.collection) as WriteDataInput['collection'] | undefined;
    const operation = (readOptionalString(output.operation) ?? 'update') as WriteDataInput['operation'];
    const id = readOptionalString(output.id);
    if (!collection) {
      return { action: name, summary: 'writeData needs a collection.', output, executed: false };
    }
    const policyCtx: DataPolicyContext = {
      role: ctx.role ?? 'unknown',
      userId: ctx.userId,
      customerId: ctx.customerId,
      builderId: ctx.builderId,
      projectId: ctx.projectId,
    };
    const result = executeWriteData(
      {
        collection,
        operation,
        id,
        data: (output.data as Record<string, unknown>) ?? {},
      },
      ctx.app,
      policyCtx
    );
    return {
      action: name,
      summary: result.message,
      entityId: result.id,
      openRoute: result.success
        ? (collection === 'customers' ? '/crm' : collection === 'quotes' ? '/quotes' : collection === 'projects' ? '/projects' : undefined)
        : undefined,
      output: { ...output, ...result },
      executed: result.success,
    };
  }

  if (name === 'readData') {
    return { action: name, summary: '', output, executed: true };
  }

  if (ctx.app) {
    if (name === 'searchCustomers') {
      const query = readOptionalString(output.query) ?? '';
      const results = searchCustomers(ctx.app, query, Number(output.limit) || 5);
      return { action: name, summary: summariseSearch('Customers', results), output: { ...output, results }, executed: true };
    }
    if (name === 'searchProjects') {
      const query = readOptionalString(output.query) ?? '';
      const results = searchProjects(query, Number(output.limit) || 5);
      return { action: name, summary: summariseSearch('Projects', results), output: { ...output, results }, executed: true };
    }
    if (name === 'searchQuotes') {
      const query = readOptionalString(output.query) ?? '';
      const results = searchQuotes(ctx.app, query, Number(output.limit) || 5);
      return { action: name, summary: summariseSearch('Quotes', results), output: { ...output, results }, executed: true };
    }
  }

  if (isProjectAction(name) && !requiresSafetyConfirm(name)) {
    return executeProjectAction(name, output, ctx);
  }

  const foremanResult = await executeForemanAutoAction(action, ctx.projectId);
  if (foremanResult) {
    return { action: name, summary: foremanResult, output, executed: true };
  }

  if (isProjectAction(name)) {
    return {
      action: name,
      summary: `${name} prepared — review before sending.`,
      output,
      executed: false,
    };
  }

  if (name === 'getPortalLink') {
    const link = readOptionalString(output.portalLink);
    return {
      action: name,
      summary: link ? 'Customer portal link ready.' : '',
      openRoute: link && link.startsWith('/') ? link : undefined,
      output,
      executed: true,
    };
  }

  // Lookup/escalation results are summarised in the assistant reply itself — no extra panel noise.
  if (name === 'lookupQuote' || name === 'lookupProjectStatus' || name === 'escalateToStaff') {
    return { action: name, summary: '', output, executed: true };
  }

  return { action: name, summary: `${name} complete.`, output, executed: true };
}

export interface ProcessToolsResult {
  executed: ToolExecutionResult[];
  pendingSafety: CopilotAction[];
  summaries: string[];
}

export async function processToolActions(
  actions: CopilotAction[],
  ctx: ToolRuntimeContext,
  options?: { role: string; requireConfirmCustomerMessages?: boolean }
): Promise<ProcessToolsResult> {
  const executed: ToolExecutionResult[] = [];
  const pendingSafety: CopilotAction[] = [];
  const summaries: string[] = [];
  const seen = new Set<string>();
  let lastCustomerId: string | undefined;
  let lastProjectId: string | undefined;

  for (const action of actions) {
    const key = `${action.action}:${JSON.stringify(action.output)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (requiresSafetyConfirm(action.action, options?.requireConfirmCustomerMessages, action.output ?? action.input)) {
      pendingSafety.push(action);
      continue;
    }

    const enriched = { ...action };
    if (
      (normalizeToolAction(action.action) === 'saveQuote' || action.action === 'saveQuote')
      && !readOptionalString(enriched.output?.customerId)
      && lastCustomerId
    ) {
      enriched.output = { ...enriched.output, customerId: lastCustomerId };
    }
    if (
      normalizeToolAction(action.action) === 'proposePaymentPlan'
      && !readOptionalString(enriched.output?.projectId)
      && lastProjectId
    ) {
      enriched.output = { ...enriched.output, projectId: lastProjectId };
    }

    const result = await executeSingleTool(enriched, {
      ...ctx,
      projectId: readOptionalString(enriched.output?.projectId) ?? lastProjectId ?? ctx.projectId,
      planningApplicationId: readOptionalString(enriched.output?.applicationId) ?? ctx.planningApplicationId,
    });
    executed.push(result);
    if (result.entityId && (action.action === 'linkCustomer' || action.action === 'saveCustomer')) {
      lastCustomerId = result.entityId;
    }
    if (action.action === 'convertQuoteToProject' && result.executed && result.entityId) {
      lastProjectId = result.entityId;
    }
    if (result.summary) summaries.push(result.summary);
  }

  return { executed, pendingSafety, summaries };
}

export async function executeSafetyAction(
  action: CopilotAction,
  ctx: ToolRuntimeContext
): Promise<ToolExecutionResult> {
  if (isProjectAction(normalizeToolAction(action.action))) {
    return executeProjectAction(normalizeToolAction(action.action), action.output, ctx);
  }
  return executeSingleTool(action, ctx);
}
