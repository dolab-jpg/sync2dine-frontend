import type { IncomingMessage, ServerResponse } from 'http';
import {
  deletePhoneLine,
  getAgentCapacitySnapshot,
  getAgentSettings,
  getAgentStatusSnapshot,
  getDataStore,
  getPhoneLineByAssignedUserId,
  getPhoneLineById,
  listPhoneLines,
  lookupContactByPhone,
  maskPhoneLine,
  saveCustomerRecord,
  savePhoneLine,
  saveRecruitmentApplication,
  saveRecruitmentCandidate,
  saveRecruitmentJob,
  saveRecruitmentOnboardingTask,
  seedOnboardingForCandidate,
  updateAgentSettings,
  updateRecruitmentApplication,
  updateRecruitmentOnboardingTask,
  type PhoneLinePurpose,
} from './data-store';
import {
  getChatterboxConfig,
  resolveTtsTextFromCall,
  synthesizeSpeech,
} from './tts';
import { transcribeAudioBuffer } from './stt';
import {
  getSipBridgeUrl,
  registerAllEnabledLines,
  testLineConnection,
  unregisterLine,
} from './telephony/lineRegistry';
import { authenticateRequest, resolveOrgIdForRequest } from './auth';
import { handleRealtimeRoutes } from './realtime-routes';

function resolveUserIdFromRequest(req: IncomingMessage): string | null {
  const auth = authenticateRequest(req);
  if (auth?.userId) return auth.userId;
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return null;
}

function parsePurpose(value: unknown, fallback: PhoneLinePurpose = 'staff'): PhoneLinePurpose {
  return value === 'aria' ? 'aria' : value === 'staff' ? 'staff' : fallback;
}

function parseAssignedUserId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value.trim() || null;
  return undefined;
}

const OPENAI_TTS_VOICES = [
  { id: 'fable', name: 'Fable (OpenAI)', provider: 'openai' },
  { id: 'alloy', name: 'Alloy (OpenAI)', provider: 'openai' },
  { id: 'nova', name: 'Nova (OpenAI)', provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer (OpenAI)', provider: 'openai' },
];

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function fetchChatterboxVoices(): Promise<Array<{ id: string; name: string; provider: string }>> {
  const config = getChatterboxConfig();
  if (!config) return [];

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const response = await fetch(`${config.baseUrl}/voices`, { headers });
  if (!response.ok) {
    throw new Error(`Chatterbox API error (${response.status})`);
  }

  const data = await response.json() as unknown;
  if (Array.isArray(data)) {
    return data.map((v, i) => {
      const item = v as Record<string, unknown>;
      return {
        id: String(item.id ?? item.voice_id ?? `voice-${i}`),
        name: String(item.name ?? item.label ?? `Voice ${i + 1}`),
        provider: 'chatterbox',
      };
    });
  }
  if (data && typeof data === 'object' && Array.isArray((data as { voices?: unknown[] }).voices)) {
    return ((data as { voices: unknown[] }).voices).map((v, i) => {
      const item = v as Record<string, unknown>;
      return {
        id: String(item.id ?? item.voice_id ?? `voice-${i}`),
        name: String(item.name ?? item.label ?? `Voice ${i + 1}`),
        provider: 'chatterbox',
      };
    });
  }
  return [];
}

async function handleGetSettings(_req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, getAgentSettings());
}

