import type { IntegrationDefinition, IntegrationId } from './types';

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'TradePro AI, Cyrus bot, CRM chat summaries, photo estimation, and TTS',
    category: 'ai',
    docsUrl: 'https://platform.openai.com/docs',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'staffModel', label: 'Staff AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'gpt-4o' },
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      ]},
      { key: 'cyrusModel', label: 'Cyrus Model', type: 'select', options: [
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
        { value: 'gpt-4o', label: 'gpt-4o' },
      ]},
      { key: 'summaryModel', label: 'Chat Summary Model', type: 'select', options: [
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
        { value: 'gpt-4o', label: 'gpt-4o' },
      ]},
      { key: 'ttsVoice', label: 'TTS Voice', type: 'select', options: [
        { value: 'fable', label: 'fable' },
        { value: 'alloy', label: 'alloy' },
        { value: 'nova', label: 'nova' },
        { value: 'shimmer', label: 'shimmer' },
      ]},
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business (Meta)',
    description: 'Cyrus client messaging, notifications, and document delivery',
    category: 'messaging',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', required: true },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text' },
      { key: 'appId', label: 'App ID', type: 'text' },
      { key: 'appSecret', label: 'App Secret', type: 'password' },
      { key: 'webhookVerifyToken', label: 'Webhook Verify Token', type: 'password' },
      { key: 'webhookUrl', label: 'Webhook URL', type: 'readonly', placeholder: 'Set after deploying server' },
      { key: 'cyrusDisplayName', label: 'Cyrus Display Name', type: 'text', placeholder: 'Cyrus' },
    ],
  },
  {
    id: 'email_smtp',
    name: 'Email (SMTP)',
    description: 'Send quotes, bookings, and invoices via SMTP',
    category: 'messaging',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
      { key: 'username', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'fromEmail', label: 'From Email', type: 'text' },
      { key: 'fromName', label: 'From Name', type: 'text' },
      { key: 'secure', label: 'Use TLS', type: 'select', options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ]},
    ],
  },
  {
    id: 'email_oauth',
    name: 'Mailbox OAuth (Gmail / Outlook / Yahoo)',
    description: 'XOAUTH2 inbox connect — read and send from user mailboxes via IMAP',
    category: 'messaging',
    docsUrl: 'https://developers.google.com/gmail/imap/xoauth2-protocol',
    npmPackage: 'google-auth-library',
    githubRepo: 'googleapis/google-auth-library-nodejs',
    fields: [
      { key: 'googleClientId', label: 'Google Client ID', type: 'text' },
      { key: 'googleClientSecret', label: 'Google Client Secret', type: 'password' },
      { key: 'microsoftClientId', label: 'Microsoft Client ID', type: 'text' },
      { key: 'microsoftClientSecret', label: 'Microsoft Client Secret', type: 'password' },
      { key: 'microsoftTenantId', label: 'Microsoft Tenant ID', type: 'text', placeholder: 'common' },
      { key: 'yahooClientId', label: 'Yahoo Client ID', type: 'text' },
      { key: 'yahooClientSecret', label: 'Yahoo Client Secret', type: 'password' },
      { key: 'redirectUri', label: 'OAuth Redirect URI', type: 'readonly', placeholder: 'Set on API server /api/mailbox/callback' },
    ],
  },
  {
    id: 'email_resend',
    name: 'Email (Resend)',
    description: 'Alternative email provider via Resend API',
    category: 'messaging',
    docsUrl: 'https://resend.com/docs',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'fromEmail', label: 'From Email', type: 'text' },
      { key: 'fromName', label: 'From Name', type: 'text' },
    ],
  },
  {
    id: 'sendgrid',
    name: 'Email (SendGrid)',
    description: 'Alternative email provider via SendGrid',
    category: 'messaging',
    docsUrl: 'https://docs.sendgrid.com',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'fromEmail', label: 'From Email', type: 'text' },
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Database and auth when going live',
    category: 'database',
    docsUrl: 'https://supabase.com/docs',
    fields: [
      { key: 'projectUrl', label: 'Project URL', type: 'url', placeholder: 'https://xxx.supabase.co' },
      { key: 'anonKey', label: 'Anon Key', type: 'password' },
      { key: 'serviceRoleKey', label: 'Service Role Key', type: 'password' },
    ],
  },
  {
    id: 'mongodb',
    name: 'MongoDB Atlas',
    description: 'Cloud database for projects, CRM data, and AI context',
    category: 'database',
    docsUrl: 'https://www.mongodb.com/docs/atlas/connect-to-cluster/',
    fields: [
      {
        key: 'connectionString',
        label: 'Connection String',
        type: 'password',
        placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/tradepro',
        required: true,
      },
      {
        key: 'databaseName',
        label: 'Database Name',
        type: 'text',
        placeholder: 'tradepro',
      },
    ],
  },
  {
    id: 'webhook_server',
    name: 'Webhook Server',
    description: 'Deployed API for WhatsApp webhooks and messaging',
    category: 'infrastructure',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://your-api.railway.app' },
      { key: 'healthEndpoint', label: 'Health Endpoint', type: 'text', placeholder: '/health' },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payments and finance deposits',
    category: 'payments',
    docsUrl: 'https://stripe.com/docs',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
    ],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync booking confirmations to calendar',
    category: 'scheduling',
    docsUrl: 'https://developers.google.com/calendar',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'calendarId', label: 'Calendar ID', type: 'text', placeholder: 'primary' },
    ],
  },
  {
    id: 'twilio_sms',
    name: 'Twilio SMS',
    description: 'SMS fallback for booking reminders',
    category: 'messaging',
    docsUrl: 'https://www.twilio.com/docs',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text' },
      { key: 'authToken', label: 'Auth Token', type: 'password' },
      { key: 'fromNumber', label: 'From Number', type: 'text', placeholder: '+44...' },
    ],
  },
  {
    id: 'voice_telephony',
    name: 'Voice Telephony (Aria)',
    description: 'Soho66 SIP bridge for Aria — configure lines in Call Centre → Phone Lines',
    category: 'messaging',
    docsUrl: 'https://docs.jambonz.org/',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [
        { value: 'mock', label: 'Mock (dev/test)' },
        { value: 'soho66', label: 'Soho66 (SIP)' },
      ]},
      { key: 'sipBridgeUrl', label: 'SIP Bridge URL (Jambonz)', type: 'url', placeholder: 'http://your-vps:3000' },
      { key: 'transferNumber', label: 'Transfer Number', type: 'text', placeholder: '+4420... (human handoff)' },
      { key: 'webhookUrl', label: 'Voice Webhook URL', type: 'readonly', placeholder: 'Set after deploying server' },
      { key: 'businessHoursStart', label: 'Business Hours Start', type: 'text', placeholder: '09:00' },
      { key: 'businessHoursEnd', label: 'Business Hours End', type: 'text', placeholder: '17:30' },
    ],
  },
  {
    id: 'chatterbox_tts',
    name: 'Chatterbox TTS',
    description: 'Cloned voice TTS for Aria — upload a Cockney/Del Boy reference WAV on the Call Centre page',
    category: 'ai',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'http://VPS_IP:8004', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    id: 'storage',
    name: 'File Storage',
    description: 'Quote PDFs and site photos',
    category: 'files',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [
        { value: 'local', label: 'Local (mock)' },
        { value: 'supabase', label: 'Supabase Storage' },
        { value: 's3', label: 'Amazon S3' },
      ]},
      { key: 'bucket', label: 'Bucket', type: 'text' },
      { key: 'accessKey', label: 'Access Key', type: 'password' },
      { key: 'secretKey', label: 'Secret Key', type: 'password' },
    ],
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Accounting and invoicing sync (future)',
    category: 'accounting',
    docsUrl: 'https://developer.xero.com',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'tenantId', label: 'Tenant ID', type: 'text' },
    ],
  },
  {
    id: 'open_banking',
    name: 'Open Banking',
    description: 'Connect bank accounts for live transaction feed, reconciliation, and P&L',
    category: 'banking',
    docsUrl: 'https://developer.truelayer.com',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [
        { value: 'mock', label: 'Mock (demo feed)' },
        { value: 'truelayer', label: 'TrueLayer' },
        { value: 'gocardless', label: 'GoCardless Bank Account Data' },
        { value: 'plaid', label: 'Plaid' },
      ]},
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'redirectUri', label: 'Redirect URI', type: 'url', placeholder: 'http://localhost:5173/integrations' },
      { key: 'institutionId', label: 'Institution ID', type: 'text', placeholder: 'Optional — pre-select bank' },
    ],
  },
  {
    id: 'price_research',
    name: 'Price Research (Web)',
    description: 'Live local price lookup for AI job pricing — checks current market/online rates',
    category: 'ai',
    docsUrl: 'https://tavily.com/',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [
        { value: 'openai_web', label: 'OpenAI Web Search' },
        { value: 'tavily', label: 'Tavily' },
        { value: 'serper', label: 'Serper (Google)' },
      ]},
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Search provider key (not needed for OpenAI Web)' },
      { key: 'region', label: 'Region', type: 'text', placeholder: 'UK' },
    ],
  },
  {
    id: 'company',
    name: 'Company Profile',
    description: 'Used by Cyrus, templates, and invoice/quote/receipt PDFs',
    category: 'general',
    fields: [
      { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'TradePro Ltd' },
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://www.example.com' },
      { key: 'companyRegistrationNumber', label: 'Company registration number', type: 'text', placeholder: '12345678' },
      { key: 'vatNumber', label: 'VAT number', type: 'text', placeholder: 'GB123456789' },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '020 1234 5678' },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'info@tradepro.com' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'logoUrl', label: 'Logo URL', type: 'url', placeholder: 'Upload below or paste image URL' },
      { key: 'accountName', label: 'Bank account name', type: 'text', placeholder: 'TradePro Ltd' },
      { key: 'sortCode', label: 'Sort code', type: 'text', placeholder: '20-00-00' },
      { key: 'accountNumber', label: 'Account number', type: 'text', placeholder: '12345678' },
      {
        key: 'autoSendReceiptOnPaid',
        label: 'Auto-send receipt when payment marked paid',
        type: 'select',
        options: [
          { value: 'true', label: 'Yes — email receipt automatically' },
          { value: 'false', label: 'No — manual send only' },
        ],
      },
    ],
  },
];

