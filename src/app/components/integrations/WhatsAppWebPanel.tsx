/**
 * WhatsAppWebPanel — admin UI for WWeb.js QR connection.
 * Live API must hit backend with handleWWebRoutes (same-origin /api/whatsapp-web/*).
 * No nginx change needed — Plesk reverse-proxy already forwards /api to the Node backend.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Loader2, LogOut, RefreshCw, Smartphone, Wifi, WifiOff, CheckCheck, Check, MessageSquare, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface WWebStatus {
  status: 'disconnected' | 'qr_pending' | 'authenticated' | 'ready';
  info?: {
    pushname?: string;
    wid?: string;
    platform?: string;
    phone?: string;
  } | null;
}

interface QRResponse {
  qr: string | null;
  qrImageDataUrl?: string | null;
  status: string;
  error?: string;
}

const API = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

export function WhatsAppWebPanel() {
  const [wwebStatus, setWwebStatus] = useState<WWebStatus>({ status: 'disconnected' });
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/whatsapp-web/status`);
      const data = await res.json() as WWebStatus;
      setWwebStatus(data);
      return data.status;
    } catch {
      return 'disconnected';
    }
  }, []);

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/whatsapp-web/qr`);
      const data = await res.json() as QRResponse;
      setQrData(data.qr);
      setQrImageUrl(data.qrImageDataUrl ?? null);
      if (data.error) setLastError(data.error);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void fetchStatus();

    pollRef.current = setInterval(async () => {
      const status = await fetchStatus();
      if (status === 'qr_pending') {
        await fetchQR();
      } else {
        setQrData(null);
        setQrImageUrl(null);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus, fetchQR]);

  const handleReconnect = async () => {
    setLoading(true);
    setLastError(null);
    try {
      await fetch(`${API}/api/whatsapp-web/reconnect`, { method: 'POST' });
      toast.success('Reconnecting — QR code will appear shortly');
      await new Promise(r => setTimeout(r, 2000));
      await fetchStatus();
      await fetchQR();
    } catch {
      toast.error('Failed to reconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/whatsapp-web/logout`, { method: 'POST' });
      toast.success('WhatsApp disconnected');
      setWwebStatus({ status: 'disconnected' });
      setQrData(null);
      setQrImageUrl(null);
      setLastError(null);
    } catch {
      toast.error('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = {
    disconnected: 'bg-red-100 text-red-800',
    qr_pending: 'bg-amber-100 text-amber-800',
    authenticated: 'bg-blue-100 text-blue-800',
    ready: 'bg-green-100 text-green-800',
  }[wwebStatus.status];

  const statusLabel = {
    disconnected: 'Disconnected',
    qr_pending: 'Waiting for QR scan',
    authenticated: 'Authenticating...',
    ready: 'Connected',
  }[wwebStatus.status];

  const StatusIcon = wwebStatus.status === 'ready' ? Wifi : wwebStatus.status === 'disconnected' ? WifiOff : Loader2;

  const qrImgSrc = qrImageUrl
    || (qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}` : null);

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
              <Badge className={statusColor}>{statusLabel}</Badge>
            </div>
            <p className="text-sm text-gray-600">
              Personal WhatsApp connected via QR code. Same AI brain, all tools, multi-language.
            </p>
          </div>
        </div>

        {wwebStatus.status === 'ready' && wwebStatus.info && (
          <div className="p-4 bg-white rounded-xl border border-green-200 space-y-2">
            <div className="flex items-center gap-2 text-green-700">
              <Smartphone className="w-4 h-4" />
              <span className="font-medium">Connected as {wwebStatus.info.pushname || 'Unknown'}</span>
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
              <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Sent</span>
              <span className="flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Delivered</span>
              <span className="flex items-center gap-1 text-blue-500"><CheckCheck className="w-3 h-3" /> Read</span>
            </div>
          </div>
        )}

        {wwebStatus.status === 'qr_pending' && qrImgSrc && (
          <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl border-2 border-dashed border-green-300">
            <p className="text-sm font-medium text-gray-700">Scan with WhatsApp on your phone</p>
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <img
                src={qrImgSrc}
                alt="WhatsApp QR Code"
                className="w-64 h-64"
              />
            </div>
            <ol className="text-xs text-gray-500 space-y-1 text-center">
              <li>1. Open WhatsApp on your phone</li>
              <li>2. Tap Menu or Settings &gt; Linked Devices</li>
              <li>3. Tap Link a Device</li>
              <li>4. Point your phone at this QR code</li>
            </ol>
          </div>
        )}

        {wwebStatus.status === 'qr_pending' && !qrData && (
          <div className="flex items-center justify-center gap-2 p-6 text-amber-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating QR code...</span>
          </div>
        )}

        {wwebStatus.status === 'authenticated' && (
          <div className="flex items-center justify-center gap-2 p-6 text-blue-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Authenticated — syncing chats...</span>
          </div>
        )}

        {wwebStatus.status === 'disconnected' && (
          <div className="p-4 bg-gray-50 rounded-xl border text-center space-y-3">
            <StatusIcon className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-sm text-gray-600">WhatsApp is not connected. Click below to start.</p>
            {lastError && (
              <p className="text-xs text-red-600">{lastError}</p>
            )}
          </div>
        )}

        {/* Fix 6C: Fallback link when disconnected with error after reconnect */}
        {wwebStatus.status === 'disconnected' && lastError && (
          <div className="border rounded-lg overflow-hidden">
            <button
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
                  Note: The production AI path still requires WWeb.js QR pairing above.
                  The browser tab is for manual message checking only.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {wwebStatus.status === 'disconnected' && (
            <Button onClick={handleReconnect} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
              Connect WhatsApp
            </Button>
          )}
          {wwebStatus.status === 'ready' && (
            <>
              <Button variant="outline" onClick={handleReconnect} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Reconnect
              </Button>
              <Button variant="destructive" onClick={handleLogout} disabled={loading}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </>
          )}
          {wwebStatus.status === 'qr_pending' && (
            <Button variant="outline" onClick={handleLogout} disabled={loading}>
              <LogOut className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p>Messages from customers are processed by Cynthia AI with all existing tools (quotes, contracts, pricing, etc.).</p>
          <p>Read receipts (blue ticks) are tracked automatically.</p>
        </div>
      </CardContent>
    </Card>
  );
}