async function handlePatchSettings(req: IncomingMessage, res: ServerResponse) {
  const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
  if (typeof body.activeVoiceId === 'string') patch.activeVoiceId = body.activeVoiceId;
  if (
    body.leadCallbackPolicy === 'alert_only'
    || body.leadCallbackPolicy === 'outbound_first'
    || body.leadCallbackPolicy === 'inbound_only'
  ) {
    patch.leadCallbackPolicy = body.leadCallbackPolicy;
  }
  if (typeof body.defaultOutboundBrief === 'string') patch.defaultOutboundBrief = body.defaultOutboundBrief;
  if (typeof body.postCallNotePrompt === 'string') patch.postCallNotePrompt = body.postCallNotePrompt;
  if (typeof body.callQueueMaxAttempts === 'number' && Number.isFinite(body.callQueueMaxAttempts)) {
    patch.callQueueMaxAttempts = Math.max(1, Math.min(10, Math.round(body.callQueueMaxAttempts)));
  }
  if (typeof body.callQueueRetryMinutes === 'number' && Number.isFinite(body.callQueueRetryMinutes)) {
    patch.callQueueRetryMinutes = Math.max(5, Math.round(body.callQueueRetryMinutes));
  }
  if (typeof body.callQueueQuietStart === 'string') patch.callQueueQuietStart = body.callQueueQuietStart;
  if (typeof body.callQueueQuietEnd === 'string') patch.callQueueQuietEnd = body.callQueueQuietEnd;
  if (typeof body.callQueueMaxConcurrent === 'number' && Number.isFinite(body.callQueueMaxConcurrent)) {
    patch.callQueueMaxConcurrent = Math.max(1, Math.min(5, Math.round(body.callQueueMaxConcurrent)));
  }
  if (
    body.outboundQueueState === 'running'
    || body.outboundQueueState === 'paused'
    || body.outboundQueueState === 'stopped'
  ) {
    patch.outboundQueueState = body.outboundQueueState;
    if (body.outboundQueueState === 'stopped') {
      const { cancelQueuedOutboundJobs } = await import('./data-store');
      cancelQueuedOutboundJobs();
    }
  }
  if (typeof body.campaignReviewBrief === 'string') patch.campaignReviewBrief = body.campaignReviewBrief;
  if (typeof body.campaignReorderBrief === 'string') patch.campaignReorderBrief = body.campaignReorderBrief;
  if (typeof body.campaignWinbackBrief === 'string') patch.campaignWinbackBrief = body.campaignWinbackBrief;
  if (typeof body.aboutUs === 'string') patch.aboutUs = body.aboutUs;
  if (typeof body.sayToday === 'string') patch.sayToday = body.sayToday;
  if (Array.isArray(body.deliveryPostcodePrefixes)) {
    const { normalizeDeliveryPrefixes } = await import('./delivery-areas');
    patch.deliveryPostcodePrefixes = normalizeDeliveryPrefixes(body.deliveryPostcodePrefixes);
  }
  if (typeof body.deliveryNotes === 'string') patch.deliveryNotes = body.deliveryNotes;
  const updated = updateAgentSettings(patch);
  sendJson(res, 200, updated);
}

async function handleGetTransferNumbers(_req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, { transferNumbers: getAgentSettings().transferNumbers ?? {} });
}

async function handlePatchTransferNumbers(req: IncomingMessage, res: ServerResponse) {
  const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  const keys = ['general', 'sales', 'projects', 'recruitment', 'accounts'] as const;
  const current = getAgentSettings().transferNumbers ?? {};
  const next: Record<string, string | undefined> = { ...current };
  for (const key of keys) {
    if (typeof body[key] === 'string') {
      const trimmed = body[key].trim();
      next[key] = trimmed || undefined;
    }
  }
  const updated = updateAgentSettings({ transferNumbers: next });
  sendJson(res, 200, { transferNumbers: updated.transferNumbers ?? {} });
}

async function handleGetStatus(_req: IncomingMessage, res: ServerResponse) {
  const snapshot = getAgentStatusSnapshot();
  sendJson(res, 200, {
    ...snapshot,
    isActive: getAgentSettings().isActive,
    capacity: snapshot.capacity ?? getAgentCapacitySnapshot(),
  });
}

async function handleGetVoices(_req: IncomingMessage, res: ServerResponse) {
  const settings = getAgentSettings();
  try {
    const chatterboxVoices = await fetchChatterboxVoices();
    if (chatterboxVoices.length > 0) {
      sendJson(res, 200, {
        provider: 'chatterbox',
        activeVoiceId: settings.activeVoiceId ?? null,
        voices: chatterboxVoices,
      });
      return;
    }
  } catch (err) {
    sendJson(res, 200, {
      provider: 'openai',
      activeVoiceId: settings.activeVoiceId ?? 'fable',
      voices: OPENAI_TTS_VOICES,
      fallback: true,
      message: err instanceof Error ? err.message : 'Chatterbox unavailable — using OpenAI TTS fallback',
    });
    return;
  }

  sendJson(res, 200, {
    provider: 'openai',
    activeVoiceId: settings.activeVoiceId ?? 'fable',
    voices: OPENAI_TTS_VOICES,
    fallback: true,
    message: 'Connect Chatterbox in Integrations for cloned voices.',
  });
}

