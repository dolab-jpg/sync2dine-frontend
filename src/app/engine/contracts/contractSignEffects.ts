import type { Contract } from './types';
import { upsertContractFromServer } from './contractStore';
import { loadProjects, updateProject } from '../project/projectStore';
import { notifyProjectEvent } from '../notifications/notify';

const notifiedSigned = new Set<string>();

export function applyContractSignedEffects(remote: Contract): void {
  upsertContractFromServer(remote);
  if (!remote.signedAt || remote.status !== 'signed') return;
  if (notifiedSigned.has(remote.id)) return;
  notifiedSigned.add(remote.id);

  notifyProjectEvent(
    'payment_stage_due',
    'Contract signed',
    `${remote.customerName} signed their contract. Deposit ${remote.depositAmount > 0 ? `£${remote.depositAmount.toLocaleString('en-GB')}` : ''} is now due.`,
    { contractId: remote.id, quoteId: remote.quoteId, customerId: remote.customerId }
  );

  if (!remote.quoteId) return;
  const project = loadProjects().find((p) => p.quoteId === remote.quoteId);
  if (!project) return;
  const stages = [...project.paymentStages];
  if (stages.length === 0) return;
  if (stages[0].status === 'pending') {
    stages[0] = {
      ...stages[0],
      status: 'due',
      dueDate: new Date().toISOString().slice(0, 10),
    };
    updateProject(project.id, { paymentStages: stages });
  }
}
