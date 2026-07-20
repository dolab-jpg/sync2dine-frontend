/**
 * WhatsApp Web.js singleton client.
 * Connects via QR code (personal WhatsApp), replaces Meta Cloud API transport.
 * Reuses the existing channel-inbound-handler pipeline for AI + tools.
 *
 * DEBUG SESSION bddce0 — temporary instrumentation (do not strip until verified).
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia, MessageAck } = pkg;
type WAClient = InstanceType<typeof Client>;
type WAMessage = InstanceType<typeof pkg.Message>;

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync } from 'fs';
import { handleChannelInbound } from './channel-inbound-handler';
import {
  resolveContactByPhone,
  getProjectByGroupId,
  getDataStore,
  getRequestOrgId,
  setRequestOrgId,
  syncData,
  DEFAULT_ORG_ID,
} from './data-store';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const DEBUG_LOG = '/tmp/debug-bddce0.log';

export type WWebStatus = 'disconnected' | 'qr_pending' | 'authenticated' | 'ready';

interface ReadReceipt {
  messageId: string;
  chatId: string;
  ack: number;
  timestamp: string;
}

let client: WAClient | null = null;
let currentStatus: WWebStatus = 'disconnected';
let currentQR: string | null = null;
let clientInfo: Record<string, unknown> | null = null;
const readReceipts = new Map<string, ReadReceipt>();

// #region agent log
let authenticatedAtMs: number | null = null;
let lastLoadingPercent: number | null = null;
let lastLoadingMessage: string | null = null;
let readyAtMs: number | null = null;
let initStartedAtMs: number | null = null;
let stuckWatchTimer: ReturnType<typeof setInterval> | null = null;

function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {}
): void {
  const payload = {
    sessionId: 'bddce0',
    runId: 'pre-fix',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(DEBUG_LOG, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore disk log failures */
  }
  console.log(`[dbg-bddce0] ${hypothesisId} ${message}`, JSON.stringify(data));
}

function stopStuckWatch(): void {
  if (stuckWatchTimer) {
    clearInterval(stuckWatchTimer);
    stuckWatchTimer = null;
  }
}

function startStuckWatch(): void {
  stopStuckWatch();
  stuckWatchTimer = setInterval(() => {
    if (currentStatus !== 'authenticated') {
      stopStuckWatch();
      return;
    }
    const ageMs = authenticatedAtMs ? Date.now() - authenticatedAtMs : null;
    const pupPage = (client as { pupPage?: unknown } | null)?.pupPage ?? null;
    agentLog('H1', 'whatsapp-web-client.ts:stuckWatch', 'still authenticated — ready not fired', {
      ageMs,
      hasClient: Boolean(client),
      hasPupPage: Boolean(pupPage),
      lastLoadingPercent,
      lastLoadingMessage,
      chromeCountHint: 'check ps separately',
      puppeteerArgs: ['--single-process', 'no-executablePath'],
    });
  }, 15000);
}

export function getWWebDebug(): Record<string, unknown> {
  const pupPage = (client as { pupPage?: unknown } | null)?.pupPage ?? null;
  return {
    hasClient: Boolean(client),
    hasPupPage: Boolean(pupPage),
    authenticatedAtMs,
    readyAtMs,
    initStartedAtMs,
    ageSinceAuthMs: authenticatedAtMs ? Date.now() - authenticatedAtMs : null,
    lastLoadingPercent,
    lastLoadingMessage,
    puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    usesExecutablePath: false,
    usesWebVersionCache: false,
  };
}
// #endregion

export function getWWebStatus(): WWebStatus {
  return currentStatus;
}

export function getWWebQR(): string | null {
  return currentQR;
}

export function getWWebInfo(): Record<string, unknown> | null {
  return clientInfo;
}

export function getWWebClient(): WAClient | null {
  return client;
}

export function getReadReceipts(chatId?: string): ReadReceipt[] {
  const all = Array.from(readReceipts.values());
  if (!chatId) return all;
  return all.filter(r => r.chatId === chatId);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}

function appendProjectMessage(
  projectId: string,
  msg: Record<string, unknown>,
  orgId?: string
): void {
  const store = getDataStore(orgId);
  const project = store.projects.find(p => String(p.id) === projectId);
  if (!project) return;
  const messages = [...(project.messages as unknown[] ?? []), msg];
  project.messages = messages;
  syncData(store, orgId);
}

