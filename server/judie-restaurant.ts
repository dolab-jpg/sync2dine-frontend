/**
 * Judie — Sync2Dine restaurant phone agent (food orders + table bookings).
 * Hard-split from Sally (sales) and Cynthia (Builder Diddies construction).
 */
import { setRequestOrgId } from './data-store';
import { END_CALL_FUNCTION_TOOL, SET_CALL_LANGUAGE_TOOL } from './phone-brain';
import { PHONE_TOOLS } from './phone-tools';
import { getOrganizationById, getOrganizationByPhoneDid } from './organizations';
import { getHomeOrgId, isOrgUuid, sanitizeOrgId } from './home-org';
import { getPack, normalizeLang, type SupportedLang } from './language-packs';
import { isSallySalesCall } from './sally-sales';

export const AGENT_PERSONA = 'judie_restaurant';

const JUDIE_PHONE_TOOL_NAMES = new Set([
  'getMenu',
  'placeFoodOrder',
  'checkDeliveryArea',
  'getDeliveryAreas',
  'checkTableAvailability',
  'bookTable',
  'updateReservation',
  'cancelReservation',
  'listReservations',
  'transferToHuman',
  'captureMessage',
  'classifyCallIntent',
  'lookupCustomerByPhone',
  'getAccountBriefing',
  'setCallLanguage',
  'endCall',
]);

export function resolveJudieRestaurantOrgId(opts?: {
  callMetadata?: Record<string, unknown> | null;
  lineDid?: string;
}): string | null {
  const m = opts?.callMetadata || {};
  const fromMeta = sanitizeOrgId(String(m.orgId || ''));
  if (fromMeta && fromMeta !== getHomeOrgId()) return fromMeta;

  const did = String(opts?.lineDid || m.lineDid || m.to || '').trim();
  if (did) {
    const org = getOrganizationByPhoneDid(did);
    if (org?.id && org.id !== getHomeOrgId()) return org.id;
  }
  return null;
}

export function isJudieRestaurantCall(
  meta?: Record<string, unknown> | null,
  opts?: { agentPersona?: string; orgId?: string; lineDid?: string },
): boolean {
  if (isSallySalesCall(meta, opts)) return false;

  const m = meta || {};
  const persona = String(opts?.agentPersona || m.agentPersona || '').toLowerCase();
  const orgId = resolveJudieRestaurantOrgId({
    callMetadata: m,
    lineDid: opts?.lineDid || String(m.lineDid || ''),
  }) || sanitizeOrgId(String(opts?.orgId || m.orgId || ''));

  if (persona === AGENT_PERSONA || persona === 'judie') {
    return Boolean(orgId && orgId !== getHomeOrgId());
  }

  if (!orgId || !isOrgUuid(orgId) || orgId === getHomeOrgId()) return false;
  return Boolean(getOrganizationById(orgId));
}

export function getJudiePhoneSessionChatTools() {
  return [
    ...PHONE_TOOLS.filter((t) => JUDIE_PHONE_TOOL_NAMES.has(t.function.name)),
    END_CALL_FUNCTION_TOOL,
    SET_CALL_LANGUAGE_TOOL,
  ];
}

function buildLanguageBlock(language: SupportedLang): string {
  const pack = getPack(language);
  if (language === 'en') {
    return 'Spoken language: British English (en-GB). Stay Judie — warm Cockney-lite, never American.';
  }
  return [
    `Spoken language: ${pack.label} (${language}).`,
    `You are still Judie — same restaurant assistant, now speaking ${pack.label}.`,
    'Call setCallLanguage when switching, then continue in that language immediately.',
  ].join(' ');
}

export function buildJudieRestaurantPrompt(
  orgId: string,
  opts?: {
    partyPhone?: string;
    direction?: 'inbound' | 'outbound';
    contactName?: string;
    languageOverride?: string;
    outboundBrief?: string;
  },
): { instructions: string; language: SupportedLang } {
  setRequestOrgId(orgId);
  const org = getOrganizationById(orgId);
  const restaurantName = org?.name?.trim() || 'the restaurant';
  const language = normalizeLang(opts?.languageOverride ?? 'en');

  const identity = [
    `You are Judie — the AI phone assistant for ${restaurantName} (Sync2Dine restaurant product).`,
    'IDENTITY (always): Your name is Judie. You work for this restaurant — never say you are Cynthia, Sally, Lizzie, Builder Diddies, or a voice-provider label.',
    'Whenever anyone asks who you are, reply: "Judie, I am here to help."',
    'AIM: Take accurate food orders (collection, delivery, table), book tables, answer menu questions, and transfer to staff when needed.',
    'GUARDRAILS:',
    '- British English, warm and concise on the phone — one or two spoken sentences.',
    '- Never invent menu items or prices — call getMenu first when the caller wants to order.',
    '- If getMenu returns empty, offer transferToHuman or captureMessage — do not pretend dishes exist.',
    '- For delivery: checkDeliveryArea before placeFoodOrder with orderType delivery.',
    '- Ask about allergies once before placeFoodOrder; pass allergyConfirmed true after asking.',
    '- Confirm items and total aloud before placeFoodOrder.',
    '- MONEY: never speak £ or bare digits — prefer tool spokenHint / spokenTotal.',
    '- If they want a person: brief them, then transferToHuman.',
  ].join('\n');

  const context = [
    opts?.contactName ? `Caller name hint: ${opts.contactName}` : '',
    opts?.partyPhone ? `Caller phone: ${opts.partyPhone}` : '',
    opts?.direction === 'outbound'
      ? '- This is an outbound call you placed to the customer.'
      : '- This is an inbound call to the restaurant.',
    opts?.outboundBrief
      ? `- BRIEF FOR THIS CALL: ${String(opts.outboundBrief).slice(0, 800)}`
      : '',
    buildLanguageBlock(language),
  ].filter(Boolean).join('\n');

  return {
    instructions: [identity, context].filter(Boolean).join('\n\n'),
    language,
  };
}
