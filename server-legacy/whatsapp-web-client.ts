/**
 * WhatsApp Web.js singleton client.
 * Connects via QR code (personal WhatsApp), replaces Meta Cloud API transport.
 * Reuses the existing channel-inbound-handler pipeline for AI + tools.
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia, MessageAck } = pkg;
type WAClient = InstanceType<typeof Client>;
type WAMessage = InstanceType<typeof pkg.Message>;

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync } from 'fs';
import { rm } from 'fs/promises';
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
const AUTH_DATA_PATH = join(DATA_DIR, '.wwebjs_auth');
const DEBUG_LOG = '/tmp/debug-bddce0.log';

/** Current WhatsApp Web HTML pin; override with WA_WEB_VERSION_URL on VPS. */
const DEFAULT_WA_WEB_VERSION_URL =
  'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1043363706-alpha.html';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** If authenticated but never ready, recover once (corrupted session / Chromium hang). */
const AUTH_STUCK_MS = 45_000;

export type WWebStatus =
  | 'disconnected'
  | 'initializing'
  | 'qr_pending'
  | 'authenticated'
  | 'ready'
  | 'error';

export interface InitWWebOptions {
  /** Keep Chromium available for screencast login UI. */
  browserLogin?: boolean;
}

interface ReadReceipt {
  messageId: string;
  chatId: string;
  ack: number;
  timestamp: string;
}

let client: WAClient | null = null;
let currentStatus: WWebStatus = 'disconnected';
let currentQR: string | null = null;
let lastError: string | null = null;
let clientInfo: Record<string, unknown> | null = null;
let initInFlight: Promise<void> | null = null;
const readReceipts = new Map<string, ReadReceipt>();

// #region agent log
let authenticatedAtMs: number | null = null;
let readyAtMs: number | null = null;
let initStartedAtMs: number | null = null;
let lastLoadingPercent: number | null = null;
let lastLoadingMessage: string | null = null;
let stuckWatchTimer: ReturnType<typeof setInterval> | null = null;
let stuckRecoveryAttempted = false;

