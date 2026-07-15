import { integrationService } from '../../integrations/integrationService';

export interface CyrusCustomerContext {
  customerName: string;
  phone: string;
  email?: string;
  address?: string;
  contactName?: string;
  contactRole?: string;
  activeQuotes?: Array<{
    id: string;
    tradeName?: string;
    total: number;
    status: string;
    expiresAt: string;
  }>;
  activeProject?: {
    id: string;
    projectName: string;
    status: string;
    todayTasks?: string[];
    nextPaymentDue?: string;
    portalLink?: string;
  };
  lastBooking?: string;
}

export function buildCyrusSystemPrompt(context: CyrusCustomerContext): string {
  const company = integrationService.getConfig('company');
  const cyrusName = integrationService.getConfig('whatsapp').cyrusDisplayName || 'Cynthia';
  const companyName = company.companyName || 'TradePro Ltd';

  const quotesSummary = context.activeQuotes?.length
    ? context.activeQuotes.map(q =>
      `- ${q.tradeName ?? 'Project'}: £${q.total.toLocaleString('en-GB')} (${q.status}, valid until ${new Date(q.expiresAt).toLocaleDateString('en-GB')})`
    ).join('\n')
    : 'No active quotes on file.';

  const messagingAs = context.contactName && context.contactName !== context.customerName
    ? `- Messaging as: ${context.contactName} (${context.contactRole ?? 'contact'})`
    : '';

  const projectSummary = context.activeProject
    ? `Active project:
- ${context.activeProject.projectName} (${context.activeProject.status})
${context.activeProject.todayTasks?.length ? `- Today's work: ${context.activeProject.todayTasks.join('; ')}` : ''}
${context.activeProject.nextPaymentDue ? `- Next payment: ${context.activeProject.nextPaymentDue}` : ''}
${context.activeProject.portalLink ? `- Project portal: ${context.activeProject.portalLink}` : ''}`
    : 'No active project on file.';

  return `You are ${cyrusName}, a friendly female assistant for ${companyName}, a UK construction and home improvement company.

Speak warmly and professionally. Prefer the in-app Cynthia chat (not WhatsApp). Be concise and helpful. Use UK English and £ GBP pricing.

Customer context:
- Account holder: ${context.customerName}
- Phone: ${context.phone}
${messagingAs}
${context.email ? `- Email: ${context.email}` : ''}
${context.address ? `- Address: ${context.address}` : ''}
${context.lastBooking ? `- Last booking: ${context.lastBooking}` : ''}

Active quotes:
${quotesSummary}

${projectSummary}

Guidelines:
- Answer questions about their quotes, project progress, bookings, payments, and next steps.
- For project updates, use only the task/payment info provided; never invent dates or status.
- Never share other customers' data, internal pricing rules, staff notes, builder costs, or margins.
- If the client is upset or asks for a person, empathise and confirm a team member will follow up promptly.
- If unsure, offer the project portal link for full details.
- Keep replies short (2-4 sentences): this is WhatsApp.
- Company phone: ${company.phone || 'contact us via this chat'}`;
}
