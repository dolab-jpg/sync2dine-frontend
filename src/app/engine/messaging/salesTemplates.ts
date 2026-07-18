/** Sync2Dine platform sales templates (Sally / company). */

export type SalesTemplateId =
  | 'intro'
  | 'demo_invite'
  | 'demo_assets'
  | 'quote'
  | 'quote_chase'
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
    subject: 'Sync2Dine — voice ordering & bookings for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

I'm Sally from Sync2Dine. We help restaurants take takeaway orders and table bookings by phone with an AI host — so your team isn't stuck on the line during rush.

I'd love to show you a quick demo of how it works for a place like yours.

Introductory pricing is £{MONTHLY_PRICE}/month. Happy to send a short video or arrange a call — what works best?

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
    subject: 'Try Sync2Dine — demo for {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

When you have a moment, you can try our demo line: {DEMO_PHONE}

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
    description: 'Clear pricing summary',
    subject: 'Your Sync2Dine pricing — {RESTAURANT_NAME}',
    body: `Hi {CUSTOMER_NAME},

Here's the Sync2Dine intro offer for {RESTAURANT_NAME}:

• Monthly: £{MONTHLY_PRICE}
• Setup: £{SETUP_FEE}

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

I wanted to follow up on the Sync2Dine pricing we shared (£{MONTHLY_PRICE}/month). Happy to answer any questions.

Would a quick call this week work?

Best regards,
{USER_NAME}
Sync2Dine`,
    type: 'followup',
  },
  {
    id: 'checkout',
    name: 'Payment link',
    description: 'After terms confirmed',
    subject: 'Complete your Sync2Dine setup — payment link',
    body: `Hi {CUSTOMER_NAME},

Thanks for confirming. Here's your secure payment link to get {RESTAURANT_NAME} set up:

{CHECKOUT_LINK}

Once paid, we'll provision your workspace and book onboarding.

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

Welcome aboard. Next we'll finish provisioning, book a short onboarding call, and get your AI phone host ready for orders and bookings.

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

Happy to pick up wherever we left off — demo, pricing, or next steps.

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
