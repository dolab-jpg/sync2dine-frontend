/**
 * WhatsAppWebPanel — admin UI for WWeb.js QR + embedded Chromium login.
 * Live API: same-origin /api/whatsapp-web/* (backend handleWWebRoutes).
 */
import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Loader2,
  LogOut,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  CheckCheck,
  Check,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';

type WWebStatusValue =
  | 'disconnected'
  | 'initializing'
  | 'qr_pending'
  | 'authenticated'
  | 'ready'
  | 'error';

interface WWebStatus {
  status: WWebStatusValue;
  info?: {
    pushname?: string;
    wid?: string;
    platform?: string;
    phone?: string;
  } | null;
  error?: string;
  browserLoginActive?: boolean;
  canSend?: boolean;
  debug?: {
    hasClient?: boolean;
    canSend?: boolean;
    sessionBrowserSkippedReinit?: boolean;
    hasPupPage?: boolean;
    ageSinceAuthMs?: number | null;
    lastLoadingPercent?: number | null;
    lastLoadingMessage?: string | null;
    usesExecutablePath?: boolean;
    usesWebVersionCache?: boolean;
    puppeteerArgs?: string[];
  };
}

interface QRResponse {
  qr: string | null;
  qrImageDataUrl?: string | null;
  status: string;
  error?: string;
}

const API = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

