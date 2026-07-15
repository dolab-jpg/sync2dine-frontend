import type { AgentRole } from './agentContext';
import type { AIStudioConfig, AutonomyLevel } from '../../config/ai/types';
import type { CopilotAction } from './orchestratorService';
import { canExecuteAction } from './rolePermissions';
import { resolveLegacyTool } from './toolAliases';

export type ActionPolicyOverrides = Pick<
  AIStudioConfig,
  'autoRunQuoteDrafts' | 'autoRunNavigation' | 'requireConfirmCustomerMessages'
>;

const CLARIFY_BLOCKED_ACTIONS = new Set([
  'saveCustomer', 'linkCustomer', 'saveQuote', 'updateQuote', 'startQuote',
  'writeData', 'proposePaymentPlan', 'proposeSchedule', 'draftInvoice',
  'convertQuoteToProject', 'mergeCustomers', 'processRefund', 'initiatePayment',
]);

export function isWriteToolBlockedInClarify(action: string): boolean {
  return CLARIFY_BLOCKED_ACTIONS.has(resolveLegacyTool(action));
}

export function getClarifyQuestionCount(autonomy: AutonomyLevel): number {
  if (autonomy === 'assist') return 4;
  if (autonomy === 'balanced') return 2;
  return 1;
}

export function shouldSkipClarify(autonomy: AutonomyLevel, missingFieldCount: number): boolean {
  if (autonomy === 'autopilot') return missingFieldCount < 3;
  if (autonomy === 'balanced') return missingFieldCount < 2;
  return false;
}

/** Actions that need human confirmation before executing (financial / outbound comms). */
const SAFETY_CONFIRM_ACTIONS = new Set([
  'draftInvoice',
  'draftContract',
  'draftCustomerMessage',
  'notifyCustomerChangeOrder',
  'draftBuilderMessage',
  'sendContract',
  'approveQuote',
  'sendEmailReply',
  'sendEmailWithAttachment',
  'placeOutboundCall',
  'sendQuote',
  'sendInvoice',
  'mergeCustomers',
  'sendSms',
  'processRefund',
  'manageSubscription',
  'initiatePayment',
  'sendWhatsAppTemplate',
  'sendWhatsAppMedia',
]);

const CUSTOMER_MESSAGE_ACTIONS = new Set([
  'draftCustomerMessage',
  'notifyCustomerChangeOrder',
  'draftBuilderMessage',
]);

export function requiresSafetyConfirm(
  action: string,
  requireConfirmCustomerMessages?: boolean,
  output?: Record<string, unknown>
): boolean {
  const name = resolveLegacyTool(action);
  if (name === 'writeData') {
    const op = output?.operation ?? output?.op;
    return op === 'delete';
  }
  if (SAFETY_CONFIRM_ACTIONS.has(name)) {
    if (CUSTOMER_MESSAGE_ACTIONS.has(name) && !requireConfirmCustomerMessages) {
      return false;
    }
    return true;
  }
  return false;
}

export function getHumanActionLabel(action: string, output?: Record<string, unknown>): string {
  const name = resolveLegacyTool(action);
  if (name === 'writeData' && output?.operation === 'delete') {
    return `Delete ${output.collection ?? 'record'}?`;
  }
  const labels: Record<string, string> = {
    linkCustomer: 'Customer ready to save.',
    saveQuote: 'Quote ready to save.',
    proposeQuoteFields: 'Quote fields staged.',
    startQuote: 'Opening quote wizard.',
    proposePaymentPlan: 'Payment plan ready.',
    convertQuoteToProject: 'Converting quote to project.',
    proposeSchedule: 'Schedule ready.',
    draftInvoice: 'Invoice draft — check before sending.',
    draftContract: 'Contract draft — check before sending.',
    draftCustomerMessage: 'Customer message ready to send.',
    draftBuilderMessage: 'Builder message ready to send.',
    proposeChangeOrder: 'Change order ready.',
    notifyCustomerChangeOrder: 'Notify customer about change order?',
    sendContract: 'Send this contract to the customer?',
    approveQuote: 'Approve this quote price?',
    sendEmailReply: 'Send this email from your connected inbox?',
    sendEmailWithAttachment: 'Send this email with attachment(s)?',
    placeOutboundCall: 'Place this outbound call?',
    generateQuotePdf: 'Quote PDF ready.',
    draftQuote: 'Quote draft ready — confirm to make PDF.',
    generateOpsReport: 'Report ready.',
    sendToStaffCynthia: 'Card sent to Cynthia.',
    writeData: 'Delete this record?',
  };
  return labels[name] ?? `Review: ${name.replace(/([A-Z])/g, ' $1').trim()}`;
}

/** @deprecated Use processToolActions from toolRuntime instead. */
export function shouldAutoRun(
  _action: string,
  role: AgentRole,
  _autonomy: AutonomyLevel,
  _overrides?: ActionPolicyOverrides
): boolean {
  return canExecuteAction(role, _action);
}

/** @deprecated Use requiresSafetyConfirm instead. */
export function shouldShowApproval(
  action: string,
  role: AgentRole,
  _autonomy: AutonomyLevel,
  overrides?: ActionPolicyOverrides
): boolean {
  if (!canExecuteAction(role, action)) return false;
  return requiresSafetyConfirm(action, overrides?.requireConfirmCustomerMessages);
}

export function partitionCopilotActions(
  actions: CopilotAction[],
  role: AgentRole,
  _autonomy: AutonomyLevel,
  overrides?: ActionPolicyOverrides
): {
  execute: CopilotAction[];
  safetyConfirm: CopilotAction[];
  blocked: CopilotAction[];
  /** @deprecated */ silent: CopilotAction[];
  /** @deprecated */ autoRun: CopilotAction[];
  /** @deprecated */ approval: CopilotAction[];
} {
  const execute: CopilotAction[] = [];
  const safetyConfirm: CopilotAction[] = [];
  const blocked: CopilotAction[] = [];

  for (const action of actions) {
    if (!canExecuteAction(role, action.action)) {
      blocked.push(action);
      continue;
    }
    if (requiresSafetyConfirm(action.action, overrides?.requireConfirmCustomerMessages, action.output)) {
      safetyConfirm.push(action);
    } else {
      execute.push(action);
    }
  }

  return {
    execute,
    safetyConfirm,
    blocked,
    silent: execute,
    autoRun: execute,
    approval: safetyConfirm,
  };
}

export function consolidateApprovalActions(actions: CopilotAction[]): CopilotAction[] {
  return actions;
}

export type ActionTier = 'execute' | 'safety_confirm' | 'blocked';

export function getActionTier(action: string, requireConfirmCustomerMessages?: boolean, output?: Record<string, unknown>): ActionTier {
  if (requiresSafetyConfirm(action, requireConfirmCustomerMessages, output)) return 'safety_confirm';
  return 'execute';
}