async function handlePostVoice(req: IncomingMessage, res: ServerResponse) {
  const config = getChatterboxConfig();
  if (!config) {
    sendJson(res, 400, { error: 'Chatterbox not configured. Set CHATTERBOX_BASE_URL in environment.' });
    return;
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    sendJson(res, 400, { error: 'Expected multipart/form-data upload' });
    return;
  }

  const raw = await readBody(req);
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    sendJson(res, 400, { error: 'Missing multipart boundary' });
    return;
  }

  const boundary = boundaryMatch[1].trim();
  const parts = raw.split(`--${boundary}`);
  let name = '';
  let fileBuffer: Buffer | null = null;
  let filename = 'voice.wav';

  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;
    const [headerBlock, ...bodyParts] = part.split('\r\n\r\n');
    const body = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '');
    const nameMatch = headerBlock.match(/name="([^"]+)"/);
    const filenameMatch = headerBlock.match(/filename="([^"]+)"/);
    const fieldName = nameMatch?.[1] ?? '';

    if (fieldName === 'name') {
      name = body.trim();
    } else if (filenameMatch || fieldName === 'file') {
      filename = filenameMatch?.[1] ?? 'voice.wav';
      fileBuffer = Buffer.from(body, 'binary');
    }
  }

  if (!name || !fileBuffer) {
    sendJson(res, 400, { error: 'name and file are required' });
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', new Blob([fileBuffer]), filename);

  const headers: Record<string, string> = {};
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const response = await fetch(`${config.baseUrl}/voices`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    sendJson(res, response.status, { error: errText || 'Chatterbox upload failed' });
    return;
  }

  const result = await response.json().catch(() => ({}));
  sendJson(res, 200, { success: true, voice: result });
}

async function handleContactLookup(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const phone = url.searchParams.get('phone')?.trim();
  if (!phone) {
    sendJson(res, 400, { error: 'phone query parameter is required' });
    return;
  }
  sendJson(res, 200, lookupContactByPhone(phone));
}

async function resolveTtsRequestInput(
  req: IncomingMessage,
  url: URL,
): Promise<{ text: string; voiceId?: string | null }> {
  if (req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId : undefined;
    if (!text) throw new Error('text is required');
    return { text, voiceId };
  }

  const callId = url.searchParams.get('callId')?.trim();
  const textParam = url.searchParams.get('text')?.trim();
  const voiceId = url.searchParams.get('voiceId') ?? undefined;
  const text = textParam || (callId ? resolveTtsTextFromCall(callId) : null);
  if (!text) throw new Error('text or callId query parameter is required');
  return { text, voiceId };
}

async function handleAgentTts(req: IncomingMessage, res: ServerResponse, url: URL) {
  try {
    const { text, voiceId } = await resolveTtsRequestInput(req, url);
    const formatParam = (url.searchParams.get('format') || 'mp3').toLowerCase();
    const format =
      formatParam === 'mulaw' || formatParam === 'ulaw' || formatParam === 'pcmu'
        ? 'mulaw'
        : formatParam === 'pcm'
          ? 'pcm'
          : 'mp3';
    const result = await synthesizeSpeech(text, voiceId, format);
    res.statusCode = 200;
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Provider', result.provider);
    res.end(result.buffer);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : 'TTS failed' });
  }
}

async function readBinaryBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleAgentStt(req: IncomingMessage, res: ServerResponse) {
  try {
    const orgId = resolveOrgIdForRequest(req);
    // Do not mutate global request org — that breaks CRM data on concurrent phone calls.
    const buffer = await readBinaryBody(req);
    if (!buffer.length) {
      sendJson(res, 400, { error: 'Empty audio body' });
      return;
    }

    const contentType = String(req.headers['content-type'] ?? 'audio/wav');
    let filename = 'utterance.wav';
    let mime = 'audio/wav';
    if (contentType.includes('basic') || contentType.includes('mulaw') || contentType.includes('pcmu')) {
      filename = 'utterance.ulaw';
      mime = 'audio/basic';
    } else if (contentType.includes('mpeg') || contentType.includes('mp3')) {
      filename = 'utterance.mp3';
      mime = 'audio/mpeg';
    } else if (contentType.includes('ogg')) {
      filename = 'utterance.ogg';
      mime = 'audio/ogg';
    } else if (contentType.includes('webm')) {
      filename = 'utterance.webm';
      mime = 'audio/webm';
    }

    const text = await transcribeAudioBuffer(buffer, filename, mime, orgId);
    sendJson(res, 200, { text });
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : 'STT failed' });
  }
}

