/** Browser events for self-heal error → CRM chat Yes/No flow. */

export const SELF_HEAL_ERROR_EVENT = 'tradepro:self-heal-error';

export type SelfHealErrorKind = 'auth' | 'ops' | 'code';

export interface SelfHealErrorDetail {
  errorCode: string;
  description: string;
  route?: string;
  status?: number;
  /** Session/auth failure — Bridge must not offer or auto-start code fixes */
  authError?: boolean;
  /** Ops/infra (502/quota/gateway) — never offer Cursor; keep chat quiet */
  opsError?: boolean;
  kind?: SelfHealErrorKind;
  /** Parsed OpenAI tool name when Invalid schema for function 'X' */
  functionName?: string;
  schemaError?: boolean;
}

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 60_000;
/** Longer window for flaky gateway / billing noise */
const OPS_DEDUPE_MS = 15 * 60_000;

const SCHEMA_FUNCTION_RE = /Invalid schema for function ['"]([^'"]+)['"]/i;
const INVALID_FUNCTION_PARAMS_RE = /invalid_function_parameters/i;
const UNAUTHORIZED_RE = /unauthorized/i;

const OPS_STATUS = new Set([429, 502, 503, 504]);

const OPS_BODY_RE =
  /no credit|usage limit|billing|quota|insufficient_quota|rate.?limit|openai key rejected|econnreset|econnrefused|etimedout|gateway|bad gateway|service unavailable|upstream|temporarily unavailable|cloudflare|proxy error|CURSOR_API_KEY not configured/i;

/** Paths that should never trigger self-heal (code-fix loop, health probes). */
function isSelfHealExcludedUrl(url: string): boolean {
  return (
    url.includes('/api/ai/code-fix') ||
    url.includes('/api/ai/conversation-log') ||
    url.includes('/api/ai/health') ||
    url.includes('/api/openai/health') ||
    url.includes('/health')
  );
}

export function isAuthSelfHealError(
  detail: Pick<SelfHealErrorDetail, 'authError' | 'status' | 'errorCode' | 'description' | 'kind'>,
): boolean {
  if (detail.kind === 'auth' || detail.authError === true) return true;
  return (
    detail.status === 401 ||
    detail.errorCode === 'HTTP_401' ||
    UNAUTHORIZED_RE.test(detail.description)
  );
}

/**
 * Ops/infra failures are not application bugs — self-heal must not open chat,
 * offer Yes/No, or launch Cursor Cloud Agents.
 */
export function isOpsSelfHealError(
  detail: Pick<SelfHealErrorDetail, 'opsError' | 'status' | 'errorCode' | 'description' | 'kind'>,
): boolean {
  if (detail.kind === 'ops' || detail.opsError === true) return true;
  const status = detail.status ?? Number(/^HTTP_(\d+)$/.exec(detail.errorCode || '')?.[1] || 0);
  if (OPS_STATUS.has(status)) return true;
  if (/^HTTP_(429|502|503|504)$/.test(detail.errorCode || '')) return true;
  return OPS_BODY_RE.test(detail.description || '');
}

export function classifySelfHealError(
  detail: Pick<SelfHealErrorDetail, 'authError' | 'opsError' | 'status' | 'errorCode' | 'description' | 'kind'>,
): SelfHealErrorKind {
  if (detail.kind === 'auth' || detail.kind === 'ops' || detail.kind === 'code') return detail.kind;
  if (isAuthSelfHealError(detail)) return 'auth';
  if (isOpsSelfHealError(detail)) return 'ops';
  return 'code';
}

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
  const kind = classifySelfHealError(detail);
  const enriched: SelfHealErrorDetail = {
    ...detail,
    route,
    kind,
    authError: kind === 'auth' ? true : detail.authError,
    opsError: kind === 'ops' ? true : detail.opsError,
  };

  // Ops: dedupe by status class only so every failing API doesn't spam
  const key =
    kind === 'ops'
      ? `ops|${enriched.errorCode}`
      : `${enriched.errorCode}|${route}|${enriched.description.slice(0, 80)}`;
  const windowMs = kind === 'ops' ? OPS_DEDUPE_MS : DEDUPE_MS;
  const now = Date.now();
  const prev = recentKeys.get(key);
  if (prev && now - prev < windowMs) return;
  recentKeys.set(key, now);
  window.dispatchEvent(new CustomEvent(SELF_HEAL_ERROR_EVENT, { detail: enriched }));
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
        !isSelfHealExcludedUrl(url)
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
        const schemaError =
          parsed.schemaError || (isOrchestrate && res.status === 400 && /Invalid schema/i.test(bodyHint));

        const errorCode =
          schemaError && functionName
            ? `OPENAI_TOOL_SCHEMA:${functionName}`
            : schemaError
              ? 'OPENAI_TOOL_SCHEMA'
              : `HTTP_${res.status}`;

        const description =
          schemaError && functionName
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
