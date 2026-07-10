import type { TradePlaybook } from '../../../config/trades/playbooks';
import type { UnifiedProject } from '../../project/types';

function summariseTasks(project: UnifiedProject): string {
  if (!project.tasks.length) return '- No live tasks yet.';
  return project.tasks
    .slice(0, 12)
    .map((task) => {
      const due = task.targetDate ? `, target ${task.targetDate}` : '';
      return `- ${task.title} (${task.status}${due})`;
    })
    .join('\n');
}

function summarisePaymentStages(project: UnifiedProject): string {
  if (!project.paymentStages.length) return '- No payment stages defined yet.';
  return project.paymentStages
    .map((stage) => `- ${stage.name}: ${stage.percentage}% (£${stage.amount.toFixed(0)}) - ${stage.status}`)
    .join('\n');
}

function summariseContractScope(project: UnifiedProject): string {
  const latestContract = project.contracts[project.contracts.length - 1];
  const terms = latestContract?.terms?.trim();
  if (terms) return terms;
  const description = project.description?.trim();
  if (description) return description;
  return 'Scope not confirmed yet. Ask for clear inclusions, exclusions, and assumptions.';
}

function summariseAssignedContractors(project: UnifiedProject): string {
  const contractors = project.assignedContractors ?? [];
  if (!contractors.length) return '- No subcontractors assigned yet.';
  return contractors
    .map((contractor) => {
      const role = contractor.role ?? 'sub';
      const trade = contractor.trade ?? contractor.tradeId ?? 'trade not set';
      return `- ${contractor.name} (${role}, ${trade})`;
    })
    .join('\n');
}

export function buildForemanSystemPrompt(project: UnifiedProject, playbook?: TradePlaybook): string {
  const playbookPhases = playbook?.phases?.length
    ? playbook.phases.join(' -> ')
    : 'No playbook phases loaded';

  return `You are Agent Foreman Scheduler for a UK home improvement business.
Use friendly British plain English. Be practical, calm, and direct.

Project details:
- Project: ${project.projectName}
- Customer: ${project.customerName}
- Builder: ${project.assignedBuilder}
- Status: ${project.status}
- Start: ${project.startDate}
- Finish: ${project.finishDate}

Contract scope:
${summariseContractScope(project)}

Payment stages:
${summarisePaymentStages(project)}

Assigned contractors:
${summariseAssignedContractors(project)}

Current tasks:
${summariseTasks(project)}

Playbook phases:
${playbookPhases}

Rules:
1) Keep updates short, clear, and polite.
2) Reference payment stages when suggesting stage gates or billing readiness.
3) Reference live tasks when asking for photos or progress checks.
4) Never invent signed-off scope; flag uncertainty and ask for confirmation.
5) Suggest actions as structured tools where possible (builder brief, plan, payment gate check, site photos, customer relay).
6) When assigned subcontractors exist, split tasks by trade and align each trade plan to playbook phases.`;
}
