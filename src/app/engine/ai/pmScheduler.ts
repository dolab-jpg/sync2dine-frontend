import { getPlaybook } from '../../config/trades/playbooks';
import { loadProjects } from '../project/projectStore';
import type { AssignedContractor, UnifiedProject } from '../project/types';
import { executeForemanAutoAction } from './foremanExecutor';
import type { CopilotAction } from './orchestratorService';
import { buildForemanSystemPrompt } from './personas/ukForeman';

export type SchedulerCadence = 'daily' | 'weekly' | 'monthly';
export type SchedulerCallback = (cadence: SchedulerCadence, slotTime: Date) => void | Promise<void>;

const LAST_RUN_KEYS: Record<SchedulerCadence, string> = {
  daily: 'pmScheduler:lastRun:daily',
  weekly: 'pmScheduler:lastRun:weekly',
  monthly: 'pmScheduler:lastRun:monthly',
};

const CHECK_INTERVAL_MS = 60 * 1000;
let schedulerTimerId: number | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readLastRun(cadence: SchedulerCadence): Date | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(LAST_RUN_KEYS[cadence]);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function writeLastRun(cadence: SchedulerCadence, value: Date): void {
  if (!isBrowser()) return;
  localStorage.setItem(LAST_RUN_KEYS[cadence], value.toISOString());
}

function getMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getScheduleSlot(cadence: SchedulerCadence, now: Date): Date {
  const slot = new Date(now);
  if (cadence === 'daily') {
    slot.setHours(7, 30, 0, 0);
    return slot;
  }
  if (cadence === 'weekly') {
    const monday = getMonday(now);
    monday.setHours(8, 0, 0, 0);
    return monday;
  }
  slot.setDate(1);
  slot.setHours(9, 0, 0, 0);
  return slot;
}

function getNextScheduleSlot(cadence: SchedulerCadence, now: Date): Date {
  const currentSlot = getScheduleSlot(cadence, now);
  if (now < currentSlot) return currentSlot;

  const nextSlot = new Date(currentSlot);
  if (cadence === 'daily') {
    nextSlot.setDate(nextSlot.getDate() + 1);
    return nextSlot;
  }
  if (cadence === 'weekly') {
    nextSlot.setDate(nextSlot.getDate() + 7);
    return nextSlot;
  }
  nextSlot.setMonth(nextSlot.getMonth() + 1);
  nextSlot.setDate(1);
  return nextSlot;
}

function isCadenceDue(cadence: SchedulerCadence, now: Date): { due: boolean; slotTime: Date } {
  const slotTime = getScheduleSlot(cadence, now);
  if (now < slotTime) return { due: false, slotTime };
  const lastRun = readLastRun(cadence);
  const due = !lastRun || lastRun < slotTime;
  return { due, slotTime };
}

function activeProjects(projects: UnifiedProject[]): UnifiedProject[] {
  return projects.filter((project) => project.status !== 'completed' && project.status !== 'on_hold');
}

function getContractorTradeLabel(contractor: AssignedContractor, project: UnifiedProject): string {
  return contractor.trade ?? contractor.tradeId ?? project.tradeName ?? project.tradeId ?? 'General';
}

function getContractorPhaseHint(contractor: AssignedContractor, project: UnifiedProject): string {
  const tradeKey = contractor.tradeId ?? project.tradeId ?? project.tradeName ?? null;
  const playbook = tradeKey ? getPlaybook(tradeKey) : undefined;
  if (!playbook?.phases?.length) return 'Review today against the active playbook phase.';
  return `Focus phase: ${playbook.phases.slice(0, 2).join(' -> ')}`;
}

function buildContractorBriefBody(
  project: UnifiedProject,
  contractor: AssignedContractor,
  cadence: SchedulerCadence
): string {
  const focusTask = project.tasks.find((task) => task.status !== 'completed');
  return [
    `Cadence: ${cadence}`,
    `Project: ${project.projectName}`,
    `Trade: ${getContractorTradeLabel(contractor, project)}`,
    `Focus task: ${focusTask?.title ?? 'Review open work package'}`,
    getContractorPhaseHint(contractor, project),
    '',
    'Please confirm today\'s outputs, blockers, and any dependencies on other trades.',
  ].join('\n');
}

