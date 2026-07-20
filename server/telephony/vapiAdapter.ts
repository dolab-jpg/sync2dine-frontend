/**
 * Vapi telephony adapter — managed SIP/media outbound calls.
 */
import { saveCall } from '../data-store';
import {
  getVapiPrivateKey,
  getVapiWebhookBaseUrl,
  toE164Uk,
  vapiFetch,
} from '../vapi-client';
import type {
  AgentCallContext,
  CallEvent,
  TelephonyConfig,
  TelephonyProvider,
  TelephonyResponse,
} from './types';

function metadataFromContext(context: AgentCallContext): Record<string, string> {
  const meta: Record<string, string> = {
    tradeproCallId: context.callId,
    direction: context.direction,
  };
  if (context.customerId) meta.customerId = String(context.customerId);
  if (context.customerName) meta.customerName = String(context.customerName);
  if (context.projectId) meta.projectId = String(context.projectId);
  if (context.campaignTemplate) meta.campaignTemplate = String(context.campaignTemplate);
  const ctx = context.metadata || {};
  for (const key of ['aim', 'brief', 'source', 'batchId', 'company', 'agentPersona'] as const) {
    if (ctx[key] != null && String(ctx[key]).trim()) meta[key] = String(ctx[key]);
  }
  return meta;
}

