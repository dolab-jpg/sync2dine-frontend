/**
 * Sally — Sync2Dine platform_owner outbound sales agent.
 * Sells Sync2Dine to restaurants; researches profile; confirms; provisions tenant org.
 * Hard-split from Lizzie (restaurant food-order agent).
 */
import { randomBytes } from 'crypto';
import {
  appendCustomerCallActivity,
  enqueueOutboundCall,
  getAgentSettings,
  getCallById,
  getDataStore,
  saveCall,
  saveCustomerRecord,
  syncData,
} from './data-store';
import { getHomeOrgId } from './home-org';
import {
  draftToAboutUs,
  researchRestaurantProfile,
  spokenConfirmForField,
  type RestaurantProfileDraft,
  type RestaurantProfileField,
} from './restaurant-research';
import { END_CALL_FUNCTION_TOOL, SET_CALL_LANGUAGE_TOOL } from './phone-brain';
import { PHONE_TOOLS } from './phone-tools';
import { getSallyOfferStored } from './sally-offer-store';

export const SALLY_PERSONA = 'sally';

/** Exclusive Sally tools (executed in this module — not generic phone/CRM). */
export const SALLY_EXCLUSIVE_TOOLS = new Set([
  'researchRestaurantProfile',
  'getRestaurantSetupDraft',
  'confirmRestaurantField',
  'provisionRestaurantClient',
  'bookDemo',
  'leaveVoicemail',
  'createSaasQuote',
  'sendStripeCheckoutLink',
  'bookOnboarding',
  'requestGoogleReview',
  'proposePlanUpsell',
  'chaseUnpaidInvoice',
  'getOfferTerms',
  'confirmSaleTerms',
  'sendSalesAssets',
  'checkPaymentStatus',
]);

export type SallyOfferTerms = {
  monthlyPriceGbp: number;
  setupFeeGbp: number;
  billing: string;
  minimumTerm: string;
  cancelPolicy: string;
  demoPhone: string;
  demoVideoUrl: string;
  salesPdfUrl: string;
};

/** Authoritative Sync2Dine intro offer — UI store first, then env, then defaults. */
export function getSallyOfferTerms(): SallyOfferTerms {
  const stored = getSallyOfferStored();
  const envMonthly = Number(process.env.SALLY_INTRO_MONTHLY_GBP);
  const envSetup = Number(process.env.SALLY_SETUP_FEE_GBP);
  const monthlyFromEnv = Number.isFinite(envMonthly) && envMonthly > 0 ? envMonthly : 350;
  const setupFromEnv = Number.isFinite(envSetup) && envSetup >= 0 ? envSetup : 0;

  return {
    monthlyPriceGbp: Number.isFinite(Number(stored.monthlyPriceGbp)) && Number(stored.monthlyPriceGbp) > 0
      ? Number(stored.monthlyPriceGbp)
      : monthlyFromEnv,
    setupFeeGbp: Number.isFinite(Number(stored.setupFeeGbp)) && Number(stored.setupFeeGbp) >= 0
      ? Number(stored.setupFeeGbp)
      : setupFromEnv,
    billing: 'monthly subscription',
    minimumTerm: (stored.minimumTerm || process.env.SALLY_MINIMUM_TERM || '1 month rolling').trim(),
    cancelPolicy: (stored.cancelPolicy
      || process.env.SALLY_CANCEL_POLICY
      || 'Cancel anytime with 30 days written notice after the first month.').trim(),
    demoPhone: (stored.demoPhone || process.env.SALLY_DEMO_PHONE || '').trim(),
    demoVideoUrl: (stored.demoVideoUrl || process.env.SALLY_DEMO_VIDEO_URL || '').trim(),
    salesPdfUrl: (stored.salesPdfUrl || process.env.SALLY_SALES_PDF_URL || '').trim(),
  };
}

function formatOfferFactsBlock(): string {
  const t = getSallyOfferTerms();
  const lines = [
    'OFFER FACTS (authoritative — never invent different prices or terms):',
    `- Introductory monthly price: £${t.monthlyPriceGbp}`,
    `- Setup fee: £${t.setupFeeGbp}`,
    `- Billing: ${t.billing}`,
    `- Minimum term: ${t.minimumTerm}`,
    `- Cancel policy: ${t.cancelPolicy}`,
  ];
  if (t.demoPhone) lines.push(`- Demo phone: ${t.demoPhone}`);
  if (t.demoVideoUrl) lines.push(`- Demo video: ${t.demoVideoUrl}`);
  if (t.salesPdfUrl) lines.push(`- Sales PDF: ${t.salesPdfUrl}`);
  return lines.join('\n');
}

type SallyTermsRecord = {
  confirmedAt: string;
  monthlyPriceGbp: number;
  setupFeeGbp: number;
  summary: string;
};

const sallyTermsBySession = new Map<string, SallyTermsRecord>();

function readTermsConfirmed(sessionKey: string, callId?: string): SallyTermsRecord | null {
  const fromSession = sallyTermsBySession.get(sessionKey);
  if (fromSession) return fromSession;
  if (!callId) return null;
  const call = getCallById(callId);
  const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
  if (!meta.sallyTermsConfirmedAt) return null;
  return {
    confirmedAt: String(meta.sallyTermsConfirmedAt),
    monthlyPriceGbp: Number(meta.sallyTermsMonthlyGbp) || getSallyOfferTerms().monthlyPriceGbp,
    setupFeeGbp: Number(meta.sallyTermsSetupGbp) || 0,
    summary: String(meta.sallyTermsSummary || 'Terms confirmed'),
  };
}

function writeTermsConfirmed(
  sessionKey: string,
  record: SallyTermsRecord,
  callId?: string,
) {
  sallyTermsBySession.set(sessionKey, record);
  if (!callId) return;
  const call = getCallById(callId);
  const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
  saveCall({
    id: callId,
    metadata: {
      ...meta,
      agentPersona: SALLY_PERSONA,
      sallyTermsConfirmedAt: record.confirmedAt,
      sallyTermsMonthlyGbp: record.monthlyPriceGbp,
      sallyTermsSetupGbp: record.setupFeeGbp,
      sallyTermsSummary: record.summary,
    },
  });
}

function requireTermsConfirmed(
  sessionKey: string,
  callId: string | undefined,
  args?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (args?.termsConfirmed === true || args?.termsConfirmed === 'true') return null;
  if (readTermsConfirmed(sessionKey, callId)) return null;
  return {
    ok: false,
    error: 'terms_confirmation_required',
    spokenHint:
      'First confirm they understand the service, monthly price, billing, and cancel policy using confirmSaleTerms.',
  };
}