function appendProjectAiAction(
  projectId: string,
  action: Record<string, unknown>,
  orgId?: string
): void {
  const store = getDataStore(orgId);
  const project = store.projects.find(p => String(p.id) === projectId);
  if (!project) return;
  const aiActions = [...(project.aiActions as unknown[] ?? []), action];
  project.aiActions = aiActions;
  syncData(store, orgId);
}

async function handleIncomingMessage(msg: WAMessage): Promise<void> {
  try {
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    const isGroup = chat.isGroup;
    const from = msg.author || msg.from;
    const phone = normalizePhone(from.replace('@c.us', '').replace('@g.us', ''));

    const orgId = DEFAULT_ORG_ID;
    setRequestOrgId(orgId);

    const resolved = resolveContactByPhone(phone);
    let projectId = resolved.projectId;

    if (isGroup) {
      const groupProject = getProjectByGroupId(chat.id._serialized);
      if (groupProject) projectId = String(groupProject.id);
    }

    let text = '';

    if (msg.type === 'chat') {
      text = msg.body || '';
    } else if (msg.hasMedia) {
      const media = await msg.downloadMedia();
      if (media) {
        const isAudio = media.mimetype.startsWith('audio/') || msg.type === 'ptt';
        const isImage = media.mimetype.startsWith('image/');
        const isDocument = media.mimetype.startsWith('application/');

        if (isAudio) {
          try {
            const { resolveOpenAIApiKeyAsync } = await import('./openai-connection');
            const { default: OpenAI } = await import('openai');
            const openai = new OpenAI({ apiKey: await resolveOpenAIApiKeyAsync(undefined, orgId) });
            const buffer = Buffer.from(media.data, 'base64');
            const file = new File([buffer], 'voice.ogg', { type: media.mimetype });
            const transcript = await openai.audio.transcriptions.create({
              model: 'whisper-1',
              file,
            });
            text = transcript.text ?? '';
          } catch {
            text = '[Voice note received — could not transcribe]';
          }
        }

        if ((isImage || isDocument) && projectId) {
          const ext = media.mimetype.split('/')[1]?.split(';')[0] ?? 'bin';
          const filename = (msg as any).filename || `whatsapp_${Date.now()}.${ext}`;

          appendProjectMessage(projectId, {
            id: `WM${Date.now()}`,
            from: resolved.contactName,
            fromRole: 'customer',
            body: `Sent a ${isImage ? 'photo' : 'document'}`,
            timestamp: new Date().toISOString(),
            channel: 'whatsapp',
            senderPhone: phone,
            senderContactName: resolved.contactName,
            senderContactRole: resolved.contactRole,
            attachments: [filename],
          }, orgId);

          const store = getDataStore(orgId);
          const project = store.projects.find(p => String(p.id) === projectId);
          if (project) {
            const fileRecord = {
              id: `F${Date.now()}`,
              storagePath: `whatsapp/${projectId}/${filename}`,
              filename,
              mimeType: media.mimetype,
              source: 'whatsapp',
              uploadedBy: resolved.contactName,
              takenAt: new Date().toISOString(),
              dataUrl: `data:${media.mimetype};base64,${media.data}`,
            };
            project.files = [...(project.files as unknown[] ?? []), fileRecord];
            if (isImage) {
              project.photos = [...(project.photos as string[] ?? []), fileRecord.id];
            }
            syncData(store, orgId);
          }

          if (!text) {
            text = isImage
              ? 'Customer sent a photo — please summarise progress or extras.'
              : 'Customer sent a document.';
          }
        }
      }
    }

    if (!text) return;

    appendProjectMessage(projectId ?? 'unknown', {
      id: `WM${Date.now()}`,
      from: resolved.contactName,
      fromRole: resolved.contactRole ?? 'customer',
      body: text,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      senderPhone: phone,
      senderContactName: resolved.contactName,
      senderContactRole: resolved.contactRole,
    }, orgId);

    const inbound = await handleChannelInbound({
      orgId,
      phone,
      text,
      channel: 'whatsapp',
      contactName: resolved.contactName,
      projectId: projectId ?? resolved.projectId,
    });

    const replyText = inbound.replyLocalized || inbound.replyEnglish;

    if (isGroup) {
      await chat.sendMessage(replyText);
    } else {
      await msg.reply(replyText);
    }

    if (projectId) {
      appendProjectMessage(projectId, {
        id: `WM${Date.now()}a`,
        from: inbound.route.mode === 'staff' ? 'Cynthia' : 'Cynthia',
        fromRole: 'office',
        body: inbound.replyEnglish,
        bodyEnglish: inbound.replyEnglish,
        timestamp: new Date().toISOString(),
        channel: 'whatsapp',
      }, orgId);

      appendProjectAiAction(projectId, {
        id: `AI${Date.now()}`,
        action: 'channelInbound',
        input: { channel: 'whatsapp', route: inbound.route.mode, phone },
        output: { executed: inbound.executedSummaries, toolsUsed: inbound.toolsUsed },
        status: 'approved',
        createdAt: new Date().toISOString(),
        approvedBy: 'Channel AI',
      }, orgId);
    }
  } catch (err) {
    console.error('WhatsApp Web.js inbound error:', err);
    try {
      const chat = await msg.getChat();
      await chat.sendMessage(
        'Sorry — our AI assistant is temporarily unavailable. A team member will follow up shortly.'
      );
    } catch {
      // ignore secondary failures
    }
  }
}

