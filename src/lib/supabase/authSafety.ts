/** Timeouts and local sign-out so a hung GoTrue cannot trap login/logout. */

export const AUTH_NETWORK_MS = 8000;

export function withTimeout<T>(promise: Promise<T>, ms = AUTH_NETWORK_MS, label = 'auth'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}-timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function fetchWithAuthTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  ms = AUTH_NETWORK_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export function clearSupabaseAuthStorage(): void {
  const wipe = (store: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') || key.includes('supabase.auth') || key === 'tradepro_session_user') {
        keys.push(key);
      }
    }
    for (const key of keys) store.removeItem(key);
  };
  try {
    wipe(window.localStorage);
  } catch {
    /* private mode */
  }
  try {
    wipe(window.sessionStorage);
  } catch {
    /* private mode */
  }
}

export function forceLocalSignOut(): void {
  clearSupabaseAuthStorage();
  try {
    window.localStorage.removeItem('tradepro_session_user');
    window.localStorage.removeItem('authToken');
    window.localStorage.removeItem('s2d.rememberLogin');
  } catch {
    /* ignore */
  }
}