const SALLY_TOOL_NAMES = new Set([
  ...SALLY_EXCLUSIVE_TOOLS,
  'bookCallback',
  'captureLead',
  'addLeadNote',
  'getLeadBrief',
  'searchLeads',
  'updateLeadStatus',
  'logFollowUp',
  'listPendingCallbacks',
  'transferToHuman',
  'captureMessage',
  'classifyCallIntent',
  'setCallLanguage',
  'endCall',
  'sendCustomerMessage',
  'placeOutboundCall',
  'enqueueOutboundCall',
  'sendEmailReply',
  'draftEmailReply',
  'sendWhatsAppTemplate',
  'createCalendarEvent',
  'scheduleAppointment',
  'sendContract',
  'schedulePaymentReminder',
  'manageSubscription',
]);

/** Chat/call draft store when no TradePro call row exists yet. */
const sallyDraftBySession = new Map<string, RestaurantProfileDraft>();

export function resolveSallySessionKey(opts: {
  callId?: string;
  staffUserId?: string;
  conversationId?: string;
}): string {
  if (opts.callId) return `call:${opts.callId}`;
  if (opts.conversationId) return `conv:${opts.conversationId}`;
  if (opts.staffUserId) return `chat:${opts.staffUserId}`;
  return 'chat:default';
}

export function isSallySalesCall(
  meta?: Record<string, unknown> | null,
  opts?: { campaignTemplate?: string; agentPersona?: string },
): boolean {
  const m = meta || {};
  const persona = String(opts?.agentPersona || m.agentPersona || '').toLowerCase();
  if (persona === SALLY_PERSONA) return true;
  if (String(m.aim || '').toLowerCase() === 'sales_outreach') return true;
  if (String(m.source || '').toLowerCase() === 'sales_csv_dial') return true;
  return false;
}

export const SALLY_PHONE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'researchRestaurantProfile',
      description:
        'Look up the restaurant’s public business details online (website / Google / social) using OpenAI. Call when they want to sign up or you need hours/address/menu links. Then confirm fields with the owner.',
      parameters: {
        type: 'object',
        properties: {
          businessName: { type: 'string' },
          phone: { type: 'string' },
          website: { type: 'string' },
          addressHint: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getRestaurantSetupDraft',
      description: 'Read the current signup draft gathered for this call (researched + confirmed fields).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'confirmRestaurantField',
      description:
        'Mark a signup field as confirmed or apply a spoken correction. Use after asking e.g. "We have found these opening hours. Are they correct?"',
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: [
              'businessName',
              'address',
              'phone',
              'openingHours',
              'deliveryAvailable',
              'collectionAvailable',
              'deliveryAreas',
              'menuUrl',
              'paymentMethods',
              'reservations',
              'website',
              'socialMedia',
              'contactEmail',
            ],
          },
          confirmed: { type: 'boolean', description: 'true if the owner agreed the value is correct' },
          value: {
            type: 'string',
            description: 'Corrected value when they disagree (use "yes"/"no" for booleans)',
          },
        },
        required: ['field'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'provisionRestaurantClient',
      description:
        'Create a Sync2Dine restaurant organisation (tenant) after confirmSaleTerms and owner agreement. Requires contact email and confirmed:true.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', description: 'Must be true — owner agreed to create the account' },
          contactEmail: { type: 'string' },
          contactName: { type: 'string' },
          businessName: { type: 'string' },
          plan: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
          adminPassword: {
            type: 'string',
            description: 'Optional — if omitted a temporary password is generated',
          },
        },
        required: ['confirmed', 'contactEmail'],
      },
    },
  },
];

export const SALLY_EXTENDED_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'bookDemo',
      description:
        'Book a Sync2Dine product demo with a restaurant prospect. Saves CRM aim demo_book, optional calendar ICS, and optional callback dial.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          contactName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          scheduledAt: { type: 'string', description: 'ISO datetime for the demo' },
          notes: { type: 'string' },
          alsoQueueCallback: { type: 'boolean' },
        },
        required: ['scheduledAt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'leaveVoicemail',
      description:
        'Record that a voicemail should be / was left, or schedule email/WhatsApp follow-up when live VM drop is unavailable. Pass left:true only when the call actually reached voicemail.',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          phone: { type: 'string' },
          left: { type: 'boolean' },
          messageSummary: { type: 'string' },
          scheduleFollowUpChannel: { type: 'string', enum: ['email', 'whatsapp', 'callback', 'none'] },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getOfferTerms',
      description:
        'Return the authoritative Sync2Dine intro offer (price, setup fee, billing, cancel policy, demo assets). Always use this instead of inventing numbers.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'confirmSaleTerms',
      description:
        'Record that the prospect confirmed they understand the service, monthly price, billing, and cancel/term policy. Required before provisionRestaurantClient or sendStripeCheckoutLink.',
      parameters: {
        type: 'object',
        properties: {
          confirmed: { type: 'boolean', description: 'Must be true — they confirmed understanding' },
          monthlyPriceGbp: { type: 'number', description: 'Price they agreed (defaults to intro offer)' },
          setupFeeGbp: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['confirmed'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sendSalesAssets',
      description:
        'Email and/or WhatsApp demo video, sales PDF, and/or demo phone number from configured offer assets.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['email', 'whatsapp', 'both'] },
          toEmail: { type: 'string' },
          toPhone: { type: 'string' },
          includeVideo: { type: 'boolean' },
          includePdf: { type: 'boolean' },
          includeDemoPhone: { type: 'boolean' },
          customerId: { type: 'string' },
        },
        required: ['channel'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createSaasQuote',
      description:
        'Create a Sync2Dine SaaS quote on the CRM prospect. Default monthly price is the intro offer from getOfferTerms (not a trade bathroom quote).',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          businessName: { type: 'string' },
          plan: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
          monthlyPriceGbp: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['plan'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sendStripeCheckoutLink',
      description:
        'After confirmSaleTerms: create Stripe Checkout for a restaurant org and email and/or WhatsApp the payment link to the prospect. Do not only speak the URL.',
      parameters: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          customerId: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'whatsapp', 'both'] },
          toEmail: { type: 'string' },
          toPhone: { type: 'string' },
        },
        required: ['organizationId', 'channel'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'checkPaymentStatus',
      description:
        'Check whether a restaurant org (or CRM prospect linked to an org) has paid / is active on Stripe.',
      parameters: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          customerId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'bookOnboarding',
      description: 'Book post-signup onboarding for a provisioned restaurant (go-live checklist + optional callback).',
      parameters: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          customerId: { type: 'string' },
          scheduledAt: { type: 'string' },
          phone: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['scheduledAt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'requestGoogleReview',
      description: 'Ask a restaurant client for a Google review (uses company Google review URL when configured).',
      parameters: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          channel: { type: 'string', enum: ['whatsapp', 'email', 'note_only'] },
          googleReviewUrl: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'proposePlanUpsell',
      description: 'Propose upgrading a restaurant org plan (starter→pro→enterprise) and optionally create a checkout link.',
      parameters: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          targetPlan: { type: 'string', enum: ['pro', 'enterprise'] },
          createCheckout: { type: 'boolean' },
        },
        required: ['organizationId', 'targetPlan'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'chaseUnpaidInvoice',
      description: 'Chase a past-due Sync2Dine SaaS invoice — CRM note + optional callback / email reminder.',
      parameters: {
        type: 'object',
        properties: {
          organizationId: { type: 'string' },
          customerId: { type: 'string' },
          phone: { type: 'string' },
          channel: { type: 'string', enum: ['callback', 'email', 'whatsapp', 'note_only'] },
          notes: { type: 'string' },
        },
      },
    },
  },
];

function pickPhoneTools(...names: string[]) {
  return PHONE_TOOLS.filter((t) => names.includes(t.function.name));
}

const SALLY_CRM_NOTE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'addLeadNote',
    description: 'Save a sales call note / disposition on the prospect CRM row',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string' },
        detail: { type: 'string' },
        aim: { type: 'string' },
        outcome: { type: 'string' },
        disposition: { type: 'string' },
      },
      required: ['detail'],
    },
  },
};