export async function initWWebClient(): Promise<void> {
  if (client) {
    // #region agent log
    agentLog('H5', 'whatsapp-web-client.ts:initWWebClient', 'init skipped — client already exists', {
      currentStatus,
      ageSinceAuthMs: authenticatedAtMs ? Date.now() - authenticatedAtMs : null,
    });
    // #endregion
    console.log('WhatsApp Web.js client already initialized');
    return;
  }

  console.log('Initializing WhatsApp Web.js client...');
  // #region agent log
  initStartedAtMs = Date.now();
  authenticatedAtMs = null;
  readyAtMs = null;
  lastLoadingPercent = null;
  lastLoadingMessage = null;
  agentLog('H1', 'whatsapp-web-client.ts:initWWebClient', 'init starting', {
    puppeteerArgs: ['--single-process'],
    usesExecutablePath: Boolean(process.env.PUPPETEER_EXECUTABLE_PATH),
    envChromeSetButUnused: Boolean(process.env.PUPPETEER_EXECUTABLE_PATH),
    usesWebVersionCache: false,
  });
  // #endregion

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: join(DATA_DIR, '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    },
  });

  client.on('qr', (qr: string) => {
    currentStatus = 'qr_pending';
    currentQR = qr;
    // #region agent log
    agentLog('H2', 'whatsapp-web-client.ts:qr', 'qr received', { qrLen: qr?.length ?? 0 });
    // #endregion
    console.log('WhatsApp QR code received — scan from admin panel or terminal:');
    try {
      import('qrcode-terminal').then(m => m.default.generate(qr, { small: true }));
    } catch {
      console.log('QR:', qr);
    }
  });

  client.on('authenticated', () => {
    currentStatus = 'authenticated';
    currentQR = null;
    // #region agent log
    authenticatedAtMs = Date.now();
    agentLog('H1', 'whatsapp-web-client.ts:authenticated', 'authenticated event', {
      msSinceInit: initStartedAtMs ? Date.now() - initStartedAtMs : null,
    });
    startStuckWatch();
    // #endregion
    console.log('WhatsApp Web.js authenticated');
  });

  // #region agent log
  client.on('loading_screen', (percent: number, message: string) => {
    lastLoadingPercent = percent;
    lastLoadingMessage = String(message ?? '');
    agentLog('H2', 'whatsapp-web-client.ts:loading_screen', 'loading_screen', {
      percent,
      message: lastLoadingMessage,
      status: currentStatus,
    });
  });
  // #endregion

  client.on('ready', () => {
    currentStatus = 'ready';
    currentQR = null;
    // #region agent log
    readyAtMs = Date.now();
    stopStuckWatch();
    agentLog('H1', 'whatsapp-web-client.ts:ready', 'ready event fired', {
      msSinceAuth: authenticatedAtMs ? Date.now() - authenticatedAtMs : null,
      msSinceInit: initStartedAtMs ? Date.now() - initStartedAtMs : null,
    });
    // #endregion
    if (client) {
      const info = (client as any).info;
      clientInfo = info ? {
        pushname: info.pushname,
        wid: info.wid?._serialized,
        platform: info.platform,
        phone: info.wid?.user,
      } : null;
    }
    console.log('WhatsApp Web.js client ready:', JSON.stringify(clientInfo));
  });

  client.on('auth_failure', (err: string) => {
    currentStatus = 'disconnected';
    currentQR = null;
    clientInfo = null;
    // #region agent log
    stopStuckWatch();
    agentLog('H2', 'whatsapp-web-client.ts:auth_failure', 'auth_failure', { err: String(err) });
    // #endregion
    console.error('WhatsApp Web.js auth failure:', err);
  });

  client.on('disconnected', (reason: string) => {
    currentStatus = 'disconnected';
    currentQR = null;
    clientInfo = null;
    // #region agent log
    stopStuckWatch();
    agentLog('H2', 'whatsapp-web-client.ts:disconnected', 'disconnected', { reason: String(reason) });
    // #endregion
    console.log('WhatsApp Web.js disconnected:', reason);
  });

  client.on('message', (msg: WAMessage) => {
    void handleIncomingMessage(msg);
  });

  client.on('message_ack', (msg: WAMessage, ack: number) => {
    readReceipts.set(msg.id._serialized, {
      messageId: msg.id._serialized,
      chatId: msg.from,
      ack,
      timestamp: new Date().toISOString(),
    });
  });

  try {
    await client.initialize();
    // #region agent log
    agentLog('H1', 'whatsapp-web-client.ts:initializeDone', 'initialize() resolved', {
      currentStatus,
      hasClient: Boolean(client),
      hasPupPage: Boolean((client as { pupPage?: unknown } | null)?.pupPage),
    });
    // #endregion
  } catch (err) {
    console.error('WhatsApp Web.js failed to initialize:', err);
    currentStatus = 'disconnected';
    // #region agent log
    stopStuckWatch();
    agentLog('H1', 'whatsapp-web-client.ts:initializeError', 'initialize() threw', {
      err: err instanceof Error ? err.message : String(err),
    });
    // #endregion
  }
}

