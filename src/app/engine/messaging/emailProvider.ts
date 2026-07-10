import { integrationService } from '../integrations/integrationService';
import { appendMessageLog } from './messageLogStore';
import type { OutboundMessage, MessageLogEntry } from './types';

export async function sendEmail(message: OutboundMessage): Promise<MessageLogEntry> {
  const to = message.to.email;
  if (!to) {
    return appendMessageLog({
      channel: 'email',
      to: '',
      subject: message.subject,
      body: message.body,
      status: 'failed',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
      error: 'No email address',
    });
  }

  const isMock = integrationService.isMockMode('email_smtp')
    || !integrationService.getActiveEmailProvider();

  if (isMock) {
    return appendMessageLog({
      channel: 'email',
      to,
      subject: message.subject,
      body: message.body,
      status: 'mock',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
    });
  }

  try {
    const provider = integrationService.getActiveEmailProvider();
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'email',
        provider,
        to,
        subject: message.subject,
        body: message.body,
        attachment: message.attachment,
        config: integrationService.getConfig(provider!),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Send failed' }));
      return appendMessageLog({
        channel: 'email',
        to,
        subject: message.subject,
        body: message.body,
        status: 'failed',
        customerId: message.to.customerId,
        customerName: message.to.customerName,
        eventType: message.eventType,
        error: err.error ?? 'Email send failed',
      });
    }

    return appendMessageLog({
      channel: 'email',
      to,
      subject: message.subject,
      body: message.body,
      status: 'sent',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
    });
  } catch (err) {
    return appendMessageLog({
      channel: 'email',
      to,
      subject: message.subject,
      body: message.body,
      status: 'failed',
      customerId: message.to.customerId,
      customerName: message.to.customerName,
      eventType: message.eventType,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
