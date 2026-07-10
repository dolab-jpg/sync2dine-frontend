import { buildProjectAISystemPrompt } from './projectAiPromptBuilder';
import type { UnifiedProject, AIActionLog } from '../project/types';
import { getProject, updateProject } from '../project/projectStore';
import { integrationService } from '../integrations/integrationService';

export interface ProjectAIResponse {
  content: string;
  proposedActions?: Array<{
    action: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
  autoActions?: Array<{
    action: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function approveChangeOrderForCustomer(
  projectId: string,
  changeOrderId: string,
  approvedBy: string
): UnifiedProject | undefined {
  const project = getProject(projectId);
  if (!project || !project.changeOrders?.length) return undefined;

  const now = new Date().toISOString();
  return updateProject(projectId, {
    changeOrders: project.changeOrders.map((order) => (
      order.id === changeOrderId && order.status === 'proposed'
        ? {
            ...order,
            status: 'pending_customer' as const,
            staffApprovedAt: now,
            staffApprovedBy: approvedBy,
          }
        : order
    )),
  });
}

export async function sendProjectAIMessage(
  project: UnifiedProject,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ProjectAIResponse> {
  const openaiConfig = integrationService.getConfig('openai');
  const company = integrationService.getConfig('company');

  const res = await fetch('/api/ai/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: buildProjectAISystemPrompt(project, company.companyName),
      model: openaiConfig.staffModel || 'gpt-4o-mini',
      apiKey: openaiConfig.apiKey || undefined,
      messages: [...history, { role: 'user', content: userMessage }],
      projectContext: {
        projectId: project.id,
        projectName: project.projectName,
        total: project.totalCustomerCost,
      },
    }),
  });

  const data = await res.json() as ProjectAIResponse;
  return data;
}

export function applyProposedAction(
  projectId: string,
  action: string,
  output: Record<string, unknown>,
  approvedBy: string,
  sourceActionId?: string
): string | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;
  let createdChangeOrderId: string | undefined;

  const log: AIActionLog = {
    id: `AI${Date.now()}`,
    action,
    input: {},
    output,
    status: 'approved',
    createdAt: new Date().toISOString(),
    approvedBy,
  };

  const existingActions = sourceActionId
    ? project.aiActions.map(a => (a.id === sourceActionId ? { ...a, status: 'approved' as const, approvedBy } : a))
    : project.aiActions;
  const updates: Partial<UnifiedProject> = {
    aiActions: [...existingActions, log],
  };

  if (action === 'proposePaymentPlan' && output.stages) {
    const stages = (output.stages as Array<Record<string, unknown>>).map((s, i) => ({
      id: `PS${Date.now()}${i}`,
      name: String(s.name),
      percentage: Number(s.percentage),
      amount: project.totalCustomerCost * (Number(s.percentage) / 100),
      status: 'pending' as const,
      notes: String(s.notes ?? ''),
    }));
    updates.paymentStages = stages;
  }

  if (action === 'proposeSchedule') {
    if (output.workingDaysOff) {
      updates.workingDaysOff = output.workingDaysOff as string[];
    }
    if (output.tasks) {
      updates.tasks = [
        ...project.tasks,
        ...(output.tasks as Array<Record<string, unknown>>).map((t, i) => ({
          id: `T${Date.now()}${i}`,
          title: String(t.title),
          description: String(t.description ?? ''),
          assignedTo: String(t.assignedTo ?? project.assignedBuilder),
          status: 'todo' as const,
          targetDate: String(t.targetDate ?? ''),
          priority: (t.priority as 'low' | 'medium' | 'high') ?? 'medium',
          photos: [],
          createdAt: new Date().toISOString(),
          createdBy: approvedBy,
          source: 'ai' as const,
        })),
      ];
    }
    if (output.milestones) {
      updates.milestones = [
        ...project.milestones,
        ...(output.milestones as Array<Record<string, unknown>>).map((m, i) => ({
          id: `M${Date.now()}${i}`,
          title: String(m.title),
          targetDate: String(m.targetDate ?? ''),
          completed: false,
        })),
      ];
    }
  }

