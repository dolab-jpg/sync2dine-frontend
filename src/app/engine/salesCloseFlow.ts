import type { Customer, Quote } from '../App';
import type { WizardAnswers } from '../config/types';
import { isHighSurveyRisk } from './surveyScorer';
import { saveContract, generateSignToken, signTokenExpiry } from './contracts/contractStore';
import type { Contract, PaymentStage } from './contracts/types';
import { sendContractEmail } from './contracts/contractSend';
import { createProjectFromQuote, loadProjects, updateProject } from './project/projectStore';
import { messagingHub } from './messaging/messagingHub';
import { renderTemplate } from './messaging/templateRenderer';

export const APPROVAL_TOTAL_THRESHOLD = 5000;
export const APPROVAL_DISCOUNT_THRESHOLD = 10;

export function needsManagerApproval(opts: {
  total: number;
  discountPct: number;
  surveyRiskScore?: number;
}): boolean {
  if (opts.total >= APPROVAL_TOTAL_THRESHOLD) return true;
  if (opts.discountPct > APPROVAL_DISCOUNT_THRESHOLD) return true;
  if (opts.surveyRiskScore != null && isHighSurveyRisk(opts.surveyRiskScore)) return true;
  return false;
}

export function resolveBookingDeposit(total: number, answers?: WizardAnswers): number {
  const fromAnswers = Number(answers?.bookingDeposit);
  if (Number.isFinite(fromAnswers) && fromAnswers > 0) return Math.round(fromAnswers);
  return Math.round(total * 0.25);
}

export function buildContractStages(total: number, depositAmount: number): PaymentStage[] {
  const deposit = Math.min(depositAmount, total);
  const remainder = Math.max(0, total - deposit);
  const progress = Math.round(remainder * 0.6);
  const completion = remainder - progress;
  return [
    {
      label: 'Booking deposit',
      description: 'Due on signing to secure the diary',
      percent: total > 0 ? Math.round((deposit / total) * 100) : 25,
      amount: deposit,
      dueTrigger: 'on_signing',
      status: 'pending',
    },
    {
      label: 'Progress',
      description: 'Due at first fix / mid programme',
      percent: total > 0 ? Math.round((progress / total) * 100) : 50,
      amount: progress,
      dueTrigger: 'first_fix',
      status: 'pending',
    },
    {
      label: 'Completion',
      description: 'Due on handover',
      percent: total > 0 ? Math.round((completion / total) * 100) : 25,
      amount: completion,
      dueTrigger: 'handover',
      status: 'pending',
    },
  ];
}

