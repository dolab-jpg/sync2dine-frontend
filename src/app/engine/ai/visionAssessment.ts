import { getPlaybook } from '../../config/trades/playbooks';

const GENERIC_COMMON_EXTRAS = [
  'Site variation',
  'Additional labour',
  'Materials upgrade',
  'Access or prep work',
] as const;

function resolvePlaybookTrade(tradeId?: string, projectTradeId?: string): string | null {
  return tradeId ?? projectTradeId ?? null;
}
import type { UnifiedProject } from '../project/types';
import { integrationService } from '../integrations/integrationService';

export interface ExtraAssessmentResult {
  title: string;
  description: string;
  amountMin: number;
  amountMax: number;
  confidence: number;
  risks: string[];
}

export interface ProgressAssessmentResult {
  snagList: string[];
  suggestedTaskUpdates: Array<{
    taskTitle: string;
    status: 'todo' | 'in_progress' | 'completed';
    note?: string;
  }>;
  summary: string;
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readConfidence(value: unknown, fallback = 0.6): number {
  return Math.max(0, Math.min(1, readNumber(value, fallback)));
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item ?? '').trim())
    .filter(Boolean);
}

function getOpenAiApiKey(): string | undefined {
  if (integrationService.isMasterMockMode()) return undefined;
  const apiKey = integrationService.getConfig('openai').apiKey?.trim();
  return apiKey || undefined;
}

function hasApiKey(): boolean {
  return Boolean(getOpenAiApiKey());
}

function chooseExtraTitle(commonExtras: readonly string[], builderNote: string): string {
  const note = builderNote.toLowerCase();
  const match = commonExtras.find(extra => {
    const words = extra.toLowerCase().split(/[\s-]+/).filter(word => word.length > 3);
    return words.some(word => note.includes(word));
  });
  return match ?? commonExtras[0] ?? 'Site variation';
}

function buildMockExtra(
  project: UnifiedProject,
  builderNote: string,
  tradeId?: string
): ExtraAssessmentResult {
  const resolvedTrade = resolvePlaybookTrade(tradeId, project.tradeId);
  const playbook = resolvedTrade ? getPlaybook(resolvedTrade) : undefined;
  const commonExtras = playbook?.commonExtras ?? GENERIC_COMMON_EXTRAS;
  const title = chooseExtraTitle(commonExtras, builderNote);
  const normalized = title.toLowerCase();
  let amountMin = 180;
  let amountMax = 420;

  if (normalized.includes('underfloor')) {
    amountMin = 650;
    amountMax = 1150;
  } else if (normalized.includes('lighting') || normalized.includes('led')) {
    amountMin = 220;
    amountMax = 480;
  } else if (normalized.includes('brassware')) {
    amountMin = 350;
    amountMax = 790;
  } else if (normalized.includes('cabinet') || normalized.includes('mirror')) {
    amountMin = 240;
    amountMax = 620;
  }

  return {
    title,
    description: `Potential extra for ${project.projectName}: ${builderNote || title}. Confirm labour time, materials, and customer approval before proceeding.`,
    amountMin,
    amountMax,
    confidence: 0.64,
    risks: [
      'Photo-only assessment; verify on-site dimensions before customer submission.',
      'Lead times for upgraded items may affect programme.',
    ],
  };
}

function buildMockProgress(project: UnifiedProject): ProgressAssessmentResult {
  const openTasks = project.tasks.filter(task => task.status !== 'completed');
  const firstTask = openTasks[0];
  const secondTask = openTasks[1];

  return {
    snagList: [
      'Sealant finish appears incomplete around one wet edge.',
      'Visible trim alignment should be rechecked before handover.',
    ],
    suggestedTaskUpdates: [
      firstTask
        ? { taskTitle: firstTask.title, status: 'in_progress', note: 'Progress visible from latest photos.' }
        : { taskTitle: 'Current active task', status: 'in_progress', note: 'Progress visible from latest photos.' },
      ...(secondTask
        ? [{ taskTitle: secondTask.title, status: 'todo' as const, note: 'Keep queued pending snag closure.' }]
        : []),
    ],
    summary: `Site appears to be progressing for ${project.projectName}. Keep current task in progress and close minor snags before the next payment checkpoint.`,
  };
}

function normalizeExtraResponse(data: Record<string, unknown> | null): ExtraAssessmentResult | null {
  if (!data) return null;
  const suggestions = data.suggestions as Record<string, unknown> | undefined;
  const titleValue = suggestions?.title as Record<string, unknown> | string | undefined;
  const descriptionValue = suggestions?.description as Record<string, unknown> | string | undefined;
  const amountMinValue = suggestions?.amountMin as Record<string, unknown> | number | undefined;
  const amountMaxValue = suggestions?.amountMax as Record<string, unknown> | number | undefined;
  const confidenceValue = suggestions?.confidence as Record<string, unknown> | number | undefined;
  const risksValue = suggestions?.risks as Record<string, unknown> | string[] | undefined;

  const title = typeof titleValue === 'object' && titleValue && 'value' in titleValue
    ? String((titleValue as Record<string, unknown>).value ?? '')
    : String(titleValue ?? data.title ?? '').trim();

  if (!title) return null;

  const description = typeof descriptionValue === 'object' && descriptionValue && 'value' in descriptionValue
    ? String((descriptionValue as Record<string, unknown>).value ?? '')
    : String(descriptionValue ?? data.summary ?? '').trim();

  const amountMinRaw = typeof amountMinValue === 'object' && amountMinValue && 'value' in amountMinValue
    ? (amountMinValue as Record<string, unknown>).value
    : amountMinValue ?? data.amountMin;
  const amountMaxRaw = typeof amountMaxValue === 'object' && amountMaxValue && 'value' in amountMaxValue
    ? (amountMaxValue as Record<string, unknown>).value
    : amountMaxValue ?? data.amountMax;
  const confidenceRaw = typeof confidenceValue === 'object' && confidenceValue && 'value' in confidenceValue
    ? (confidenceValue as Record<string, unknown>).value
    : confidenceValue ?? data.confidence;
  const riskRaw = typeof risksValue === 'object' && risksValue && 'value' in risksValue
    ? (risksValue as Record<string, unknown>).value
    : risksValue ?? data.risks;

  const amountMin = Math.round(readNumber(amountMinRaw, 150));
  const amountMax = Math.round(readNumber(amountMaxRaw, amountMin + 250));

  return {
    title,
    description: description || 'Potential variation detected from site photos.',
    amountMin: Math.min(amountMin, amountMax),
    amountMax: Math.max(amountMax, amountMin),
    confidence: readConfidence(confidenceRaw, 0.6),
    risks: readStringArray(riskRaw).slice(0, 5),
  };
}

