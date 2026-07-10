/** Planning tool names — keep in sync with server/planning-tools.ts */

export const PLANNING_ACTION_NAMES = [
  'updateApplication',
  'setStage',
  'setPricing',
  'sendPricingEmail',
  'logDrawing',
  'sendReviewEmail',
  'recordCouncil',
  'raiseChangeRequest',
  'resolveChangeRequest',
  'setDeadline',
  'addComment',
  'portalStatusCheck',
  'sendCouncilReply',
  'sendCourtesyEmail',
  'markDecision',
  'generatePostApprovalTasks',
  'convertToProject',
] as const;

export const PLANNING_ACTIONS = new Set<string>(PLANNING_ACTION_NAMES);

export function isPlanningAction(action: string): boolean {
  return PLANNING_ACTIONS.has(action);
}
