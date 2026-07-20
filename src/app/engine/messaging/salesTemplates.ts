/** Sync2Dine platform sales templates (Sally / company). */

export type SalesTemplateId =
  | 'intro'
  | 'demo_invite'
  | 'demo_assets'
  | 'quote'
  | 'quote_chase'
  | 'contract_offer'
  | 'checkout'
  | 'onboarding'
  | 'followup';

export type SalesTemplate = {
  id: SalesTemplateId;
  name: string;
  description: string;
  subject: string;
  body: string;
  type: 'quote_sent' | 'followup' | 'invoice' | 'custom';
};

export const SALES_TEMPLATES: SalesTemplate[] = [
  {
    id: 'intro',
    name: 'Intro to Sync2Dine',
    description: 'First outreach to a restaurant owner',
    subject: 'Sync2Dine — Judie + Atmosphere for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

I'm Sally from Sync2Dine (the restaurant side of Sync2Gear). We help venues with Judie — your AI phone receptionist for orders and bookings — and Atmosphere — exclusive sustainable audio management, messaging, and staff training.

Launch offer from £{WEEKLY_PRICE}/week (40% off) or £{ANNUAL_PRICE} annual prepay (50% off). Monthly equivalent ~£{MONTHLY_PRICE} for comparison only.

Happy to send a short video or arrange a call — what works best?

Best regards,
{USER_NAME}
Sync2Dine
{COMPANY_PHONE}`,
    type: 'followup',
  },
  {
    id: 'demo_invite',
    name: 'Book a demo',
    description: 'Invite them to try the demo line',
    subject: 'Try Sync2Dine — Judie demo for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

When you have a moment, you can try our Judie demo line: {DEMO_PHONE}

Or reply with a couple of times that suit you and I'll arrange a short walkthrough for {RESTAURANT_NAME}.

Best regards,
{USER_NAME}
Sync2Dine`,
    type: 'followup',
  },
  {
    id: 'demo_assets',
    name: 'Demo materials',
    description: 'Video, PDF, and demo phone',
    subject: 'Sync2Dine materials for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

As promised, here are your Sync2Dine details:

{ASSETS_BLOCK}

Any questions — just reply or call {COMPANY_PHONE}.

Best regards,
{USER_NAME}
Sync2Dine`,
    type: 'followup',
  },
  {
    id: 'quote',
    name: 'SaaS quote / pricing',
    description: 'Clear weekly pricing + fare summary',
    subject: 'Your Sync2Dine pricing — {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

Here's the Sync2Dine offer for {RESTAURANT_NAME}:

• Package: {PACKAGE_NAME}
• Normally: £{STANDARD_WEEKLY}/week
• Launch offer: £{WEEKLY_PRICE}/week (40% off)
• Annual prepay: £{ANNUAL_PRICE} (50% off annualized launch)
• Comparison monthly: ~£{MONTHLY_PRICE}

Usage & fares:
{FARE_SUMMARY}

Full policy: {APP_BASE}/legal/fair-use-and-fares

Happy to walk through anything on a quick call.

Best regards,
{USER_NAME}
Sync2Dine
{COMPANY_PHONE}`,
    type: 'quote_sent',
  },
  {
    id: 'quote_chase',
    name: 'Quote follow-up',
    description: 'Soft chase after pricing',
    subject: 'Just checking in — Sync2Dine for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

I wanted to follow up on the Sync2Dine pricing we shared (£{WEEKLY_PRICE}/week launch for {PACKAGE_NAME}). Happy to answer any questions on Judie minutes, Atmosphere, or annual prepay.

Would a quick call this week work?

Best regards,
{USER_NAME}
Sync2Dine`,
    type: 'followup',
  },
  {
    id: 'contract_offer',
    name: 'Contract signing',
    description: 'Send SaaS subscription contract link',
    subject: 'Please sign your Sync2Dine contract — {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

Please review and sign your Sync2Dine subscription for {RESTAURANT_NAME}:

• Package: {PACKAGE_NAME}
• Billing: {BILLING_INTERVAL} — £{AMOUNT}
• Overage action: {OVERAGE_ACTION}

{FARE_SUMMARY}

Sign here: {CONTRACT_LINK}

Policies: Terms, Fair Use & Fares, Privacy, Acceptable Use, Cancellation — linked from the signing page.

Best regards,
{USER_NAME}
Sync2Dine / Sally`,
    type: 'custom',
  },
  {
    id: 'checkout',
    name: 'Payment link',
    description: 'After contract signed',
    subject: 'Complete your Sync2Dine setup — payment link',
    body: `Hi {CUSTOMER_NAME},

Thanks for signing. Here's your secure payment link for {RESTAURANT_NAME}:

{CHECKOUT_LINK}

Package {PACKAGE_NAME} — £{AMOUNT} ({BILLING_INTERVAL}).

Once paid, we'll provision Judie/Atmosphere and book onboarding.

Best regards,
{USER_NAME}
Sync2Dine`,
    type: 'invoice',
  },
  {
    id: 'onboarding',
    name: 'Welcome / next steps',
    description: 'Post-payment welcome',
    subject: 'Welcome to Sync2Dine — next steps for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

Welcome aboard. Next we'll finish provisioning, book a short onboarding call, and get Judie ready for orders and bookings (and Atmosphere if included).

Reply anytime — {COMPANY_PHONE} / {COMPANY_EMAIL}.

Best regards,
{USER_NAME}
Sync2Dine`,
    type: 'followup',
  },
  {
    id: 'followup',
    name: 'General follow-up',
    description: 'After a call or missed connection',
    subject: 'Following up — Sync2Dine',
    body: `Hi {CUSTOMER_NAME},

Just following up from our recent conversation about Sync2Dine for {RESTAURANT_NAME}.

Happy to pick up wherever we left off — Judie demo, Atmosphere, pricing, or next steps.

Best regards,
{USER_NAME}
Sync2Dine
{COMPANY_PHONE}`,
    type: 'followup',
  },
];

export function getSalesTemplate(id: string): SalesTemplate | undefined {
  return SALES_TEMPLATES.find((t) => t.id === id);
}
