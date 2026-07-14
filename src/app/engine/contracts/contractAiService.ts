import { integrationService } from '../integrations/integrationService';
import type { PaymentStage } from './types';

export interface GenerateScheduleInput {
  total: number;
  tradeName?: string;
  context?: string;
  preferredStages?: { label: string; percent: number; dueTrigger: string }[];
}

interface RawStage {
  label?: string;
  description?: string;
  percent?: number;
  dueTrigger?: string;
}

/** Ensure stage percentages sum to exactly 100 and recompute amounts from the total. */
export function normaliseStages(stages: RawStage[], total: number): PaymentStage[] {
  const cleaned = stages
    .map((s) => ({
      label: (s.label ?? 'Stage').trim() || 'Stage',
      description: (s.description ?? s.dueTrigger ?? '').trim(),
      dueTrigger: (s.dueTrigger ?? s.description ?? '').trim(),
      percent: Number(s.percent) || 0,
    }))
    .filter((s) => s.percent > 0);

  if (cleaned.length === 0) {
    cleaned.push(
      { label: 'Deposit', description: 'On signing', dueTrigger: 'On signing', percent: 25 },
      { label: 'First Fix', description: 'When work begins', dueTrigger: 'When work begins', percent: 50 },
      { label: 'Completion', description: 'On completion', dueTrigger: 'On completion', percent: 25 },
    );
  }

  const sum = cleaned.reduce((s, x) => s + x.percent, 0);
  const rounded = cleaned.map((s) => Math.round((s.percent / sum) * 100));
  const pctDiff = 100 - rounded.reduce((a, b) => a + b, 0);
  rounded[rounded.length - 1] += pctDiff; // absorb rounding on the final stage

  let allocated = 0;
  return cleaned.map((s, i) => {
    const isLast = i === cleaned.length - 1;
    const amount = isLast ? Math.round(total - allocated) : Math.round((total * rounded[i]) / 100);
    allocated += amount;
    return {
      label: s.label,
      description: s.description,
      dueTrigger: s.dueTrigger,
      percent: rounded[i],
      amount,
    };
  });
}

function deterministicSchedule(input: GenerateScheduleInput): PaymentStage[] {
  const stages = input.preferredStages?.length
    ? input.preferredStages
    : [
        { label: 'Deposit', percent: 25, dueTrigger: 'On signing, to secure start date' },
        { label: 'First Fix', percent: 50, dueTrigger: 'When work begins on site' },
        { label: 'Completion', percent: 25, dueTrigger: 'On completion and sign-off' },
      ];
  return normaliseStages(stages, input.total);
}

/**
 * Ask the AI for a sensible stage payment schedule for the job total.
 * Falls back to a deterministic 25/50/25 (or the preferred template stages).
 */
export async function generatePaymentSchedule(input: GenerateScheduleInput): Promise<PaymentStage[]> {
  const openai = integrationService.getConfig('openai');

  try {
    const systemPrompt = [
      'You are a UK building contracts assistant.',
      'Produce a fair, industry-standard stage payment schedule for the job below.',
      'Smaller jobs typically use fewer stages (e.g. 50/50); larger fit-outs use deposit / first fix / completion or more.',
      'Return strict JSON: { "stages": [ { "label": string, "description": string, "percent": number, "dueTrigger": string } ] }.',
      'Percentages MUST sum to 100. Keep it to 2-4 stages.',
    ].join('\n');

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        model: openai.staffModel || 'gpt-4o-mini',
        apiKey: integrationService.getLiveOpenAIApiKey(),
        messages: [
          {
            role: 'user',
            content: `Trade: ${input.tradeName ?? 'general'}\nTotal: £${input.total}\nDetails: ${input.context ?? 'n/a'}\n\nReturn the JSON only.`,
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content: string = data.content ?? data.message ?? '';
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { stages?: RawStage[] };
        if (parsed.stages && parsed.stages.length) {
          return normaliseStages(parsed.stages, input.total);
        }
      }
    }
  } catch {
    // fall through to deterministic
  }

  return deterministicSchedule(input);
}
