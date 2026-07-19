import { mailboxService } from '../mailbox/mailboxService';
import { getActiveOrgId } from '../platform/orgContext';
import { getHomeOrgId } from '../platform/homeOrg';
import type { DocumentAttachment } from './types';
import type { SaasQuoteEmail } from './saasQuoteEmail';

export type SaasQuoteMailboxDelivery = {
  delivered: boolean;
  provider: 'gmail' | 'fallback';
  messageId?: string;
  error?: string;
};

/** Send from the user's connected OAuth mailbox when available. */
export async function sendSaasQuoteFromMailbox(input: {
  userId: string;
  to: string;
  email: SaasQuoteEmail;
  attachment: DocumentAttachment;
}): Promise<SaasQuoteMailboxDelivery> {
  const orgId = getActiveOrgId() ?? getHomeOrgId();
  const connections = await mailboxService.getConnections(input.userId, orgId);
  const connection = connections.find(
    (item) => item.status !== 'needs_reconnect' && item.status !== 'disconnected',
  );
  if (!connection) return { delivered: false, provider: 'fallback' };

  const result = await mailboxService.send(
    {
      connectionId: connection.id,
      to: input.to,
      subject: input.email.subject,
      body: input.email.text,
      html: input.email.html,
      attachments: [{
        filename: input.attachment.filename,
        mimeType: input.attachment.mimeType,
        content: input.attachment.content,
      }],
    },
    input.userId,
    orgId,
  ) as { success?: boolean; messageId?: string; error?: string };

  return result.success
    ? { delivered: true, provider: 'gmail', messageId: result.messageId }
    : { delivered: false, provider: 'gmail', error: result.error || 'Gmail send failed' };
}