async function handleGetLines(_req: IncomingMessage, res: ServerResponse) {
  const lines = listPhoneLines();
  // #region agent log
  fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-B',location:'agent-routes.ts:handleGetLines',message:'list phone lines (masked)',data:{count:lines.length,staff:lines.filter(l=>(l.purpose??'staff')==='staff').map(l=>({id:l.id,label:l.label,did:l.did,hasPassword:Boolean(l.sipPassword),passwordLen:l.sipPassword?.length??0,assignedUserId:l.assignedUserId??null,status:l.status,purpose:l.purpose??'staff'}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  sendJson(res, 200, {
    bridgeUrl: getSipBridgeUrl(),
    lines: lines.map(maskPhoneLine),
  });
}

async function handleGetMyLine(req: IncomingMessage, res: ServerResponse) {
  const userId = resolveUserIdFromRequest(req);
  if (!userId) {
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-A',location:'agent-routes.ts:handleGetMyLine',message:'mine missing user id',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    sendJson(res, 401, { error: 'User id required (Authorization or X-User-Id)' });
    return;
  }
  const line = getPhoneLineByAssignedUserId(userId);
  // #region agent log
  fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-A',location:'agent-routes.ts:handleGetMyLine',message:'mine lookup',data:{userIdSuffix:userId.slice(-8),found:Boolean(line),lineId:line?.id??null,label:line?.label??null,did:line?.did??null,hasPassword:Boolean(line?.sipPassword),passwordLen:line?.sipPassword?.length??0,assignedMatch:line?.assignedUserId===userId,purpose:line?.purpose??null,allStaffAssigned:listPhoneLines().filter(l=>(l.purpose??'staff')==='staff').map(l=>({id:l.id,assignedSuffix:(l.assignedUserId??'').slice(-8)||null,label:l.label}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!line) {
    sendJson(res, 200, { line: null, message: 'No softphone line is assigned to your account yet. Ask an admin to assign one in Call Centre → Phone Lines.' });
    return;
  }
  sendJson(res, 200, { line });
}

async function handlePostLine(req: IncomingMessage, res: ServerResponse) {
  const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  const label = String(body.label ?? '').trim();
  const sipUsername = String(body.sipUsername ?? '').trim();
  const sipPassword = String(body.sipPassword ?? '').trim();
  const did = String(body.did ?? '').trim();
  // #region agent log
  fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-C',location:'agent-routes.ts:handlePostLine',message:'create line',data:{label,sipUsername,did,hasPassword:Boolean(sipPassword),passwordLen:sipPassword.length,assignedUserId:typeof body.assignedUserId==='string'?String(body.assignedUserId).slice(-8):body.assignedUserId??null,purpose:body.purpose??'staff'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!label || !sipUsername || !sipPassword || !did) {
    sendJson(res, 400, { error: 'label, sipUsername, sipPassword, and did are required' });
    return;
  }
  const line = savePhoneLine({
    label,
    sipUsername,
    sipPassword,
    did,
    sipDomain: typeof body.sipDomain === 'string' ? body.sipDomain : undefined,
    enabled: body.enabled !== false,
    assignedUserId: parseAssignedUserId(body.assignedUserId),
    purpose: parsePurpose(body.purpose, 'staff'),
  });
  // #region agent log
  fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-C',location:'agent-routes.ts:handlePostLine:saved',message:'line saved',data:{id:line.id,hasPassword:Boolean(line.sipPassword),passwordLen:line.sipPassword?.length??0,assignedSuffix:(line.assignedUserId??'').slice(-8)||null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  sendJson(res, 200, { line: maskPhoneLine(line) });
}

