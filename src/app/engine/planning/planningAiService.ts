import { integrationService } from '../integrations/integrationService';
import { addNotification } from '../notifications/notificationStore';
import {
  addPlanningChangeRequest,
  addPlanningComment,
  getPlanningApplication,
  recordPlanningAiAction,
  snapshotForUndo,
  updateChangeRequest,
  updatePlanningApplication,
} from './planningStore';
import type {
  PlanningApplication,
  PlanningPostApproval,
  PostApprovalWorkstream,
} from './types';

export interface PlanningAgentAction {
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface PlanningAgentResponse {
  content: string;
  actions: PlanningAgentAction[];
  mockMode?: boolean;
}

interface RunOptions {
  application: PlanningApplication;
  messages: { role: string; content: string }[];
  sourceEmail?: string;
  userRole?: string;
  userName?: string;
}

function getApiKey(): string | undefined {
  if (integrationService.isMasterMockMode()) return undefined;
  return integrationService.getLiveOpenAIApiKey();
}

export function buildPlanningOrchestratorContext(app: PlanningApplication) {
  return {
    id: app.id,
    customerName: app.customerName,
    customerEmail: app.customerEmail,
    address: app.address,
    title: app.title,
    applicationType: app.applicationType,
    stage: app.stage,
    pricing: { amount: app.pricing.amount, sentAt: app.pricing.sentAt, acceptedAt: app.pricing.acceptedAt },
    council: {
      name: app.council.name,
      reference: app.council.reference,
      portalUrl: app.council.portalUrl,
      submittedAt: app.council.submittedAt,
      validationOfficer: app.council.validationOfficer,
      targetDecisionDate: app.council.targetDecisionDate,
    },
    changeRequests: app.changeRequests.map((c) => ({
      id: c.id,
      description: c.description,
      deadline: c.deadline,
      status: c.status,
    })),
    drawingsCount: app.drawings.length,
    decision: app.decision,
  };
}

function buildContext(app: PlanningApplication) {
  return buildPlanningOrchestratorContext(app);
}

export async function runPlanningAgent(opts: RunOptions): Promise<{ content: string; applied: string[]; mockMode?: boolean }> {
  const res = await fetch('/api/ai/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: getApiKey(),
      model: 'gpt-4o-mini',
      messages: opts.messages,
      application: buildContext(opts.application),
      sourceEmail: opts.sourceEmail,
      userRole: opts.userRole,
      userName: opts.userName,
    }),
  });
  if (!res.ok) {
    throw new Error(`Planning AI error: ${res.status}`);
  }
  const data = (await res.json()) as PlanningAgentResponse;

  const applied = await executePlanningActions(opts.application.id, data.actions, opts.userName ?? 'AI');
  return { content: data.content, applied, mockMode: data.mockMode };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function sendCustomerEmail(
  app: PlanningApplication,
  subject: string,
  body: string
): Promise<void> {
  if (!app.customerEmail) return;
  try {
    const { messagingHub } = await import('../messaging/messagingHub');
    await messagingHub.send({
      channels: ['email'],
      to: {
        email: app.customerEmail,
        customerId: app.customerId ?? app.id,
        customerName: app.customerName,
      },
      subject,
      body,
      eventType: 'custom',
    });
  } catch {
    // mock / offline — message logged elsewhere
  }
}

function approvalLink(token: string): string {
  if (typeof window === 'undefined') return `/planning-approve/${token}`;
  return `${window.location.origin}/planning-approve/${token}`;
}

/**
 * Apply each agent action to the planning store with full autonomy, capturing a
 * pre-action snapshot so every step can be undone from the audit log.
 */
