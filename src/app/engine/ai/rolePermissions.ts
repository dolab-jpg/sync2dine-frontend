import type { AgentRole } from './agentContext';
import { loadAIStudioConfig } from './aiStudioStore';

const CUSTOMER_SELF_SERVICE = new Set([
  'lookupQuote',
  'lookupProjectStatus',
  'getPortalLink',
  'escalateToStaff',
  'indicativeEstimate',
  'navigateTo',
]);

const SALES_QUOTING = new Set([
  'detectTrades',
  'proposeQuoteFields',
  'linkCustomer',
  'saveCustomer',
  'startQuote',
  'saveQuote',
  'updateQuote',
  'convertQuoteToProject',
  'searchCustomers',
  'searchProjects',
  'searchQuotes',
  'searchLeads',
  'updateLeadStatus',
  'logFollowUp',
  'addQuoteLines',
  'updateQuoteLines',
  'navigateTo',
]);

const MANAGER_INSIGHTS = new Set([
  'getTeamPerformance',
]);

const PROJECT_PM = new Set([
  'proposePaymentPlan',
  'savePaymentPlan',
  'proposeSchedule',
  'saveProjectSchedule',
  'proposePlan',
  'updateProject',
  'checkPaymentGate',
  'draftContract',
  'proposeChangeOrder',
  'updateTaskStatus',
  'completeHandover',
  'assignContractor',
  'markPaymentReceived',
]);

const FINANCIAL = new Set([
  'draftInvoice',
  'draftCustomerMessage',
  'draftBuilderMessage',
  'notifyCustomerChangeOrder',
]);

// AI pricing + contracts: available to all staff-level roles.
const CONTRACTS_PRICING = new Set([
  'priceSmallJob',
  'submitForApproval',
  'generatePaymentSchedule',
  'saveContract',
  'sendContract',
]);

// Price approval is restricted to managers and super admins (human-only gate).
const APPROVALS = new Set([
  'approveQuote',
  'rejectQuote',
]);

const FOREMAN = new Set([
  'sendBuilderBrief',
  'sendContractorBrief',
  'requestSitePhotos',
  'relayCustomerUpdate',
  'logBuilderReply',
  'logBuilderPrice',
  'tagPhoto',
  'assessExtraFromPhotos',
  'assessProgress',
]);

const COSTING = new Set([
  'recordCostEntry',
  'fixCostEntry',
  'logHours',
  'correctTimesheet',
]);

const COSTING_ADMIN = new Set([
  'getCostBreakdown',
  'getProjectProfit',
]);

const PHONE_RECEPTION = new Set([
  'classifyCallIntent',
  'captureLead',
  'bookCallback',
  'scheduleAppointment',
  'screenCandidate',
  'bookInterview',
  'logCandidate',
  'transferToHuman',
  'enqueueOutboundCall',
  'captureMessage',
]);

const RECRUITMENT = new Set([
  'screenCandidate',
  'bookInterview',
  'logCandidate',
]);

const ACCOUNTS = new Set([
  'categorizeTransaction',
  'matchTransactionToProject',
  'draftClientReceipt',
  'sendClientReceipt',
]);

const EMAIL = new Set([
  'listRecentEmails',
  'getEmailThread',
  'draftEmailReply',
  'sendEmailReply',
  'sendEmailWithAttachment',
]);

const PLANNING = new Set([
  'updateApplication',
  'setStage',
  'setPricing',
  'sendPricingEmail',
  'logDrawing',
  'sendReviewEmail',
  'recordCouncil',
  'raiseChangeRequest',
  'resolveChangeRequest',
  'setDeadline',
  'addComment',
  'portalStatusCheck',
  'sendCouncilReply',
  'sendCourtesyEmail',
  'markDecision',
  'generatePostApprovalTasks',
  'convertToProject',
]);

const ROLE_ACTIONS: Record<AgentRole, Set<string>> = {
  customer: new Set([...CUSTOMER_SELF_SERVICE, 'detectTrades']),
  agent: new Set([...CUSTOMER_SELF_SERVICE, ...PHONE_RECEPTION, ...RECRUITMENT]),
  staff: new Set([
    ...CUSTOMER_SELF_SERVICE,
    'indicativeEstimate',
    ...SALES_QUOTING,
    ...PROJECT_PM,
    ...FINANCIAL,
    ...FOREMAN,
    ...COSTING,
    ...ACCOUNTS,
    ...PHONE_RECEPTION,
    ...CONTRACTS_PRICING,
    ...PLANNING,
    ...EMAIL,
    'requestCodeFix',
  ]),
  manager: new Set([
    ...CUSTOMER_SELF_SERVICE,
    'indicativeEstimate',
    ...SALES_QUOTING,
    ...PROJECT_PM,
    ...FINANCIAL,
    ...FOREMAN,
    ...COSTING,
    ...COSTING_ADMIN,
    ...ACCOUNTS,
    ...PHONE_RECEPTION,
    ...RECRUITMENT,
    ...CONTRACTS_PRICING,
    ...APPROVALS,
    ...MANAGER_INSIGHTS,
    ...PLANNING,
    ...EMAIL,
    'requestCodeFix',
  ]),
  super_admin: new Set([
    ...CUSTOMER_SELF_SERVICE,
    'indicativeEstimate',
    ...SALES_QUOTING,
    ...PROJECT_PM,
    ...FINANCIAL,
    ...FOREMAN,
    ...COSTING,
    ...COSTING_ADMIN,
    ...ACCOUNTS,
    ...PHONE_RECEPTION,
    ...RECRUITMENT,
    ...CONTRACTS_PRICING,
    ...APPROVALS,
    ...MANAGER_INSIGHTS,
    ...PLANNING,
    ...EMAIL,
    'requestCodeFix',
  ]),
  builder: new Set([
    ...FOREMAN,
    ...COSTING,
    'lookupProjectStatus',
    'proposeSchedule',
    'updateTaskStatus',
    'tagPhoto',
    'assessProgress',
    'assessExtraFromPhotos',
    'navigateTo',
    'searchProjects',
    'requestCodeFix',
  ]),
  recruitment: new Set([...SALES_QUOTING, 'searchCustomers', ...RECRUITMENT, ...PHONE_RECEPTION]),
  unknown: new Set(['lookupQuote', 'lookupProjectStatus', 'escalateToStaff', ...PHONE_RECEPTION]),
};

export function canExecuteAction(role: AgentRole, action: string): boolean {
  if (action === 'readData' || action === 'writeData' || action === 'navigate') return true;
  const allowed = ROLE_ACTIONS[role] ?? ROLE_ACTIONS.unknown;
  return allowed.has(action);
}

export function filterActionsByRole<T extends { action: string }>(role: AgentRole, actions: T[]): T[] {
  return actions.filter((a) => canExecuteAction(role, a.action));
}

export function blockedActionMessage(role: AgentRole): string {
  if (role === 'customer') {
    return "That's one for the office — I've flagged it for the team. They'll be in touch.";
  }
  return "You don't have permission for that action — speak to a manager if you need it.";
}

export function isStaffRole(role: AgentRole): boolean {
  return role === 'staff' || role === 'manager' || role === 'super_admin';
}

/** Company-wide settings (pricing, margins, business info) — admin only for internal accounts. */
export function canManageCompanySettings(role: AgentRole): boolean {
  return role === 'super_admin';
}

export function canViewAudit(role: AgentRole): boolean {
  const roles = loadAIStudioConfig().auditRoles;
  if (roles?.length) return roles.includes(role);
  return role === 'super_admin' || role === 'manager';
}
