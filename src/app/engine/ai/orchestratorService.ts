import { integrationService } from '../integrations/integrationService';
import { loadAIStudioConfig, matchKnowledgeChunks } from './aiStudioStore';
import { buildBritishVoicePrompt } from './britishVoice';
import type { AgentContext } from './agentContext';
import { isStaffRole } from './rolePermissions';
import { PLANNING_ACTIONS } from '../planning/planningActionNames';

export type OrchestratorMode = 'staff' | 'project' | 'foreman' | 'buildingControl' | 'planning' | 'customer' | 'cyrus' | 'auto';

export type OrchestratorChannel = 'overlay_chat' | 'formal_doc' | 'customer_portal';
export type TaskPhase = 'chat' | 'clarify' | 'execute' | 'complete';

export interface PendingTaskPayload {
  id: string;
  summary: string;
  questions: string[];
  askedAt: string;
}

export interface CopilotAction {
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export type OrchestratorAction = CopilotAction;

export interface OrchestratorResponse {
  content: string;
  proposedActions: CopilotAction[];
  autoActions: CopilotAction[];
  detectedTrades: Array<{ tradeId: string; confidence: number; reason?: string }>;
  mockMode?: boolean;
  phase?: TaskPhase;
  clarifyingQuestions?: string[];
  taskSummary?: string;
  pendingTaskId?: string;
}

export type OrchestratorResult = OrchestratorResponse;

export const STAFF_ACTIONS = new Set([
  'detectTrades', 'proposeQuoteFields', 'linkCustomer', 'saveCustomer', 'startQuote', 'saveQuote', 'updateQuote', 'convertQuoteToProject',
  'priceSmallJob', 'submitForApproval', 'approveQuote', 'rejectQuote', 'generatePaymentSchedule', 'saveContract', 'sendContract',
]);
export const PROJECT_ACTIONS = new Set([
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
  'notifyCustomerChangeOrder',
]);
export const AUTO_ACTIONS = new Set([
  'navigateTo',
  'navigate',
  'writeData',
  'searchCustomers',
  'searchProjects',
  'searchQuotes',
  'searchLeads',
  'getTeamPerformance',
  'updateLeadStatus',
  'logFollowUp',
  'addQuoteLines',
  'updateQuoteLines',
  'completeHandover',
  'assignContractor',
  'markPaymentReceived',
  'sendBuilderBrief',
  'sendContractorBrief',
  'requestSitePhotos',
  'relayCustomerUpdate',
  'logBuilderReply',
  'lookupQuote',
  'lookupProjectStatus',
  'getPortalLink',
  'escalateToStaff',
  ...PLANNING_ACTIONS,
]);

export { PLANNING_ACTIONS };

export function getOrchestratorMode(context: AgentContext): OrchestratorMode {
  if (context.bcSessionId) return 'buildingControl';
  if (context.planningApplicationId) return 'planning';
  if (context.route.startsWith('/planning')) return 'planning';
  if (context.role === 'customer') return 'customer';
  if (context.role === 'builder') return 'foreman';
  if (context.projectId && isStaffRole(context.role)) return 'project';
  if (isStaffRole(context.role)) return 'staff';
  return 'auto';
}

export function splitOrchestratorActions(actions: CopilotAction[]) {
  return {
    staffActions: actions.filter((action) => STAFF_ACTIONS.has(action.action)),
    projectActions: actions.filter((action) => PROJECT_ACTIONS.has(action.action)),
    autoActions: actions.filter((action) => AUTO_ACTIONS.has(action.action)),
  };
}

const QUOTE_PAYLOAD_CAP = 100;
const CUSTOMER_PAYLOAD_CAP = 100;

export async function sendOrchestratorMessage(
  messages: { role: string; content: string }[],
  context: AgentContext,
  options?: {
    model?: string;
    userName?: string;
    userId?: string;
    companyName?: string;
    customers?: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      interestedTrades?: string[];
      status?: string;
      source?: string;
      leadScore?: number;
      nextFollowUp?: string;
      budget?: string;
      notes?: string;
    }>;
    quotes?: Array<{
      id: string;
      customerId: string;
      customerName: string;
      tradeId?: string;
      tradeName?: string;
      total: number;
      status: string;
    }>;
    businessSnapshot?: {
      customerCount?: number;
      quoteCount?: number;
      projectCount?: number;
      builderCount?: number;
      officeStaffCount?: number;
      managerCount?: number;
      salesStaffCount?: number;
      recentCustomerNames?: string[];
      recentQuoteSummaries?: string[];
      leadPipeline?: Record<string, unknown>;
      officeTeamRoster?: Array<Record<string, unknown>>;
    };
    projectContext?: Record<string, unknown>;
    planningApplicationContext?: Record<string, unknown>;
    orchestratorMode?: OrchestratorMode;
    channel?: OrchestratorChannel;
    pendingTask?: PendingTaskPayload;
    customerName?: string;
    customerId?: string;
    dataContext?: Record<string, unknown[] | Record<string, unknown>>;
  }
): Promise<OrchestratorResponse> {
  const openaiConfig = integrationService.getConfig('openai');
  const studio = loadAIStudioConfig();
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const knowledge = matchKnowledgeChunks(lastUser);
  const voicePrompt = buildBritishVoicePrompt(
    studio.humourLevel,
    context.role,
    [studio.companyInstructions, ...knowledge].filter(Boolean).join('\n\n'),
    options?.channel ?? 'overlay_chat'
  );

  const mode = options?.orchestratorMode ?? getOrchestratorMode(context);
  const isCustomer = mode === 'customer';
  const cappedCustomers = options?.customers?.slice(0, CUSTOMER_PAYLOAD_CAP);
  const cappedQuotes = options?.quotes?.slice(0, QUOTE_PAYLOAD_CAP);

  const body: Record<string, unknown> = {
    model: options?.model || openaiConfig.staffModel || 'gpt-4o-mini',
    apiKey: integrationService.getLiveOpenAIApiKey(),
    messages,
    voicePrompt,
    companyName: options?.companyName ?? 'TradePro',
    businessSnapshot: options?.businessSnapshot,
    orchestratorMode: mode,
    aiStudio: {
      companyInstructions: studio.companyInstructions,
      autonomyLevel: studio.autonomyLevel,
      humourLevel: studio.humourLevel,
      knowledgeChunks: studio.knowledgeChunks,
    },
    dataContext: options?.dataContext,
    channel: options?.channel ?? 'overlay_chat',
    pendingTask: options?.pendingTask,
  };

  if (isCustomer) {
    body.customerContext = {
      customerName: options?.customerName ?? options?.userName ?? 'Customer',
      contactName: options?.userName ?? options?.customerName ?? 'Customer',
      customerId: options?.customerId ?? context.customerId,
      projectId: context.projectId,
      role: context.role,
    };
    body.projectContext = options?.projectContext ?? (context.projectId
      ? { projectId: context.projectId }
      : undefined);
  } else {
    body.staffContext = {
      role: context.role,
      route: context.route,
      tradeId: context.tradeId,
      customerId: context.customerId,
      userName: options?.userName,
      userId: options?.userId,
      customers: cappedCustomers,
      quotes: cappedQuotes,
      planningApplicationId: context.planningApplicationId,
    };
    body.projectContext = options?.projectContext ?? (context.projectId
      ? { projectId: context.projectId }
      : undefined);
    if (options?.planningApplicationContext) {
      body.planningApplicationContext = options.planningApplicationContext;
    } else if (context.planningApplicationId) {
      body.planningApplicationContext = { id: context.planningApplicationId };
    }
  }

  const response = await fetch('/api/ai/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = response.status === 503
      ? 'OpenAI not connected — add your API key in Settings → Integrations → OpenAI and Save.'
      : `Orchestrator request failed: ${response.status}`;
    try {
      const data = await response.json() as { error?: string; code?: 'missing' | 'rejected' };
      if (data.error) detail = data.error;
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }

  return response.json() as Promise<OrchestratorResponse>;
}
