/**
 * Shared builders for Vapi assistant payloads (outbound + assistant-request).
 */
import { DEFAULT_ORG_ID, getCallById, setRequestOrgId } from './data-store';
import {
  buildPhoneBrainPrompt,
  getPhoneSessionChatTools,
  VERIFY_PIN_TOOL,
} from './phone-brain';
import {
  isPhoneAuthVerified,
  resolvePhoneCallerIdentity,
  type PhoneCallerIdentity,
} from './phone-auth';
import { deepgramLanguageForPack } from './language-packs';
import { getVapiVoiceConfigForLang } from './phone-voices';
import { getVapiWebhookBaseUrl } from './vapi-client';
export { resolveTransferNumber, transferDestinationsFromEnv } from './transfer-numbers';
import { transferDestinationsFromEnv } from './transfer-numbers';
import {
  buildSallyBrainPrompt,
  getSallyPhoneSessionChatTools,
  isSallySalesCall,
  SALLY_PERSONA,
} from './sally-sales';
import {
  AGENT_PERSONA as JUDIE_PERSONA,
  buildJudieRestaurantPrompt,
  getJudiePhoneSessionChatTools,
  isJudieRestaurantCall,
  resolveJudieRestaurantOrgId,
} from './judie-restaurant';
import type { RestaurantProfileDraft } from './restaurant-research';
import { buildVapiModelBlock } from './vapi-llm-model';

/** Never greet as Guest / Unknown — empty means ask for the name. */
export function spokenFirstName(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const first = String(c || '').trim().split(/\s+/)[0];
    if (!first) continue;
    const lower = first.toLowerCase();
    if (lower === 'guest' || lower === 'unknown' || lower === 'caller' || lower === 'there') continue;
    return first;
  }
  return '';
}