  if (action === 'proposePlan') {
    if (output.tasks) {
      updates.tasks = [
        ...project.tasks,
        ...(output.tasks as Array<Record<string, unknown>>).map((t, i) => ({
          id: `T${Date.now()}${i}`,
          title: String(t.title),
          description: String(t.description ?? ''),
          assignedTo: String(t.owner ?? t.assignedTo ?? project.assignedBuilder),
          status: 'todo' as const,
          targetDate: String(t.due ?? t.targetDate ?? ''),
          priority: 'medium' as const,
          photos: [],
          createdAt: new Date().toISOString(),
          createdBy: approvedBy,
          source: 'ai' as const,
        })),
      ];
    }
    if (output.milestones) {
      updates.milestones = [
        ...project.milestones,
        ...(output.milestones as Array<Record<string, unknown>>).map((m, i) => ({
          id: `M${Date.now()}${i}`,
          title: String(m.title),
          targetDate: String(m.targetDate ?? ''),
          completed: false,
        })),
      ];
    }
    if (output.title) {
      updates.plans = [
        ...(project.plans ?? []),
        {
          id: `PLAN${Date.now()}`,
          title: String(output.title),
          status: 'draft',
          cadence: (String(output.cadence ?? 'daily') as 'daily' | 'weekly' | 'monthly' | 'milestone' | 'ad_hoc'),
          notes: `Cadence: ${String(output.cadence ?? 'daily')}`,
        },
      ];
    }
  }

  if (action === 'checkPaymentGate' && output.stageName) {
    const evidence = Array.isArray(output.evidenceNeeded)
      ? (output.evidenceNeeded as unknown[]).map(item => String(item)).filter(Boolean)
      : [];
    updates.messages = [
      ...project.messages,
      {
        id: `PM${Date.now()}`,
        from: approvedBy,
        fromRole: 'office',
        body: `Payment gate check for ${String(output.stageName)}. Evidence needed: ${evidence.join(', ') || 'none listed'}.`,
        channel: 'app',
        timestamp: new Date().toISOString(),
        emailSent: false,
      },
    ];
  }

  if (action === 'draftInvoice') {
    const invoice = {
      id: `INV${Date.now()}`,
      stageId: undefined,
      lineItems: (output.lineItems as Array<{ description: string; amount: number }>) ?? [],
      total: Number(output.total) || project.totalCustomerCost * 0.4,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
    };
    updates.invoices = [...project.invoices, invoice];
  }

  if (action === 'draftContract') {
    const contract = {
      id: `CON${Date.now()}`,
      terms: String(output.terms),
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
    };
    updates.contracts = [...project.contracts, contract];
  }

