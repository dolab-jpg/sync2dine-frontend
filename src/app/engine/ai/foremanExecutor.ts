import { loadBuilders } from '../builder/builderStore';
import { loadContacts } from '../contacts/contactStore';
import { notifyProjectEvent } from '../notifications/notify';
import { messagingHub } from '../messaging/messagingHub';
import type { MessageChannel as OutboundMessageChannel } from '../messaging/types';
import { getProject, updateProject } from '../project/projectStore';
import type { ContractorComm, MessageChannel, ProjectMessage, UnifiedProject } from '../project/types';
import { getTrade, isValidTradeId } from '../../config/trades';

type BuilderCommChannel = OutboundMessageChannel | 'app';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveProject(projectId: string): UnifiedProject | null {
  return getProject(projectId) ?? null;
}

function toProjectMessageChannel(channel: BuilderCommChannel | undefined): MessageChannel {
  if (channel === 'email') return 'email';
  if (channel === 'whatsapp') return 'whatsapp';
  return 'app';
}

function toContractorCommChannel(channel: BuilderCommChannel | undefined): ContractorComm['channel'] {
  if (channel === 'email') return 'email';
  if (channel === 'whatsapp') return 'whatsapp';
  return 'app';
}

function persistLogs(
  project: UnifiedProject,
  message: ProjectMessage,
  contractorComm: ContractorComm
): UnifiedProject | undefined {
  return updateProject(project.id, {
    messages: [...project.messages, message],
    contractorComms: [...project.contractorComms, contractorComm],
  });
}

function resolveBuilder(project: UnifiedProject, fromPhone?: string) {
  const builders = loadBuilders();
  const normalized = fromPhone ? normalizePhone(fromPhone) : '';
  const matchByPhone = normalized
    ? builders.find((builder) => normalizePhone(builder.phone) === normalized)
    : undefined;
  const byName = builders.find((builder) => builder.name === project.assignedBuilder);
  return matchByPhone ?? byName;
}

function normalizeTradeKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function resolveContractorTradeName(tradeId?: string, tradeName?: string): string | undefined {
  if (tradeName?.trim()) return tradeName.trim();
  if (!tradeId || !isValidTradeId(tradeId)) return undefined;
  return getTrade(tradeId).name;
}

function resolveAssignedContractor(project: UnifiedProject, contractorId: string) {
  return project.assignedContractors?.find((contractor) =>
    contractor.id === contractorId || contractor.contractorId === contractorId
  );
}

function resolveAssignedContractorsByTrade(project: UnifiedProject, tradeId: string) {
  const requested = normalizeTradeKey(tradeId);
  return (project.assignedContractors ?? []).filter((contractor) => {
    const byId = normalizeTradeKey(contractor.tradeId);
    const byName = normalizeTradeKey(contractor.trade);
    return byId === requested || byName === requested;
  });
}

function resolveCustomerPhone(project: UnifiedProject): string | undefined {
  const contacts = loadContacts().filter((contact) => contact.customerId === project.customerId);
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
  return primary?.phone;
}

export async function sendBuilderMessage(
  projectId: string,
  builderPhone: string | undefined,
  builderEmail: string | undefined,
  body: string,
  channels: BuilderCommChannel[] = ['whatsapp']
): Promise<boolean> {
  const project = resolveProject(projectId);
  if (!project || !body.trim()) return false;

  const requestedChannels: BuilderCommChannel[] = channels.length > 0 ? channels : ['whatsapp'];
  const outboundChannels = requestedChannels.filter((channel): channel is OutboundMessageChannel =>
    channel === 'email' || channel === 'whatsapp'
  );

  let sentSuccess = true;
  let usedChannels: BuilderCommChannel[] = requestedChannels;
  if (outboundChannels.length > 0) {
    const sent = await messagingHub.send({
      channels: outboundChannels,
      to: {
        phone: builderPhone,
        email: builderEmail,
        customerId: project.customerId,
        customerName: project.assignedBuilder || 'Builder',
      },
      subject: `Builder brief: ${project.projectName}`,
      body,
      eventType: 'project_update',
      templateId: 'project_update',
    });
    sentSuccess = sent.success;
    usedChannels = sent.channels;
  }

  const primaryChannel = usedChannels[0];
  const builder = resolveBuilder(project, builderPhone);
  const timestamp = nowIso();
  const message: ProjectMessage = {
    id: `PM${Date.now()}`,
    from: 'Office Team',
    fromRole: 'office',
    body,
    timestamp,
    channel: toProjectMessageChannel(primaryChannel),
    emailSent: outboundChannels.length > 0 && usedChannels.includes('email'),
  };
  const contractorComm: ContractorComm = {
    id: `CC${Date.now()}`,
    builderId: builder?.id ?? 'builder',
    builderName: builder?.name ?? project.assignedBuilder,
    subject: 'Builder brief',
    body,
    status: outboundChannels.length > 0 && sentSuccess ? 'sent' : 'draft',
    channel: toContractorCommChannel(primaryChannel),
    createdAt: timestamp,
  };
  persistLogs(project, message, contractorComm);
  notifyProjectEvent(
    'builder_brief_sent',
    `Brief sent to ${builder?.name ?? project.assignedBuilder}`,
    project.projectName,
    { projectId: project.id, route: `/projects/${project.id}?tab=messages` }
  );
  return sentSuccess;
}