function normalizeProgressResponse(data: Record<string, unknown> | null): ProgressAssessmentResult | null {
  if (!data) return null;
  const suggestions = data.suggestions as Record<string, unknown> | undefined;
  const snagRaw = suggestions?.snagList ?? data.snagList;
  const updatesRaw = suggestions?.suggestedTaskUpdates ?? data.suggestedTaskUpdates;
  const summary = String(suggestions?.summary ?? data.summary ?? '').trim();

  const suggestedTaskUpdates = Array.isArray(updatesRaw)
    ? updatesRaw
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const taskTitle = String(row.taskTitle ?? row.title ?? '').trim();
          const status = String(row.status ?? '').trim();
          if (!taskTitle || !['todo', 'in_progress', 'completed'].includes(status)) return null;
          const note = String(row.note ?? row.reason ?? '').trim();
          return {
            taskTitle,
            status: status as 'todo' | 'in_progress' | 'completed',
            note: note || undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    snagList: readStringArray(snagRaw).slice(0, 8),
    suggestedTaskUpdates,
    summary: summary || 'Progress assessed from latest site photos.',
  };
}

export async function assessExtraFromPhotos(
  project: UnifiedProject,
  photoUrlsOrDataUrls: string[],
  builderNote: string,
  tradeId?: string
): Promise<ExtraAssessmentResult> {
  const resolvedTrade = resolvePlaybookTrade(tradeId, project.tradeId);
  const playbook = resolvedTrade ? getPlaybook(resolvedTrade) : undefined;
  const commonExtras = playbook?.commonExtras ?? GENERIC_COMMON_EXTRAS;

  if (!hasApiKey()) {
    return buildMockExtra(project, builderNote, tradeId);
  }

  try {
    const res = await fetch('/api/ai/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: resolvedTrade ?? 'general',
        images: photoUrlsOrDataUrls.slice(0, 5),
        apiKey: getOpenAiApiKey(),
        systemPrompt: [
          'You are a UK construction foreman AI for multi-trade home-improvement projects.',
          `Project: ${project.projectName}.`,
          `Builder note: ${builderNote || 'No additional note supplied.'}`,
          `Common extras for this trade: ${commonExtras.join(', ')}.`,
          'Assess whether the photos indicate an extra/variation suitable for a customer change order.',
          'Return realistic UK GBP ranges only; avoid overconfidence.',
        ].join('\n'),
        schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                amountMin: { type: 'number' },
                amountMax: { type: 'number' },
                confidence: { type: 'number' },
                risks: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'description', 'amountMin', 'amountMax', 'confidence', 'risks'],
            },
            risks: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
          required: ['suggestions', 'risks', 'summary'],
        },
      }),
    });

    if (!res.ok) throw new Error(`Vision estimate failed: ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    const normalized = normalizeExtraResponse(data);
    if (normalized) return normalized;
  } catch {
    // fall back to playbook-driven mock
  }

  return buildMockExtra(project, builderNote, tradeId);
}

export async function assessProgress(
  project: UnifiedProject,
  photoUrls: string[],
  tradeId?: string
): Promise<ProgressAssessmentResult> {
  const resolvedTrade = resolvePlaybookTrade(tradeId, project.tradeId);

  if (!hasApiKey()) {
    return buildMockProgress(project);
  }

  try {
    const res = await fetch('/api/ai/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: resolvedTrade ?? 'general',
        images: photoUrls.slice(0, 5),
        apiKey: getOpenAiApiKey(),
        systemPrompt: [
          'You are a UK foreman AI reviewing site progress photos.',
          `Project: ${project.projectName}.`,
          `Trade: ${resolvedTrade ?? 'general (infer from photos)'}.`,
          'Return a concise progress summary, a snag list, and suggested task status updates.',
          'Use task statuses only from: todo, in_progress, completed.',
        ].join('\n'),
        schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'object',
              properties: {
                snagList: { type: 'array', items: { type: 'string' } },
                suggestedTaskUpdates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      taskTitle: { type: 'string' },
                      status: { type: 'string' },
                      note: { type: 'string' },
                    },
                    required: ['taskTitle', 'status'],
                  },
                },
                summary: { type: 'string' },
              },
              required: ['snagList', 'suggestedTaskUpdates', 'summary'],
            },
            risks: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
          },
          required: ['suggestions', 'summary'],
        },
      }),
    });

    if (!res.ok) throw new Error(`Vision progress failed: ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    const normalized = normalizeProgressResponse(data);
    if (normalized) return normalized;
  } catch {
    // fall back to mock
  }

  return buildMockProgress(project);
}