function buildBriefBody(project: UnifiedProject, cadence: SchedulerCadence): string {
  const focusTask = project.tasks.find((task) => task.status !== 'completed');
  const pendingStage = project.paymentStages.find((stage) => stage.status !== 'paid');
  const playbookTrade = project.tradeId ?? project.tradeName ?? null;
  const playbook = playbookTrade ? getPlaybook(playbookTrade) : undefined;
  const personaContext = buildForemanSystemPrompt(project, playbook);
  const contextLine = personaContext.split('\n').slice(0, 2).join(' ');
  const contractorSummary = (project.assignedContractors ?? [])
    .map((contractor) => `${contractor.name} (${getContractorTradeLabel(contractor, project)})`)
    .join(', ');

  return [
    `Cadence: ${cadence}`,
    `Project: ${project.projectName}`,
    `Focus task: ${focusTask?.title ?? 'No open task'}`,
    `Next payment stage: ${pendingStage?.name ?? 'None pending'}`,
    `Subcontractors: ${contractorSummary || 'None assigned'}`,
    `Scope note: ${project.description || 'Scope to be confirmed'}`,
    '',
    `Tone guide: ${contextLine}`,
  ].join('\n');
}

export function buildForemanBrief(project: UnifiedProject, cadence: SchedulerCadence): CopilotAction[] {
  const actions: CopilotAction[] = [];
  const focusTask = project.tasks.find((task) => task.status !== 'completed');
  const assignedSubs = (project.assignedContractors ?? []).filter((contractor) => contractor.role !== 'lead');

  actions.push({
    action: 'sendBuilderBrief',
    input: { cadence },
    output: {
      projectId: project.id,
      builderName: project.assignedBuilder || 'Builder',
      body: buildBriefBody(project, cadence),
      channels: ['app'],
    },
  });

  for (const contractor of assignedSubs) {
    actions.push({
      action: 'sendContractorBrief',
      input: { cadence },
      output: {
        projectId: project.id,
        contractorId: contractor.id,
        tradeId: contractor.tradeId,
        body: buildContractorBriefBody(project, contractor, cadence),
        channels: ['app'],
      },
    });
  }

  if (focusTask) {
    actions.push({
      action: 'requestSitePhotos',
      input: { cadence },
      output: {
        taskTitle: focusTask.title,
        deadline: focusTask.targetDate || new Date().toISOString().slice(0, 10),
      },
    });
  }

  if (cadence !== 'daily') {
    actions.push({
      action: 'relayCustomerUpdate',
      input: { cadence },
      output: {
        body: `Quick update: ${project.projectName} is progressing. Next focus is ${focusTask?.title ?? 'final checks'}.`,
      },
    });
  }

  return actions;
}

async function runForemanCadence(cadence: SchedulerCadence): Promise<void> {
  const projects = activeProjects(loadProjects());
  for (const project of projects) {
    const actions = buildForemanBrief(project, cadence);
    for (const action of actions) {
      await executeForemanAutoAction(action, project.id);
    }
  }
}

export async function runDueSchedules(callback: SchedulerCallback = runForemanCadence): Promise<SchedulerCadence[]> {
  const now = new Date();
  const dueCadences: SchedulerCadence[] = [];
  const cadences: SchedulerCadence[] = ['daily', 'weekly', 'monthly'];

  for (const cadence of cadences) {
    const { due, slotTime } = isCadenceDue(cadence, now);
    if (!due) continue;
    await callback(cadence, slotTime);
    writeLastRun(cadence, now);
    dueCadences.push(cadence);
  }

  return dueCadences;
}

export function getSchedulerState() {
  const now = new Date();
  const cadences: SchedulerCadence[] = ['daily', 'weekly', 'monthly'];
  const state = {
    isRunning: schedulerTimerId !== null,
    checkIntervalMs: CHECK_INTERVAL_MS,
    lastRuns: {} as Record<SchedulerCadence, string | null>,
    dueNow: [] as SchedulerCadence[],
    nextRuns: {} as Record<SchedulerCadence, string>,
  };

  for (const cadence of cadences) {
    const lastRun = readLastRun(cadence);
    const { due } = isCadenceDue(cadence, now);
    state.lastRuns[cadence] = lastRun ? lastRun.toISOString() : null;
    state.nextRuns[cadence] = getNextScheduleSlot(cadence, now).toISOString();
    if (due) state.dueNow.push(cadence);
  }

  return state;
}

export function startPmScheduler(callback: SchedulerCallback = runForemanCadence): () => void {
  if (!isBrowser()) return () => undefined;
  if (schedulerTimerId !== null) {
    return stopPmScheduler;
  }

  void runDueSchedules(callback);
  schedulerTimerId = window.setInterval(() => {
    void runDueSchedules(callback);
  }, CHECK_INTERVAL_MS);

  return stopPmScheduler;
}

export function stopPmScheduler(): void {
  if (schedulerTimerId === null || !isBrowser()) return;
  window.clearInterval(schedulerTimerId);
  schedulerTimerId = null;
}
