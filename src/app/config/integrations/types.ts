export type IntegrationId =
  | 'openai'
  | 'whatsapp'
  | 'email_smtp'
  | 'email_resend'
  | 'sendgrid'
  | 'email_oauth'
  | 'supabase'
  | 'webhook_server'
  | 'stripe'
  | 'google_calendar'
  | 'twilio_sms'
  | 'voice_telephony'
  | 'vapi'
  | 'elevenlabs'
  | 'chatterbox_tts'
  | 'storage'
  | 'xero'
  | 'open_banking'
  | 'price_research'
  | 'company';

export type IntegrationCategory =
  | 'ai'
  | 'messaging'
  | 'database'
  | 'infrastructure'
  | 'payments'
  | 'scheduling'
  | 'files'
  | 'accounting'
  | 'banking'
  | 'general';

export type IntegrationStatus = 'not_configured' | 'mock' | 'connected' | 'error';

export type IntegrationFieldType = 'text' | 'password' | 'url' | 'number' | 'select' | 'readonly';

export interface IntegrationFieldDef {
  key: string;
  label: string;
  type: IntegrationFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  description: string;
  category: IntegrationCategory;
  docsUrl?: string;
  /** Optional setup steps shown when the card is expanded (e.g. Google Cloud OAuth). */
  setupGuide?: {
    title: string;
    intro?: string;
    steps: { label: string; value?: string; note?: string }[];
    footer?: string;
  };
  fields: IntegrationFieldDef[];
  npmPackage?: string;
  githubRepo?: string;
}

export interface IntegrationInstanceState {
  enabled: boolean;
  mockMode: boolean;
  values: Record<string, string>;
  status: IntegrationStatus;
  lastTestedAt?: string;
  lastTestError?: string;
}

export interface IntegrationsStoreData {
  masterMockMode: boolean;
  environment: 'local' | 'staging' | 'production';
  integrations: Record<IntegrationId, IntegrationInstanceState>;
  updatedAt: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  status: IntegrationStatus;
}
