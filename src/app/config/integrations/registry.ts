import type { IntegrationDefinition, IntegrationId } from './types';

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    id: 'openai',
    name: 'Company AI Brain',
    description: 'Primary brain powers chat, Cynthia, Sally, and photo pricing (vision). Choose DeepSeek or OpenAI. OpenAI specialist key is optional — only needed for TTS, Whisper STT, Realtime phone, photoreal image edit, and Sally web search.',
    category: 'ai',
    docsUrl: 'https://api-docs.deepseek.com/',
    fields: [
      { key: 'provider', label: 'Primary brain provider', type: 'select', options: [
        { value: 'deepseek', label: 'DeepSeek (primary)' },
        { value: 'openai', label: 'OpenAI' },
      ]},
      { key: 'deepseekApiKey', label: 'DeepSeek API Key', type: 'password', placeholder: 'sk-...' },
      { key: 'apiKey', label: 'OpenAI specialist key (optional — voice / image gen / web search)', type: 'password', placeholder: 'sk-...' },
      { key: 'staffModel', label: 'Staff AI Model', type: 'select', options: [
        { value: 'deepseek-v4-flash', label: 'deepseek-v4-flash' },
        { value: 'deepseek-v4-pro', label: 'deepseek-v4-pro' },
        { value: 'deepseek-chat', label: 'deepseek-chat (legacy)' },
        { value: 'deepseek-reasoner', label: 'deepseek-reasoner (legacy)' },
        { value: 'gpt-4o', label: 'gpt-4o' },
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      ]},
      { key: 'cyrusModel', label: 'Cynthia Model', type: 'select', options: [
        { value: 'deepseek-v4-flash', label: 'deepseek-v4-flash' },
        { value: 'deepseek-v4-pro', label: 'deepseek-v4-pro' },
        { value: 'deepseek-chat', label: 'deepseek-chat (legacy)' },
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
        { value: 'gpt-4o', label: 'gpt-4o' },
      ]},
      { key: 'summaryModel', label: 'Chat Summary Model', type: 'select', options: [
        { value: 'deepseek-v4-flash', label: 'deepseek-v4-flash' },
        { value: 'deepseek-chat', label: 'deepseek-chat (legacy)' },
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
        { value: 'gpt-4o', label: 'gpt-4o' },
      ]},
      { key: 'ttsVoice', label: 'TTS Voice (OpenAI specialist)', type: 'select', options: [
        { value: 'fable', label: 'fable' },
        { value: 'alloy', label: 'alloy' },
        { value: 'nova', label: 'nova' },
        { value: 'shimmer', label: 'shimmer' },
      ]},
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Web (QR Code)',
    description: 'Connect your personal WhatsApp via QR code. Same AI brain, tools, and multi-language support — no Business API needed.',
    category: 'messaging',
    docsUrl: 'https://github.com/pedroslopez/whatsapp-web.js',
    fields: [
      { key: 'cyrusDisplayName', label: 'Cynthia Display Name', type: 'text', placeholder: 'Cynthia' },
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
    description: 'XOAUTH2 inbox connect — read and send from user mailboxes via IMAP. Create a Google Cloud Web client first (see setup guide below).',
    category: 'messaging',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    npmPackage: 'google-auth-library',
    githubRepo: 'googleapis/google-auth-library-nodejs',
    setupGuide: {
      title: 'Google Cloud OAuth — create a Web client',
      intro:
        'A Client ID identifies this app to Google’s OAuth servers. Use Application type “Web application”. Paste the Client ID and Client Secret into the fields below, then staff connect Gmail from Communications → Mailbox.',
      steps: [
        {
          label: 'Application type',
          value: 'Web application',
          note: 'Not Desktop or iOS — mailbox connect uses a browser redirect.',
        },
        {
          label: 'Name (console only)',
          value: 'Sync2Dine Mailbox',
          note: 'Only shown in Google Cloud Console — not shown to end users.',
        },
        {
          label: 'Authorized JavaScript origins',
          value: 'https://app.sync2dine.io',
          note: 'For browser requests from the live app. Domains are also added to the OAuth consent screen.',
        },
        {
          label: 'Authorized redirect URIs',
          value: 'https://app.sync2dine.io/api/mailbox/callback',
          note: 'Must match exactly. Google may take 5 minutes to a few hours to apply changes.',
        },
        {
          label: 'Optional local origin (dev only)',
          value: 'http://localhost:5174',
          note: 'Only if testing against a local SPA. Production connect uses app.sync2dine.io.',
        },
        {
          label: 'Optional local redirect (dev only)',
          value: 'http://localhost:3001/api/mailbox/callback',
          note: 'Only if the API runs locally. Live VPS must use the https://app.sync2dine.io callback above.',
        },
      ],
      footer:
        'Easiest: Download JSON from Google Cloud → upload it with the green “Upload client_secret JSON” control above → Save (Enabled on, Mock off). Or paste Client ID + Secret manually. Then Communications → Mailbox → Connect with Google.',
    },
    fields: [
      { key: 'googleClientId', label: 'Google Client ID', type: 'text', placeholder: '….apps.googleusercontent.com' },
      { key: 'googleClientSecret', label: 'Google Client Secret', type: 'password', placeholder: 'GOCSPX-…' },
      { key: 'microsoftClientId', label: 'Microsoft Client ID', type: 'text' },
      { key: 'microsoftClientSecret', label: 'Microsoft Client Secret', type: 'password' },
      { key: 'microsoftTenantId', label: 'Microsoft Tenant ID', type: 'text', placeholder: 'common' },
      { key: 'yahooClientId', label: 'Yahoo Client ID', type: 'text' },
      { key: 'yahooClientSecret', label: 'Yahoo Client Secret', type: 'password' },
      { key: 'redirectUri', label: 'OAuth Redirect URI (must match Google Console)', type: 'readonly', placeholder: 'https://app.sync2dine.io/api/mailbox/callback' },
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
    name: 'Voice Telephony (Cynthia)',
    description: 'Cynthia phone via Vapi + Soho66 SIP trunk — configure lines in Call Centre → Phone Lines',
    category: 'messaging',
    docsUrl: 'https://docs.jambonz.org/',
    fields: [
      { key: 'provider', label: 'Provider', type: 'select', options: [
        { value: 'mock', label: 'Mock (dev/test)' },
        { value: 'soho66', label: 'Soho66 (SIP)' },
      ]},
      { key: 'sipUsername', label: 'SIP Username', type: 'text', placeholder: 'Extension or auth user' },
      { key: 'sipPassword', label: 'SIP Password', type: 'password' },
      { key: 'sipDomain', label: 'SIP Domain', type: 'text', placeholder: 'sip.soho66.co.uk' },
      { key: 'did', label: 'DID (Inbound Number)', type: 'text', placeholder: '+442037453233' },
      { key: 'sipBridgeUrl', label: 'SIP Bridge URL (Jambonz)', type: 'url', placeholder: 'http://your-vps:3000' },
      { key: 'transferNumber', label: 'Transfer Number', type: 'text', placeholder: '+4420... (human handoff)' },
      { key: 'webhookUrl', label: 'Voice Webhook URL', type: 'readonly', placeholder: 'Set after deploying server' },
      { key: 'businessHoursStart', label: 'Business Hours Start', type: 'text', placeholder: '09:00' },
      { key: 'businessHoursEnd', label: 'Business Hours End', type: 'text', placeholder: '17:30' },
    ],
  },
  {
    id: 'vapi',
    name: 'Vapi (Voice AI Platform)',
    description: 'Vapi orchestrates Cynthia phone calls — connects SIP trunk to AI pipeline with ElevenLabs voice',
    category: 'ai',
    docsUrl: 'https://docs.vapi.ai',
    fields: [
      { key: 'privateKey', label: 'Private Key', type: 'password', placeholder: 'vapi_sk_...', required: true },
      { key: 'publicKey', label: 'Public Key', type: 'text', placeholder: 'vapi_pk_...' },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', placeholder: 'Vapi phone number resource ID' },
      { key: 'serverSecret', label: 'Server Secret', type: 'password', placeholder: 'Webhook signature secret' },
      { key: 'region', label: 'Region', type: 'select', options: [
        { value: 'us', label: 'US' },
        { value: 'eu', label: 'EU' },
      ]},
      { key: 'webhookUrl', label: 'Webhook URL', type: 'readonly', placeholder: 'Auto-set from backend deploy' },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Ultra-realistic voice cloning and TTS for Cynthia phone calls via Vapi',
    category: 'ai',
    docsUrl: 'https://elevenlabs.io/docs',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'xi_...', required: true },
      { key: 'voiceId', label: 'Voice ID', type: 'text', placeholder: 'Cloned voice ID from ElevenLabs' },
      { key: 'modelId', label: 'Model ID', type: 'select', options: [
        { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (fastest)' },
        { value: 'eleven_multilingual_v2', label: 'Multilingual v2' },
        { value: 'eleven_monolingual_v1', label: 'Monolingual v1' },
      ]},
    ],
  },
  {
    id: 'chatterbox_tts',
    name: 'Chatterbox TTS (legacy)',
    description: 'Legacy / mock clone TTS only — live Cynthia phone voice is Vapi + ElevenLabs (see VOICE_SETUP.md). WAV upload on Call Centre does not change real calls.',
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
        { value: 'supabase', label: 'Supabase Storage' },
        { value: 'local', label: 'Local (offline fallback)' },
        { value: 's3', label: 'Amazon S3 (not wired)' },
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
    description: 'Used by Cynthia, templates, and invoice/quote/receipt PDFs',
    category: 'general',
    fields: [
      { key: 'companyName', label: 'Company Name', type: 'text', placeholder: 'Sync2Dine' },
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://sync2dine.io' },
      { key: 'companyRegistrationNumber', label: 'Company registration number', type: 'text', placeholder: '12345678' },
      { key: 'vatNumber', label: 'VAT number', type: 'text', placeholder: 'GB123456789' },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '020 3745 3233' },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'info@sync2dine.io' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'logoUrl', label: 'Logo URL', type: 'url', placeholder: 'Upload below or paste image URL' },
      { key: 'accountName', label: 'Bank account name', type: 'text', placeholder: 'Sync2Dine' },
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
    values.provider = 'openai';
    values.staffModel = 'gpt-4o-mini';
    values.cyrusModel = 'gpt-4o-mini';
    values.summaryModel = 'gpt-4o-mini';
    values.ttsVoice = 'nova';
  }
  if (def.id === 'whatsapp') {
    values.cyrusDisplayName = 'Cynthia';
  }
  if (def.id === 'company') {
    values.companyName = 'Sync2Dine';
    values.website = 'https://sync2dine.io';
    values.phone = '020 3745 3233';
    values.email = 'info@sync2dine.io';
    values.address = '';
    values.autoSendReceiptOnPaid = 'true';
  }
  if (def.id === 'email_oauth') {
    values.microsoftTenantId = 'common';
    values.redirectUri = 'https://app.sync2dine.io/api/mailbox/callback';
  }
  if (def.id === 'email_smtp') {
    values.host = 'smtp.gmail.com';
    values.port = '587';
    values.secure = 'true';
    values.fromName = 'Sync2Dine';
  }
  if (def.id === 'storage') {
    values.provider = 'supabase';
    values.bucket = 'project-files';
  }
  if (def.id === 'voice_telephony') {
    values.provider = 'soho66';
    values.businessHoursStart = '09:00';
    values.businessHoursEnd = '17:30';
    values.sipDomain = 'sip.soho66.co.uk';
  }
  if (def.id === 'vapi') {
    values.region = 'eu';
  }
  if (def.id === 'elevenlabs') {
    values.modelId = 'eleven_turbo_v2_5';
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
