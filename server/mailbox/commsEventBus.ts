import { randomUUID } from 'crypto';
import { getDataStore, syncData, saveRecruitmentCandidate, saveRecruitmentApplication } from '../data-store';
import { handleCyrusViaOrchestrator } from '../cyrus-orchestrator';
import { runLeadEmailAgent } from './leadEmailAgent';
import { runSallyEmailAgent } from './sallyEmailAgent';
import { getHomeOrgId } from '../home-org';
import { speechContactName } from '../contact-display-name';
import type { CachedEmailMessage } from './types';
import { getConnection } from './mailbox-store';

function isSync2DineHomeOrg(orgId: string): boolean {
  const home = getHomeOrgId();
  return Boolean(orgId && home && orgId === home);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveContactByEmail(email: string): {
  customerId: string | null;
  customerName: string;
  projectId: string | null;
} {
  const store = getDataStore();
  const normalized = normalizeEmail(email);
  const customer = store.customers.find(
    c => normalizeEmail(String(c.email ?? '')) === normalized
  );
  const contact = store.contacts.find(
    c => normalizeEmail(String(c.email ?? '')) === normalized
  );
  const customerId = customer
    ? String(customer.id)
    : contact
      ? String(contact.customerId)
      : null;
  const customerName = customer
    ? String(customer.name)
    : contact
      ? String(contact.name)
      : email;
  const project = customerId
    ? store.projects.find(
      p => String(p.customerId) === customerId && p.status !== 'completed'
    )
    : undefined;
  return {
    customerId,
    customerName,
    projectId: project ? String(project.id) : null,
  };
}

function appendProjectMessage(projectId: string, msg: Record<string, unknown>): void {
  const store = getDataStore();
  const project = store.projects.find(p => String(p.id) === projectId);
  if (!project) return;
  const messages = [...(project.messages as unknown[] ?? []), msg];
  project.messages = messages;
  syncData(store);
}

const JOB_APPLICATION_PATTERNS = /\b(apply|applying|application|applicant|CV|curriculum\s*vitae|résumé|resume|job\s*(?:opening|posting|position|role|vacancy)|cover\s*letter|hire|hiring|work\s*(?:with|for|at)\s*(?:you|your)|interested\s*in\s*(?:the|a|your)\s*(?:role|position|job))\b/i;

function looksLikeJobApplication(subject: string, body: string): boolean {
  const combined = `${subject} ${body}`.slice(0, 4000);
  const matches = combined.match(JOB_APPLICATION_PATTERNS);
  return (matches?.length ?? 0) >= 1;
}

function tryRouteToRecruitment(message: CachedEmailMessage, orgId: string): boolean {
  const subject = message.subject ?? '';
  const body = message.textBody ?? message.snippet ?? '';
  if (!looksLikeJobApplication(subject, body)) return false;

  const fromName = message.fromName || message.fromAddr.split('@')[0] || 'Applicant';
  const phoneMatch = body.match(/(?:\+44|0)\d[\d\s()-]{8,14}\d/);
  const emailMatch = message.fromAddr;

  const candidate = saveRecruitmentCandidate({
    name: fromName,
    email: emailMatch,
    phone: phoneMatch?.[0]?.replace(/\s/g, '') ?? '',
    source: 'email',
    desiredRole: subject.slice(0, 120),
    notes: `Auto-detected job application email: ${subject}`,
  });

  const store = getDataStore(orgId);
  const openJob = store.recruitmentJobs.find(
    (j) => String(j.status) === 'open',
  );
  if (openJob) {
    saveRecruitmentApplication({
      candidateId: String(candidate.id),
      jobId: String(openJob.id),
      stage: 'applied',
      appliedDate: new Date().toISOString().slice(0, 10),
      stageDate: new Date().toISOString().slice(0, 10),
      notes: [`Auto-matched from email: ${subject}`],
      feedback: '',
      rating: 0,
    });
  }

  console.log(`[commsEventBus] Routed email to recruitment pipeline: ${fromName} <${emailMatch}>`);
  return true;
}

export async function processInboundEmail(message: CachedEmailMessage, orgId = 'default'): Promise<void> {
  const conn = getConnection(message.connectionId);
  const effectiveOrgId = orgId !== 'default' ? orgId : (conn?.orgId || getHomeOrgId() || 'default');
  const resolved = resolveContactByEmail(message.fromAddr);
  const timestamp = message.receivedAt;

  // Sync2Dine home org: Sally owns all inbound mail (known + unknown)
  if (isSync2DineHomeOrg(effectiveOrgId)) {
    if (tryRouteToRecruitment(message, effectiveOrgId)) return;
    try {
      const known = speechContactName(resolved.customerName);
      await runSallyEmailAgent(message, effectiveOrgId, known);
    } catch (err) {
      console.error('sallyEmailAgent error:', err);
    }
    return;
  }

  if (resolved.projectId) {
    appendProjectMessage(resolved.projectId, {
      id: randomUUID(),
      from: message.fromName || message.fromAddr,
      fromRole: 'customer',
      message: message.textBody || message.snippet,
      subject: message.subject,
      timestamp,
      channel: 'email',
      emailSent: false,
      direction: 'inbound',
      externalId: message.messageId,
    });
  }

  if (!resolved.customerId) {
    if (tryRouteToRecruitment(message, effectiveOrgId)) return;
    try {
      await runLeadEmailAgent(message, effectiveOrgId);
    } catch (err) {
      console.error('leadEmailAgent error:', err);
    }
    return;
  }

  try {
    const reply = await handleCyrusViaOrchestrator({
      messages: [{ role: 'user', content: `[Email from ${message.fromAddr}] ${message.subject}\n\n${message.textBody || message.snippet}` }],
      customerContext: {
        customerId: resolved.customerId,
        customerName: resolved.customerName,
        projectId: resolved.projectId ?? undefined,
        channel: 'email',
      },
      projectContext: resolved.projectId ? { projectId: resolved.projectId } : undefined,
    });

    if (resolved.projectId && reply.content) {
      appendProjectMessage(resolved.projectId, {
        id: randomUUID(),
        from: conn?.displayName || 'Cynthia',
        fromRole: 'office',
        message: reply.content,
        timestamp: new Date().toISOString(),
        channel: 'email',
        direction: 'outbound',
        aiGenerated: true,
      });
    }
  } catch (err) {
    console.error('commsEventBus orchestrator error:', err);
  }
}

export async function processNewMessages(messages: CachedEmailMessage[], orgId = 'default'): Promise<void> {
  for (const msg of messages) {
    await processInboundEmail(msg, orgId);
  }
}
