/**
 * Canonical names for aliased/legacy AI tool actions.
 *
 * Normalization happens at dispatch time only — the OpenAI-visible tool
 * schemas still expose the alias names, so the model's view is unchanged.
 * Every gate (role permissions, safety confirm, clarify-phase blocking) and
 * every executor entry point resolves through this table first, so an alias
 * can never take a different code path than its canonical tool.
 *
 * Deliberately NOT aliased:
 * - getEmailThread → searchEmails: getEmailThread has its own executor that
 *   filters by threadId; the searchEmails executor ignores threadId entirely.
 */
export const TOOL_NAME_ALIASES: Readonly<Record<string, string>> = {
  saveCustomer: 'linkCustomer',
  savePaymentPlan: 'proposePaymentPlan',
  saveProjectSchedule: 'proposeSchedule',
  // navigate carries { path } or { route }; the navigateTo executor reads both.
  navigate: 'navigateTo',
  // Both names already routed to the same receipt executor.
  draftClientReceipt: 'sendClientReceipt',
};

/** Resolve an aliased/legacy tool name to its canonical executor name. */
export function resolveLegacyTool(name: string): string {
  return TOOL_NAME_ALIASES[name] ?? name;
}