function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  runId = 'post-fix'
): void {
  const payload = {
    sessionId: 'bddce0',
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  try {
    appendFileSync(DEBUG_LOG, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore */
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
    agentLog('H1', 'whatsapp-web-client.ts:stuckWatch', 'still authenticated — ready not fired', {
      ageMs,
      hasClient: Boolean(client),
      hasPupPage: Boolean(getWWebPupPage()),
      lastLoadingPercent,
      lastLoadingMessage,
      usesExecutablePath: Boolean(process.env.PUPPETEER_EXECUTABLE_PATH?.trim()),
      usesWebVersionCache: true,
      singleProcess: false,
    });
    if (ageMs != null && ageMs >= AUTH_STUCK_MS && !stuckRecoveryAttempted) {
      stuckRecoveryAttempted = true;
      stopStuckWatch();
      agentLog('H1', 'whatsapp-web-client.ts:stuckRecovery', 'authenticated stuck — wiping auth and reconnecting', {
        ageMs,
      });
      void reconnectWWeb({ fresh: true });
    }
  }, 15000);
}

export function getWWebDebug(): Record<string, unknown> {
  const puppeteer = resolvePuppeteerOptions(false);
  return {
    hasClient: Boolean(client),
    hasPupPage: Boolean(getWWebPupPage()),
    authenticatedAtMs,
    readyAtMs,
    initStartedAtMs,
    ageSinceAuthMs: authenticatedAtMs ? Date.now() - authenticatedAtMs : null,
    lastLoadingPercent,
    lastLoadingMessage,
    puppeteerArgs: puppeteer.args,
    usesExecutablePath: Boolean(puppeteer.executablePath),
    usesWebVersionCache: true,
    singleProcess: false,
    stuckRecoveryAttempted,
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

export function getWWebLastError(): string | null {
  return lastError;
}

export function getWWebAuthDataPath(): string {
  return AUTH_DATA_PATH;
}

export function getWWebPupPage(): unknown | null {
  return (client as { pupPage?: unknown } | null)?.pupPage ?? null;
}

function resolveWebVersionCache(): { type: 'remote'; remotePath: string } {
  const remotePath =
    process.env.WA_WEB_VERSION_URL?.trim() || DEFAULT_WA_WEB_VERSION_URL;
  return { type: 'remote', remotePath };
}

function resolvePuppeteerOptions(browserLogin?: boolean) {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined;
  return {
    headless: true as boolean,
    executablePath,
    // NOTE: never use --single-process — it hangs after authenticated on Linux/VPS.
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
      ...(browserLogin ? ['--remote-debugging-port=0'] : []),
    ],
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
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

export async function wipeWWebAuthData(): Promise<void> {
  try {
    await rm(AUTH_DATA_PATH, { recursive: true, force: true });
    console.log('WhatsApp Web.js auth data wiped:', AUTH_DATA_PATH);
  } catch (err) {
    console.warn('WhatsApp Web.js auth wipe failed:', err);
  }
}

/** Force-destroy client even when stuck mid-init (does not wipe auth files). */
export async function destroyWWeb(): Promise<void> {
  const existing = client;
  client = null;
  initInFlight = null;
  currentStatus = 'disconnected';
  currentQR = null;
  clientInfo = null;
  readReceipts.clear();

  if (!existing) return;

  try {
    await Promise.race([
      (async () => {
        try {
          await existing.logout();
        } catch {
          /* already gone */
        }
        try {
          await existing.destroy();
        } catch {
          /* ignore */
        }
      })(),
      sleep(8000),
    ]);
  } catch {
    /* ignore */
  }
  console.log('WhatsApp Web.js client destroyed');
}

export async function logoutWWeb(): Promise<void> {
  await destroyWWeb();
  console.log('WhatsApp Web.js logged out');
}

export async function reconnectWWeb(opts?: { fresh?: boolean }): Promise<void> {
  await destroyWWeb();
  if (opts?.fresh) {
    await wipeWWebAuthData();
  }
  lastError = null;
  void initWWebClient();
}

export async function initWWebClient(options?: InitWWebOptions): Promise<void> {
  if (client && currentStatus === 'ready') {
    console.log('WhatsApp Web.js client already ready');
    return;
  }
  if (initInFlight) {
    return initInFlight;
  }
  if (client) {
    console.log('WhatsApp Web.js replacing non-ready client...');
    await destroyWWeb();
  }

  initInFlight = (async () => {
    console.log('Initializing WhatsApp Web.js client...');
    currentStatus = 'initializing';
    lastError = null;
    currentQR = null;
    clientInfo = null;
    // #region agent log
    initStartedAtMs = Date.now();
    authenticatedAtMs = null;
    readyAtMs = null;
    lastLoadingPercent = null;
    lastLoadingMessage = null;
    const puppeteerOpts = resolvePuppeteerOptions(options?.browserLogin);
    agentLog('H1', 'whatsapp-web-client.ts:initWWebClient', 'init starting', {
      usesExecutablePath: Boolean(puppeteerOpts.executablePath),
      puppeteerArgs: puppeteerOpts.args,
      singleProcess: false,
      usesWebVersionCache: true,
      stuckRecoveryAttempted,
    });
    // #endregion

    const webVersionCache = resolveWebVersionCache();
    console.log('WhatsApp Web version cache:', webVersionCache.remotePath);

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_DATA_PATH,
      }),
      puppeteer: puppeteerOpts,
      userAgent: CHROME_UA,
      webVersionCache,
    } as any);

    client.on('qr', (qr: string) => {
      currentStatus = 'qr_pending';
      currentQR = qr;
      lastError = null;
      // #region agent log
      agentLog('H2', 'whatsapp-web-client.ts:qr', 'qr received', { qrLen: qr?.length ?? 0 });
      // #endregion
      console.log('WhatsApp QR code received — scan from admin panel or terminal:');
      try {
        import('qrcode-terminal').then((m) => m.default.generate(qr, { small: true }));
      } catch {
        console.log('QR:', qr);
      }
    });

    client.on('authenticated', () => {
      currentStatus = 'authenticated';
      currentQR = null;
      lastError = null;
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
      lastError = null;
      // #region agent log
      readyAtMs = Date.now();
      stopStuckWatch();
      agentLog('H1', 'whatsapp-web-client.ts:ready', 'ready event fired', {
        msSinceAuth: authenticatedAtMs ? Date.now() - authenticatedAtMs : null,
        msSinceInit: initStartedAtMs ? Date.now() - initStartedAtMs : null,
        usesExecutablePath: Boolean(process.env.PUPPETEER_EXECUTABLE_PATH?.trim()),
        singleProcess: false,
      });
      // #endregion
      if (client) {
        const info = (client as any).info;
        clientInfo = info
          ? {
              pushname: info.pushname,
              wid: info.wid?._serialized,
              platform: info.platform,
              phone: info.wid?.user,
            }
          : null;
      }
      console.log('WhatsApp Web.js client ready:', JSON.stringify(clientInfo));
    });

    client.on('auth_failure', (err: string) => {
      currentStatus = 'error';
      currentQR = null;
      clientInfo = null;
      lastError = `Auth failure: ${err}`;
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
      lastError = `Disconnected: ${reason}`;
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
    } catch (err) {
      console.error('WhatsApp Web.js failed to initialize:', err);
      currentStatus = 'error';
      lastError = `Init failed: ${err instanceof Error ? err.message : String(err)}`;
      const failed = client;
      client = null;
      if (failed) {
        try {
          await failed.destroy();
        } catch {
          /* ignore */
        }
      }
    } finally {
      initInFlight = null;
    }
  })();

  return initInFlight;
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