  if (action === 'draftBuilderMessage') {
    updates.contractorComms = [
      ...project.contractorComms,
      {
        id: `CC${Date.now()}`,
        builderId: 'builder',
        builderName: project.assignedBuilder,
        subject: String(output.subject),
        body: String(output.body),
        priceQuoted: output.priceQuoted ? Number(output.priceQuoted) : undefined,
        status: 'draft' as const,
        channel: 'app' as const,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  if (action === 'draftCustomerMessage') {
    const body = String(output.body ?? '').trim();
    if (body) {
      updates.messages = [
        ...project.messages,
        {
          id: `PM${Date.now()}`,
          from: approvedBy,
          fromRole: 'office',
          body,
          channel: 'app',
          timestamp: new Date().toISOString(),
          emailSent: false,
        },
      ];
    }
  }

  if (action === 'logBuilderPrice') {
    updates.contractorComms = [
      ...project.contractorComms,
      {
        id: `CC${Date.now()}`,
        builderId: 'builder',
        builderName: String(output.builderName ?? project.assignedBuilder),
        subject: 'Price quoted',
        body: String(output.notes ?? 'Builder price recorded'),
        priceQuoted: Number(output.priceQuoted),
        status: 'replied' as const,
        channel: 'app' as const,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  if (action === 'updateTaskStatus' && output.taskTitle) {
    const title = String(output.taskTitle).toLowerCase();
    updates.tasks = project.tasks.map(t =>
      t.title.toLowerCase().includes(title) || title.includes(t.title.toLowerCase())
        ? {
            ...t,
            status: (output.status as 'todo' | 'in_progress' | 'completed') ?? t.status,
            targetDate: output.targetDate ? String(output.targetDate) : t.targetDate,
            completedAt: output.status === 'completed' ? new Date().toISOString() : t.completedAt,
          }
        : t
    );
  }

  if (action === 'tagPhoto' && output.caption) {
    const files = [...project.files];
    if (files.length > 0) {
      const idx = output.fileId
        ? files.findIndex(f => f.id === output.fileId)
        : files.length - 1;
      if (idx >= 0) {
        files[idx] = { ...files[idx], caption: String(output.caption) };
        updates.files = files;
      }
    }
  }

  if (action === 'assessExtraFromPhotos') {
    const title = readOptionalString(output.title) ?? 'Variation candidate';
    const description = readOptionalString(output.description) ?? 'Extra scope assessed from site photos.';
    const amountMin = readOptionalNumber(output.amountMin);
    const amountMax = readOptionalNumber(output.amountMax);
    const confidence = readOptionalNumber(output.confidence);
    const risks = Array.isArray(output.risks)
      ? output.risks.map((risk) => String(risk)).filter(Boolean)
      : [];
    const confidenceText = typeof confidence === 'number' ? ` (${Math.round(confidence * 100)}% confidence)` : '';
    updates.messages = [
      ...project.messages,
      {
        id: `PM${Date.now()}`,
        from: approvedBy,
        fromRole: 'office',
        body: `Vision extra assessment${confidenceText}: ${title}. ${description}${amountMin || amountMax ? ` Estimated range £${amountMin ?? 0} - £${amountMax ?? amountMin ?? 0}.` : ''}${risks.length ? ` Risks: ${risks.join('; ')}.` : ''}`,
        channel: 'app',
        timestamp: new Date().toISOString(),
        emailSent: false,
      },
    ];

    const proposed = output.proposeChangeOrder;
    if (proposed && typeof proposed === 'object' && !Array.isArray(proposed)) {
      const draft = proposed as Record<string, unknown>;
      const amount = readOptionalNumber(draft.amount) ?? readOptionalNumber(draft.amountMax) ?? readOptionalNumber(draft.amountMin) ?? 0;
      const changeOrderId = `CO${Date.now()}`;
      updates.changeOrders = [
        ...(project.changeOrders ?? []),
        {
          id: changeOrderId,
          title: readOptionalString(draft.title) ?? title,
          amount,
          amountMin: readOptionalNumber(draft.amountMin) ?? amountMin,
          amountMax: readOptionalNumber(draft.amountMax) ?? amountMax,
          status: 'proposed',
          createdAt: new Date().toISOString(),
          description: readOptionalString(draft.description) ?? description,
          reason: readOptionalString(draft.reason) ?? 'Vision extra assessment',
          sourcePhotoIds: Array.isArray(draft.photoIds) ? draft.photoIds.map((id) => String(id)).filter(Boolean) : undefined,
        },
      ];
    }
  }

  if (action === 'assessProgress') {
    const summary = readOptionalString(output.summary) ?? 'Progress assessed from latest site photos.';
    const snagList = Array.isArray(output.snagList)
      ? output.snagList.map((snag) => String(snag)).filter(Boolean)
      : [];
    updates.messages = [
      ...project.messages,
      {
        id: `PM${Date.now()}`,
        from: approvedBy,
        fromRole: 'office',
        body: `Vision progress assessment: ${summary}${snagList.length ? ` Snags: ${snagList.join('; ')}.` : ''}`,
        channel: 'app',
        timestamp: new Date().toISOString(),
        emailSent: false,
      },
    ];

    if (Array.isArray(output.suggestedTaskUpdates)) {
      const suggested = output.suggestedTaskUpdates as Array<Record<string, unknown>>;
      updates.tasks = project.tasks.map((task) => {
        const match = suggested.find((row) => {
          const taskTitle = String(row.taskTitle ?? row.title ?? '').toLowerCase();
          return taskTitle && (task.title.toLowerCase().includes(taskTitle) || taskTitle.includes(task.title.toLowerCase()));
        });
        if (!match) return task;
        const status = String(match.status ?? task.status);
        if (status !== 'todo' && status !== 'in_progress' && status !== 'completed') return task;
        return {
          ...task,
          status,
          completedAt: status === 'completed' ? new Date().toISOString() : task.completedAt,
        };
      });
    }
  }

  if (action === 'proposeChangeOrder') {
    const amount = readOptionalNumber(output.amount);
    const amountMin = readOptionalNumber(output.amountMin);
    const amountMax = readOptionalNumber(output.amountMax);
    const fallbackAmount = amountMax ?? amountMin ?? 0;
    const normalizedAmount = amount ?? fallbackAmount;
    const sourcePhotoIds = Array.isArray(output.photoIds)
      ? output.photoIds.map((id) => String(id)).filter(Boolean)
      : [];
    const changeOrderId = `CO${Date.now()}`;
    createdChangeOrderId = changeOrderId;

    updates.changeOrders = [
      ...(project.changeOrders ?? []),
      {
        id: changeOrderId,
        title: readOptionalString(output.title) ?? 'Change order',
        amount: normalizedAmount,
        amountMin,
        amountMax,
        status: 'proposed',
        createdAt: new Date().toISOString(),
        description: readOptionalString(output.description),
        reason: readOptionalString(output.reason),
        estimatedDays: readOptionalNumber(output.estimatedDays),
        sourcePhotoIds: sourcePhotoIds.length > 0 ? sourcePhotoIds : undefined,
      },
    ];
  }

  if (action === 'recordCostEntry') {
    const supplier = readOptionalString(output.supplier) ?? 'Supplier';
    const total = readOptionalNumber(output.total) ?? 0;
    const itemsRaw = Array.isArray(output.items) ? output.items as Array<Record<string, unknown>> : [];
    const items = itemsRaw.length > 0
      ? itemsRaw.map((item) => ({
          description: readOptionalString(item.description) ?? supplier,
          qty: readOptionalNumber(item.qty) ?? 1,
          unitPrice: readOptionalNumber(item.unitPrice) ?? total,
          total: readOptionalNumber(item.total) ?? total,
          category: readOptionalString(item.category) ?? 'other',
        }))
      : [{ description: supplier, qty: 1, unitPrice: total, total, category: 'other' }];

    const entry = {
      id: `CE${Date.now()}`,
      projectId,
      builderId: readOptionalString(output.builderId) ?? 'ai',
      type: 'ai' as const,
      supplier,
      date: new Date().toISOString().split('T')[0],
      items,
      subtotal: total,
      vat: 0,
      total,
      aiConfidence: 1,
      aiSummary: readOptionalString(output.aiSummary) ?? `AI recorded: ${supplier} — £${total}`,
      status: 'recorded' as const,
      createdAt: new Date().toISOString(),
    };
    updates.costEntries = [...(project.costEntries ?? []), entry];
  }

  if (action === 'fixCostEntry') {
    const entryId = readOptionalString(output.entryId);
    if (entryId) {
      updates.costEntries = (project.costEntries ?? []).map((entry) => {
        if (entry.id !== entryId) return entry;
        const total = readOptionalNumber(output.total) ?? entry.total;
        return {
          ...entry,
          supplier: readOptionalString(output.supplier) ?? entry.supplier,
          total,
          subtotal: total,
          status: 'recorded' as const,
          aiSummary: readOptionalString(output.notes) ?? entry.aiSummary,
        };
      });
    }
  }

  if (action === 'logHours') {
    const hours = readOptionalNumber(output.hours) ?? 0;
    const rate = readOptionalNumber(output.rate) ?? 25;
    const labourCost = Math.round(hours * rate * 100) / 100;
    const clockInDate = readOptionalString(output.date)
      ? new Date(String(output.date))
      : new Date();
    const entry = {
      id: `TS${Date.now()}`,
      projectId,
      builderId: readOptionalString(output.builderId) ?? 'ai',
      clockIn: clockInDate.toISOString(),
      clockOut: new Date(clockInDate.getTime() + hours * 3600000).toISOString(),
      hours,
      rate,
      labourCost,
      notes: readOptionalString(output.notes),
    };
    updates.timesheets = [...(project.timesheets ?? []), entry];
    output.hours = hours;
    output.labourCost = labourCost;
  }

  if (action === 'correctTimesheet') {
    const timesheetId = readOptionalString(output.timesheetId);
    if (timesheetId) {
      updates.timesheets = (project.timesheets ?? []).map((t) => {
        if (t.id !== timesheetId) return t;
        const hours = readOptionalNumber(output.hours) ?? t.hours ?? 0;
        const rate = readOptionalNumber(output.rate) ?? t.rate;
        return {
          ...t,
          hours,
          rate,
          labourCost: Math.round(hours * rate * 100) / 100,
          notes: readOptionalString(output.notes) ?? t.notes,
        };
      });
    }
  }

  updateProject(projectId, updates);
  return createdChangeOrderId;
}

export function saveProposedActions(
  projectId: string,
  actions: ProjectAIResponse['proposedActions']
): void {
  if (!actions?.length) return;
  const project = getProject(projectId);
  if (!project) return;

  const logs: AIActionLog[] = actions.map(a => ({
    id: `AI${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    action: a.action,
    input: a.input,
    output: a.output,
    status: 'proposed' as const,
    createdAt: new Date().toISOString(),
  }));

  updateProject(projectId, { aiActions: [...project.aiActions, ...logs] });
}
