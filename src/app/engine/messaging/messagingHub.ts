import type { Customer } from '../../App';
import { sendEmail } from './emailProvider';
import { sendWhatsApp } from './whatsappProvider';
import type { MessageChannel, MessageLogEntry, OutboundMessage } from './types';
import { loadMessageLogs } from './messageLogStore';

export interface SendResult {
  success: boolean;
  logs: MessageLogEntry[];
  channels: MessageChannel[];
  errors: string[];
}

function resolveChannels(
  requested: MessageChannel[],
  customer: Pick<Customer, 'preferredChannel' | 'whatsappOptIn' | 'email' | 'phone'>
): MessageChannel[] {
  const channels = new Set<MessageChannel>();

  for (const ch of requested) {
    if (ch === 'whatsapp' && !customer.whatsappOptIn) continue;
    if (ch === 'email' && !customer.email) continue;
    if (ch === 'whatsapp' && !customer.phone) continue;
    channels.add(ch);
  }

  if (channels.size === 0 && customer.preferredChannel === 'both') {
    if (customer.email) channels.add('email');
    if (customer.phone && customer.whatsappOptIn) channels.add('whatsapp');
  } else if (channels.size === 0) {
    if (customer.preferredChannel === 'whatsapp' && customer.phone && customer.whatsappOptIn) {
      channels.add('whatsapp');
    } else if (customer.email) {
      channels.add('email');
    }
  }

  return Array.from(channels);
}

export const messagingHub = {
  async send(message: OutboundMessage, customer?: Pick<Customer, 'preferredChannel' | 'whatsappOptIn' | 'email' | 'phone'>): Promise<SendResult> {
    const channels = customer
      ? resolveChannels(message.channels, customer)
      : message.channels;

    const logs: MessageLogEntry[] = [];
    const errors: string[] = [];

    for (const channel of channels) {
      if (channel === 'email') {
        const log = await sendEmail(message);
        logs.push(log);
        if (log.status === 'failed') errors.push(log.error ?? 'Email failed');
      } else if (channel === 'whatsapp') {
        const log = await sendWhatsApp(message);
        logs.push(log);
        if (log.status === 'failed') errors.push(log.error ?? 'WhatsApp failed');
      }
    }

    return {
      success: logs.length > 0 && logs.every(l => l.status === 'sent' || l.status === 'mock'),
      logs,
      channels,
      errors,
    };
  },

  getLogs(): MessageLogEntry[] {
    return loadMessageLogs();
  },
};
