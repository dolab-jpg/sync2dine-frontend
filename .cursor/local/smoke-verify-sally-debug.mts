/**
 * Live verify Sally silence / meeting / recording / CRM paths (debug session d0f60a).
 * Run on VPS from sync2dine-backend with tsx + --env-file=.env
 */
import { appendFileSync } from 'fs';
import { buildVapiAssistantForParty } from './server/vapi-assistant.ts';
import {
  executeSallySalesPhoneTool,
  resolveMeetingConfirmOutcome,
} from './server/sally-sales-phone.ts';
import { getDataStore } from './server/data-store.ts';
import { resolveCallPlaybackUrl } from './server/call-recording-artifacts.ts';
import { debugLog } from './server/debug-session-log.ts';

const LOG = process.env.DEBUG_D0F60A_LOG || '/tmp/debug-d0f60a.log';
const CUSTOMER_ID = '1784487882245';
const SAMPLE_CALL = 'out-1784646013205';

function note(msg: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    sessionId: 'd0f60a',
    hypothesisId: 'SMOKE',
    location: 'smoke-verify-sally-debug.mts',
    message: msg,
    data,
    timestamp: Date.now(),
    runId: 'verify1',
  });
  console.log(msg, JSON.stringify(data));
  try {
    appendFileSync(LOG, `${line}\n`);
  } catch {
    /* ignore */
  }
}

// A — silence hooks for Sally + non-Sally
const sallyAst = buildVapiAssistantForParty({
  partyPhone: '+447464207366',
  callMeta: { aim: 'sales_outreach', agentPersona: 'sally', brief: 'smoke' },
  direction: 'outbound',
});
const lizzieAst = buildVapiAssistantForParty({
  partyPhone: '+447464207366',
  callMeta: { aim: 'order_take', brief: 'smoke' },
  direction: 'inbound',
});
note('assistant silence configs', {
  sallyHooks: (sallyAst.assistant.hooks as unknown[])?.length,
  sallyTimeout: sallyAst.assistant.silenceTimeoutSeconds,
  sallyHookNames: (sallyAst.assistant.hooks as Array<{ name?: string }>)?.map((h) => h.name),
  sallyHasDemo: String(sallyAst.assistant.model?.messages?.[0]?.content || '').includes('THIS CALL IS THE DEMO')
    || String((sallyAst.assistant as { model?: { messages?: Array<{ content?: string }> } }).model?.messages?.[0]?.content || '').includes('THIS CALL IS THE DEMO'),
  lizzieHooks: (lizzieAst.assistant.hooks as unknown[])?.length,
  lizzieTimeout: lizzieAst.assistant.silenceTimeoutSeconds,
});

// B — book integration meeting + T-30 job
const when = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const booked = await executeSallySalesPhoneTool(
  'bookIntegrationMeeting',
  {
    when,
    name: 'Dolab',
    phone: '+447464207366',
    email: 'dolab@dolab.me',
    restaurant: 'Pizza Go Go',
    postcode: 'GU12 5QW',
    notes: 'debug smoke bookIntegrationMeeting d0f60a',
  },
  { partyPhone: '+447464207366', callId: 'smoke-d0f60a-meeting' },
);
note('bookIntegrationMeeting result', {
  ok: booked.ok,
  booked: booked.booked,
  confirmJobId: booked.confirmJobId,
  scheduledAt: booked.scheduledAt,
  confirmCallAt: booked.confirmCallAt,
  meetingStatus: booked.meeting?.status,
});

const store = getDataStore();
const confirmJob = (store.outboundQueue || []).find(
  (j) => String(j.id) === String(booked.confirmJobId || ''),
);
note('T-30 confirm job on queue', {
  found: Boolean(confirmJob),
  status: confirmJob?.status,
  bypassQuietHours: confirmJob?.bypassQuietHours === true,
  aim: (confirmJob?.context as Record<string, unknown> | undefined)?.aim,
  scheduledAt: confirmJob?.scheduledAt,
});

// C — no-answer cancel disposition
const cancel = resolveMeetingConfirmOutcome({
  customerId: CUSTOMER_ID,
  partyPhone: '+447464207366',
  callId: 'smoke-d0f60a-confirm-na',
  endedReason: 'customer-did-not-answer',
  disposition: 'no-answer',
  answered: false,
});
const afterCust = getDataStore().customers.find((c) => String(c.id) === CUSTOMER_ID);
note('confirm no-answer cancel', {
  result: cancel,
  meetingStatus: afterCust?.meeting?.status,
});

// D — recording playback for known call
const playback = await resolveCallPlaybackUrl(SAMPLE_CALL);
note('recording playback', {
  callId: SAMPLE_CALL,
  source: playback.source,
  hasUrl: Boolean(playback.url),
});

try {
  const res = await fetch(`http://127.0.0.1:3011/api/calls/${SAMPLE_CALL}/recording`, {
    redirect: 'manual',
  });
  note('recording HTTP', {
    status: res.status,
    location: res.headers.get('location')?.slice(0, 80) || null,
  });
} catch (err) {
  note('recording HTTP error', {
    error: err instanceof Error ? err.message : String(err),
  });
}

// E — CRM spam check for sample customer
const cust = getDataStore().customers.find((c) => String(c.id) === CUSTOMER_ID);
const acts = Array.isArray(cust?.activities) ? cust!.activities! : [];
const callerSpam = acts.filter((a) => /^Caller:/i.test(String((a as { summary?: string }).summary || '')));
const sallyNotes = acts.filter((a) => String((a as { createdBy?: string }).createdBy || '') === 'sally');
note('CRM activity hygiene', {
  totalActivities: acts.length,
  callerSpamCount: callerSpam.length,
  sallyCreatedByCount: sallyNotes.length,
  recentSummaries: acts.slice(-5).map((a) => String((a as { summary?: string }).summary || '').slice(0, 80)),
});

debugLog('SMOKE', 'smoke-verify-sally-debug.mts:done', 'smoke complete', { ok: true });
console.log('SMOKE_DONE');
