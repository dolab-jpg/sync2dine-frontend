import type { Customer } from '../../App';
import type { UnifiedProject, PaymentStage, Invoice } from '../project/types';
import { loadProjects, updateProject } from '../project/projectStore';
import { addClientReceipt, categorizeTransaction, loadBankTransactions } from './bankingStore';
import type { BankTransaction, ClientReceipt } from './types';
import { messagingHub } from '../messaging/messagingHub';
import type { MessageChannel } from '../messaging/types';
import { generateReceiptPdf } from '../messaging/pdfGenerator';
import { persistGeneratedPdf, pdfPathFromAttachment } from '../messaging/documentPersist';

export interface IssueReceiptInput {
  transactionId: string;
  projectId: string;
  customer: Customer;
  stageId?: string;
  invoiceId?: string;
  channels?: MessageChannel[];
}

export interface IssueReceiptResult {
  success: boolean;
  receipt?: ClientReceipt;
  message: string;
}

function formatGBP(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildReceiptBody(
  customer: Customer,
  project: UnifiedProject,
  amount: number,
  stageName?: string
): string {
  return [
    `Dear ${customer.name},`,
    '',
    `Thank you for your payment of ${formatGBP(amount)}.`,
    stageName ? `Payment stage: ${stageName}` : '',
    `Project: ${project.projectName}`,
    project.address ? `Site: ${project.address}` : '',
    '',
    'This email serves as your receipt. Please retain for your records.',
    '',
    'Builder Diddies Ltd',
  ].filter(Boolean).join('\n');
}

function markStagePaid(project: UnifiedProject, stageId: string, paidDate: string): UnifiedProject {
  const paymentStages = project.paymentStages.map((s) =>
    s.id === stageId ? { ...s, status: 'paid' as PaymentStage['status'], paidDate } : s
  );
  return { ...project, paymentStages };
}

function markInvoicePaid(project: UnifiedProject, invoiceId: string): UnifiedProject {
  const invoices = project.invoices.map((inv) =>
    inv.id === invoiceId ? { ...inv, status: 'paid' as Invoice['status'] } : inv
  );
  return { ...project, invoices };
}

export async function issueClientReceipt(input: IssueReceiptInput): Promise<IssueReceiptResult> {
  const transactions = loadBankTransactions();
  const tx = transactions.find((t) => t.id === input.transactionId);
  if (!tx || tx.direction !== 'in') {
    return { success: false, message: 'Select a valid incoming bank transaction.' };
  }

  const projects = loadProjects();
  const project = projects.find((p) => p.id === input.projectId);
  if (!project) {
    return { success: false, message: 'Project not found.' };
  }

  const stage = input.stageId
    ? project.paymentStages.find((s) => s.id === input.stageId)
    : undefined;
  const paidDate = tx.date;

  let updated = project;
  if (input.stageId) updated = markStagePaid(updated, input.stageId, paidDate);
  if (input.invoiceId) updated = markInvoicePaid(updated, input.invoiceId);
  updateProject(project.id, {
    paymentStages: updated.paymentStages,
    invoices: updated.invoices,
  });

  categorizeTransaction(tx.id, tx.category === 'uncategorised' ? 'stage-payment' : tx.category, 'Matched when receipt issued', {
    matchedProjectId: project.id,
    matchedCustomerId: input.customer.id,
    matchedInvoiceId: input.invoiceId,
    matchedStageId: input.stageId,
  });

  const channels: MessageChannel[] = input.channels ?? ['email'];
  const body = buildReceiptBody(input.customer, project, tx.amount, stage?.name);
  const pdf = await persistGeneratedPdf(
    await generateReceiptPdf(
      input.customer.name,
      project.projectName,
      tx.amount,
      stage?.name
    ),
    { projectId: project.id, uploadedBy: 'receipt-send' }
  );
  const sendResult = await messagingHub.send(
    {
      channels,
      to: {
        email: input.customer.email,
        phone: input.customer.phone,
        customerId: input.customer.id,
        customerName: input.customer.name,
      },
      subject: `Payment receipt — ${project.projectName}`,
      body,
      eventType: 'receipt',
      templateId: 'payment_receipt',
      attachment: pdf,
    },
    input.customer
  );

  const receipt = addClientReceipt({
    customerId: input.customer.id,
    customerName: input.customer.name,
    projectId: project.id,
    projectName: project.projectName,
    invoiceId: input.invoiceId,
    stageId: input.stageId,
    transactionId: tx.id,
    amount: tx.amount,
    date: paidDate,
    pdfPath: pdfPathFromAttachment(pdf),
    sentVia: channels.length > 1 ? 'both' : channels[0] === 'whatsapp' ? 'whatsapp' : 'email',
    sentAt: sendResult.success ? new Date().toISOString() : undefined,
  });

  return {
    success: sendResult.success,
    receipt,
    message: sendResult.success
      ? `Receipt sent to ${input.customer.name} via ${receipt.sentVia}.`
      : `Receipt recorded but delivery failed: ${sendResult.errors.join(', ') || 'unknown error'}`,
  };
}

export function findUnmatchedIncoming(): BankTransaction[] {
  return loadBankTransactions().filter(
    (t) => t.direction === 'in' && (!t.reconciled || t.category === 'uncategorised')
  );
}

export function suggestPaymentMatches(
  tx: BankTransaction,
  projects: UnifiedProject[]
): Array<{ project: UnifiedProject; stage?: PaymentStage; score: number }> {
  const desc = tx.description.toUpperCase();
  return projects
    .map((project) => {
      let score = 0;
      if (desc.includes(project.customerName.toUpperCase())) score += 3;
      if (desc.includes(project.projectName.toUpperCase())) score += 2;
      const stage = project.paymentStages.find(
        (s) => s.status !== 'paid' && Math.abs(s.amount - tx.amount) < 1
      );
      if (stage) score += 2;
      return { project, stage, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}
