import { handleOrchestrator, type OrchestratorRequest } from './orchestrator-handler';
import { resolveInboundChannel, type ChannelRoute } from './channel-router';
import {
  appendConversationMessage,
  conversationToOrchestratorMessages,
} from './conversation-store';
import { normalizeInboundText, localizeOutboundText } from './translation-service';
import {
  executeChannelActions,
  filterActionsForChannelMode,
  handleConfirmationReply,
  appendProjectAiAction,
} from './channel-action-executor';
import { getDataStore, setRequestOrgId } from './data-store';
import { readStudioConfigExport } from './ai-studio-routes';
import type { ServerAgentRole } from './role-permissions';

export interface ChannelInboundRequest {
  orgId: string;
  phone: string;
  text: string;
  channel: 'whatsapp' | 'phone' | 'app';
  contactName?: string;
  projectId?: string | null;
  voiceReply?: boolean;
  apiKey?: string;
  model?: string;
}

export interface ChannelInboundResult {
  replyEnglish: string;
  replyLocalized: string;
  detectedLanguage: string;
  route: ChannelRoute;
  toolsUsed: string[];
  executedSummaries: string[];
}

function buildStaffContext(orgId: string, route: ChannelRoute): OrchestratorRequest['staffContext'] {
  const store = getDataStore(orgId);
  return {
    role: route.role ?? 'staff',
    userId: route.userId,
    userName: route.name,
    customers: store.customers.slice(0, 200).map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      email: String(c.email ?? ''),
      phone: String(c.phone ?? ''),
      status: String(c.status ?? ''),
      source: c.source ? String(c.source) : undefined,
      notes: c.notes ? String(c.notes) : undefined,
    })),
    quotes: (store.quotes ?? []).slice(0, 200).map((q) => ({
      id: String(q.id ?? ''),
      customerId: String(q.customerId ?? ''),
      customerName: String(q.customerName ?? ''),
      tradeName: q.tradeName ? String(q.tradeName) : undefined,
      total: Number(q.total ?? 0),
      status: String(q.status ?? ''),
    })),
  };
}

function resolveOrchestratorMode(route: ChannelRoute): OrchestratorRequest['orchestratorMode'] {
  if (route.mode === 'staff') return 'staff';
  if (route.mode === 'foreman') return 'foreman';
  if (route.mode === 'customer') return 'cyrus';
  return 'cyrus';
}

function resolveRole(route: ChannelRoute): ServerAgentRole {
  if (route.mode === 'staff') return (route.role as ServerAgentRole) ?? 'staff';
  if (route.mode === 'foreman') return 'builder';
  if (route.mode === 'customer') return 'customer';
  return 'unknown';
}

function buildChannelPrompt(channel: string, route: ChannelRoute): string {
  const base = channel === 'whatsapp'
    ? (route.mode === 'staff' ? 'whatsapp_staff' : route.mode === 'customer' ? 'whatsapp_customer' : 'whatsapp')
    : channel === 'phone'
      ? (route.mode === 'staff' ? 'phone_staff' : 'phone')
      : 'overlay_chat';
  return base;
}