/** Chat-completions tools for Sally phone — no food-order / menu tools. */
export function getSallyPhoneSessionChatTools() {
  return [
    ...SALLY_PHONE_TOOLS,
    ...SALLY_EXTENDED_TOOLS,
    ...pickPhoneTools(
      'bookCallback',
      'captureLead',
      'transferToHuman',
      'captureMessage',
      'classifyCallIntent',
      'sendCustomerMessage',
      'placeOutboundCall',
      'enqueueOutboundCall',
      'scheduleAppointment',
    ),
    SALLY_CRM_NOTE_TOOL,
    END_CALL_FUNCTION_TOOL,
    SET_CALL_LANGUAGE_TOOL,
  ];
}

/** Orchestrator (chat) tool pack for Sally mode. */
export function getSallyOrchestratorTools() {
  return [
    ...SALLY_PHONE_TOOLS,
    ...SALLY_EXTENDED_TOOLS,
    ...pickPhoneTools(
      'bookCallback',
      'captureLead',
      'sendCustomerMessage',
      'placeOutboundCall',
      'enqueueOutboundCall',
      'scheduleAppointment',
      'classifyCallIntent',
      'captureMessage',
    ),
    SALLY_CRM_NOTE_TOOL,
    {
      type: 'function' as const,
      function: {
        name: 'getLeadBrief',
        description: 'Load CRM lead notes and history for a prospect',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            customerId: { type: 'string' },
            query: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'searchLeads',
        description: 'Search CRM leads/prospects by name, phone, or status',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'updateLeadStatus',
        description: 'Update CRM lead status (e.g. qualified, negotiating, won, lost)',
        parameters: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            status: { type: 'string' },
          },
          required: ['customerId', 'status'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'logFollowUp',
        description: 'Log a sales follow-up on a lead',
        parameters: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            detail: { type: 'string' },
            nextFollowUp: { type: 'string' },
          },
          required: ['customerId', 'detail'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'draftEmailReply',
        description: 'Draft a sales email to a restaurant prospect (mailbox)',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'sendEmailReply',
        description: 'Send a sales email via connected mailbox (requires confirmation)',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
            confirmed: { type: 'boolean' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'sendWhatsAppTemplate',
        description: 'Send a WhatsApp template message to a prospect',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            templateName: { type: 'string' },
            confirmed: { type: 'boolean' },
          },
          required: ['phone'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'createCalendarEvent',
        description: 'Create a calendar/ICS invite for a demo or onboarding',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            startAt: { type: 'string' },
            endAt: { type: 'string' },
            attendees: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['title', 'startAt'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'sendContract',
        description: 'Send a Sync2Dine SaaS contract / MSA signing link',
        parameters: {
          type: 'object',
          properties: {
            contractId: { type: 'string' },
            customerId: { type: 'string' },
            confirmed: { type: 'boolean' },
          },
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'schedulePaymentReminder',
        description: 'Schedule a payment reminder for a past-due SaaS invoice',
        parameters: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            organizationId: { type: 'string' },
            dueAt: { type: 'string' },
          },
        },
      },
    },
  ];
}

export function isSallyToolName(name: string): boolean {
  return SALLY_TOOL_NAMES.has(name);
}

export function isSallyExclusiveTool(name: string): boolean {
  return SALLY_EXCLUSIVE_TOOLS.has(name);
}

const SALLY_SALES_OS = [
  'You are Sally, Sync2Dine’s dedicated sales AI (phone and chat).',
  'IDENTITY: Your name is Sally. You work for Sync2Dine (sync2dine.io). Never say you are Lizzie, Cynthia, or Builder Diddies. Never take food orders.',
  'AIM: Take a restaurant prospect from first contact as far as possible toward a live, paying Sync2Dine customer, with minimal human help, while ensuring they understand the product and can ask questions.',
  'HOW: Use tools when useful. Adapt (callback, discovery, demo, close, pay, setup, follow-up, stop if opt-out). Do not force unused steps. There is no fixed stage script.',
  'GUARDRAILS:',
  '- NOT the restaurant food-order agent. No menus, orders, or diner reservations.',
  '- British English, warm professional sales tone. Phone: one or two spoken sentences. Chat: concise paragraphs OK.',
  '- Never invent price, terms, CRM facts, hours, or payment links — use getOfferTerms and tools.',
  '- Before provisionRestaurantClient or sendStripeCheckoutLink, call confirmSaleTerms after they confirm understanding.',
  '- Payment links must be emailed and/or WhatsApp’d via sendStripeCheckoutLink (channel email|whatsapp|both) — do not rely on reading a long URL aloud.',
  '- Escalate only if stuck or they ask for a human. DNC/opt-out = stop.',
  '- Voicemail: use leaveVoicemail; if live drop unavailable, schedule email/WhatsApp follow-up — never fake a left message.',
].join('\n');

export function buildSallyBrainPrompt(input: {
  partyPhone: string;
  direction: 'inbound' | 'outbound';
  outboundBrief?: string;
  contactName?: string;
  companyHint?: string;
  draft?: RestaurantProfileDraft | null;
}): { instructions: string; language: 'en' } {
  const draftBlock = input.draft && Object.keys(input.draft).length
    ? `Current signup draft (confirm with owner — do not invent):\n${JSON.stringify(input.draft, null, 0).slice(0, 2500)}`
    : 'No signup draft yet — call researchRestaurantProfile once they want to sign up or you need public details.';

  const instructions = [
    SALLY_SALES_OS,
    formatOfferFactsBlock(),
    '- On phone keep replies short. Confirm fields one at a time after research.',
    input.direction === 'outbound'
      ? '- This is an outbound sales call you placed.'
      : '- This is an inbound sales call.',
    input.contactName ? `- Contact name hint: ${input.contactName}` : '',
    input.companyHint ? `- Company / restaurant hint: ${input.companyHint}` : '',
    `Caller phone: ${input.partyPhone}`,
    input.outboundBrief
      ? `- SALES BRIEF FOR THIS CALL (follow this): ${String(input.outboundBrief).slice(0, 900)}`
      : '- Pitch Sync2Dine: AI answers the phone, takes orders, and helps grow repeat business.',
    '',
    draftBlock,
  ].filter(Boolean).join('\n');

  return { instructions, language: 'en' };
}

export function buildSallyChatPrompt(input?: {
  userName?: string;
  draft?: RestaurantProfileDraft | null;
}): string {
  const draftBlock = input?.draft && Object.keys(input.draft).length
    ? `Current signup draft:\n${JSON.stringify(input.draft, null, 0).slice(0, 2500)}`
    : 'No signup draft in this session yet.';
  return [
    SALLY_SALES_OS,
    formatOfferFactsBlock(),
    input?.userName ? `You are chatting with platform sales staff: ${input.userName}.` : 'You are chatting with Sync2Dine platform sales staff.',
    'Help them run the sales pipeline with tools. Prefer action over long essays.',
    'Routes they may need: /crm, /calls, /platform/clients, /sales.',
    draftBlock,
  ].join('\n');
}

function readDraft(sessionKey: string, callId?: string): RestaurantProfileDraft {
  if (callId) {
    const call = getCallById(callId);
    const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
    const draft = meta.sallySetupDraft;
    if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
      return draft as RestaurantProfileDraft;
    }
  }
  return sallyDraftBySession.get(sessionKey) || {};
}

