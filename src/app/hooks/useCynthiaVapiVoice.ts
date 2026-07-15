/**
 * Start/stop the same Vapi Cynthia assistant used on phone calls.
 * Does NOT use Whisper / OpenAI TTS — audio stays on Vapi + ElevenLabs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type CynthiaVapiStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'pin_required'
  | 'ended'
  | 'unavailable';

type WebSessionResponse = {
  ok?: boolean;
  publicKey?: string;
  region?: string;
  callId?: string;
  assistant?: Record<string, unknown>;
  error?: string;
  code?: string;
  identity?: { kind?: string; userId?: string | null };
};

function orgHeaders(userId: string): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'X-User-Id': userId };
  try {
    const orgId = localStorage.getItem('tradepro_active_org_id') || localStorage.getItem('activeOrgId');
    if (orgId) h['X-Org-Id'] = orgId;
  } catch { /* ignore */ }
  return h;
}

export function useCynthiaVapiVoice(opts: {
  userId: string;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onStatusMessage?: (message: string) => void;
}) {
  const [status, setStatus] = useState<CynthiaVapiStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const vapiRef = useRef<{ stop?: () => void; start?: (a: unknown) => Promise<void> } | null>(null);
  const onTranscriptRef = useRef(opts.onTranscript);
  const onStatusRef = useRef(opts.onStatusMessage);
  onTranscriptRef.current = opts.onTranscript;
  onStatusRef.current = opts.onStatusMessage;

  const stop = useCallback(async () => {
    try {
      vapiRef.current?.stop?.();
    } catch { /* ignore */ }
    vapiRef.current = null;
    setStatus((s) => (s === 'idle' ? s : 'ended'));
    setCallId(null);
  }, []);

  useEffect(() => () => { void stop(); }, [stop]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    try {
      const res = await fetch('/api/vapi/web-session', {
        method: 'POST',
        headers: orgHeaders(opts.userId),
        body: JSON.stringify({ userId: opts.userId }),
      });
      const data = (await res.json()) as WebSessionResponse;
      if (!res.ok || !data.publicKey || !data.assistant) {
        const msg = data.error || 'Cynthia voice is not connected';
        setError(msg);
        setStatus(data.code === 'provider_unavailable' ? 'unavailable' : 'ended');
        onStatusRef.current?.(msg);
        return;
      }

      setCallId(data.callId || null);
      // Dynamic import keeps desktop bundle optional if SDK missing in older installs
      const mod = await import('@vapi-ai/web');
      const Vapi = (mod as { default: new (key: string, opts?: { apiBaseUrl?: string }) => {
        on: (event: string, cb: (...args: unknown[]) => void) => void;
        start: (assistant: unknown) => Promise<void>;
        stop: () => void;
      } }).default;

      const apiBaseUrl = data.region === 'us' ? 'https://api.vapi.ai' : 'https://api.eu.vapi.ai';
      const vapi = new Vapi(data.publicKey, { apiBaseUrl });
      vapiRef.current = vapi;

      vapi.on('call-start', () => setStatus('listening'));
      vapi.on('call-end', () => setStatus('ended'));
      vapi.on('speech-start', () => setStatus('speaking'));
      vapi.on('speech-end', () => setStatus('listening'));
      vapi.on('message', (raw: unknown) => {
        const msg = raw as {
          type?: string;
          role?: string;
          transcript?: string;
          transcriptType?: string;
        };
        if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
          const role = msg.role === 'assistant' ? 'assistant' : 'user';
          onTranscriptRef.current?.(role, msg.transcript);
          if (role === 'user' && (/\b(pin|code|security)\b/i.test(msg.transcript) || /^\s*[\d\s]{3,12}\s*$/.test(msg.transcript || ''))) {
            setStatus('pin_required');
          }
        }
      });
      vapi.on('error', (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Vapi session error';
        setError(message);
        setStatus('ended');
        onStatusRef.current?.(message);
      });

      await vapi.start(data.assistant);
      setStatus('listening');
      onStatusRef.current?.('Cynthia is listening — say your four-digit code if needed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start Cynthia voice';
      setError(message);
      setStatus('unavailable');
      onStatusRef.current?.(message);
    }
  }, [opts.userId]);

  const toggle = useCallback(async () => {
    if (status === 'connecting' || status === 'listening' || status === 'speaking' || status === 'pin_required') {
      await stop();
      return;
    }
    await start();
  }, [start, stop, status]);

  return {
    status,
    error,
    callId,
    isActive: status === 'connecting' || status === 'listening' || status === 'speaking' || status === 'pin_required',
    start,
    stop,
    toggle,
  };
}