export async function handleChannelInbound(req: ChannelInboundRequest): Promise<ChannelInboundResult> {
  const { orgId, phone, text, channel, projectId } = req;
  setRequestOrgId(orgId);

  const confirm = await handleConfirmationReply(orgId, phone, text, {
    role: resolveRole(resolveInboundChannel(phone, orgId)),
    orgId,
    phone,
    approvedBy: resolveInboundChannel(phone, orgId).name,
  });
  if (confirm.handled) {
    const route = resolveInboundChannel(phone, orgId);
    const replyEnglish = confirm.reply ?? 'Done.';
    const replyLocalized = await localizeOutboundText(replyEnglish, route.preferredLanguage);
    appendConversationMessage(orgId, phone, {
      role: 'user',
      content: text,
      bodyEnglish: text,
      detectedLanguage: 'en',
      channel,
    });
    appendConversationMessage(orgId, phone, {
      role: 'assistant',
      content: replyLocalized,
      bodyEnglish: replyEnglish,
      channel,
    });
    return {
      replyEnglish,
      replyLocalized,
      detectedLanguage: route.preferredLanguage ?? 'en',
      route,
      toolsUsed: confirm.results?.map((r) => r.action) ?? [],
      executedSummaries: confirm.results?.map((r) => r.summary) ?? [],
    };
  }

  const route = resolveInboundChannel(phone, orgId);
  const normalized = await normalizeInboundText(text, route.preferredLanguage);
  const history = conversationToOrchestratorMessages(orgId, phone, 20);
  const studio = readStudioConfigExport();
  const humourLevel = String(studio?.humourLevel ?? 'balanced');
  const companyInstructions = String(studio?.companyInstructions ?? '');

  appendConversationMessage(orgId, phone, {
    role: 'user',
    content: text,
    bodyEnglish: normalized.english,
    detectedLanguage: normalized.detectedLanguage,
    channel,
  });

  const channelKey = buildChannelPrompt(channel, route);
  const orchestratorChannel: OrchestratorRequest['channel'] =
    channelKey === 'whatsapp_staff' || channelKey === 'phone_staff'
      ? channelKey
      : channelKey === 'overlay_chat'
        ? 'overlay_chat'
        : 'customer_portal';
  const orchestratorBody: OrchestratorRequest = {
    messages: [...history, { role: 'user', content: normalized.english }],
    orchestratorMode: resolveOrchestratorMode(route),
    channel: orchestratorChannel,
    apiKey: req.apiKey,
    model: req.model ?? 'gpt-4o-mini',
    aiStudio: {
      humourLevel,
      companyInstructions,
      autonomyLevel: (studio?.autonomyLevel as OrchestratorRequest['aiStudio'] extends { autonomyLevel?: infer A } ? A : never) ?? 'autopilot',
    },
    staffContext: route.mode === 'staff' || route.mode === 'foreman'
      ? buildStaffContext(orgId, route)
      : undefined,
    customerContext: route.mode === 'customer' || route.mode === 'unknown'
      ? {
          customerId: route.customerId,
          customerName: route.customerName,
          contactName: route.contactName ?? req.contactName,
          phone,
          projectId: projectId ?? route.projectId,
          role: 'customer',
        }
      : undefined,
    projectContext: projectId
      ? (() => {
          const p = getDataStore(orgId).projects.find((x) => String(x.id) === projectId);
          return p
            ? {
                projectId: String(p.id),
                projectName: String(p.projectName ?? 'Project'),
                customerId: String(p.customerId ?? ''),
                status: String(p.status ?? ''),
              }
            : undefined;
        })()
      : undefined,
  };

  const result = await handleOrchestrator(orchestratorBody);
  const allActions = [...result.proposedActions, ...(result.autoActions ?? [])];
  const filtered = filterActionsForChannelMode(allActions, route.mode === 'unknown' ? 'customer' : route.mode);

  const executed = await executeChannelActions(filtered, {
    role: resolveRole(route),
    orgId,
    phone,
    approvedBy: route.name,
    orchestratorBody,
  });

  const executedSummaries = executed.filter((e) => e.executed).map((e) => e.summary);
  const pendingConfirm = executed.find((e) => e.needsConfirm);
  let replyEnglish = result.content ?? '';
  if (pendingConfirm?.confirmPrompt) {
    replyEnglish = `${replyEnglish}\n\n${pendingConfirm.confirmPrompt}`.trim();
  }
  if (executedSummaries.length) {
    const actionBlock = executedSummaries.join('\n');
    replyEnglish = replyEnglish ? `${replyEnglish}\n\n${actionBlock}` : actionBlock;
  }

  const replyLocalized = await localizeOutboundText(replyEnglish, route.preferredLanguage);

  appendConversationMessage(orgId, phone, {
    role: 'assistant',
    content: replyLocalized,
    bodyEnglish: replyEnglish,
    channel,
  });

  const pid = projectId ?? route.projectId;
  if (pid && executed.some((e) => e.executed)) {
    appendProjectAiAction(String(pid), {
      id: `AI${Date.now()}`,
      action: 'channelExecute',
      input: { channel, phone, route: route.mode },
      output: { executed: executedSummaries, toolsUsed: executed.map((e) => e.action) },
      status: 'approved',
      createdAt: new Date().toISOString(),
    });
  }

  return {
    replyEnglish,
    replyLocalized,
    detectedLanguage: route.preferredLanguage ?? normalized.detectedLanguage,
    route,
    toolsUsed: executed.map((e) => e.action),
    executedSummaries,
  };
}