function writeDraft(
  sessionKey: string,
  draft: RestaurantProfileDraft,
  callId?: string,
  extraMeta?: Record<string, unknown>,
) {
  sallyDraftBySession.set(sessionKey, draft);
  if (!callId) return;
  const call = getCallById(callId);
  const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
  saveCall({
    id: callId,
    metadata: {
      ...meta,
      ...extraMeta,
      agentPersona: SALLY_PERSONA,
      sallySetupDraft: draft,
    },
  });
}

function parseBoolish(value: string | undefined, fallback: boolean | null | undefined): boolean | null {
  if (value == null || value === '') return fallback ?? null;
  const s = value.trim().toLowerCase();
  if (['yes', 'true', 'y', '1'].includes(s)) return true;
  if (['no', 'false', 'n', '0'].includes(s)) return false;
  return fallback ?? null;
}

function generateTempPassword(): string {
  return `Sd${randomBytes(4).toString('hex')}!${randomBytes(2).toString('hex')}`;
}

function linkCrmToSallyOrg(orgId: string, contactEmail: string, phone?: string) {
  try {
    const store = getDataStore();
    const email = contactEmail.trim().toLowerCase();
    const digits = (phone || '').replace(/\D/g, '');
    let touched = false;
    for (const c of (store.customers as Array<Record<string, unknown>>) || []) {
      const cEmail = String(c.email || '').trim().toLowerCase();
      const cPhone = String(c.phone || '').replace(/\D/g, '');
      const match = (email && cEmail === email)
        || (digits.length >= 8 && cPhone.endsWith(digits.slice(-10)));
      if (!match) continue;
      saveCustomerRecord({ ...c, saasOrgId: orgId });
      touched = true;
    }
    if (touched) syncData({ customers: store.customers });
  } catch {
    /* best-effort */
  }
}