export const vapiAdapter: TelephonyProvider = {
  id: 'vapi',

  parseInboundRequest(body: Record<string, unknown>): CallEvent | null {
    const message = (body.message || body) as Record<string, unknown>;
    const call = (message.call || body.call || body) as Record<string, unknown>;
    const callId = String(call.id || body.callId || `vapi-${Date.now()}`);
    const customer = call.customer as Record<string, unknown> | undefined;
    const customerNumber = String(customer?.number || body.to || '').trim();
    return {
      type: 'call_started',
      callId,
      providerCallId: callId,
      from: String(call.phoneNumber || process.env.SOHO66_FROM_NUMBER || ''),
      to: customerNumber,
      direction: String(call.type || '').toLowerCase().includes('outbound') ? 'outbound' : 'inbound',
      status: 'in_progress',
      raw: body,
    };
  },

  buildResponse(response: TelephonyResponse, callId: string) {
    // Vapi owns media; local TwiML-style responses are unused.
    return {
      contentType: 'application/json',
      body: JSON.stringify({
        callId,
        speak: response.speak,
        gather: response.gather ?? true,
        hangup: response.hangup ?? false,
        provider: 'vapi',
      }),
    };
  },

  verifyWebhook(_body: string, _url: string, headers: Record<string, string>, _config: TelephonyConfig): boolean {
    const secret = process.env.VAPI_SERVER_SECRET?.trim();
    if (!secret) return true;
    const header = headers['x-vapi-secret'] || headers.authorization || '';
    return header.includes(secret);
  },

  async placeCall(to: string, context: AgentCallContext, config: TelephonyConfig) {
    if (!getVapiPrivateKey()) {
      throw new Error('VAPI_PRIVATE_KEY is required for VOICE_PROVIDER=vapi');
    }

    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
    if (!phoneNumberId) {
      throw new Error(
        'VAPI_PHONE_NUMBER_ID is required — run npm run vapi:setup after adding VAPI_PRIVATE_KEY',
      );
    }

    const callId = context.callId ?? `vapi-out-${Date.now()}`;
    const customerNumber = toE164Uk(to);
    const webhookBase = getVapiWebhookBaseUrl();
    const fromNumber = toE164Uk(
      config.fromNumber || process.env.SOHO66_FROM_NUMBER || process.env.VAPI_FROM_NUMBER || '',
    );

    const ctxMeta = (context.metadata && typeof context.metadata === 'object')
      ? context.metadata
      : {};
    const outboundBrief = ctxMeta.brief != null
      ? String(ctxMeta.brief)
      : ctxMeta.aim != null
        ? String(ctxMeta.aim)
        : undefined;

    // Shared builder resolves staff/builder/customer identity + PIN gating + tools + transfer/hangup.
    // Pass brief/persona explicitly — call row may not exist yet at build time.
    const { buildVapiAssistantForParty } = await import('../vapi-assistant');
    const { assistant, identity, agentPersona } = await buildVapiAssistantForParty({
      partyPhone: customerNumber,
      direction: 'outbound',
      campaignTemplate: context.campaignTemplate,
      callId,
      contactName: context.customerName || (ctxMeta.company != null ? String(ctxMeta.company) : undefined),
      outboundBrief,
      agentPersona: ctxMeta.agentPersona != null ? String(ctxMeta.agentPersona) : undefined,
      callMetadata: ctxMeta,
    });

    // Persist TradePro row BEFORE dial so early webhooks can attach via tradeproCallId
    // (avoids empty out-* Call Centre rows with transcript stuck on a Vapi-UUID twin).
    saveCall({
      id: callId,
      provider: 'vapi',
      direction: 'outbound',
      from: fromNumber || process.env.SOHO66_FROM_NUMBER || '',
      to: customerNumber,
      status: 'ringing',
      transcript: [],
      startedAt: new Date().toISOString(),
      customerId: context.customerId,
      contactName: identity.kind !== 'customer'
        ? identity.name
        : (context.customerName || (ctxMeta.company != null ? String(ctxMeta.company) : undefined)),
      campaignTemplate: context.campaignTemplate,
      metadata: {
        ...ctxMeta,
        tradeproCallId: callId,
        partyPhone: customerNumber,
        webhookBase,
        callerKind: identity.kind,
        callerRole: identity.role,
        phoneAuth: identity.needsPin ? 'pending' : 'n/a',
        ...(agentPersona ? { agentPersona } : {}),
      },
    });

    const payload: Record<string, unknown> = {
      phoneNumberId,
      customer: {
        number: customerNumber,
        numberE164CheckEnabled: true,
        name: context.customerName || undefined,
      },
      assistant,
      metadata: metadataFromContext({ ...context, callId }),
    };

    const result = await vapiFetch('/call/phone', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      saveCall({
        id: callId,
        status: 'failed',
        endedAt: new Date().toISOString(),
        outcome: 'vapi_dial_failed',
        metadata: {
          ...ctxMeta,
          tradeproCallId: callId,
          partyPhone: customerNumber,
          webhookBase,
          callerKind: identity.kind,
          callerRole: identity.role,
          phoneAuth: identity.needsPin ? 'pending' : 'n/a',
          ...(agentPersona ? { agentPersona } : {}),
          dialError: result.raw.slice(0, 400),
        },
      });
      void import('../phone-ops-incidents')
        .then(({ recordPhoneIncident }) => {
          recordPhoneIncident({
            severity: 'call_fail',
            error: `Vapi dial failed (${result.status}): ${result.raw.slice(0, 400)}`,
            callId,
            callerPhone: customerNumber,
            outcome: 'vapi_dial_failed',
            route: '/call/phone',
            details: { httpStatus: result.status, dialError: result.raw.slice(0, 400) },
          });
        })
        .catch(() => undefined);
      throw new Error(`Vapi dial failed (${result.status}): ${result.raw.slice(0, 400)}`);
    }

    const providerCallId = String(result.json.id || result.json.callId || callId);
    saveCall({
      id: callId,
      providerCallId,
      provider: 'vapi',
      status: 'in_progress',
      metadata: {
        vapiCallId: providerCallId,
        tradeproCallId: callId,
        partyPhone: customerNumber,
        webhookBase,
        callerKind: identity.kind,
        callerRole: identity.role,
        phoneAuth: identity.needsPin ? 'pending' : 'n/a',
      },
    });

    return { callId, providerCallId };
  },

  async testConnection(_config: TelephonyConfig) {
    if (!getVapiPrivateKey()) {
      return { ok: false, message: 'VAPI_PRIVATE_KEY missing' };
    }
    try {
      const result = await vapiFetch('/phone-number', { method: 'GET' });
      if (!result.ok) {
        return { ok: false, message: `Vapi API error ${result.status}: ${result.raw.slice(0, 200)}` };
      }
      const phoneId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
      return {
        ok: true,
        message: phoneId
          ? `Vapi connected. Phone number id=${phoneId}`
          : 'Vapi connected, but VAPI_PHONE_NUMBER_ID is not set — run npm run vapi:setup',
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
