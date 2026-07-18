import type { IncomingMessage, ServerResponse } from 'http';
import { resolveOrgIdForRequest } from './auth';
import {
  mapOpenAIError,
  resolveOpenAIApiKeyAsync,
} from './openai-connection';
import {
  probeLLMConnection,
  resolveBrainProvider,
  resolveDeepSeekApiKeyAsync,
} from './llm-connection';
import { getOrgAIBrain, ensureOrgAIBrainLoaded } from './organizations';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

const MISSING_MESSAGE =
  'AI brain not connected — add a DeepSeek or OpenAI key in Settings → Integrations → Company AI Brain and Save.';

export async function handleOpenAIHealth(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let bodyApiKey: string | undefined;
  let bodyDeepSeekApiKey: string | undefined;
  let bodyOrgId: string | undefined;
  let bodyProvider: string | undefined;
  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      if (raw.trim()) {
        const body = JSON.parse(raw) as {
          apiKey?: string;
          deepseekApiKey?: string;
          orgId?: string;
          provider?: string;
        };
        bodyApiKey = body.apiKey;
        bodyDeepSeekApiKey = body.deepseekApiKey;
        bodyOrgId = body.orgId;
        bodyProvider = body.provider;
      }
    } catch {
      sendJson(res, 400, { connected: false, reason: 'missing', message: MISSING_MESSAGE });
      return;
    }
  }

  const orgId = resolveOrgIdForRequest(req, bodyOrgId ? { orgId: bodyOrgId } : undefined);
  if (orgId) await ensureOrgAIBrainLoaded(orgId);
  const provider = resolveBrainProvider(bodyProvider, orgId);

  // Prefer probing the active primary brain provider.
  if (provider === 'deepseek') {
    const deepseekKey = await resolveDeepSeekApiKeyAsync(bodyDeepSeekApiKey, orgId);
    if (deepseekKey) {
      try {
        await probeLLMConnection('deepseek', deepseekKey);
        const openaiKey = await resolveOpenAIApiKeyAsync(bodyApiKey, orgId);
        let openaiConnected = false;
        if (openaiKey) {
          try {
            await probeLLMConnection('openai', openaiKey);
            openaiConnected = true;
          } catch {
            openaiConnected = false;
          }
        }
        sendJson(res, 200, {
          connected: true,
          provider: 'deepseek',
          openaiConnected,
          deepseekConfigured: true,
          warning: openaiConnected
            ? undefined
            : 'DeepSeek brain connected. Optional OpenAI specialist key still needed for TTS, Whisper, Realtime, image edit, and Sally web search.',
        });
        return;
      } catch (err) {
        const mapped = mapOpenAIError(err);
        sendJson(res, 200, { connected: false, reason: mapped.code, message: mapped.message });
        return;
      }
    }
  }

  const openaiKey = await resolveOpenAIApiKeyAsync(bodyApiKey, orgId);
  if (openaiKey) {
    try {
      await probeLLMConnection('openai', openaiKey);
      const brain = orgId ? getOrgAIBrain(orgId) : { provider, openaiConfigured: true, deepseekConfigured: false };
      sendJson(res, 200, {
        connected: true,
        provider: brain.provider,
        openaiConnected: true,
        deepseekConfigured: brain.deepseekConfigured,
      });
      return;
    } catch (err) {
      const mapped = mapOpenAIError(err);
      sendJson(res, 200, {
        connected: false,
        reason: mapped.code,
        message: mapped.message,
        openaiConnected: false,
      });
      return;
    }
  }

  sendJson(res, 200, { connected: false, reason: 'missing', message: MISSING_MESSAGE });
}
