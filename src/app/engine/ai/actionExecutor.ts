import type { NavigateFunction } from 'react-router';
import type { AppContextType } from '../../App';
import type { TradeId } from '../../config/types';
import { isValidTradeId } from '../../config/trades';
import { loadProjects } from '../project/projectStore';
import { applyProposedAction as applyProjectServiceAction } from '../projectAi/projectAiService';
import { categorizeTransaction } from '../banking/bankingStore';
import { issueClientReceipt } from '../banking/clientReceiptService';
import { sendReceiptForStage } from '../banking/paymentReceiptService';
import type { TransactionCategory } from '../banking/types';
import type { CopilotAction } from './orchestratorService';
import { executeForemanAutoAction } from './foremanExecutor';

const PROJECT_ACTIONS = new Set([
  'proposePaymentPlan',
  'proposeSchedule',
  'proposePlan',
  'checkPaymentGate',
  'draftInvoice',
  'draftContract',
  'draftBuilderMessage',
  'draftCustomerMessage',
  'proposeChangeOrder',
  'logBuilderPrice',
  'updateTaskStatus',
  'tagPhoto',
  'sendBuilderBrief',
  'sendContractorBrief',
  'requestSitePhotos',
  'relayCustomerUpdate',
  'logBuilderReply',
  'assessExtraFromPhotos',
  'assessProgress',
  'recordCostEntry',
  'fixCostEntry',
  'logHours',
  'correctTimesheet',
]);

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function buildQuoteRoute(tradeId?: string, customerId?: string): string {
  const trade = tradeId && isValidTradeId(tradeId) ? tradeId : '';
  const customer = customerId ?? '';
  return `/quote/${trade}/${customer}`.replace(/\/+$/, '');
}

function normaliseFields(output: Record<string, unknown>): Record<string, unknown> {
  const source = output.prefillFields ?? output.fields;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const fields: Record<string, unknown> = {};
  Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
    if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
      fields[key] = (value as Record<string, unknown>).value;
      return;
    }
    fields[key] = value;
  });
  return fields;
}

export interface FillQuoteFieldsHandlers {
  setPendingQuoteFields: (fields: Record<string, unknown>) => void;
  setLastAcceptedFields: (fields: Record<string, unknown>) => void;
  setJobGroupId?: (jobGroupId: string | null) => void;
  setActiveTradeId?: (tradeId: TradeId | null) => void;
  navigate?: NavigateFunction;
  openQuoteAfterFill?: boolean;
}

export function navigate(output: Record<string, unknown>, navigateFn: NavigateFunction): boolean {
  const route = readOptionalString(output.route) ?? readOptionalString(output.path);
  if (!route) return false;
  navigateFn(route);
  return true;
}

export function fillQuoteFields(output: Record<string, unknown>, handlers: FillQuoteFieldsHandlers): boolean {
  const fields = normaliseFields(output);
  if (Object.keys(fields).length > 0) {
    handlers.setLastAcceptedFields(fields);
    handlers.setPendingQuoteFields(fields);
  }

  const tradeId = readOptionalString(output.tradeId);
  if (tradeId && isValidTradeId(tradeId)) {
    handlers.setActiveTradeId?.(tradeId);
  }

  const jobGroupId = readOptionalString(output.jobGroupId);
  if (jobGroupId) handlers.setJobGroupId?.(jobGroupId);

  if (handlers.openQuoteAfterFill && handlers.navigate) {
    const customerId = readOptionalString(output.customerId);
    handlers.navigate(`${buildQuoteRoute(tradeId, customerId)}?prefill=ai`);
  }

  return Object.keys(fields).length > 0 || Boolean(tradeId) || Boolean(jobGroupId);
}

export function isProjectAction(action: string): boolean {
  return PROJECT_ACTIONS.has(action);
}

export { isPlanningAction } from '../planning/planningActionNames';

export function applyProjectAction(
  projectId: string,
  action: string,
  output: Record<string, unknown>,
  approvedBy: string,
  sourceActionId?: string
): string | undefined {
  return applyProjectServiceAction(projectId, action, output, approvedBy, sourceActionId);
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  route?: string;
}

function includesQuery(value: string | null | undefined, query: string): boolean {
  if (value == null) return false;
  return String(value).toLowerCase().includes(query.toLowerCase());
}

export function searchCustomers(app: AppContextType, query: string, limit = 5): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  return app.customers
    .filter((customer) =>
      includesQuery(customer.name, q)
      || includesQuery(customer.email, q)
      || includesQuery(customer.phone, q)
      || includesQuery(customer.notes, q)
    )
    .slice(0, limit)
    .map((customer) => ({
      id: customer.id,
      title: customer.name,
      subtitle: `${customer.email} • ${customer.phone}`,
      route: '/crm',
    }));
}