export async function sendContractorMessage(
  projectId: string,
  contractorId: string,
  body: string,
  channels: BuilderCommChannel[] = ['whatsapp']
): Promise<boolean> {
  const project = resolveProject(projectId);
  if (!project || !body.trim()) return false;

  const contractor = resolveAssignedContractor(project, contractorId);
  if (!contractor) return false;

  const requestedChannels: BuilderCommChannel[] = channels.length > 0 ? channels : ['whatsapp'];
  const outboundChannels = requestedChannels.filter((channel): channel is OutboundMessageChannel =>
    channel === 'email' || channel === 'whatsapp'
  );

  const hasOutboundDestination = Boolean(contractor.phone || contractor.email);
  let sentSuccess = true;
  let usedChannels: BuilderCommChannel[] = requestedChannels;
  if (outboundChannels.length > 0 && hasOutboundDestination) {
    const sent = await messagingHub.send({
      channels: outboundChannels,
      to: {
        phone: contractor.phone,
        email: contractor.email,
        customerId: contractor.contractorId ?? contractor.id,
        customerName: contractor.name,
      },
      subject: `Contractor brief: ${project.projectName}`,
      body,
      eventType: 'project_update',
      templateId: 'project_update',
    });
    sentSuccess = sent.success;
    usedChannels = sent.channels;
  } else if (outboundChannels.length > 0) {
    sentSuccess = false;
  }

  const tradeName = resolveContractorTradeName(contractor.tradeId, contractor.trade);
  const timestamp = nowIso();
  const subject = `Contractor brief · ${contractor.name}${tradeName ? ` (${tradeName})` : ''}`;
  const primaryChannel = usedChannels[0];
  const message: ProjectMessage = {
    id: `PM${Date.now()}`,
    from: 'Office Team',
    fromRole: 'office',
    body,
    timestamp,
    channel: toProjectMessageChannel(primaryChannel),
    emailSent: outboundChannels.length > 0 && usedChannels.includes('email'),
  };
  const contractorComm: ContractorComm = {
    id: `CC${Date.now()}`,
    builderId: contractor.contractorId ?? contractor.id,
    builderName: contractor.name,
    contractorId: contractor.contractorId ?? contractor.id,
    contractorTradeId: contractor.tradeId,
    contractorTradeName: tradeName,
    subject,
    body,
    status: outboundChannels.length > 0 && sentSuccess ? 'sent' : 'draft',
    channel: toContractorCommChannel(primaryChannel),
    createdAt: timestamp,
  };

  persistLogs(project, message, contractorComm);
  notifyProjectEvent(
    'builder_brief_sent',
    `Contractor brief logged for ${contractor.name}`,
    project.projectName,
    { projectId: project.id, route: `/projects/${project.id}?tab=messages` }
  );

  return outboundChannels.length === 0 ? true : sentSuccess;
}

export function logBuilderReply(projectId: string, body: string, fromPhone: string): boolean {
  const project = resolveProject(projectId);
  if (!project || !body.trim()) return false;

  const builder = resolveBuilder(project, fromPhone);
  const timestamp = nowIso();
  const message: ProjectMessage = {
    id: `PM${Date.now()}`,
    from: builder?.name ?? project.assignedBuilder ?? 'Builder',
    fromRole: 'builder',
    body,
    timestamp,
    channel: 'whatsapp',
    senderPhone: fromPhone,
  };
  const contractorComm: ContractorComm = {
    id: `CC${Date.now()}`,
    builderId: builder?.id ?? 'builder',
    builderName: builder?.name ?? project.assignedBuilder,
    subject: 'Builder reply',
    body,
    status: 'replied',
    channel: 'whatsapp',
    createdAt: timestamp,
  };
  persistLogs(project, message, contractorComm);
  notifyProjectEvent(
    'builder_reply_received',
    `Reply from ${builder?.name ?? 'builder'}`,
    body.slice(0, 80),
    { projectId: project.id, route: `/projects/${project.id}?tab=messages` }
  );
  return true;
}

