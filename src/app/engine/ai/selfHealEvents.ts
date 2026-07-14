/** Browser events for self-heal error → CRM chat Yes/No flow. */

export const SELF_HEAL_ERROR_EVENT = 'tradepro:self-heal-error';

export interface SelfHealErrorDetail {
  errorCode: string;
  description: string;
  route?: string;
  status?: number;
  /** Parsed OpenAI tool name when Invalid schema for function 'X' */
  functionName?: string;
  schemaError?: boolean;
}

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 60_000;

const SCHEMA_FUNCTION_RE = /Invalid schema for function ['"]([^'"]+)['"]/i;
const INVALID_FUNCTION_PARAMS_RE = /invalid_function_parameters/i;

export function parseOpenAIToolSchemaError(bodyText: string): {
  functionName?: string;
  schemaError: boolean;
} {
  const fnMatch = bodyText.match(SCHEMA_FUNCTION_RE);
  const schemaError = Boolean(fnMatch) || INVALID_FUNCTION_PARAMS_RE.test(bodyText);
  return {
    functionName: fnMatch?.[1],
    schemaError,
  };
}

export function emitSelfHealError(detail: SelfHealErrorDetail): void {
  if (typeof window === 'undefined') return;
  const route = detail.route || window.location.pathname;
  const key = `${detail.errorCode}|${route}|${detail.description.slice(0, 80)}`;
  const now = Date.now();
  const prev = recentKeys.get(key);
  if (prev && now - prev < DEDUPE_MS) return;
  recentKeys.set(key, now);
  window.dispatchEvent(new CustomEvent(SELF_HEAL_ERROR_EVENT, { detail: { ...detail, route } }));
}

export function installSelfHealFetchHook(): () => void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (
        res.status >= 400 &&
        (url.includes('/api/') || url.includes('/webhooks/')) &&
        !url.includes('/api/ai/code-fix') &&
        !url.includes('/api/ai/conversation-log') &&
        !url.includes('/api/ai/health')
      ) {
        let bodyHint = '';
        try {
          const clone = res.clone();
          bodyHint = (await clone.text()).slice(0, 500);
        } catch {
          // ignore
        }

        const isOrchestrate = url.includes('/api/ai/orchestrate');
        const parsed = parseOpenAIToolSchemaError(bodyHint);
        const functionName = parsed.functionName;
        const schemaError = parsed.schemaError || (isOrchestrate && res.status === 400 && /Invalid schema/i.test(bodyHint));

        const errorCode = schemaError && functionName
          ? `OPENAI_TOOL_SCHEMA:${functionName}`
          : schemaError
            ? 'OPENAI_TOOL_SCHEMA'
            : `HTTP_${res.status}`;

        const description = schemaError && functionName
          ? `OpenAI rejected tool schema for function '${functionName}'. ${bodyHint || `HTTP ${res.status}`}`
          : bodyHint
            ? `Request failed (${res.status}): ${bodyHint}`
            : `Request failed with status ${res.status}`;

        emitSelfHealError({
          errorCode,
          description,
          route: window.location.pathname,
          status: res.status,
          functionName,
          schemaError,
        });
      }
    } catch {
      // never break fetch
    }
    return res;
  };
  return () => {
    window.fetch = original;
  };
}