function wsUrlForPath(path: string): string {
  if (API) {
    const base = API.replace(/^http/, 'ws');
    return `${base}${path}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}

export function WhatsAppWebPanel() {
  const [wwebStatus, setWwebStatus] = useState<WWebStatus>({ status: 'disconnected' });
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [apiReachable, setApiReachable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [browserLogin, setBrowserLogin] = useState(false);
  const [browserFrame, setBrowserFrame] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const browserLoginRef = useRef(false);
  const prevStatusRef = useRef<WWebStatusValue | null>(null);
  const stoppingBrowserLoginRef = useRef(false);

  useEffect(() => {
    browserLoginRef.current = browserLogin;
  }, [browserLogin]);

  const toastConnectedOnce = useCallback((nextStatus: WWebStatusValue) => {
    if (nextStatus === 'ready' && prevStatusRef.current !== 'ready') {
      toast.success('WhatsApp connected');
    }
    prevStatusRef.current = nextStatus;
  }, []);

  const finishBrowserLogin = useCallback(() => {
    setBrowserLogin(false);
    setBrowserFrame(null);
    if (stoppingBrowserLoginRef.current) return;
    stoppingBrowserLoginRef.current = true;
    void fetch(`${API}/api/whatsapp-web/browser-login/stop`, { method: 'POST' })
      .catch(() => {
        /* ignore — UI is already closed */
      })
      .finally(() => {
        stoppingBrowserLoginRef.current = false;
      });
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/whatsapp-web/status`);
      if (!res.ok) {
        setApiReachable(false);
        setLastError(`Status HTTP ${res.status}`);
        return 'disconnected' as WWebStatusValue;
      }
      const data = (await res.json()) as WWebStatus;
      setApiReachable(true);
      setWwebStatus(data);
      // #region agent log
      fetch('http://127.0.0.1:7610/ingest/e809fe57-584f-4b4e-8cfb-f3dee6b9facf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0f60a'},body:JSON.stringify({sessionId:'d0f60a',runId:'post-fix',hypothesisId:'D',location:'WhatsAppWebPanel.tsx:fetchStatus',message:'wweb status poll',data:{status:data.status,canSend:(data as {canSend?:boolean}).canSend??null,hasPhone:Boolean(data.info?.phone),hasClient:data.debug?.hasClient??null,sessionBrowserSkippedReinit:data.debug?.sessionBrowserSkippedReinit??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (data.error) setLastError(data.error);
      else if (data.status === 'ready' || data.status === 'qr_pending') setLastError(null);
      toastConnectedOnce(data.status);
      if (data.status === 'ready') {
        // Connected sessions must not keep the live login panel open / toasting.
        if (browserLoginRef.current || data.browserLoginActive) {
          finishBrowserLogin();
        } else {
          setBrowserLogin(false);
          setBrowserFrame(null);
        }
      } else if (typeof data.browserLoginActive === 'boolean') {
        setBrowserLogin(data.browserLoginActive);
      }
      return data.status;
    } catch (err) {
      setApiReachable(false);
      setLastError(err instanceof Error ? err.message : 'Cannot reach WhatsApp API');
      return 'disconnected' as WWebStatusValue;
    }
  }, [finishBrowserLogin, toastConnectedOnce]);

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/whatsapp-web/qr`);
      const data = (await res.json()) as QRResponse;
      setQrData(data.qr);
      setQrImageUrl(data.qrImageDataUrl ?? null);
      if (data.error) setLastError(data.error);
      return data;
    } catch {
      return null;
    }
  }, []);

  const fetchBrowserFrame = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/whatsapp-web/browser-login/frame`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        frame: string | null;
        status: WWebStatusValue;
        active: boolean;
        error?: string;
      };
      if (data.error) setLastError(data.error);
      if (data.status) {
        setWwebStatus((prev) => ({ ...prev, status: data.status }));
        toastConnectedOnce(data.status);
      }
      if (data.status === 'ready') {
        finishBrowserLogin();
        return;
      }
      if (data.frame) setBrowserFrame(data.frame);
      setBrowserLogin(data.active);
    } catch {
      /* ignore frame poll errors */
    }
  }, [finishBrowserLogin, toastConnectedOnce]);

  const stopWs = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
  }, []);

  const startWs = useCallback(() => {
    stopWs();
    try {
      const ws = new WebSocket(wsUrlForPath('/api/whatsapp-web/browser-login/stream'));
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type: string;
            data?: string;
            status?: WWebStatusValue;
          };
          if (msg.type === 'frame' && msg.data) {
            setBrowserFrame(`data:image/jpeg;base64,${msg.data}`);
          }
          if (msg.status) {
            setWwebStatus((prev) => ({ ...prev, status: msg.status! }));
            toastConnectedOnce(msg.status);
            if (msg.status === 'ready') {
              finishBrowserLogin();
            }
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        /* frame poll is the fallback */
      };
    } catch {
      /* proxy may block WS — poll still works */
    }
  }, [finishBrowserLogin, stopWs, toastConnectedOnce]);

  useEffect(() => {
    void fetchStatus();

    pollRef.current = setInterval(async () => {
      const status = await fetchStatus();
      if (status === 'qr_pending') {
        await fetchQR();
      } else if (status !== 'initializing') {
        setQrData(null);
        setQrImageUrl(null);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (framePollRef.current) clearInterval(framePollRef.current);
      stopWs();
    };
  }, [fetchStatus, fetchQR, stopWs]);

  useEffect(() => {
    if (browserLogin) {
      startWs();
      framePollRef.current = setInterval(() => {
        void fetchBrowserFrame();
      }, 1500);
      return () => {
        if (framePollRef.current) clearInterval(framePollRef.current);
        stopWs();
      };
    }
    stopWs();
    if (framePollRef.current) {
      clearInterval(framePollRef.current);
      framePollRef.current = null;
    }
    return undefined;
  }, [browserLogin, startWs, stopWs, fetchBrowserFrame]);

  const handleReconnect = async (fresh = false) => {
    setLoading(true);
    setLastError(null);
    try {
      const q = fresh ? '?fresh=1' : '';
      const res = await fetch(`${API}/api/whatsapp-web/reconnect${q}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(
        fresh
          ? 'Fresh reconnect — new QR will appear shortly'
          : 'Reconnecting — QR code will appear shortly'
      );
      await new Promise((r) => setTimeout(r, 2000));
      await fetchStatus();
      await fetchQR();
    } catch (err) {
      toast.error('Failed to reconnect');
      setLastError(err instanceof Error ? err.message : 'Reconnect failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserLogin = async (fresh = true) => {
    setLoading(true);
    setLastError(null);
    setBrowserFrame(null);
    prevStatusRef.current = null;
    try {
      const res = await fetch(`${API}/api/whatsapp-web/browser-login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fresh }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; status?: string };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setBrowserLogin(true);
      toast.success('Login browser started — scan the QR in the live view');
      await fetchStatus();
    } catch (err) {
      toast.error('Could not start login browser');
      setLastError(err instanceof Error ? err.message : 'Browser login failed');
      setBrowserLogin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStopBrowserLogin = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/whatsapp-web/browser-login/stop`, { method: 'POST' });
      setBrowserLogin(false);
      setBrowserFrame(null);
      stopWs();
      await fetchStatus();
    } catch {
      toast.error('Failed to stop login browser');
    } finally {
      setLoading(false);
    }
  };

  const handleFrameClick = (e: MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'click', x, y }));
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/whatsapp-web/logout`, { method: 'POST' });
      toast.success('WhatsApp disconnected');
      prevStatusRef.current = 'disconnected';
      setWwebStatus({ status: 'disconnected' });
      setQrData(null);
      setQrImageUrl(null);
      setLastError(null);
      setBrowserLogin(false);
      setBrowserFrame(null);
    } catch {
      toast.error('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<WWebStatusValue, string> = {
    disconnected: 'bg-red-100 text-red-800',
    initializing: 'bg-amber-100 text-amber-800',
    qr_pending: 'bg-amber-100 text-amber-800',
    authenticated: 'bg-blue-100 text-blue-800',
    ready: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  };

  const statusLabel: Record<WWebStatusValue, string> = {
    disconnected: 'Disconnected',
    initializing: 'Starting…',
    qr_pending: 'Waiting for QR scan',
    authenticated: 'Authenticating...',
    ready: 'Connected',
    error: 'Error',
  };

  const StatusIcon =
    wwebStatus.status === 'ready'
      ? Wifi
      : wwebStatus.status === 'disconnected' || wwebStatus.status === 'error'
        ? WifiOff
        : Loader2;

  const qrImgSrc =
    qrImageUrl ||
    (qrData
      ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}`
      : null);

  return (
    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-600 rounded-xl text-white">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg">WhatsApp Web</h3>
              <Badge className={statusColor[wwebStatus.status] ?? statusColor.disconnected}>
                {wwebStatus.status === 'ready' && wwebStatus.canSend === false
                  ? 'Connected (not sendable)'
                  : statusLabel[wwebStatus.status] ?? wwebStatus.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              Personal WhatsApp via QR or live browser login. No Business API required.
            </p>
          </div>
        </div>

        {!apiReachable && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            Cannot reach WhatsApp API ({API || 'same-origin'}). Check that the backend is running.
            {lastError ? ` — ${lastError}` : ''}
          </div>
        )}

        {wwebStatus.status === 'ready' && wwebStatus.info && (
          <div className="p-4 bg-white rounded-xl border border-green-200 space-y-2">
            <div className="flex items-center gap-2 text-green-700">
              <Smartphone className="w-4 h-4" />
              <span className="font-medium">
                Connected as {wwebStatus.info.pushname || 'Unknown'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              {wwebStatus.info.phone && (
                <div>
                  <Label className="text-xs text-gray-400">Phone</Label>
                  <p>+{wwebStatus.info.phone}</p>
                </div>
              )}
              {wwebStatus.info.platform && (
                <div>
                  <Label className="text-xs text-gray-400">Platform</Label>
                  <p className="capitalize">{wwebStatus.info.platform}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" /> Sent
              </span>
              <span className="flex items-center gap-1">
                <CheckCheck className="w-3 h-3" /> Delivered
              </span>
              <span className="flex items-center gap-1 text-blue-500">
                <CheckCheck className="w-3 h-3" /> Read
              </span>
            </div>
          </div>
        )}

        {browserLogin && (
          <div className="space-y-2 p-3 bg-white rounded-xl border-2 border-green-300">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Live WhatsApp Web (scan QR here)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleStopBrowserLogin()}
                disabled={loading}
              >
                Close browser
              </Button>
            </div>
            {browserFrame ? (
              <img
                ref={frameImgRef}
                src={browserFrame}
                alt="WhatsApp Web live view"
                className="w-full max-w-xl mx-auto rounded-lg border cursor-crosshair bg-black"
                onClick={handleFrameClick}
              />
            ) : (
              <div className="flex items-center justify-center gap-2 p-10 text-amber-700">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading WhatsApp Web…</span>
              </div>
            )}
            <p className="text-xs text-gray-500 text-center">
              Use Linked Devices on your phone to scan. Click the view if WhatsApp asks for a
              confirmation step.
            </p>
          </div>
        )}

        {!browserLogin && wwebStatus.status === 'qr_pending' && qrImgSrc && (
          <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl border-2 border-dashed border-green-300">
            <p className="text-sm font-medium text-gray-700">Scan with WhatsApp on your phone</p>
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <img src={qrImgSrc} alt="WhatsApp QR Code" className="w-64 h-64" />
            </div>
            <ol className="text-xs text-gray-500 space-y-1 text-center">
              <li>1. Open WhatsApp on your phone</li>
              <li>2. Tap Menu or Settings &gt; Linked Devices</li>
              <li>3. Tap Link a Device</li>
              <li>4. Point your phone at this QR code</li>
            </ol>
          </div>
        )}

        {!browserLogin && wwebStatus.status === 'qr_pending' && !qrData && (
          <div className="flex items-center justify-center gap-2 p-6 text-amber-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating QR code...</span>
          </div>
        )}

        {(wwebStatus.status === 'initializing' || wwebStatus.status === 'authenticated') &&
          !browserLogin && (
            <div className="flex items-center justify-center gap-2 p-6 text-blue-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {wwebStatus.status === 'initializing'
                  ? 'Starting WhatsApp client…'
                  : 'Authenticated — syncing chats...'}
              </span>
            </div>
          )}

        {(wwebStatus.status === 'disconnected' || wwebStatus.status === 'error') &&
          !browserLogin && (
            <div className="p-4 bg-gray-50 rounded-xl border text-center space-y-3">
              <StatusIcon className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm text-gray-600">
                WhatsApp is not connected. Connect with QR, or open the live login browser.
              </p>
              {lastError && <p className="text-xs text-red-600 break-words">{lastError}</p>}
            </div>
          )}

        {(wwebStatus.status === 'disconnected' || wwebStatus.status === 'error') && lastError && (
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFallback(!showFallback)}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <span>Manual fallback options</span>
              {showFallback ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showFallback && (
              <div className="px-4 pb-3 text-xs text-gray-500 space-y-2">
                <a
                  href="https://web.whatsapp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-green-700 hover:underline font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open WhatsApp Web in new tab
                </a>
                <p>
                  The production AI path still needs pairing via Connect or Login browser above.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(wwebStatus.status === 'disconnected' || wwebStatus.status === 'error') &&
            !browserLogin && (
              <>
                <Button
                  onClick={() => void handleReconnect(false)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4 mr-2" />
                  )}
                  Connect WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleBrowserLogin(true)}
                  disabled={loading}
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  Open login browser
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void handleReconnect(true)}
                  disabled={loading}
                >
                  Fresh session
                </Button>
              </>
            )}
          {wwebStatus.status === 'ready' && (
            <>
              <Button variant="outline" onClick={() => void handleReconnect(false)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Reconnect
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleBrowserLogin(true)}
                disabled={loading}
              >
                <Monitor className="w-4 h-4 mr-2" />
                Relink in browser
              </Button>
              <Button variant="destructive" onClick={() => void handleLogout()} disabled={loading}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </>
          )}
          {(wwebStatus.status === 'qr_pending' || wwebStatus.status === 'initializing') &&
            !browserLogin && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleBrowserLogin(false)}
                  disabled={loading}
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  Open login browser
                </Button>
                <Button variant="outline" onClick={() => void handleLogout()} disabled={loading}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>
            Messages from customers are processed by Cynthia AI with existing tools.
          </p>
          <p>Read receipts (blue ticks) are tracked automatically.</p>
        </div>
      </CardContent>
    </Card>
  );
}
