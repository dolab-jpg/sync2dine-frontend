import type { Contract } from './types';
import { upsertContractFromServer, loadContracts, updateContract } from './contractStore';
import { loadProjects, updateProject } from '../project/projectStore';
import { notifyProjectEvent } from '../notifications/notify';
import { closeDealOnContractSign } from '../salesCloseFlow';
import type { Customer, Quote } from '../../App';

const notifiedSigned = new Set<string>();

function patchLocalQuotes(quoteId: string, projectId: string): void {
  try {
    const raw = localStorage.getItem('quotes');
    if (!raw) return;
    const quotes = JSON.parse(raw) as Quote[];
    const next = quotes.map((q) =>
      q.id === quoteId ? { ...q, status: 'accepted' as const, projectId } : q,
    );
    localStorage.setItem('quotes', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('tradepro:quotes-updated'));
  } catch {
    /* ignore */
  }
}

function patchLocalCustomerWon(customerId: string): void {
  try {
    const raw = localStorage.getItem('customers');
    if (!raw) return;
    const customers = JSON.parse(raw) as Customer[];
    const next = customers.map((c) =>
      c.id === customerId ? { ...c, status: 'won' as const, lastContact: new Date().toISOString() } : c,
    );
    localStorage.setItem('customers', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('tradepro:customers-updated'));
  } catch {
    /* ignore */
  }
}

function loadCustomer(customerId: string): Customer | undefined {
  try {
    const raw = localStorage.getItem('customers');
    if (!raw) return undefined;
    return (JSON.parse(raw) as Customer[]).find((c) => c.id === customerId);
  } catch {
    return undefined;
  }
}

function loadQuote(quoteId: string): Quote | undefined {
  try {
    const raw = localStorage.getItem('quotes');
    if (!raw) return undefined;
    return (JSON.parse(raw) as Quote[]).find((q) => q.id === quoteId);
  } catch {
    return undefined;
  }
}

export function applyContractSignedEffects(remote: Contract): { projectId?: string; portalToken?: string } {
  upsertContractFromServer(remote);
  if (!remote.signedAt || remote.status !== 'signed') return {};
  if (notifiedSigned.has(remote.id)) {
    const existing = loadProjects().find((p) => p.quoteId === remote.quoteId);
    return { projectId: existing?.id, portalToken: existing?.portalToken };
  }
  notifiedSigned.add(remote.id);

  notifyProjectEvent(
    'payment_stage_due',
    'Contract signed',
    `${remote.customerName} signed their contract. Deposit ${
      remote.depositAmount > 0 ? `£${remote.depositAmount.toLocaleString('en-GB')}` : ''
    } is now due.`,
    { contractId: remote.id, quoteId: remote.quoteId, customerId: remote.customerId },
  );

  updateContract(remote.id, { status: 'signed', signedAt: remote.signedAt, depositDue: true });

  if (!remote.quoteId) return {};

  const quote = loadQuote(remote.quoteId);
  const customer = loadCustomer(remote.customerId);

  if (quote && customer) {
    const { projectId } = closeDealOnContractSign({
      contract: remote,
      quote,
      customer,
      bookingDeposit: remote.depositAmount,
    });
    patchLocalQuotes(quote.id, projectId);
    patchLocalCustomerWon(customer.id);
    const project = loadProjects().find((p) => p.id === projectId);
    return { projectId, portalToken: project?.portalToken };
  }

  // Fallback: mark deposit due if project already exists
  const project = loadProjects().find((p) => p.quoteId === remote.quoteId);
  if (project) {
    const stages = [...project.paymentStages];
    if (stages.length > 0 && stages[0].status === 'pending') {
      stages[0] = {
        ...stages[0],
        status: 'due',
        dueDate: new Date().toISOString().slice(0, 10),
        amount: remote.depositAmount || stages[0].amount,
      };
      updateProject(project.id, { paymentStages: stages });
    }
    return { projectId: project.id, portalToken: project.portalToken };
  }

  return {};
}

/** Apply close effects after customer signs via public token page. */
export function applySignedCloseFromToken(
  token: string,
  signedMeta: { signedAt?: string; depositAmount?: number },
): { projectId?: string; portalToken?: string; depositAmount: number } {
  const local = loadContracts().find((c) => c.signToken === token);

  if (!local) {
    return { depositAmount: signedMeta.depositAmount ?? 0 };
  }

  const contract: Contract = {
    ...local,
    status: 'signed',
    signedAt: signedMeta.signedAt ?? new Date().toISOString(),
    depositDue: true,
    depositAmount: signedMeta.depositAmount ?? local.depositAmount,
  };

  const result = applyContractSignedEffects(contract);
  return {
    ...result,
    depositAmount: contract.depositAmount,
  };
}
