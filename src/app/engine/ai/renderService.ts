import { integrationService } from '../integrations/integrationService';
import type { RenderOptionGroup } from '../../config/types';

export interface AiRenderRequest {
  image: string;
  prompt: string;
  tradeId?: string;
}

export interface AiRenderResult {
  image: string;
}

/** Build a UK trade redesign prompt from selected finish options. */
export function buildRenderPrompt(
  tradeName: string,
  settings: Record<string, string>,
  renderGroups: RenderOptionGroup[]
): string {
  const parts = renderGroups.map((group) => {
    const opt = group.options.find((o) => o.value === settings[group.key]);
    const label = opt?.label ?? settings[group.key] ?? '';
    return label ? `${group.label}: ${label}` : null;
  }).filter(Boolean);

  return [
    `Photorealistic UK ${tradeName.toLowerCase()} redesign of this exact room photo.`,
    'Keep the same room layout, camera angle, and proportions.',
    'Apply these finishes and products naturally as a completed professional installation:',
    parts.length ? parts.join('; ') : 'modern high-quality finishes',
    'Realistic lighting, materials, and shadows. No text, watermarks, or labels in the image.',
  ].join(' ');
}

export async function generateAiRender(req: AiRenderRequest): Promise<AiRenderResult> {
  const res = await fetch('/api/ai/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: req.image,
      prompt: req.prompt,
      tradeId: req.tradeId,
      apiKey: integrationService.getLiveOpenAIApiKey(),
    }),
  });

  const data = await res.json() as { image?: string; error?: string; code?: string };
  if (!res.ok) {
    throw new Error(data.error || `AI render failed (${res.status})`);
  }
  if (!data.image) {
    throw new Error('AI render returned no image');
  }
  return { image: data.image };
}