export async function buildVapiAssistantForParty(opts: {
  partyPhone: string;
  direction: 'inbound' | 'outbound';
  campaignTemplate?: string;
  callId?: string;
  contactName?: string;
  /** Explicit outbound brief (preferred over reading call row — placeCall may not have saved meta yet). */
  outboundBrief?: string;
  agentPersona?: string;
  callMetadata?: Record<string, unknown>;
}): {
  assistant: Record<string, unknown>;
  identity: PhoneCallerIdentity;
  verified: boolean;
  agentPersona?: string;
} {
  const identity = resolvePhoneCallerIdentity(opts.partyPhone, DEFAULT_ORG_ID);
  const verified = opts.callId ? isPhoneAuthVerified(opts.callId) : false;
  const existingCall = opts.callId ? getCallById(opts.callId) : undefined;
  const languageOverride = (existingCall?.metadata as Record<string, unknown> | undefined)?.callLanguage as
    | string
    | undefined;
  const callMeta = {
    ...((existingCall?.metadata as Record<string, unknown> | undefined) || {}),
    ...(opts.callMetadata || {}),
  };
  const outboundBrief = opts.outboundBrief
    ?? (callMeta.brief != null
      ? String(callMeta.brief)
      : callMeta.aim != null
        ? String(callMeta.aim)
        : undefined);

  const sally = isSallySalesCall(callMeta, {
    campaignTemplate: opts.campaignTemplate,
    agentPersona: opts.agentPersona || String(callMeta.agentPersona || ''),
  });
  const lineDid = String(callMeta.lineDid || callMeta.to || '');
  const judieOrgId = resolveJudieRestaurantOrgId({ callMetadata: callMeta, lineDid });
  const judie = !sally && isJudieRestaurantCall(callMeta, {
    agentPersona: opts.agentPersona || String(callMeta.agentPersona || ''),
    orgId: judieOrgId || undefined,
    lineDid,
  });

  const webhookBase = getVapiWebhookBaseUrl();
  const toolServer = `${webhookBase}/webhooks/vapi`;
  const firstName = spokenFirstName(
    opts.contactName,
    callMeta.customerName != null ? String(callMeta.customerName) : undefined,
    callMeta.company != null ? String(callMeta.company) : undefined,
    identity.name,
  );

  let instructions: string;
  let language: string;
  let firstMessage: string;
  let assistantName: string;
  let functionTools: Array<Record<string, unknown>>;

  if (sally) {
    const draft = (callMeta.sallySetupDraft && typeof callMeta.sallySetupDraft === 'object'
      ? callMeta.sallySetupDraft
      : null) as RestaurantProfileDraft | null;
    const sallyPrompt = buildSallyBrainPrompt({
      partyPhone: opts.partyPhone,
      direction: opts.direction,
      outboundBrief,
      contactName: opts.contactName || identity.name,
      companyHint: callMeta.company != null ? String(callMeta.company) : undefined,
      draft,
    });
    instructions = sallyPrompt.instructions;
    language = sallyPrompt.language;
    assistantName = 'Sally Sync2Dine';
    if (opts.direction === 'outbound') {
      firstMessage = firstName
        ? `Hi ${firstName}, it's Sally from Sync2Dine — have you got a quick moment?`
        : `Hi, it's Sally from Sync2Dine — who am I speaking with?`;
    } else {
      firstMessage = firstName
        ? `Hi ${firstName}, Sally from Sync2Dine here — how can I help?`
        : `Hi, Sally from Sync2Dine here — who am I speaking with?`;
    }
    functionTools = getSallyPhoneSessionChatTools()
      .filter((tool) => tool.function.name !== 'endCall')
      .map((tool) => ({
        type: 'function',
        function: tool.function,
        async: false,
        server: { url: toolServer },
      }));
  } else if (judie && judieOrgId) {
    setRequestOrgId(judieOrgId);
    const judiePrompt = buildJudieRestaurantPrompt(judieOrgId, {
      partyPhone: opts.partyPhone,
      direction: opts.direction,
      outboundBrief,
      contactName: opts.contactName || resolvePhoneCallerIdentity(opts.partyPhone, judieOrgId).name,
      languageOverride,
    });
    instructions = judiePrompt.instructions;
    language = judiePrompt.language;
    assistantName = 'Judie';
    if (opts.direction === 'outbound') {
      firstMessage = `Hi${firstName ? ` ${firstName}` : ''}, it's Judie — have you got a moment about your order?`;
    } else {
      firstMessage = `Hi${firstName ? ` ${firstName}` : ''}, Judie here — how can I help?`;
    }
    functionTools = getJudiePhoneSessionChatTools()
      .filter((tool) => tool.function.name !== 'endCall')
      .map((tool) => ({
        type: 'function',
        function: tool.function,
        async: false,
        server: { url: toolServer },
      }));
  } else {
    const built = buildPhoneBrainPrompt({
      orgId: DEFAULT_ORG_ID,
      partyPhone: opts.partyPhone,
      direction: opts.direction,
      campaignTemplate: opts.campaignTemplate,
      outboundBrief,
      contactName: opts.contactName || identity.name,
      identity,
      callId: opts.callId,
      phoneAuthVerified: verified,
      languageOverride,
    });
    instructions = built.instructions;
    language = built.language;

    if (identity.kind === 'staff' || identity.kind === 'foreman') {
      firstMessage = verified
        ? `Hi ${firstName || 'there'}, Cynthia here — you're unlocked, what do you need?`
        : `Hi ${firstName || 'there'}, Cynthia here — when you can, say your four-digit security code and I'll unlock your tools.`;
    } else if (opts.direction === 'outbound') {
      firstMessage = firstName
        ? `Hi ${firstName}, it's Cynthia from Builder Diddies — how are you getting on?`
        : `Hi, it's Cynthia from Builder Diddies — who am I speaking with?`;
    } else {
      firstMessage = firstName
        ? `Hi ${firstName}, Cynthia from Builder Diddies here — how can I help?`
        : `Hi, Cynthia from Builder Diddies here — how can I help?`;
    }
    assistantName = identity.kind === 'customer' ? 'Cynthia Builder Diddies' : `Cynthia (${identity.role})`;

    functionTools = getPhoneSessionChatTools(identity, verified)
      .filter((tool) => tool.function.name !== 'endCall')
      .map((tool) => ({
        type: 'function',
        function: tool.function,
        async: false,
        server: { url: toolServer },
      }));

    if (identity.kind !== 'customer' && !functionTools.some((t) => (t.function as { name?: string }).name === 'verifyStaffPhonePin')) {
      functionTools.unshift({
        type: 'function',
        function: VERIFY_PIN_TOOL.function,
        async: false,
        server: { url: toolServer },
      });
    }
  }

  const nativeTools: Array<Record<string, unknown>> = [
    { type: 'endCall' },
  ];
  const xfer = transferDestinationsFromEnv();
  if (xfer.length) {
    nativeTools.push({
      type: 'transferCall',
      destinations: xfer,
    });
  }

  const model = await buildVapiModelBlock({
    orgId: DEFAULT_ORG_ID,
    instructions,
    tools: [...nativeTools, ...functionTools],
  });

  const assistant: Record<string, unknown> = {
    name: assistantName,
    firstMessage,
    model,
    voice: getVapiVoiceConfigForLang(language),
    transcriber: {
      provider: 'deepgram',
      model: process.env.VAPI_DEEPGRAM_MODEL?.trim() || 'nova-2',
      language: deepgramLanguageForPack(language as 'en'),
    },
    silenceTimeoutSeconds: 45,
    maxDurationSeconds: Number(process.env.VAPI_MAX_CALL_SECONDS || 900),
    backgroundSound: 'off',
    ...(sally
      ? {
          voicemailDetectionEnabled: true,
          voicemailMessage:
            process.env.SALLY_VOICEMAIL_MESSAGE?.trim()
            || "Hi, it's Sally from Sync2Dine. We help restaurants answer the phone with AI that takes orders. I'll try you again soon — or reply to this number and we'll book a quick demo. Thanks!",
        }
      : {}),
    serverUrl: toolServer,
    serverMessages: [
      'transcript',
      'status-update',
      'end-of-call-report',
      'tool-calls',
      'hang',
      'conversation-update',
    ],
  };

  return {
    assistant,
    identity,
    verified,
    agentPersona: sally ? SALLY_PERSONA : judie ? JUDIE_PERSONA : undefined,
  };
}