async function seedTenantProfile(
  orgId: string,
  draft: RestaurantProfileDraft,
  contactEmail: string,
): Promise<void> {
  try {
    const { canProvisionViaSupabase } = await import('./provision-org');
    if (!canProvisionViaSupabase()) return;
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) return;
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const aboutUs = draftToAboutUs(draft);
    await supabase.from('agent_settings').upsert({
      org_id: orgId,
      is_active: true,
      data: {
        aboutUs,
        updatedAt: new Date().toISOString(),
        seededBy: 'sally',
      },
    }, { onConflict: 'org_id' });
    await supabase.from('integrations').upsert({
      org_id: orgId,
      integration_id: 'company',
      enabled: true,
      mock_mode: false,
      status: 'connected',
      values: {
        companyName: draft.businessName || '',
        website: draft.website || '',
        email: contactEmail,
        phone: draft.phone || '',
        address: draft.address || '',
        autoSendReceiptOnPaid: 'true',
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,integration_id' });
  } catch (err) {
    console.warn('[sally] seedTenantProfile failed:', err instanceof Error ? err.message : err);
  }
}

export type SallyToolContext = {
  callId?: string;
  partyPhone?: string;
  sessionKey?: string;
  staffUserId?: string;
};

async function sendSallyWhatsApp(
  toRaw: string,
  message: string,
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const { normalizeDialableE164 } = await import('./phone-tools');
  const to = normalizeDialableE164(toRaw);
  if (!to) return { ok: false, error: 'invalid_phone' };
  const { isMetaWhatsAppEnabled, sendWhatsAppText } = await import('./whatsapp-webhook');
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!isMetaWhatsAppEnabled() || !waToken || !waPhoneId) {
    return { ok: false, error: 'whatsapp_not_configured' };
  }
  await sendWhatsAppText(waPhoneId, waToken, to.startsWith('+') ? to : `+${to}`, message);
  return { ok: true, to };
}

async function sendSallyEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { sendPlainTextEmail } = await import('./email-service');
  const result = await sendPlainTextEmail({ to, subject, text });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

async function deliverSallyChannels(opts: {
  channel: 'email' | 'whatsapp' | 'both';
  toEmail?: string;
  toPhone?: string;
  emailSubject: string;
  emailBody: string;
  whatsappBody: string;
}): Promise<{ sentVia: string[]; errors: string[] }> {
  const sentVia: string[] = [];
  const errors: string[] = [];
  const wantEmail = opts.channel === 'email' || opts.channel === 'both';
  const wantWa = opts.channel === 'whatsapp' || opts.channel === 'both';

  if (wantEmail) {
    const email = (opts.toEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      errors.push('email_required');
    } else {
      const r = await sendSallyEmail(email, opts.emailSubject, opts.emailBody);
      if (r.ok) sentVia.push('email');
      else errors.push(r.error);
    }
  }
  if (wantWa) {
    const phone = (opts.toPhone || '').trim();
    if (!phone) {
      errors.push('phone_required');
    } else {
      const r = await sendSallyWhatsApp(phone, opts.whatsappBody);
      if (r.ok) sentVia.push('whatsapp');
      else errors.push(r.error);
    }
  }
  return { sentVia, errors };
}

export async function executeSallyTool(
  name: string,
  args: Record<string, unknown>,
  callIdOrCtx: string | SallyToolContext,
  partyPhoneArg?: string,
): Promise<Record<string, unknown>> {
  const ctx: SallyToolContext = typeof callIdOrCtx === 'string'
    ? { callId: callIdOrCtx, partyPhone: partyPhoneArg || '' }
    : callIdOrCtx;
  const callId = ctx.callId || '';
  const partyPhone = ctx.partyPhone || '';
  const sessionKey = ctx.sessionKey
    || resolveSallySessionKey({ callId, staffUserId: ctx.staffUserId });

  if (name === 'getOfferTerms') {
    const terms = getSallyOfferTerms();
    return {
      ok: true,
      ...terms,
      spokenHint: `Introductory Sync2Dine is ${terms.monthlyPriceGbp} pounds a month${terms.setupFeeGbp ? `, plus ${terms.setupFeeGbp} pounds setup` : ''}. ${terms.cancelPolicy}`,
    };
  }

  if (name === 'confirmSaleTerms') {
    if (args.confirmed !== true && args.confirmed !== 'true') {
      return {
        ok: false,
        error: 'confirmation_required',
        spokenHint: 'Ask them to confirm they understand the service, monthly price, billing, and cancel policy first.',
      };
    }
    const offer = getSallyOfferTerms();
    const monthly = Number(args.monthlyPriceGbp);
    const setup = Number(args.setupFeeGbp);
    const record: SallyTermsRecord = {
      confirmedAt: new Date().toISOString(),
      monthlyPriceGbp: Number.isFinite(monthly) && monthly > 0 ? monthly : offer.monthlyPriceGbp,
      setupFeeGbp: Number.isFinite(setup) && setup >= 0 ? setup : offer.setupFeeGbp,
      summary: String(args.notes || 'Customer confirmed service, price, billing, and cancel policy').trim(),
    };
    writeTermsConfirmed(sessionKey, record, callId || undefined);
    return {
      ok: true,
      ...record,
      spokenHint: `Noted — they confirmed terms at £${record.monthlyPriceGbp}/month. You can provision the account and send the payment link.`,
    };
  }

  if (name === 'sendSalesAssets') {
    const channel = String(args.channel || '').toLowerCase() as 'email' | 'whatsapp' | 'both';
    if (!['email', 'whatsapp', 'both'].includes(channel)) {
      return { ok: false, error: 'channel_required', spokenHint: 'Should I email, WhatsApp, or both for the demo materials?' };
    }
    const offer = getSallyOfferTerms();
    const parts: string[] = ['Here are your Sync2Dine details:'];
    if (args.includeVideo !== false && offer.demoVideoUrl) parts.push(`Demo video: ${offer.demoVideoUrl}`);
    if (args.includePdf !== false && offer.salesPdfUrl) parts.push(`Overview PDF: ${offer.salesPdfUrl}`);
    if (args.includeDemoPhone !== false && offer.demoPhone) parts.push(`Demo phone: ${offer.demoPhone}`);
    if (parts.length === 1) {
      return {
        ok: false,
        error: 'assets_not_configured',
        spokenHint: 'Demo assets are not configured yet — share the intro price verbally or escalate to set SALLY_DEMO_* env values.',
      };
    }
    const body = parts.join('\n');
    const toEmail = String(args.toEmail || '').trim();
    const toPhone = String(args.toPhone || partyPhone || '').trim();
    const delivered = await deliverSallyChannels({
      channel,
      toEmail,
      toPhone,
      emailSubject: 'Sync2Dine — demo materials',
      emailBody: body,
      whatsappBody: body,
    });
    if (!delivered.sentVia.length) {
      return {
        ok: false,
        error: delivered.errors.join(',') || 'send_failed',
        spokenHint: 'I could not send the materials on that channel — ask for another email or WhatsApp number, or escalate.',
        errors: delivered.errors,
      };
    }
    const customerId = String(args.customerId || '').trim();
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        callId: callId || undefined,
        summary: `Sales assets sent via ${delivered.sentVia.join(' + ')}`,
        detail: body,
        aim: 'demo_book',
        type: 'note',
        createdBy: 'sally',
      });
    }
    return {
      ok: true,
      sentVia: delivered.sentVia,
      errors: delivered.errors,
      spokenHint: `I've sent the Sync2Dine materials by ${delivered.sentVia.join(' and ')}.`,
    };
  }

  if (name === 'checkPaymentStatus') {
    let organizationId = String(args.organizationId || '').trim();
    const customerId = String(args.customerId || '').trim();
    if (!organizationId && customerId) {
      const store = getDataStore();
      const cust = (store.customers as Array<Record<string, unknown>>).find((c) => String(c.id) === customerId);
      organizationId = String(cust?.saasOrgId || cust?.organizationId || '').trim();
      if (!organizationId && callId) {
        const call = getCallById(callId);
        const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
        organizationId = String(meta.sallyProvisionedOrgId || '').trim();
      }
    }
    if (!organizationId && callId) {
      const call = getCallById(callId);
      const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
      organizationId = String(meta.sallyProvisionedOrgId || '').trim();
    }
    if (!organizationId) {
      return {
        ok: false,
        error: 'organizationId_required',
        spokenHint: 'Which organisation should I check payment for?',
      };
    }
    const { getOrgPaymentStatus } = await import('./stripe-service');
    const status = getOrgPaymentStatus(organizationId);
    if (!status) {
      return { ok: false, error: 'org_not_found', spokenHint: 'I could not find that organisation.' };
    }
    let crmPaid: string | null = null;
    if (customerId) {
      const store = getDataStore();
      const cust = (store.customers as Array<Record<string, unknown>>).find((c) => String(c.id) === customerId);
      crmPaid = cust ? String(cust.saasPaymentStatus || '') || null : null;
    }
    return {
      ok: true,
      ...status,
      crmPaymentStatus: crmPaid,
      spokenHint: status.paid
        ? 'Payment is confirmed — they are live on Sync2Dine.'
        : `Not paid yet — org status ${status.status}${status.subscriptionStatus ? `, subscription ${status.subscriptionStatus}` : ''}.`,
    };
  }

  if (name === 'researchRestaurantProfile') {
    const call = callId ? getCallById(callId) : undefined;
    const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
    const businessName = String(args.businessName || meta.company || call?.contactName || '').trim();
    const phone = String(args.phone || partyPhone || '').trim();
    const website = String(args.website || '').trim();
    const addressHint = String(args.addressHint || '').trim();

    const result = await researchRestaurantProfile({
      businessName,
      phone,
      website: website || undefined,
      addressHint: addressHint || undefined,
      orgId: getHomeOrgId(),
    });

    if (!result.ok) {
      return { ok: false, error: result.error, spokenHint: result.spokenHint };
    }

    const prev = readDraft(sessionKey, callId || undefined);
    const merged: RestaurantProfileDraft = {
      ...prev,
      ...result.draft,
      phone: result.draft.phone || phone || prev.phone,
      businessName: result.draft.businessName || businessName || prev.businessName,
      confirmedFields: prev.confirmedFields || [],
    };
    writeDraft(sessionKey, merged, callId || undefined, { sallyResearchAt: new Date().toISOString() });
    return {
      ok: true,
      draft: merged,
      spokenHint: result.spokenHint,
      nextField: merged.openingHours ? 'openingHours' : 'address',
    };
  }

  if (name === 'getRestaurantSetupDraft') {
    const draft = readDraft(sessionKey, callId || undefined);
    return {
      ok: true,
      draft,
      spokenHint: draft.businessName
        ? `Draft on file for ${draft.businessName}. Confirm remaining fields then provision.`
        : 'No draft yet — research the restaurant first.',
    };
  }

  if (name === 'confirmRestaurantField') {
    const field = String(args.field || '') as RestaurantProfileField;
    if (!field) {
      return { ok: false, error: 'field_required', spokenHint: 'Which field should I confirm?' };
    }
    const draft = { ...readDraft(sessionKey, callId || undefined) };
    const confirmed = args.confirmed !== false && args.confirmed !== 'false';
    if (args.value != null && String(args.value).trim()) {
      const raw = String(args.value).trim();
      if (field === 'deliveryAvailable' || field === 'collectionAvailable' || field === 'reservations') {
        (draft as Record<string, unknown>)[field] = parseBoolish(raw, draft[field] as boolean | null);
      } else {
        (draft as Record<string, unknown>)[field] = raw;
      }
    }
    const confirmedFields = new Set(draft.confirmedFields || []);
    if (confirmed) confirmedFields.add(field);
    else confirmedFields.delete(field);
    draft.confirmedFields = [...confirmedFields];
    writeDraft(sessionKey, draft, callId || undefined);
    const nextHints: RestaurantProfileField[] = [
      'openingHours', 'address', 'deliveryAvailable', 'collectionAvailable',
      'paymentMethods', 'website', 'contactEmail',
    ];
    const next = nextHints.find((f) => !confirmedFields.has(f) && f !== field);
    return {
      ok: true,
      field,
      confirmed: confirmedFields.has(field),
      draft,
      spokenHint: confirmed
        ? (next ? spokenConfirmForField(next, draft) : 'That looks solid. If they are ready, get their email and provision the restaurant account.')
        : spokenConfirmForField(field, draft),
      nextField: next || null,
    };
  }

  if (name === 'provisionRestaurantClient') {
    const termsGate = requireTermsConfirmed(sessionKey, callId || undefined, args);
    if (termsGate) return termsGate;
    if (args.confirmed !== true && args.confirmed !== 'true') {
      return {
        ok: false,
        error: 'confirmation_required',
        spokenHint: 'Ask them to confirm they want the Sync2Dine restaurant account created first.',
      };
    }
    const contactEmail = String(args.contactEmail || '').trim().toLowerCase();
    if (!contactEmail || !contactEmail.includes('@')) {
      return {
        ok: false,
        error: 'email_required',
        spokenHint: 'I need their email address to create the restaurant login.',
      };
    }

    const draft = readDraft(sessionKey, callId || undefined);
    const businessName = String(args.businessName || draft.businessName || 'New Restaurant').trim();
    const contactName = String(args.contactName || businessName).trim();
    const adminPassword = String(args.adminPassword || '').trim() || generateTempPassword();
    const plan = String(args.plan || 'starter').trim() || 'starter';
    const aboutNotes = draftToAboutUs({
      ...draft,
      businessName,
      phone: draft.phone || partyPhone,
      contactEmail,
    });

    try {
      const {
        canProvisionViaSupabase,
        provisionOrganizationInSupabase,
        mapSupabaseOrgToApi,
      } = await import('./provision-org');

      if (canProvisionViaSupabase()) {
        const provisioned = await provisionOrganizationInSupabase({
          name: businessName,
          contactName,
          contactEmail,
          contactPhone: draft.phone || partyPhone,
          address: draft.address,
          plan,
          adminPassword,
          notes: `Provisioned by Sally${callId ? ` on call ${callId}` : ''}.\n${aboutNotes}`,
        });
        const org = mapSupabaseOrgToApi(provisioned.organization);
        await seedTenantProfile(org.id, { ...draft, businessName, contactEmail, phone: draft.phone || partyPhone }, contactEmail);
        writeDraft(sessionKey, {
          ...draft,
          businessName,
          contactEmail,
          phone: draft.phone || partyPhone,
        }, callId || undefined, {
          sallyProvisionedOrgId: org.id,
          sallyProvisionedAt: new Date().toISOString(),
        });
        linkCrmToSallyOrg(org.id, contactEmail, draft.phone || partyPhone);
        return {
          ok: true,
          organizationId: org.id,
          organizationName: org.name,
          contactEmail,
          temporaryPassword: adminPassword,
          plan: org.plan,
          spokenHint: `All set — I've created ${org.name} on Sync2Dine. They can log in with ${contactEmail}. I've set a temporary password; tell them to change it after first login.`,
        };
      }

      const { createOrganization } = await import('./organizations');
      const local = createOrganization({
        name: businessName,
        contactName,
        contactEmail,
        contactPhone: String(draft.phone || partyPhone || ''),
        address: draft.address,
        plan: plan as 'starter' | 'pro' | 'enterprise',
        notes: `Provisioned by Sally${callId ? ` on call ${callId}` : ''}.\n${aboutNotes}`,
      });
      writeDraft(sessionKey, { ...draft, businessName, contactEmail }, callId || undefined, {
        sallyProvisionedOrgId: local.id,
        sallyProvisionedAt: new Date().toISOString(),
      });
      linkCrmToSallyOrg(local.id, contactEmail, draft.phone || partyPhone);
      return {
        ok: true,
        organizationId: local.id,
        organizationName: local.name,
        contactEmail,
        temporaryPassword: adminPassword,
        plan: local.plan,
        localOnly: true,
        spokenHint: `I've created ${local.name} on Sync2Dine (local record). Login email ${contactEmail}.`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'provision_failed',
        spokenHint: 'Sorry — creating the restaurant account failed. Offer a callback and we will finish setup from the office.',
      };
    }
  }

  if (name === 'bookDemo') {
    const scheduledAt = String(args.scheduledAt || '').trim();
    if (!scheduledAt) {
      return { ok: false, error: 'scheduledAt_required', spokenHint: 'When should we book the demo?' };
    }
    const customerId = String(args.customerId || '').trim();
    const phone = String(args.phone || partyPhone || '').trim();
    const contactName = String(args.contactName || '').trim();
    const notes = String(args.notes || '').trim();
    const detail = `Demo booked for ${scheduledAt}${notes ? ` — ${notes}` : ''}`;
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        callId: callId || undefined,
        summary: detail,
        detail,
        aim: 'demo_book',
        type: 'note',
        createdBy: 'sally',
      });
      const store = getDataStore();
      const cust = (store.customers as Array<Record<string, unknown>>).find((c) => String(c.id) === customerId);
      if (cust) {
        saveCustomerRecord({ ...cust, nextFollowUp: scheduledAt, status: cust.status || 'lead' });
        syncData({ customers: store.customers });
      }
    }
    if (args.alsoQueueCallback && phone) {
      enqueueOutboundCall({
        to: phone,
        template: 'lead_callback',
        status: 'queued',
        scheduledAt,
        context: {
          customerId: customerId || undefined,
          company: contactName,
          aim: 'demo_book',
          agentPersona: SALLY_PERSONA,
          brief: `Demo callback for ${contactName || 'prospect'} at ${scheduledAt}`,
          source: 'sally_book_demo',
        },
      });
    }
    return {
      ok: true,
      scheduledAt,
      customerId: customerId || null,
      spokenHint: `Demo booked for ${scheduledAt}. I've noted it on the CRM${args.alsoQueueCallback && phone ? ' and queued a reminder call' : ''}.`,
    };
  }

  if (name === 'leaveVoicemail') {
    const left = args.left === true || args.left === 'true';
    const customerId = String(args.customerId || '').trim();
    const summary = String(args.messageSummary || 'Voicemail follow-up').trim();
    const channel = String(args.scheduleFollowUpChannel || (left ? 'none' : 'whatsapp'));
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        callId: callId || undefined,
        summary: left ? `Voicemail left: ${summary}` : `Voicemail not available — follow up via ${channel}: ${summary}`,
        detail: summary,
        aim: 'sales_outreach',
        outcome: left ? 'voicemail' : 'callback_requested',
        disposition: left ? 'voicemail' : 'callback_requested',
        type: 'note',
        createdBy: 'sally',
        updateCallQueue: true,
      });
    }
    const phone = String(args.phone || partyPhone || '').trim();
    if (!left && channel === 'callback' && phone) {
      const retryMin = getAgentSettings().callQueueRetryMinutes ?? 60;
      enqueueOutboundCall({
        to: phone,
        template: 'lead_callback',
        status: 'queued',
        scheduledAt: new Date(Date.now() + retryMin * 60_000).toISOString(),
        context: {
          customerId: customerId || undefined,
          aim: 'sales_outreach',
          agentPersona: SALLY_PERSONA,
          brief: summary,
          source: 'sally_voicemail_followup',
        },
      });
    }
    return {
      ok: true,
      left,
      followUpChannel: channel,
      spokenHint: left
        ? 'Noted — voicemail left and CRM updated.'
        : `Live voicemail drop isn't available; I've logged it and scheduled a ${channel} follow-up.`,
    };
  }

  if (name === 'createSaasQuote') {
    const plan = String(args.plan || 'starter') as 'starter' | 'pro' | 'enterprise';
    const offer = getSallyOfferTerms();
    const monthlyArg = Number(args.monthlyPriceGbp);
    const monthly = Number.isFinite(monthlyArg) && monthlyArg > 0 ? monthlyArg : offer.monthlyPriceGbp;
    const customerId = String(args.customerId || '').trim();
    const businessName = String(args.businessName || '').trim() || 'Restaurant';
    const quoteId = `saas-${Date.now().toString(36)}`;
    const { saveQuoteRecord } = await import('./data-store');
    const quote = {
      id: quoteId,
      customerId: customerId || null,
      customerName: businessName,
      tradeId: 'sync2dine_saas',
      tradeName: 'Sync2Dine SaaS',
      status: 'draft',
      total: monthly,
      currency: 'GBP',
      billing: 'monthly',
      plan,
      notes: String(args.notes || `Sync2Dine ${plan} — £${monthly}/mo (intro offer)`),
      createdAt: new Date().toISOString(),
      source: 'sally',
    };
    saveQuoteRecord(quote);
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        summary: `SaaS quote ${quoteId}: ${plan} £${monthly}/mo`,
        detail: quote.notes as string,
        aim: 'quote_requested',
        type: 'note',
        createdBy: 'sally',
      });
    }
    return {
      ok: true,
      quoteId,
      plan,
      monthlyPriceGbp: monthly,
      spokenHint: `I've drafted a Sync2Dine ${plan} quote at ${monthly} pounds a month (${quoteId}).`,
    };
  }

  if (name === 'sendStripeCheckoutLink') {
    const termsGate = requireTermsConfirmed(sessionKey, callId || undefined, args);
    if (termsGate) return termsGate;
    const organizationId = String(args.organizationId || '').trim();
    if (!organizationId) {
      return { ok: false, error: 'organizationId_required', spokenHint: 'Which organisation should get the Stripe checkout link?' };
    }
    const channel = String(args.channel || args.sendVia || '').toLowerCase() as 'email' | 'whatsapp' | 'both';
    if (!['email', 'whatsapp', 'both'].includes(channel)) {
      return {
        ok: false,
        error: 'channel_required',
        spokenHint: 'Should I email, WhatsApp, or both for the payment link?',
      };
    }
    try {
      const { createCheckoutSessionForOrg } = await import('./stripe-service');
      const { getOrganizationById } = await import('./organizations');
      const org = getOrganizationById(organizationId);
      const toEmail = String(args.toEmail || org?.contactEmail || '').trim();
      const toPhone = String(args.toPhone || partyPhone || org?.contactPhone || '').trim();
      const url = await createCheckoutSessionForOrg(organizationId, {
        metadata: {
          sallySession: sessionKey,
          customerEmail: toEmail || org?.contactEmail || '',
        },
      });
      const msg = [
        'Your Sync2Dine payment link is ready.',
        `Pay securely here: ${url}`,
        'Once paid, your restaurant account stays live on the plan we discussed.',
      ].join('\n');
      const delivered = await deliverSallyChannels({
        channel,
        toEmail,
        toPhone,
        emailSubject: 'Sync2Dine — complete your subscription',
        emailBody: msg,
        whatsappBody: msg,
      });
      if (!delivered.sentVia.length) {
        return {
          ok: false,
          error: delivered.errors.join(',') || 'delivery_failed',
          checkoutUrl: url,
          organizationId,
          spokenHint:
            'I created the payment link but could not send it — ask for another email or WhatsApp number, or escalate.',
          errors: delivered.errors,
        };
      }
      const customerId = String(args.customerId || '').trim();
      if (customerId) {
        appendCustomerCallActivity({
          customerId,
          summary: `Stripe checkout sent via ${delivered.sentVia.join(' + ')}`,
          detail: url,
          aim: 'quote_requested',
          type: 'note',
          createdBy: 'sally',
        });
      }
      if (callId) {
        const call = getCallById(callId);
        const meta = (call?.metadata as Record<string, unknown> | undefined) || {};
        saveCall({
          id: callId,
          metadata: {
            ...meta,
            sallyCheckoutUrl: url,
            sallyCheckoutSentVia: delivered.sentVia,
            sallyCheckoutAt: new Date().toISOString(),
          },
        });
      }
      return {
        ok: true,
        checkoutUrl: url,
        organizationId,
        sentVia: delivered.sentVia,
        errors: delivered.errors,
        spokenHint: `I've ${delivered.sentVia.includes('email') && delivered.sentVia.includes('whatsapp') ? 'emailed and WhatsApp’d' : delivered.sentVia.includes('email') ? 'emailed' : 'WhatsApp’d'} the payment link. They can open it now while we stay on the line.`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'stripe_failed',
        spokenHint: 'Could not create a Stripe checkout link — check Stripe is configured for that organisation.',
      };
    }
  }

  if (name === 'bookOnboarding') {
    const scheduledAt = String(args.scheduledAt || '').trim();
    if (!scheduledAt) {
      return { ok: false, error: 'scheduledAt_required', spokenHint: 'When should onboarding happen?' };
    }
    const customerId = String(args.customerId || '').trim();
    const organizationId = String(args.organizationId || '').trim();
    const phone = String(args.phone || partyPhone || '').trim();
    const detail = `Onboarding booked ${scheduledAt}${organizationId ? ` for org ${organizationId}` : ''}${args.notes ? ` — ${args.notes}` : ''}`;
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        summary: detail,
        detail,
        aim: 'appointment_booked',
        type: 'note',
        createdBy: 'sally',
      });
    }
    if (phone) {
      enqueueOutboundCall({
        to: phone,
        template: 'lead_callback',
        status: 'queued',
        scheduledAt,
        context: {
          customerId: customerId || undefined,
          aim: 'onboarding',
          agentPersona: SALLY_PERSONA,
          brief: detail,
          source: 'sally_book_onboarding',
          organizationId: organizationId || undefined,
        },
      });
    }
    return {
      ok: true,
      scheduledAt,
      organizationId: organizationId || null,
      spokenHint: `Onboarding booked for ${scheduledAt}.`,
    };
  }

  if (name === 'requestGoogleReview') {
    const customerId = String(args.customerId || '').trim();
    const channel = String(args.channel || 'note_only');
    const url = String(args.googleReviewUrl || process.env.GOOGLE_REVIEW_URL || '').trim()
      || 'https://g.page/r/ — ask staff for the Google review link';
    const message = `We'd love a Google review if you're happy with Sync2Dine: ${url}`;
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        summary: 'Google review requested',
        detail: message,
        aim: 'satisfaction',
        type: 'note',
        createdBy: 'sally',
      });
    }
    return {
      ok: true,
      googleReviewUrl: url,
      channel,
      message,
      spokenHint: channel === 'note_only'
        ? `Review ask ready: ${url}`
        : `Ask them for a Google review via ${channel}: ${url}`,
    };
  }

  if (name === 'proposePlanUpsell') {
    const organizationId = String(args.organizationId || '').trim();
    const targetPlan = String(args.targetPlan || 'pro') as 'pro' | 'enterprise';
    if (!organizationId) {
      return { ok: false, error: 'organizationId_required', spokenHint: 'Which organisation are we upselling?' };
    }
    const { getOrganizationById, updateOrganization } = await import('./organizations');
    const org = getOrganizationById(organizationId);
    if (!org) {
      return { ok: false, error: 'org_not_found', spokenHint: 'I could not find that organisation.' };
    }
    updateOrganization(organizationId, { plan: targetPlan, notes: `${org.notes || ''}\nSally proposed upsell to ${targetPlan}`.trim() });
    let checkoutUrl: string | undefined;
    if (args.createCheckout === true || args.createCheckout === 'true') {
      try {
        const { createCheckoutSessionForOrg } = await import('./stripe-service');
        checkoutUrl = await createCheckoutSessionForOrg(organizationId);
      } catch {
        /* optional */
      }
    }
    return {
      ok: true,
      organizationId,
      fromPlan: org.plan,
      targetPlan,
      checkoutUrl: checkoutUrl || null,
      spokenHint: checkoutUrl
        ? `Proposed upgrade to ${targetPlan}. Checkout: ${checkoutUrl}`
        : `Proposed upgrade from ${org.plan} to ${targetPlan}.`,
    };
  }

  if (name === 'chaseUnpaidInvoice') {
    const customerId = String(args.customerId || '').trim();
    const organizationId = String(args.organizationId || '').trim();
    const phone = String(args.phone || partyPhone || '').trim();
    const channel = String(args.channel || 'callback');
    const notes = String(args.notes || 'Past-due Sync2Dine invoice chase').trim();
    if (customerId) {
      appendCustomerCallActivity({
        customerId,
        summary: `Invoice chase (${channel})`,
        detail: notes,
        aim: 'past_due',
        type: 'note',
        createdBy: 'sally',
      });
    }
    if (channel === 'callback' && phone) {
      enqueueOutboundCall({
        to: phone,
        template: 'payment_reminder',
        status: 'queued',
        context: {
          customerId: customerId || undefined,
          organizationId: organizationId || undefined,
          aim: 'past_due',
          agentPersona: SALLY_PERSONA,
          brief: notes,
          source: 'sally_chase_unpaid',
        },
      });
    }
    return {
      ok: true,
      channel,
      organizationId: organizationId || null,
      spokenHint: `I've logged the unpaid chase${channel === 'callback' && phone ? ' and queued a payment reminder call' : ''}.`,
    };
  }

  return { ok: false, error: `unknown_sally_tool:${name}` };
}

