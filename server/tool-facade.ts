/**
 * Optional AI tool facade — disabled by default.
 * When enabled, web-staff modes can use a reduced domain tool set.
 */
export const FACADE_TOOLS: Array<{
  type: 'function';
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}> = [];

export const FACADE_WEB_STAFF_MODES = new Set<string>(['staff', 'project', 'foreman', 'planning', 'auto']);

export function isFacadeEnabled(): boolean {
  return process.env.AI_TOOL_FACADE === '1' || process.env.AI_TOOL_FACADE === 'true';
}

export function expandFacadeCall(
  _toolName: string,
  _args: Record<string, unknown>,
): { canonicalAction: string; canonicalArgs: Record<string, unknown> } | null {
  return null;
}
