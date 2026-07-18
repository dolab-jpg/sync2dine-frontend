/** Shared Google (and generic) OAuth popup + postMessage handshake. */

export type OAuthPopupResult =
  | { ok: true; email?: string; provider?: string }
  | { ok: false; error: string };

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Open an OAuth authorize URL in a popup and wait for a typed postMessage.
 * Origin is not strictly enforced so local SPA (:5174) + API (:3001) still works;
 * the message `type` must match exactly.
 */
export function openOAuthPopup(
  authUrl: string,
  options: {
    messageType: string;
    /** @deprecated Prefer messageType-only validation for split SPA/API origins */
    expectedOrigin?: string;
    timeoutMs?: number;
    windowName?: string;
  },
): Promise<OAuthPopupResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const width = 520;
  const height = 680;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;

  const popup = window.open(authUrl, options.windowName || 'google_oauth', features);
  if (!popup) {
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'D',location:'googlePopupOAuth.ts:blocked',message:'popup blocked',data:{messageType:options.messageType},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return Promise.resolve({
      ok: false,
      error: 'Popup blocked — allow popups for this site and try again',
    });
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: OAuthPopupResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      clearTimeout(timeoutId);
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'D',location:'googlePopupOAuth.ts:finish',message:'popup finish',data:{ok:result.ok,error:result.ok?null:result.error,messageType:options.messageType},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      try {
        popup.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const msg = data as { type?: string; ok?: boolean; email?: string; provider?: string; error?: string };
      if (msg.type !== options.messageType) return;
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'D',location:'googlePopupOAuth.ts:onMessage',message:'oauth postMessage received',data:{origin:event.origin,ok:Boolean(msg.ok),hasError:Boolean(msg.error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (options.expectedOrigin && event.origin !== options.expectedOrigin) {
        // Allow API host when SPA and API differ (e.g. :5174 vs :3001)
        try {
          const apiOrigin = new URL(authUrl).origin;
          if (event.origin !== apiOrigin) return;
        } catch {
          return;
        }
      }
      if (msg.ok) {
        finish({ ok: true, email: msg.email || undefined, provider: msg.provider || undefined });
      } else {
        finish({ ok: false, error: msg.error || 'OAuth failed' });
      }
    };

    window.addEventListener('message', onMessage);

    const closedPoll = window.setInterval(() => {
      if (popup.closed && !settled) {
        finish({ ok: false, error: 'Sign-in window closed before completing' });
      }
    }, 500);

    const timeoutId = window.setTimeout(() => {
      finish({ ok: false, error: 'Sign-in timed out — try again' });
    }, timeoutMs);
  });
}