export function createContractDraftFromQuote(
  quote: Quote,
  depositAmount: number,
): Contract {
  const stages = buildContractStages(quote.total, depositAmount);
  const body = [
    `# Builder Diddies works agreement`,
    ``,
    `**Customer:** ${quote.customerName}`,
    `**Trade:** ${quote.tradeName ?? 'Works'}`,
    `**Quote reference:** ${quote.id}`,
    `**Total:** £${quote.total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    `**Booking deposit:** £${depositAmount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    ``,
    `## Scope`,
    `Works as set out in the attached quotation for ${quote.tradeName ?? 'the agreed trade'}.`,
    ``,
    `## Payment schedule`,
    ...stages.map(
      (s) => `- **${s.label}** (${s.percent}%): £${s.amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })} — ${s.description}`,
    ),
    ``,
    `## Acceptance`,
    `By signing, the customer accepts the quotation total and payment schedule and authorises works to proceed subject to receipt of the booking deposit.`,
  ].join('\n');

  return saveContract({
    customerId: quote.customerId,
    customerName: quote.customerName,
    quoteId: quote.id,
    tradeName: quote.tradeName,
    total: quote.total,
    depositAmount,
    stages,
    bodyRendered: body,
    status: 'draft',
    signToken: generateSignToken(),
    signTokenExpiresAt: signTokenExpiry(30),
  });
}

/** Send quote summary + contract sign link to the customer. */
export async function sendPricePack(opts: {
  quote: Quote;
  customer: Customer;
  userName: string;
  contract?: Contract;
  depositAmount?: number;
}): Promise<{ success: boolean; error?: string; contract: Contract; mock?: boolean }> {
  const deposit =
    opts.depositAmount ??
    resolveBookingDeposit(opts.quote.total, opts.quote.wizardAnswers as WizardAnswers | undefined);

  let contract = opts.contract;
  if (!contract) {
    contract = createContractDraftFromQuote(opts.quote, deposit);
  }

  if (!opts.customer.email && !opts.customer.phone) {
    return { success: false, error: 'Customer has no email or phone', contract };
  }

  const sendResult = await sendContractEmail(contract, opts.customer, opts.userName);
  if (!sendResult.success) {
    return { success: false, error: sendResult.error, contract };
  }

  // Also send a short quote summary email when email is available
  if (opts.customer.email) {
    const body = renderTemplate(
      `Dear {CUSTOMER_NAME},\n\nYour quotation for {TRADE_NAME} is £{QUOTE_TOTAL}.\nBooking deposit: £{DEPOSIT_AMOUNT}.\n\nYour contract signing link is in a separate message.\n\nKind regards,\n{USER_NAME}`,
      {
        CUSTOMER_NAME: opts.customer.name,
        TRADE_NAME: opts.quote.tradeName ?? 'works',
        QUOTE_TOTAL: opts.quote.total.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
        DEPOSIT_AMOUNT: deposit.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
        USER_NAME: opts.userName,
      },
    );
    await messagingHub.send(
      {
        channels: ['email'],
        to: {
          email: opts.customer.email,
          phone: opts.customer.phone,
          customerId: opts.customer.id,
          customerName: opts.customer.name,
        },
        subject: `Your quote — ${opts.quote.tradeName ?? 'Builder Diddies'}`,
        body,
        eventType: 'quote_sent',
        templateId: 'quote_sent',
      },
      opts.customer,
    );
  }

  return { success: true, contract, mock: sendResult.mock };
}

/**
 * After contract sign: accept quote, win customer, create project with deposit due.
 * Callers must pass updateQuote / updateCustomer side effects for React state.
 */
export function closeDealOnContractSign(opts: {
  contract: Contract;
  quote: Quote;
  customer: Customer;
  bookingDeposit?: number;
}): { projectId: string; depositAmount: number } {
  const deposit =
    opts.bookingDeposit ??
    opts.contract.depositAmount ??
    resolveBookingDeposit(opts.quote.total, opts.quote.wizardAnswers as WizardAnswers | undefined);

  let project = loadProjects().find((p) => p.quoteId === opts.quote.id);
  if (!project) {
    project = createProjectFromQuote(
      {
        id: opts.quote.id,
        customerId: opts.quote.customerId,
        customerName: opts.quote.customerName,
        total: opts.quote.total,
        tradeId: opts.quote.tradeId,
        tradeName: opts.quote.tradeName,
        lines: opts.quote.lines,
        bookingDeposit: deposit,
      },
      {
        email: opts.customer.email,
        address: opts.customer.address,
        phone: opts.customer.phone,
      },
    );
  } else {
    const stages = project.paymentStages.map((s, i) => {
      if (i === 0) {
        return {
          ...s,
          name: 'Deposit',
          amount: deposit,
          percentage: opts.quote.total > 0 ? Math.round((deposit / opts.quote.total) * 100) : s.percentage,
          status: 'due' as const,
          dueDate: new Date().toISOString().slice(0, 10),
        };
      }
      return s;
    });
    updateProject(project.id, { paymentStages: stages });
  }

  return { projectId: project.id, depositAmount: deposit };
}

export function markDepositPaidOnProject(projectId: string): boolean {
  const project = loadProjects().find((p) => p.id === projectId);
  if (!project) return false;
  const stages = [...project.paymentStages];
  const idx = stages.findIndex((s) => /deposit|booking/i.test(s.name) || s.status === 'due');
  const target = idx >= 0 ? idx : 0;
  if (!stages[target]) return false;
  stages[target] = {
    ...stages[target],
    status: 'paid',
    paidDate: new Date().toISOString().slice(0, 10),
  };
  updateProject(projectId, {
    paymentStages: stages,
    status: project.status === 'planning' ? 'in_progress' : project.status,
  });
  return true;
}
