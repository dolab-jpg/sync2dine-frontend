import type { Customer, Quote } from '../../App';
import { integrationService } from '../integrations/integrationService';
import { buildCyrusSystemPrompt, type CyrusCustomerContext } from './cyrusPromptBuilder';
import { normalizeUkPhone } from '../messaging/whatsappProvider';
import { resolveContactByPhone } from '../contacts/contactStore';
import {
  getActiveProjectForCustomer,
  getProject,
  saveWhatsAppSession,
  syncToServer,
  updateProject,
} from '../project/projectStore';

export interface WhatsAppMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  phone: string;
  contactName?: string;
  contactRole?: string;
}

const CONVERSATIONS_KEY = 'whatsappConversations';

export function loadConversations(): Record<string, WhatsAppMessage[]> {
  try {
    return JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveConversation(phone: string, messages: WhatsAppMessage[]): void {
  const all = loadConversations();
  all[normalizeUkPhone(phone)] = messages;
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
}

export function appendConversationMessage(
  phone: string,
  msg: Omit<WhatsAppMessage, 'id' | 'timestamp'>
): WhatsAppMessage[] {
  const key = normalizeUkPhone(phone);
  const all = loadConversations();
  const thread = all[key] ?? [];
  const full: WhatsAppMessage = {
    ...msg,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    phone: key,
  };
  thread.push(full);
  all[key] = thread.slice(-100);
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
  return all[key];
}

export function buildContextFromCustomer(
  customer: Customer,
  quotes: Quote[],
  contactOverride?: { name: string; role: string; phone: string }
): CyrusCustomerContext {
  const activeQuotes = quotes
    .filter(q => q.customerId === customer.id && q.status !== 'expired')
    .map(q => ({
      id: q.id,
      tradeName: q.tradeName,
      total: q.total,
      status: q.status,
      expiresAt: q.expiresAt,
    }));

  const project = getActiveProjectForCustomer(customer.id);
  const portalLink = project?.portalToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${project.portalToken}`
    : undefined;

  const todayTasks = project?.tasks
    .filter(t => t.status !== 'completed')
    .slice(0, 3)
    .map(t => t.title);

  const nextDue = project?.paymentStages.find(s => s.status === 'due' || s.status === 'pending');

  return {
    customerName: customer.name,
    phone: contactOverride?.phone ?? customer.phone,
    email: customer.email,
    address: customer.address,
    contactName: contactOverride?.name ?? customer.name,
    contactRole: contactOverride?.role ?? 'primary',
    activeQuotes,
    activeProject: project
      ? {
          id: project.id,
          projectName: project.projectName,
          status: project.status,
          todayTasks,
          nextPaymentDue: nextDue ? `${nextDue.name}: £${nextDue.amount.toLocaleString('en-GB')}` : undefined,
          portalLink,
        }
      : undefined,
  };
}

export function findCustomerByPhone(customers: Customer[], phone: string): Customer | undefined {
  const resolved = resolveContactByPhone(phone, customers);
  if (resolved.customerId) {
    return customers.find(c => c.id === resolved.customerId);
  }
  return undefined;
}

export async function sendCyrusMessage(
  userMessage: string,
  context: CyrusCustomerContext,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  options?: { useOrchestrator?: boolean }
): Promise<string> {
  const openaiConfig = integrationService.getConfig('openai');
  const systemPrompt = buildCyrusSystemPrompt(context);
  const useOrchestrator = options?.useOrchestrator ?? true;

  const payload = {
    systemPrompt,
    model: openaiConfig.cyrusModel || 'gpt-4o-mini',
    apiKey: openaiConfig.apiKey || undefined,
    messages: [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
    customerContext: context,
    projectContext: context.activeProject
      ? {
          projectId: context.activeProject.id,
          projectName: context.activeProject.projectName,
          status: context.activeProject.status,
          todayTasks: context.activeProject.todayTasks ?? [],
          nextPaymentDue: context.activeProject.nextPaymentDue ?? null,
          portalLink: context.activeProject.portalLink ?? null,
        }
      : undefined,
  };

  const res = await fetch(useOrchestrator ? '/api/ai/orchestrate' : '/api/ai/cyrus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(useOrchestrator ? {
      ...payload,
      orchestratorMode: 'cyrus',
    } : payload),
  });

  const data = await res.json() as {
    content?: string;
    error?: string;
    proposedActions?: Array<{ action: string }>;
  };
  const content = data.content ?? data.error ?? 'Sorry, I could not process that. A team member will be in touch shortly.';

  if (context.activeProject?.id) {
    const project = getProject(context.activeProject.id);
    if (project) {
      const toolsUsed = Array.from(new Set((data.proposedActions ?? []).map(action => action.action)));
      updateProject(project.id, {
        aiActions: [
          ...project.aiActions,
          {
            id: `AI${Date.now()}`,
            action: 'cyrusReply',
            input: { channel: 'web' },
            output: { content, toolsUsed },
            status: 'approved',
            createdAt: new Date().toISOString(),
            approvedBy: 'Cyrus',
          },
        ],
      });
    }
  }

  return content;
}

export async function simulateInboundWhatsApp(
  message: string,
  customers: Customer[],
  quotes: Quote[],
  phone = '+447700900000'
): Promise<string> {
  const resolved = resolveContactByPhone(phone, customers);
  let customer = resolved.customerId
    ? customers.find(c => c.id === resolved.customerId)
    : undefined;

  if (!customer && customers.length > 0) {
    customer = customers[0];
    phone = customer.phone;
  }

  saveWhatsAppSession(phone);

  const context: CyrusCustomerContext = customer
    ? buildContextFromCustomer(customer, quotes, {
        name: resolved.contactName,
        role: resolved.contactRole,
        phone: resolved.phone,
      })
    : { customerName: 'Guest', phone, activeQuotes: [] };

  const key = normalizeUkPhone(phone);
  const history = (loadConversations()[key] ?? []).map(m => ({
    role: m.role,
    content: m.content,
  }));

  appendConversationMessage(phone, {
    role: 'user',
    content: message,
    phone: key,
    contactName: resolved.contactName,
    contactRole: resolved.contactRole,
  });
  const reply = await sendCyrusMessage(message, context, history);
  appendConversationMessage(phone, { role: 'assistant', content: reply, phone: key });
  syncToServer();

  return reply;
}

export function getAllConversationThreads(): Array<{
  phone: string;
  customerName?: string;
  contactName?: string;
  contactRole?: string;
  messages: WhatsAppMessage[];
  lastAt: string;
}> {
  const all = loadConversations();
  return Object.entries(all).map(([phone, messages]) => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return {
      phone,
      contactName: lastUser?.contactName,
      contactRole: lastUser?.contactRole,
      messages,
      lastAt: messages[messages.length - 1]?.timestamp ?? '',
    };
  }).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
