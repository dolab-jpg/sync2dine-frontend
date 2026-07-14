/** Browser events for self-heal error → CRM chat Yes/No flow. */

export const SELF_HEAL_ERROR_EVENT = 'tradepro:self-heal-error';

export interface SelfHealErrorDetail {
  errorCode: string;
  description: string;
  route?: string;
  status?: number;
}

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 60_000;

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
          const text = await clone.text();
          bodyHint = text.slice(0, 200);
        } catch {
          // ignore
        }
        emitSelfHealError({
          errorCode: `HTTP_${res.status}`,
          description: bodyHint
            ? `Request failed (${res.status}): ${bodyHint}`
            : `Request failed with status ${res.status}`,
          route: window.location.pathname,
          status: res.status,
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