export async function executePlanningActions(
  appId: string,
  actions: PlanningAgentAction[],
  by: string
): Promise<string[]> {
  const summaries: string[] = [];

  for (const { action, input } of actions) {
    const app = getPlanningApplication(appId);
    if (!app) break;
    const previous = snapshotForUndo(app);
    let summary = '';

    switch (action) {
      case 'updateApplication': {
        const patch: Partial<PlanningApplication> = {};
        if (str(input.title)) patch.title = str(input.title);
        if (str(input.address)) patch.address = str(input.address);
        if (str(input.description)) patch.description = str(input.description);
        if (str(input.customerName)) patch.customerName = str(input.customerName);
        if (str(input.customerEmail)) patch.customerEmail = str(input.customerEmail);
        if (str(input.applicationType)) {
          patch.applicationType = str(input.applicationType) as PlanningApplication['applicationType'];
        }
        updatePlanningApplication(appId, patch);
        summary = 'Updated application details';
        break;
      }
      case 'setStage': {
        const stage = str(input.stage) as PlanningApplication['stage'] | undefined;
        if (!stage) continue;
        updatePlanningApplication(appId, { stage });
        summary = `Moved to "${stage}"`;
        break;
      }
      case 'setPricing': {
        updatePlanningApplication(appId, {
          pricing: { ...app.pricing, amount: num(input.amount) ?? app.pricing.amount, scope: str(input.scope) ?? app.pricing.scope },
        });
        summary = `Set planning fee${num(input.amount) != null ? ` to £${num(input.amount)}` : ''}`;
        break;
      }
      case 'sendPricingEmail': {
        const subject = str(input.subject) ?? 'Planning application — our proposal';
        const body = str(input.body) ?? '';
        await sendCustomerEmail(app, subject, body);
        updatePlanningApplication(appId, {
          pricing: { ...app.pricing, amount: num(input.amount) ?? app.pricing.amount, sentAt: new Date().toISOString() },
        });
        addPlanningComment(appId, `Pricing email sent to ${app.customerName}.`, 'ai', by);
        summary = 'Sent pricing email';
        break;
      }
      case 'logDrawing': {
        const filename = str(input.filename) ?? `drawing-${Date.now()}.pdf`;
        const version = (app.drawings[app.drawings.length - 1]?.version ?? 0) + 1;
        updatePlanningApplication(appId, {
          drawings: [
            ...app.drawings,
            {
              id: `dwg-${Date.now()}`,
              filename,
              mimeType: 'application/pdf',
              version,
              uploadedAt: new Date().toISOString(),
              uploadedBy: by,
              note: str(input.note),
            },
          ],
          stage: app.stage === 'pricing' ? 'drawings' : app.stage,
        });
        summary = `Logged drawing "${filename}"`;
        break;
      }
      case 'sendReviewEmail': {
        const subject = str(input.subject) ?? 'Your planning drawings — please review';
        const link = approvalLink(app.customerApproval.token);
        const body = `${str(input.body) ?? ''}\n\nReview & approve your drawings: ${link}`;
        await sendCustomerEmail(app, subject, body);
        updatePlanningApplication(appId, {
          customerApproval: { ...app.customerApproval, status: 'pending', sentAt: new Date().toISOString() },
          stage: 'customer_approval',
        });
        addPlanningComment(appId, `Drawings review email sent to ${app.customerName}.`, 'ai', by);
        summary = 'Sent drawings review email';
        break;
      }
      case 'recordCouncil': {
        const submittedAt = str(input.submittedAt);
        updatePlanningApplication(appId, {
          council: {
            ...app.council,
            name: str(input.name) ?? app.council.name,
            reference: str(input.reference) ?? app.council.reference,
            portalUrl: str(input.portalUrl) ?? app.council.portalUrl,
            validationOfficer: str(input.validationOfficer) ?? app.council.validationOfficer,
            validationOfficerEmail: str(input.validationOfficerEmail) ?? app.council.validationOfficerEmail,
            targetDecisionDate: str(input.targetDecisionDate) ?? app.council.targetDecisionDate,
            submittedAt: submittedAt ?? app.council.submittedAt,
          },
          stage: submittedAt ? 'submitted' : app.stage,
        });
        summary = 'Recorded council details';
        break;
      }
      case 'raiseChangeRequest': {
        const description = str(input.description);
        if (!description) continue;
        const deadline = str(input.deadline);
        addPlanningChangeRequest(appId, {
          description,
          deadline,
          sourceEmail: str(input.sourceEmail),
          aiComment: str(input.aiComment),
        });
        addNotification({
          type: 'customer_action_required',
          title: 'Planning: change requested',
          message: `${app.customerName}: ${description}${deadline ? ` (due ${deadline})` : ''}`,
          data: { planningId: appId },
        });
        summary = `Raised change request${deadline ? ` (due ${deadline})` : ''}`;
        break;
      }
      case 'resolveChangeRequest': {
        const id = str(input.changeRequestId);
        const desc = str(input.description);
        const target = app.changeRequests.find(
          (c) => (id && c.id === id) || (desc && c.description.toLowerCase().includes(desc.toLowerCase()))
        ) ?? app.changeRequests.find((c) => c.status === 'open');
        if (!target) continue;
        updateChangeRequest(appId, target.id, { status: 'resolved', resolvedAt: new Date().toISOString() });
        summary = 'Resolved a change request';
        break;
      }
      case 'setDeadline': {
        const deadline = str(input.deadline);
        if (!deadline) continue;
        const id = str(input.changeRequestId);
        if (id) {
          updateChangeRequest(appId, id, { deadline });
          summary = `Set change-request deadline to ${deadline}`;
        } else {
          updatePlanningApplication(appId, {
            council: { ...app.council, targetDecisionDate: deadline },
          });
          summary = `Set target decision date to ${deadline}`;
        }
        break;
      }
      case 'addComment': {
        const body = str(input.body);
        if (!body) continue;
        addPlanningComment(appId, body, 'ai', by);
        summary = 'Added a note';
        break;
      }
      case 'portalStatusCheck': {
        const note = str(input.note) ?? 'Check the council portal for the latest status.';
        addPlanningComment(appId, `Portal status check: ${note}`, 'ai', by);
        summary = 'Logged a portal status check';
        break;
      }
      case 'sendCouncilReply': {
        const subject = str(input.subject) ?? 'Re: planning application';
        const body = str(input.body) ?? '';
        const officerEmail = app.council.validationOfficerEmail;
        if (officerEmail) {
          try {
            const { messagingHub } = await import('../messaging/messagingHub');
            await messagingHub.send({
              channels: ['email'],
              to: { email: officerEmail, customerId: app.customerId ?? app.id, customerName: app.council.validationOfficer ?? 'Planning Officer' },
              subject,
              body,
              eventType: 'custom',
            });
          } catch {
            // mock / offline
          }
        }
        addPlanningComment(appId, `Reply to validation team${officerEmail ? ` (${officerEmail})` : ''}:\n${body}`, 'ai', by);
        summary = 'Drafted/sent council reply';
        break;
      }
      case 'sendCourtesyEmail': {
        const subject = str(input.subject) ?? 'An update on your planning application';
        const body = str(input.body) ?? '';
        await sendCustomerEmail(app, subject, body);
        updatePlanningApplication(appId, { courtesyEmailSentAt: new Date().toISOString() });
        addPlanningComment(appId, `Courtesy pre-approval email sent to ${app.customerName}.`, 'ai', by);
        summary = 'Sent courtesy email';
        break;
      }
      case 'markDecision': {
        const decision = str(input.decision) === 'refused' ? 'refused' : 'approved';
        updatePlanningApplication(appId, {
          decision,
          decidedAt: new Date().toISOString(),
          decisionNote: str(input.note),
          stage: decision === 'approved' ? 'approved' : 'refused',
        });
        summary = `Marked application ${decision}`;
        break;
      }
      case 'generatePostApprovalTasks': {
        const ws = str(input.workstream) as keyof PlanningPostApproval | undefined;
        if (!ws || !(ws in app.postApproval)) continue;
        const taskTitles = Array.isArray(input.tasks) ? input.tasks.map(String) : [];
        const workstream: PostApprovalWorkstream = {
          status: 'in_progress',
          notes: str(input.notes) ?? app.postApproval[ws].notes,
          tasks: taskTitles.map((title, i) => ({ id: `pat-${Date.now()}-${i}`, title, done: false })),
        };
        updatePlanningApplication(appId, {
          postApproval: { ...app.postApproval, [ws]: workstream },
          stage: app.decision === 'approved' || app.stage === 'approved' ? 'post_approval' : app.stage,
        });
        summary = `Created ${taskTitles.length} ${ws} task(s)`;
        break;
      }
      case 'convertToProject': {
        try {
          const { createProjectFromQuote } = await import('../project/projectStore');
          const project = createProjectFromQuote(
            {
              id: `plan-${app.id}`,
              customerId: app.customerId ?? '',
              customerName: app.customerName,
              total: app.pricing.amount ?? 0,
              tradeName: 'Planning & Build',
            },
            { email: app.customerEmail ?? '', address: app.address, phone: app.customerPhone ?? '' }
          );
          updatePlanningApplication(appId, { projectId: project.id, stage: 'completed' });
          summary = 'Converted to a delivery project';
        } catch {
          summary = 'Could not convert to project';
        }
        break;
      }
      default:
        continue;
    }

    if (summary) {
      recordPlanningAiAction(appId, { action, summary, input, previous }, by);
      summaries.push(summary);
    }
  }

  return summaries;
}