export function searchProjects(query: string, limit = 5): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  return loadProjects()
    .filter((project) =>
      includesQuery(project.projectName, q)
      || includesQuery(project.customerName, q)
      || includesQuery(project.assignedBuilder, q)
      || includesQuery(project.id, q)
    )
    .slice(0, limit)
    .map((project) => ({
      id: project.id,
      title: `${project.projectName} (${project.id})`,
      subtitle: `${project.customerName} • ${project.status}`,
      route: '/projects',
    }));
}

export function searchQuotes(app: AppContextType, query: string, limit = 5): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  return app.quotes
    .filter((quote) =>
      includesQuery(quote.id, q)
      || includesQuery(quote.customerName, q)
      || includesQuery(quote.tradeName ?? quote.tradeId ?? '', q)
      || includesQuery(quote.status, q)
    )
    .slice(0, limit)
    .map((quote) => ({
      id: quote.id,
      title: `${quote.id} • ${quote.customerName}`,
      subtitle: `${quote.tradeName ?? quote.tradeId ?? 'Trade'} • £${quote.total.toFixed(0)} • ${quote.status}`,
      route: '/quotes',
    }));
}

function summariseResults(label: string, results: SearchResult[]): string {
  if (results.length === 0) return `No ${label} found.`;
  const preview = results
    .slice(0, 3)
    .map((result) => result.title)
    .join(', ');
  return `${label} found: ${preview}${results.length > 3 ? '...' : ''}`;
}

export function executeAutoAction(
  action: CopilotAction,
  app: AppContextType | null,
  navigateFn: NavigateFunction,
  projectIdFromContext?: string | null
): Promise<string | null> {
  return executeAutoActionInternal(action, app, navigateFn, projectIdFromContext);
}

async function executeAutoActionInternal(
  action: CopilotAction,
  app: AppContextType | null,
  navigateFn: NavigateFunction,
  projectIdFromContext?: string | null
): Promise<string | null> {
  const foremanResult = await executeForemanAutoAction(action, projectIdFromContext);
  if (foremanResult) return foremanResult;

  if (action.action === 'navigateTo') {
    return navigate(action.output, navigateFn) ? 'Navigated to requested page.' : null;
  }

  if (!app) return null;

  if (action.action === 'searchCustomers') {
    const query = readOptionalString(action.output.query) ?? '';
    return summariseResults('Customers', searchCustomers(app, query, Number(action.output.limit) || 5));
  }

  if (action.action === 'searchProjects') {
    const query = readOptionalString(action.output.query) ?? '';
    return summariseResults('Projects', searchProjects(query, Number(action.output.limit) || 5));
  }

  if (action.action === 'searchQuotes') {
    const query = readOptionalString(action.output.query) ?? '';
    return summariseResults('Quotes', searchQuotes(app, query, Number(action.output.limit) || 5));
  }

  if (action.action === 'categorizeTransaction') {
    const txId = readOptionalString(action.output.transactionId);
    const category = readOptionalString(action.output.category) as TransactionCategory | undefined;
    if (!txId || !category) return 'Missing transactionId or category.';
    categorizeTransaction(txId, category, readOptionalString(action.output.reason));
    return `Transaction categorised as ${category}.`;
  }

  if (action.action === 'matchTransactionToProject') {
    const txId = readOptionalString(action.output.transactionId);
    const projectId = readOptionalString(action.output.projectId);
    if (!txId || !projectId) return 'Missing transactionId or projectId.';
    categorizeTransaction(txId, 'stage-payment', 'Matched to project', {
      matchedProjectId: projectId,
      matchedCustomerId: readOptionalString(action.output.customerId),
      matchedInvoiceId: readOptionalString(action.output.invoiceId),
      matchedStageId: readOptionalString(action.output.stageId),
    });
    return `Transaction matched to project ${projectId}.`;
  }

  if (action.action === 'sendClientReceipt' || action.action === 'draftClientReceipt') {
    const projectId = readOptionalString(action.output.projectId);
    const customerId = readOptionalString(action.output.customerId);
    const txId = readOptionalString(action.output.transactionId);
    if (txId && projectId && customerId) {
      const customer = app.customers.find((c) => c.id === customerId);
      if (!customer) return 'Customer not found.';
      const result = await issueClientReceipt({
        transactionId: txId,
        projectId,
        customer,
        stageId: readOptionalString(action.output.stageId),
      });
      return result.message;
    }
    if (!projectId) return 'Missing projectId.';
    const resolvedCustomer = customerId
      ? app.customers.find((c) => c.id === customerId)
      : undefined;
    if (!resolvedCustomer) return 'Customer not found.';
    const result = await sendReceiptForStage({
      projectId,
      stageId: readOptionalString(action.output.stageId),
      stageName: readOptionalString(action.output.stageName),
      customer: resolvedCustomer,
      force: action.action === 'sendClientReceipt',
    });
    return result.message;
  }

  return null;
}