export async function relayCustomerUpdate(projectId: string, body: string): Promise<boolean> {
  const project = resolveProject(projectId);
  if (!project || !project.customerAutoUpdates || !body.trim()) return false;

  const phone = resolveCustomerPhone(project);
  const channels: OutboundMessageChannel[] = [];
  if (project.customerEmail) channels.push('email');
  if (phone) channels.push('whatsapp');
  if (channels.length === 0) return false;

  const sent = await messagingHub.send({
    channels,
    to: {
      email: project.customerEmail,
      phone,
      customerId: project.customerId,
      customerName: project.customerName,
    },
    subject: `Project update: ${project.projectName}`,
    body,
    eventType: 'project_update',
    templateId: 'project_update',
  });

  const timestamp = nowIso();
  updateProject(project.id, {
    messages: [
      ...project.messages,
      {
        id: `PM${Date.now()}`,
        from: 'Office Team',
        fromRole: 'office',
        body,
        timestamp,
        channel: toProjectMessageChannel(sent.channels[0]),
        emailSent: sent.channels.includes('email'),
      },
    ],
  });

  return sent.success;
}

export function requestSitePhotos(projectId: string, body: string): boolean {
  const project = resolveProject(projectId);
  if (!project) return false;

  const requestBody = body.trim() || 'Please send today\'s site photos for the customer update.';
  const timestamp = nowIso();
  const message: ProjectMessage = {
    id: `PM${Date.now()}`,
    from: 'Office Team',
    fromRole: 'office',
    body: requestBody,
    timestamp,
    channel: 'app',
  };
  const contractorComm: ContractorComm = {
    id: `CC${Date.now()}`,
    builderId: 'builder',
    builderName: project.assignedBuilder,
    subject: 'Site photo request',
    body: requestBody,
    status: 'draft',
    channel: 'app',
    createdAt: timestamp,
  };
  persistLogs(project, message, contractorComm);
  notifyProjectEvent(
    'photo_requested',
    'Site photos requested',
    requestBody.slice(0, 80),
    { projectId: project.id, route: `/projects/${project.id}?tab=messages` }
  );
  return true;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readChannels(value: unknown): BuilderCommChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((channel): channel is BuilderCommChannel =>
    channel === 'email' || channel === 'whatsapp' || channel === 'app'
  );
}

function formatChangeOrderAmount(order: { amount: number; amountMin?: number; amountMax?: number }): string {
  if (typeof order.amountMin === 'number' && typeof order.amountMax === 'number') {
    return `£${order.amountMin.toLocaleString('en-GB')} - £${order.amountMax.toLocaleString('en-GB')}`;
  }
  return `£${order.amount.toLocaleString('en-GB')}`;
}

export async function notifyCustomerChangeOrder(
  projectId: string,
  changeOrderId: string
): Promise<boolean> {
  const project = resolveProject(projectId);
  if (!project || !project.changeOrders?.length) return false;

  const order = project.changeOrders.find((item) => item.id === changeOrderId);
  if (!order || order.status !== 'pending_customer') return false;

  const phone = resolveCustomerPhone(project);
  const channels: OutboundMessageChannel[] = [];
  if (project.customerEmail) channels.push('email');
  if (phone) channels.push('whatsapp');
  if (channels.length === 0) return false;

  const amountText = formatChangeOrderAmount(order);
  const body = [
    `Change order ready for your review: ${order.title}.`,
    order.description ? order.description : undefined,
    `Proposed amount: ${amountText}.`,
    'Please review and approve or reject this change in your customer portal.',
  ].filter(Boolean).join('\n\n');

  const sent = await messagingHub.send({
    channels,
    to: {
      email: project.customerEmail,
      phone,
      customerId: project.customerId,
      customerName: project.customerName,
    },
    subject: `Change order: ${project.projectName}`,
    body,
    eventType: 'project_update',
    templateId: 'project_update',
  });

  const timestamp = nowIso();
  updateProject(project.id, {
    messages: [
      ...project.messages,
      {
        id: `PM${Date.now()}`,
        from: 'Office Team',
        fromRole: 'office',
        body,
        timestamp,
        channel: toProjectMessageChannel(sent.channels[0]),
        emailSent: sent.channels.includes('email'),
      },
    ],
  });

  notifyProjectEvent(
    'customer_action_required',
    'Change order sent for approval',
    `${project.projectName}: ${order.title}`,
    { projectId: project.id, route: `/projects/${project.id}?tab=messages`, changeOrderId: order.id }
  );

  return sent.success;
}

