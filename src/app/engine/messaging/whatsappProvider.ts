import { integrationService } from '../integrations/integrationService';
import { appendMessageLog } from './messageLogStore';
import type { OutboundMessage, MessageLogEntry } from './types';

export function normalizeUkPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('44')) return `+${digits}`;
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`;
  if (digits.length === 10) return `+44${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export async function sendWhatsApp(message: OutboundMessage): Promise<MessageLogEntry> {
  const phone = message.to.phone ? normalizeUkPhone(message.to.phone) : '';
  if (!phone) {
    return appendMessageLog({
      channel: 'whatsapp',
      to: '',
      body: message.body,
      status: 'failed',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
      error: 'No phone number',
    });
  }

  // Live transport is WhatsApp Web.js on the backend — do not require a Meta accessToken
  const isMock = integrationService.isMockMode('whatsapp')
    || !integrationService.isEnabled('whatsapp');

  if (isMock) {
    return appendMessageLog({
      channel: 'whatsapp',
      to: phone,
      body: message.body,
      status: 'mock',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
    });
  }

  try {
    const config = integrationService.getConfig('whatsapp');
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'whatsapp',
        to: phone,
        body: message.body,
        attachment: message.attachment,
        templateId: message.templateId,
        config,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Send failed' }));
      return appendMessageLog({
        channel: 'whatsapp',
        to: phone,
        body: message.body,
        status: 'failed',
        customerId: message.to.customerId,
        customerName: message.to.customerName,
        eventType: message.eventType,
        error: err.error ?? 'WhatsApp send failed',
      });
    }

    return appendMessageLog({
      channel: 'whatsapp',
      to: phone,
      body: message.body,
      status: 'sent',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
    });
  } catch (err) {
    return appendMessageLog({
      channel: 'whatsapp',
      to: phone,
      body: message.body,
      status: 'failed',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