export async function logoutWWeb(): Promise<void> {
  // #region agent log
  agentLog('H5', 'whatsapp-web-client.ts:logoutWWeb', 'logout requested', {
    currentStatus,
    hasClient: Boolean(client),
  });
  stopStuckWatch();
  // #endregion
  if (!client) return;
  try {
    await client.logout();
  } catch {
    // may already be disconnected
  }
  try {
    await client.destroy();
  } catch {
    // ignore
  }
  client = null;
  currentStatus = 'disconnected';
  currentQR = null;
  clientInfo = null;
  readReceipts.clear();
  console.log('WhatsApp Web.js logged out and destroyed');
}

export async function sendWWebMessage(
  to: string,
  body: string,
  options?: { media?: { data: string; mimetype: string; filename?: string } }
): Promise<string | null> {
  if (!client || currentStatus !== 'ready') {
    console.error('WhatsApp Web.js not ready — cannot send');
    return null;
  }

  const chatId = to.includes('@') ? to : `${normalizePhone(to)}@c.us`;

  try {
    if (options?.media) {
      const media = new MessageMedia(
        options.media.mimetype,
        options.media.data,
        options.media.filename
      );
      const sent = await client.sendMessage(chatId, media, { caption: body || undefined });
      return sent.id._serialized;
    }

    const sent = await client.sendMessage(chatId, body);
    return sent.id._serialized;
  } catch (err) {
    console.error('WhatsApp Web.js send error:', err);
    return null;
  }
}

export async function sendWWebDocument(
  to: string,
  fileBuffer: Buffer,
  mimetype: string,
  filename: string,
  caption?: string
): Promise<string | null> {
  const base64 = fileBuffer.toString('base64');
  return sendWWebMessage(to, caption || '', {
    media: { data: base64, mimetype, filename },
  });
}

export async function sendWWebImage(
  to: string,
  imageBuffer: Buffer,
  mimetype: string,
  caption?: string
): Promise<string | null> {
  const base64 = imageBuffer.toString('base64');
  return sendWWebMessage(to, caption || '', {
    media: { data: base64, mimetype, filename: `image_${Date.now()}.${mimetype.split('/')[1] || 'jpg'}` },
  });
}

export { MessageMedia };