export function getIntegrationDefinition(id: IntegrationId): IntegrationDefinition | undefined {
  return INTEGRATION_REGISTRY.find(i => i.id === id);
}

export function getDefaultFieldValues(def: IntegrationDefinition): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of def.fields) {
    if (field.type === 'select' && field.options?.[0]) {
      values[field.key] = field.options[0].value;
    } else {
      values[field.key] = '';
    }
  }
  if (def.id === 'openai') {
    values.staffModel = 'gpt-4o-mini';
    values.cyrusModel = 'gpt-4o-mini';
    values.summaryModel = 'gpt-4o-mini';
    values.ttsVoice = 'fable';
  }
  if (def.id === 'whatsapp') {
    values.cyrusDisplayName = 'Cyrus';
  }
  if (def.id === 'company') {
    values.companyName = 'TradePro Ltd';
    values.phone = '020 1234 5678';
    values.email = 'info@tradepro.com';
    values.address = '123 High Street, London, SW1A 1AA';
    values.autoSendReceiptOnPaid = 'true';
  }
  if (def.id === 'email_oauth') {
    values.microsoftTenantId = 'common';
    values.redirectUri = 'http://localhost:3001/api/mailbox/callback';
  }
  if (def.id === 'email_smtp') {
    values.host = 'smtp.gmail.com';
    values.port = '587';
    values.secure = 'true';
    values.fromName = 'TradePro';
  }
  if (def.id === 'storage') {
    values.provider = 'local';
  }
  if (def.id === 'mongodb') {
    values.databaseName = 'tradepro';
  }
  if (def.id === 'voice_telephony') {
    values.provider = 'soho66';
    values.businessHoursStart = '09:00';
    values.businessHoursEnd = '17:30';
  }
  if (def.id === 'chatterbox_tts') {
    values.baseUrl = '';
  }
  if (def.id === 'open_banking') {
    values.provider = 'mock';
    values.redirectUri = 'http://localhost:5173/integrations';
  }
  if (def.id === 'price_research') {
    values.provider = 'openai_web';
    values.region = 'UK';
  }
  return values;
}
