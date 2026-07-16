export type MessageChannel = 'email' | 'whatsapp' | 'sms';

export type MessageStatus = 'sent' | 'failed' | 'pending' | 'mock';

export type MessageEventType =
  | 'quote_sent'
  | 'booking_confirmed'
  | 'reminder'
  | 'followup'
  | 'invoice'
  | 'receipt'
  | 'project_update'
  | 'custom';

export interface DocumentAttachment {
  filename: string;
  mimeType: string;
  content: string; // base64 or text stub
  /** Public or data URL for preview / Meta document.link when available */
  url?: string;
  /** Supabase/local storage path when persisted under a project */
  storagePath?: string;
  /** Set when PDF was built without an embedded company logo */
  logoWarning?: string;
  logoEmbedded?: boolean;
}

export interface OutboundMessage {
  channels: MessageChannel[];
  to: {
    email?: string;
    phone?: string;
    customerId: string;
    customerName: string;
  };
  subject?: string;
  body: string;
  eventType: MessageEventType;
  attachment?: DocumentAttachment;
  templateId?: string;
}

export interface MessageLogEntry {
  id: string;
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
  status: MessageStatus;
  sentAt: string;
  customerId: string;
  customerName: string;
  eventType: MessageEventType;
  error?: string;
}

export interface NotificationPreferences {
  quote_sent: { email: boolean; whatsapp: boolean };
  booking_confirmed: { email: boolean; whatsapp: boolean };
  reminder: { email: boolean; whatsapp: boolean };
  followup: { email: boolean; whatsapp: boolean };
  invoice: { email: boolean; whatsapp: boolean };
  project_update: { email: boolean; whatsapp: boolean };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  quote_sent: { email: true, whatsapp: true },
  booking_confirmed: { email: true, whatsapp: true },
  reminder: { email: true, whatsapp: false },
  followup: { email: true, whatsapp: true },
  invoice: { email: true, whatsapp: false },
  project_update: { email: true, whatsapp: true },
};
