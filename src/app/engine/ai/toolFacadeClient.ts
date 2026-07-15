/**
 * Client-side mirror of the backend 12-tool web facade
 * (tradepro-backend/server/tool-facade.ts, AI_TOOL_FACADE flag).
 *
 * The server expands facade calls to CANONICAL action names before returning
 * proposedActions/autoActions, so this module is defensive only: if a facade
 * name (searchRecords, manageQuote, …) leaks through to the client, we expand
 * it here BEFORE resolveLegacyTool / normalizeToolAction so role permissions,
 * safety confirms, and executors always operate on canonical names. Keep the
 * operation maps in sync with the backend module.
 */
import { PLANNING_ACTION_NAMES } from '../planning/planningActionNames';
import type { CopilotAction } from './orchestratorService';

type OperationMap = Readonly<Record<string, string>>;

export const FACADE_OPERATION_MAP: Readonly<Record<string, OperationMap>> = {
  searchRecords: {
    customers: 'searchCustomers',
    projects: 'searchProjects',
    quotes: 'searchQuotes',
    leads: 'searchLeads',
    emails: 'searchEmails',
    businessSnapshot: 'getBusinessSnapshot',
    teamPerformance: 'getTeamPerformance',
    readCollection: 'readData',
    projectProfit: 'getProjectProfit',
    costBreakdown: 'getCostBreakdown',
  },
  manageCustomer: {
    link: 'linkCustomer',
    updateLead: 'updateLeadStatus',
    logFollowUp: 'logFollowUp',
    merge: 'mergeCustomers',
  },
  manageQuote: {
    detectTrades: 'detectTrades',
    proposeFields: 'proposeQuoteFields',
    start: 'startQuote',
    save: 'saveQuote',
    update: 'updateQuote',
    addLines: 'addQuoteLines',
    updateLines: 'updateQuoteLines',
    duplicate: 'duplicateQuote',
    archive: 'archiveQuote',
    priceSmallJob: 'priceSmallJob',
    submitApproval: 'submitForApproval',
  },
  managePricing: {
    approve: 'approveQuote',
    reject: 'rejectQuote',
    paymentSchedule: 'generatePaymentSchedule',
  },
  manageContract: {
    draftQuote: 'draftQuote',
    generateQuotePdf: 'generateQuotePdf',
    draft: 'draftContract',
    save: 'saveContract',
    send: 'sendContract',
    generatePdf: 'generateContractPdf',
  },
  manageProject: {
    convertFromQuote: 'convertQuoteToProject',
    paymentPlan: 'proposePaymentPlan',
    schedule: 'proposeSchedule',
    changeOrder: 'proposeChangeOrder',
    handover: 'completeHandover',
    assignContractor: 'assignContractor',
    close: 'closeProject',
    markPaid: 'markPaymentReceived',
    // Backend canonical name; the alias table routes it to the
    // sendClientReceipt executor (draftClientReceipt → sendClientReceipt).
    receipt: 'draftClientReceipt',
  },
  siteOperations: {
    builderBrief: 'sendBuilderBrief',
    contractorBrief: 'sendContractorBrief',
    plan: 'proposePlan',
    paymentGate: 'checkPaymentGate',
    sitePhotos: 'requestSitePhotos',
    taskStatus: 'updateTaskStatus',
    tagPhoto: 'tagPhoto',
    assessProgress: 'assessProgress',
    assessExtra: 'assessExtraFromPhotos',
    logBuilderReply: 'logBuilderReply',
    logBuilderPrice: 'logBuilderPrice',
    recordCost: 'recordCostEntry',
    logHours: 'logHours',
    fixCost: 'fixCostEntry',
    correctTimesheet: 'correctTimesheet',
    supplierOrder: 'draftSupplierOrder',
  },
  manageInvoices: {
    draft: 'draftInvoice',
    generatePdf: 'generateInvoicePdf',
    send: 'sendInvoice',
  },
  managePayments: {
    categorizeTxn: 'categorizeTransaction',
    matchTxn: 'matchTransactionToProject',
    flagTxn: 'flagTransaction',
    refund: 'processRefund',
    initiate: 'initiatePayment',
    subscription: 'manageSubscription',
  },
  sendMessage: {
    draftCustomer: 'draftCustomerMessage',
    draftBuilder: 'draftBuilderMessage',
    notifyChangeOrder: 'notifyCustomerChangeOrder',
    emailDraft: 'draftEmailReply',
    emailSend: 'sendEmailReply',
    emailAttach: 'sendEmailWithAttachment',
    sms: 'sendSms',
    whatsappTemplate: 'sendWhatsAppTemplate',
    whatsappMedia: 'sendWhatsAppMedia',
    callOutbound: 'placeOutboundCall',
  },
  managePlanning: Object.fromEntries(PLANNING_ACTION_NAMES.map((name) => [name, name])),
  appControl: {
    navigate: 'navigate',
    staffCard: 'sendToStaffCynthia',
    report: 'generateOpsReport',
    calendarEvent: 'createCalendarEvent',
    reminder: 'createReminder',
    files: 'manageFiles',
    codeFix: 'requestCodeFix',
    escalate: 'escalateToStaff',
    portalLink: 'getPortalLink',
    writeData: 'writeData',
  },
};

export const FACADE_TOOL_NAMES = Object.keys(FACADE_OPERATION_MAP);

export function isFacadeToolName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(FACADE_OPERATION_MAP, name);
}

/** Facade args that are routing metadata, not canonical executor fields. */
const NON_FORWARDED_KEYS = new Set(['operation', 'payload']);

/**
 * Expand facade args ({ operation, payload, ...ids }) into canonical action +
 * flat args. Payload fields come first; defined non-empty top-level fields
 * (quoteId, projectId, …) override them. Returns null for non-facade names
 * and unknown operations.
 */
export function expandFacadeArgs(
  name: string,
  args: Record<string, unknown> | undefined
): { action: string; args: Record<string, unknown> } | null {
  const map = FACADE_OPERATION_MAP[name];
  if (!map) return null;
  const input = args ?? {};
  const operation = typeof input.operation === 'string' ? input.operation : '';
  const canonical = map[operation];
  if (!canonical) return null;

  const payload =
    input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : {};
  const flat: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(input)) {
    if (NON_FORWARDED_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    flat[key] = value;
  }
  return { action: canonical, args: flat };
}

/**
 * Defensive ingress normalization for CopilotActions: returns the action
 * unchanged unless its name is a facade tool with a resolvable operation, in
 * which case both input and output are expanded to the flat canonical shape
 * and the facade name is kept as `requestedAs` for the audit trail.
 */
export function expandFacadeCopilotAction(action: CopilotAction): CopilotAction {
  if (!isFacadeToolName(action.action)) return action;
  const source =
    action.output && Object.keys(action.output).length > 0 ? action.output : action.input;
  const expanded = expandFacadeArgs(action.action, source);
  if (!expanded) return action;
  return {
    ...action,
    action: expanded.action,
    input: { ...expanded.args },
    output: { ...expanded.args, requestedAs: action.action },
  };
}
