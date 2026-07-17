import { useCallback, useEffect, useRef, useState } from 'react';

export type LiveListenStatus = 'idle' | 'connecting' | 'listening' | 'error';

/**
 * Page-bound live listen-in via Vapi monitor WebSocket (PCM).
 * Cleans up on unmount / route leave — no sticky dock.
 */
export function useLiveCallAudio(listenUrl?: string | null) {
  const [status, setStatus] = useState<LiveListenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
    nextTimeRef.current = 0;
    setStatus('idle');
    setError(null);
  }, []);

  const start = useCallback(async () => {
    if (!listenUrl || !/^wss?:\/\//i.test(listenUrl)) {
      setError('Live audio not available for this call');
      setStatus('error');
      return;
    }
    stop();
    activeRef.current = true;
    setStatus('connecting');
    setError(null);

    try {
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      nextTimeRef.current = ctx.currentTime + 0.05;

      const ws = new WebSocket(listenUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (!activeRef.current) return;
        setStatus('listening');
      };
      ws.onerror = () => {
        if (!activeRef.current) return;
        setError('Could not connect to live audio');
        setStatus('error');
      };
      ws.onclose = () => {
        if (!activeRef.current) return;
        setStatus((s) => (s === 'listening' ? 'idle' : s));
      };
      ws.onmessage = (ev) => {
        if (!activeRef.current || !ctxRef.current) return;
        const data = ev.data;
        if (!(data instanceof ArrayBuffer) && !(data instanceof Blob)) return;
        void (async () => {
          const buf = data instanceof Blob ? await data.arrayBuffer() : data;
          if (!activeRef.current || !ctxRef.current) return;
          // Vapi listen stream: 16-bit little-endian PCM mono @ 16kHz
          const samples = new Int16Array(buf);
          if (!samples.length) return;
          const float = new Float32Array(samples.length);
          for (let i = 0; i < samples.length; i++) {
            float[i] = samples[i] / 32768;
          }
          const audioBuf = ctxRef.current.createBuffer(1, float.length, 16000);
          audioBuf.copyToChannel(float, 0);
          const src = ctxRef.current.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctxRef.current.destination);
          const startAt = Math.max(ctxRef.current.currentTime + 0.02, nextTimeRef.current);
          src.start(startAt);
          nextTimeRef.current = startAt + audioBuf.duration;
        })();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Listen failed');
      setStatus('error');
      stop();
    }
  }, [listenUrl, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    status,
    error,
    isListening: status === 'listening' || status === 'connecting',
    start,
    stop,
    canListen: Boolean(listenUrl && /^wss?:\/\//i.test(listenUrl)),
  };
}
