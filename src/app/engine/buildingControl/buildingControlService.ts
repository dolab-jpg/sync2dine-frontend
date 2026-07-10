import { integrationService } from '../integrations/integrationService';
import type { BCCitation } from './bcStore';

export interface BuildingControlResponse {
  content: string;
  citations: BCCitation[];
  complianceActions: string[];
  draftEmailReply?: string;
  photoAnalysis?: string;
}

function getApiKey(): string | undefined {
  if (integrationService.isMasterMockMode()) return undefined;
  return integrationService.getConfig('openai').apiKey || undefined;
}

export async function sendBuildingControlMessage(
  messages: { role: string; content: string }[],
  options: {
    tradeId?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    sourceEmail?: string | null;
    images?: string[];
    userRole?: string;
    model?: string;
  }
): Promise<BuildingControlResponse> {
  const apiKey = getApiKey();

  const res = await fetch('/api/ai/building-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      apiKey,
      model: options.model ?? 'gpt-4o-mini',
      tradeId: options.tradeId,
      projectId: options.projectId,
      projectName: options.projectName,
      sourceEmail: options.sourceEmail,
      images: options.images,
      userRole: options.userRole,
    }),
  });

  if (!res.ok) {
    throw new Error(`Building control AI error: ${res.status}`);
  }

  return res.json() as Promise<BuildingControlResponse>;
}
