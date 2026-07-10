import type { UnifiedProject, ProjectStatus } from './types';

export function deriveProjectStatus(project: UnifiedProject): ProjectStatus {
  if (project.status === 'on_hold') return 'on_hold';
  if (project.status === 'completed') return 'completed';
  if (project.handover?.signedAt) return 'completed';

  const snags = project.snags ?? [];
  const openSnags = snags.filter((s) => s.status === 'open').length;
  const milestones = project.milestones ?? [];
  const handoverMilestone = milestones.find((m) => /handover/i.test(m.title));
  const startMilestone = milestones.find((m) => /start/i.test(m.title));

  if (openSnags === 0 && snags.length > 0) return 'handover';
  if (
    handoverMilestone?.completed
    || (project.tasks.length > 0 && project.tasks.every((t) => t.status === 'completed'))
  ) {
    return 'snagging';
  }
  if (
    startMilestone?.completed
    || (project.assignedBuilder && project.assignedBuilder !== 'Unassigned')
  ) {
    return 'in_progress';
  }
  return 'planning';
}

export function applyDerivedStatus(project: UnifiedProject): UnifiedProject {
  return { ...project, status: deriveProjectStatus(project) };
}
