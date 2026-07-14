import type { Customer } from '../../App';
import { loadProjects, updateProject } from '../project/projectStore';
import { addClientReceipt, loadClientReceipts } from './bankingStore';
import { generateReceiptPdf } from '../messaging/pdfGenerator';
import { messagingHub } from '../messaging/messagingHub';
import type { MessageChannel } from '../messaging/types';
import { integrationService } from '../integrations/integrationService';

export interface SendReceiptForStageInput {
  projectId: string;
  stageId?: string;
  stageName?: string;
  customer: Customer;
  channels?: MessageChannel[];
  force?: boolean;
}

export interface SendReceiptForStageResult {
  success: boolean;
  message: string;
  skipped?: boolean;
}

export function isAutoSendReceiptOnPaid(): boolean {
  return integrationService.getConfig('company').autoSendReceiptOnPaid !== 'false';
}

export function hasReceiptForStage(projectId: string, stageId: string): boolean {
  return loadClientReceipts().some(
    (r) => r.projectId === projectId && r.stageId === stageId && Boolean(r.sentAt)
  );
}

function resolveStage(
  projectId: string,
  stageId?: string,
  stageName?: string
): { project: ReturnType<typeof loadProjects>[number]; stage: import('../project/types').PaymentStage } | null {
  const project = loadProjects().find((p) => p.id === projectId);
  if (!project) return null;
  const nameLower = stageName?.toLowerCase();
  const stage = project.paymentStages.find((s) => {
    if (stageId && s.id === stageId) return true;
    if (nameLower && s.name.toLowerCase().includes(nameLower)) return true;
    return false;
  });
  if (!stage) return null;
  return { project, stage };
}

export async function sendReceiptForStage(
  input: SendReceiptForStageInput
): Promise<SendReceiptForStageResult> {
  const resolved = resolveStage(input.projectId, input.stageId, input.stageName);
  if (!resolved) {
    return { success: false, message: 'Project or payment stage not found.' };
  }
  const { project, stage } = resolved;

  if (stage.status !== 'paid') {
    return { success: false, message: `Stage "${stage.name}" is not marked paid yet.` };
  }

  if (!input.force && hasReceiptForStage(project.id, stage.id)) {
    return { success: true, message: 'Receipt already sent for this stage.', skipped: true };
  }

  const projectName = project.projectName || project.description || project.customerName;
  const pdf = await generateReceiptPdf(
    input.customer.name,
    projectName,
    stage.amount,
    stage.name
  );

  const channels: MessageChannel[] = input.channels ?? ['email'];
  const sendResult = await messagingHub.send(
    {
      channels,
      to: {
        email: input.customer.email || project.customerEmail,
        phone: input.customer.phone,
        customerId: input.customer.id,
        customerName: input.customer.name,
      },
      subject: `Payment receipt — ${stage.name}`,
      body: `Thank you for your payment of £${stage.amount.toFixed(2)} for ${stage.name}.`,
      eventType: 'receipt',
      attachment: pdf,
      templateId: 'payment_receipt',
    },
    input.customer
  );

  const paidDate = stage.paidDate ?? new Date().toISOString().split('T')[0];
  addClientReceipt({
    customerId: input.customer.id,
    customerName: input.customer.name,
    projectId: project.id,
    projectName,
    stageId: stage.id,
    amount: stage.amount,
    date: paidDate,
    pdfPath: pdf.filename,
    sentVia: channels.length > 1 ? 'both' : channels[0] === 'whatsapp' ? 'whatsapp' : 'email',
    sentAt: sendResult.success ? new Date().toISOString() : undefined,
  });

  const invoices = project.invoices.map((inv) =>
    inv.stageId === stage.id ? { ...inv, status: 'paid' as const } : inv
  );
  if (invoices.some((inv, i) => inv !== project.invoices[i])) {
    updateProject(project.id, { invoices });
  }

  if (!sendResult.success) {
    return {
      success: false,
      message: `Receipt recorded but delivery failed: ${sendResult.errors.join(', ') || 'unknown error'}`,
    };
  }

  return {
    success: true,
    message: `Receipt sent to ${input.customer.name} for ${stage.name}.`,
  };
}

export async function autoSendReceiptAfterMarkPaid(
  projectId: string,
  stageId: string,
  customer: Customer
): Promise<SendReceiptForStageResult | null> {
  if (!isAutoSendReceiptOnPaid()) return null;
  return sendReceiptForStage({ projectId, stageId, customer, force: false });
}