interface ForemanAutoAction {
  action: string;
  output: Record<string, unknown>;
}

export async function executeForemanAutoAction(
  action: ForemanAutoAction,
  projectIdFromContext?: string | null
): Promise<string | null> {
  const projectId = readOptionalString(action.output.projectId) ?? projectIdFromContext ?? undefined;

  if (action.action === 'sendBuilderBrief') {
    if (!projectId) return 'Open a project to send a builder brief.';
    const body = readOptionalString(action.output.body) ?? '';
    if (!body) return 'Builder brief skipped (empty body).';
    const sent = await sendBuilderMessage(
      projectId,
      readOptionalString(action.output.builderPhone),
      readOptionalString(action.output.builderEmail),
      body,
      readChannels(action.output.channels)
    );
    return sent ? 'Builder brief sent and logged.' : 'Builder brief could not be sent.';
  }

  if (action.action === 'sendContractorBrief') {
    if (!projectId) return 'Open a project to send a contractor brief.';
    const body = readOptionalString(action.output.body) ?? '';
    if (!body) return 'Contractor brief skipped (empty body).';
    const channels = readChannels(action.output.channels);
    const contractorId = readOptionalString(action.output.contractorId);
    const tradeId = readOptionalString(action.output.tradeId);

    if (contractorId) {
      const sent = await sendContractorMessage(projectId, contractorId, body, channels);
      return sent ? 'Contractor brief sent and logged.' : 'Contractor brief could not be sent.';
    }

    if (!tradeId) {
      return 'Contractor brief skipped (missing contractorId or tradeId).';
    }

    const project = resolveProject(projectId);
    if (!project) return 'Could not find project for contractor brief.';

    const matching = resolveAssignedContractorsByTrade(project, tradeId);
    if (matching.length === 0) return `No assigned contractors found for trade ${tradeId}.`;

    let sentCount = 0;
    for (const contractor of matching) {
      const sent = await sendContractorMessage(projectId, contractor.id, body, channels);
      if (sent) sentCount += 1;
    }
    if (sentCount === 0) return `Contractor brief could not be sent for trade ${tradeId}.`;
    return `Contractor brief sent to ${sentCount} ${tradeId} contractor${sentCount === 1 ? '' : 's'}.`;
  }

  if (action.action === 'requestSitePhotos') {
    if (!projectId) return 'Open a project to request site photos.';
    const taskTitle = readOptionalString(action.output.taskTitle);
    const deadline = readOptionalString(action.output.deadline);
    const fallbackBody = taskTitle
      ? `Please send site photos for ${taskTitle}${deadline ? ` by ${deadline}` : ''}.`
      : 'Please send today\'s site photos for the customer update.';
    const body = readOptionalString(action.output.body) ?? fallbackBody;
    return requestSitePhotos(projectId, body)
      ? 'Requested site photos and logged it.'
      : 'Could not log the site photo request.';
  }

  if (action.action === 'relayCustomerUpdate') {
    if (!projectId) return 'Open a project to relay a customer update.';
    const body = readOptionalString(action.output.body) ?? '';
    if (!body) return 'Customer update skipped (empty body).';
    const relayed = await relayCustomerUpdate(projectId, body);
    return relayed
      ? 'Customer update relayed and logged.'
      : 'Customer update skipped (auto updates disabled or no contact channel).';
  }

  if (action.action === 'logBuilderReply') {
    if (!projectId) return 'Open a project to log a builder reply.';
    const body = readOptionalString(action.output.body) ?? '';
    const fromPhone = readOptionalString(action.output.fromPhone) ?? '';
    if (!body || !fromPhone) return 'Builder reply skipped (missing body or phone).';
    return logBuilderReply(projectId, body, fromPhone)
      ? 'Builder reply logged to project.'
      : 'Could not log the builder reply.';
  }

  if (action.action === 'notifyCustomerChangeOrder') {
    if (!projectId) return 'Open a project to notify a customer about a change order.';
    const changeOrderId = readOptionalString(action.output.changeOrderId) ?? '';
    if (!changeOrderId) return 'Change-order notification skipped (missing changeOrderId).';
    const notified = await notifyCustomerChangeOrder(projectId, changeOrderId);
    return notified
      ? 'Customer notified about the approved change order.'
      : 'Could not notify customer (approve change order first and ensure contact channels exist).';
  }

  return null;
}