/** Re-queue CRM leads marked needs_retry whose nextFollowUp/retry window has elapsed. */
export function enqueueSallyRetryLeads(): number {
  const settings = getAgentSettings();
  const maxAttempts = settings.callQueueMaxAttempts ?? 3;
  const retryMin = settings.callQueueRetryMinutes ?? 60;
  const store = getDataStore();
  const customers = (store.customers as Array<Record<string, unknown>>) || [];
  let queued = 0;
  const now = Date.now();
  for (const c of customers) {
    if (String(c.callQueueStatus || '') !== 'needs_retry') continue;
    const attempts = Number(c.callAttemptCount ?? 0);
    if (attempts >= maxAttempts) continue;
    const phone = String(c.phone || '').trim();
    if (!phone) continue;
    const lastAt = c.lastCallAt ? Date.parse(String(c.lastCallAt)) : NaN;
    const nextAt = c.nextFollowUp ? Date.parse(String(c.nextFollowUp)) : NaN;
    const readyAt = Number.isFinite(nextAt)
      ? nextAt
      : (Number.isFinite(lastAt) ? lastAt + retryMin * 60_000 : now);
    if (readyAt > now) continue;
    const already = (store.outboundQueue || []).some((j) =>
      String(j.status) === 'queued'
      && String((j.context as Record<string, unknown> | undefined)?.customerId || '') === String(c.id)
    );
    if (already) continue;
    enqueueOutboundCall({
      to: phone,
      template: 'lead_callback',
      status: 'queued',
      context: {
        customerId: String(c.id),
        company: String(c.name || ''),
        aim: 'sales_outreach',
        agentPersona: SALLY_PERSONA,
        brief: `Auto-retry (${attempts + 1}/${maxAttempts}) for ${c.name || phone}`,
        source: 'sally_needs_retry',
      },
    });
    saveCustomerRecord({ ...c, callQueueStatus: 'queued' });
    queued += 1;
  }
  if (queued) syncData({ customers: store.customers });
  return queued;
}