async function handlePatchLine(req: IncomingMessage, res: ServerResponse, lineId: string) {
  const existing = getPhoneLineById(lineId);
  if (!existing) {
    sendJson(res, 404, { error: 'Line not found' });
    return;
  }
  const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  const sipPassword = typeof body.sipPassword === 'string' && body.sipPassword && body.sipPassword !== '••••••'
    ? body.sipPassword
    : existing.sipPassword;
  const assignedParsed = parseAssignedUserId(body.assignedUserId);
  // #region agent log
  fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'036e91'},body:JSON.stringify({sessionId:'036e91',runId:'cred-check',hypothesisId:'H-C',location:'agent-routes.ts:handlePatchLine',message:'patch line',data:{lineId,label:typeof body.label==='string'?body.label:existing.label,bodyPasswordLen:typeof body.sipPassword==='string'?body.sipPassword.length:null,keptExistingPassword:!(typeof body.sipPassword==='string'&&body.sipPassword&&body.sipPassword!=='••••••'),resolvedPasswordLen:sipPassword?.length??0,prevPasswordLen:existing.sipPassword?.length??0,assignedParsed:assignedParsed===null?null:typeof assignedParsed==='string'?assignedParsed.slice(-8):'unchanged'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const line = savePhoneLine({
    id: lineId,
    label: typeof body.label === 'string' ? body.label : existing.label,
    sipUsername: typeof body.sipUsername === 'string' ? body.sipUsername : existing.sipUsername,
    sipPassword,
    sipDomain: typeof body.sipDomain === 'string' ? body.sipDomain : existing.sipDomain,
    did: typeof body.did === 'string' ? body.did : existing.did,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : existing.enabled,
    status: existing.status,
    assignedUserId: assignedParsed !== undefined ? assignedParsed : existing.assignedUserId,
    purpose: body.purpose !== undefined ? parsePurpose(body.purpose, existing.purpose ?? 'staff') : existing.purpose,
  });
  if (body.enabled === false) {
    await unregisterLine(lineId);
  }
  sendJson(res, 200, { line: maskPhoneLine(line) });
}

async function handleDeleteLine(_req: IncomingMessage, res: ServerResponse, lineId: string) {
  await unregisterLine(lineId);
  const ok = deletePhoneLine(lineId);
  if (!ok) {
    sendJson(res, 404, { error: 'Line not found' });
    return;
  }
  sendJson(res, 200, { success: true });
}

async function handleTestLine(_req: IncomingMessage, res: ServerResponse, lineId: string) {
  const line = getPhoneLineById(lineId);
  if (!line) {
    sendJson(res, 404, { error: 'Line not found' });
    return;
  }
  const result = await testLineConnection(line);
  sendJson(res, result.ok ? 200 : 400, result);
}

async function handleRegisterAllLines(_req: IncomingMessage, res: ServerResponse) {
  const result = await registerAllEnabledLines();
  sendJson(res, 200, {
    ...result,
    lines: listPhoneLines().map(maskPhoneLine),
  });
}

export async function handleAgentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (await handleRealtimeRoutes(req, res, pathname)) {
    return true;
  }
  if (pathname === '/api/agent/settings' && req.method === 'GET') {
    await handleGetSettings(req, res);
    return true;
  }
  if (pathname === '/api/agent/settings' && req.method === 'PATCH') {
    await handlePatchSettings(req, res);
    return true;
  }
  if (pathname === '/api/agent/transfer-numbers' && req.method === 'GET') {
    await handleGetTransferNumbers(req, res);
    return true;
  }
  if (pathname === '/api/agent/transfer-numbers' && req.method === 'PATCH') {
    await handlePatchTransferNumbers(req, res);
    return true;
  }
  if (pathname === '/api/agent/status' && req.method === 'GET') {
    await handleGetStatus(req, res);
    return true;
  }
  if (pathname === '/api/agent/voices' && req.method === 'GET') {
    await handleGetVoices(req, res);
    return true;
  }
  if (pathname === '/api/agent/voices' && req.method === 'POST') {
    await handlePostVoice(req, res);
    return true;
  }
  if (pathname === '/api/contacts/lookup' && req.method === 'GET') {
    await handleContactLookup(req, res, url);
    return true;
  }
  if (pathname === '/api/agent/tts' && (req.method === 'GET' || req.method === 'POST')) {
    await handleAgentTts(req, res, url);
    return true;
  }
  if (pathname === '/api/agent/stt' && req.method === 'POST') {
    await handleAgentStt(req, res);
    return true;
  }
  if (pathname === '/api/agent/lines' && req.method === 'GET') {
    await handleGetLines(req, res);
    return true;
  }
  if (pathname === '/api/agent/lines' && req.method === 'POST') {
    await handlePostLine(req, res);
    return true;
  }
  if (pathname === '/api/agent/lines/mine' && req.method === 'GET') {
    await handleGetMyLine(req, res);
    return true;
  }
  if (pathname === '/api/agent/lines/register-all' && req.method === 'POST') {
    await handleRegisterAllLines(req, res);
    return true;
  }
  const lineMatch = pathname.match(/^\/api\/agent\/lines\/([^/]+)(?:\/(test))?$/);
  if (lineMatch) {
    const lineId = decodeURIComponent(lineMatch[1]);
    if (lineMatch[2] === 'test' && req.method === 'POST') {
      await handleTestLine(req, res, lineId);
      return true;
    }
    if (req.method === 'PATCH') {
      await handlePatchLine(req, res, lineId);
      return true;
    }
    if (req.method === 'DELETE') {
      await handleDeleteLine(req, res, lineId);
      return true;
    }
  }

  if (pathname === '/api/customers/upsert' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const customer = (body.customer && typeof body.customer === 'object')
      ? (body.customer as Record<string, unknown>)
      : body;
    if (!customer.name && !customer.phone && !customer.id) {
      sendJson(res, 400, { error: 'customer required' });
      return true;
    }
    const saved = saveCustomerRecord(customer);
    sendJson(res, 200, { ok: true, customer: saved });
    return true;
  }

  if (pathname === '/api/campaigns/templates' && req.method === 'GET') {
    const { getCampaignTemplates } = await import('./outbound-campaigns');
    sendJson(res, 200, { templates: getCampaignTemplates() });
    return true;
  }
  if (pathname === '/api/campaigns/lapsed-customers' && req.method === 'GET') {
    const days = Math.max(1, Number(url.searchParams.get('days') ?? 30) || 30);
    const { listCustomersWithLastOrderOlderThan } = await import('./outbound-campaigns');
    sendJson(res, 200, { days, customers: await listCustomersWithLastOrderOlderThan(days) });
    return true;
  }
  if (pathname === '/api/campaigns/queue-lapsed' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as {
      template?: string;
      daysOlderThan?: number;
      dryRun?: boolean;
    };
    const template = String(body.template ?? 'lapse_winback');
    const daysOlderThan = Math.max(1, Number(body.daysOlderThan ?? 30) || 30);
    try {
      const { queueLapsedCampaign } = await import('./outbound-campaigns');
      const result = await queueLapsedCampaign({
        template: template as 'customer_review' | 'customer_reorder' | 'lapse_winback',
        daysOlderThan,
        dryRun: body.dryRun === true,
      });
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Campaign queue failed' });
    }
    return true;
  }

  if (pathname === '/api/agent/capacity' && req.method === 'GET') {
    sendJson(res, 200, getAgentCapacitySnapshot());
    return true;
  }

  // ── Recruitment routes ────────────────────────────────────────────
  if (pathname === '/api/recruitment' && req.method === 'GET') {
    const store = getDataStore();
    sendJson(res, 200, {
      jobs: store.recruitmentJobs,
      candidates: store.recruitmentCandidates,
      interviews: store.recruitmentInterviews,
      applications: store.recruitmentApplications,
      onboardingTasks: store.recruitmentOnboardingTasks,
    });
    return true;
  }

  if (pathname === '/api/recruitment/jobs' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const job = saveRecruitmentJob(body);
    sendJson(res, 200, { ok: true, job });
    return true;
  }

  if (pathname === '/api/recruitment/candidates' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const candidate = saveRecruitmentCandidate(body);
    sendJson(res, 200, { ok: true, candidate });
    return true;
  }

  if (pathname === '/api/recruitment/applications' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const app = saveRecruitmentApplication(body);
    if (String(body.stage) === 'hired') {
      seedOnboardingForCandidate(String(body.candidateId));
    }
    sendJson(res, 200, { ok: true, application: app });
    return true;
  }

  const appPatchMatch = pathname.match(/^\/api\/recruitment\/applications\/([^/]+)$/);
  if (appPatchMatch && req.method === 'PATCH') {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    const updated = updateRecruitmentApplication(decodeURIComponent(appPatchMatch[1]), body);
    if (!updated) {
      sendJson(res, 404, { error: 'Application not found' });
      return true;
    }
    if (String(body.stage) === 'hired' && updated) {
      seedOnboardingForCandidate(String(updated.candidateId));
    }
    sendJson(res, 200, { ok: true, application: updated });
    return true;
  }

  if (pathname === '/api/recruitment/onboarding' && (req.method === 'POST' || req.method === 'PATCH')) {
    const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
    if (body.id) {
      const updated = updateRecruitmentOnboardingTask(String(body.id), body);
      sendJson(res, updated ? 200 : 404, updated ? { ok: true, task: updated } : { error: 'Task not found' });
    } else {
      const task = saveRecruitmentOnboardingTask(body);
      sendJson(res, 200, { ok: true, task });
    }
    return true;
  }

  if (pathname === '/api/integrations/voice-config' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as { integration: string; values: Record<string, string> };
    const envMap: Record<string, string> = {};
    if (body.integration === 'vapi') {
      if (body.values.privateKey) envMap.VAPI_PRIVATE_KEY = body.values.privateKey;
      if (body.values.publicKey) envMap.VAPI_PUBLIC_KEY = body.values.publicKey;
      if (body.values.phoneNumberId) envMap.VAPI_PHONE_NUMBER_ID = body.values.phoneNumberId;
      if (body.values.serverSecret) envMap.VAPI_SERVER_SECRET = body.values.serverSecret;
      if (body.values.region) envMap.VAPI_REGION = body.values.region;
    } else if (body.integration === 'elevenlabs') {
      if (body.values.apiKey) envMap.ELEVENLABS_API_KEY = body.values.apiKey;
      if (body.values.voiceId) {
        envMap.ELEVENLABS_VOICE_ID = body.values.voiceId;
        envMap.VAPI_ELEVENLABS_VOICE_ID = body.values.voiceId;
      }
      if (body.values.modelId) envMap.ELEVENLABS_MODEL_ID = body.values.modelId;
    }
    for (const [k, v] of Object.entries(envMap)) {
      process.env[k] = v;
    }
    sendJson(res, 200, { ok: true, keysSet: Object.keys(envMap) });
    return true;
  }

  if (pathname === '/api/integrations/voice-config' && req.method === 'GET') {
    const mask = (v?: string | null) => (v && v.trim() ? `${v.trim().slice(0, 4)}…${v.trim().slice(-4)}` : null);
    sendJson(res, 200, {
      vapi: {
        configured: Boolean(process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY),
        privateKey: mask(process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY),
        publicKey: mask(process.env.VAPI_PUBLIC_KEY),
        phoneNumberId: mask(process.env.VAPI_PHONE_NUMBER_ID),
        serverSecret: Boolean(process.env.VAPI_SERVER_SECRET),
        region: process.env.VAPI_REGION || 'eu',
        webhookUrl: process.env.VAPI_WEBHOOK_BASE_URL || process.env.WEBHOOK_BASE_URL || '',
      },
      elevenlabs: {
        configured: Boolean(process.env.ELEVENLABS_API_KEY || process.env.VAPI_ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID),
        apiKey: mask(process.env.ELEVENLABS_API_KEY),
        voiceId: process.env.VAPI_ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || '',
        modelId: process.env.ELEVENLABS_MODEL_ID || '',
      },
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        apiKey: mask(process.env.OPENAI_API_KEY),
      },
      sip: {
        username: process.env.SOHO66_SIP_USERNAME || '',
        domain: process.env.SOHO66_SIP_DOMAIN || 'sbc.soho66.co.uk',
        did: process.env.SOHO66_FROM_NUMBER || '',
        bridgeUrl: process.env.SOHO66_SIP_BRIDGE_URL || '',
        hasPassword: Boolean(process.env.SOHO66_SIP_PASSWORD),
      },
    });
    return true;
  }

  if (pathname === '/api/campaigns/upload' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req)) as {
      csv?: string;
      rows?: Array<{ name?: string; phone?: string; notes?: string; customerId?: string }>;
      template?: string;
      brief?: string;
      dryRun?: boolean;
    };
    try {
      const { parseCampaignCsv, queueCsvCampaign } = await import('./outbound-campaigns');
      const rows = Array.isArray(body.rows) && body.rows.length
        ? body.rows.map((r) => ({
            name: String(r.name ?? 'Guest'),
            phone: String(r.phone ?? ''),
            notes: r.notes != null ? String(r.notes) : undefined,
            customerId: r.customerId != null ? String(r.customerId) : undefined,
          }))
        : parseCampaignCsv(String(body.csv ?? ''));
      const result = queueCsvCampaign({
        rows,
        template: body.template,
        brief: body.brief,
        dryRun: body.dryRun === true,
      });
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Campaign upload failed' });
    }
    return true;
  }

  return false;
}
