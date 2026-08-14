import { useCallback, useEffect, useRef, useState } from 'react';

export type LiveListenStatus = 'idle' | 'connecting' | 'listening' | 'error';

/** Vapi monitor.listenUrl streams raw PCM s16le mono @ 16 kHz. */
const SOURCE_SAMPLE_RATE = 16000;

function pcm16ToFloat32(bytes: ArrayBuffer): Float32Array {
  const frameBytes = bytes.byteLength - (bytes.byteLength % 2);
  const view = new Int16Array(frameBytes === bytes.byteLength ? bytes : bytes.slice(0, frameBytes));
  const float = new Float32Array(view.length);
  for (let i = 0; i < view.length; i++) {
    float[i] = view[i] / 32768;
  }
  return float;
}

/** Linear resample PCM from sourceRate → targetRate. */
function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate || input.length === 0) return input;
  const ratio = sourceRate / targetRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = srcPos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

/**
 * Some monitor transports deliver interleaved stereo. Playing that as mono
 * at 16 kHz sounds half-speed and deep. Detect via L/R energy imbalance.
 */
function maybeDownmixStereo(monoOrStereo: Float32Array): Float32Array {
  if (monoOrStereo.length < 64 || monoOrStereo.length % 2 !== 0) return monoOrStereo;
  let energyL = 0;
  let energyR = 0;
  let energyMono = 0;
  const n = Math.min(monoOrStereo.length, 8000);
  for (let i = 0; i + 1 < n; i += 2) {
    const l = monoOrStereo[i];
    const r = monoOrStereo[i + 1];
    energyL += l * l;
    energyR += r * r;
    energyMono += l * l; // every sample as mono (same buffer)
  }
  const frames = n / 2;
  // True stereo: channels differ; fake "stereo from mono pairs" has nearly equal L/R and high lag-1 correlation.
  const ratio = Math.sqrt((energyL + 1e-12) / (energyR + 1e-12));
  const imbalanced = ratio > 2.5 || ratio < 0.4;
  // Alternate-sample correlation: stereo speech often has weaker even/odd correlation than upsampled mono.
  let corr = 0;
  let den = 0;
  for (let i = 0; i + 1 < n; i += 2) {
    corr += monoOrStereo[i] * monoOrStereo[i + 1];
    den += monoOrStereo[i] * monoOrStereo[i] + monoOrStereo[i + 1] * monoOrStereo[i + 1];
  }
  const normCorr = (2 * corr) / (den + 1e-12);
  // Prefer downmix when channels are clearly split (agent vs caller), not when it's just mono.
  if (!imbalanced && normCorr > 0.85) return monoOrStereo;

  if (!imbalanced) return monoOrStereo;

  const out = new Float32Array(frames);
  for (let i = 0, o = 0; i + 1 < monoOrStereo.length; i += 2, o++) {
    out[o] = (monoOrStereo[i] + monoOrStereo[i + 1]) * 0.5;
  }
  // Guard: if downmix is near-silent but "mono" wasn't, keep original.
  let eDown = 0;
  for (let i = 0; i < out.length; i++) eDown += out[i] * out[i];
  if (eDown * 2 < energyMono * 0.05) return monoOrStereo;
  return out;
}

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
  const stereoModeRef = useRef<'unknown' | 'mono' | 'stereo'>('unknown');
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConnectTimer = useCallback(() => {
    if (connectTimerRef.current !== null) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    clearConnectTimer();
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
    stereoModeRef.current = 'unknown';
    setStatus('idle');
    setError(null);
  }, [clearConnectTimer]);

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
      // Use the device's native rate, then resample 16 kHz PCM up.
      // Forcing { sampleRate: 16000 } is often ignored and has caused slow/deep playback.
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      nextTimeRef.current = ctx.currentTime + 0.05;
      stereoModeRef.current = 'unknown';

      const ws = new WebSocket(listenUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      // Dead/zombie calls never fire onopen — fail fast instead of "Connecting…" forever.
      clearConnectTimer();
      connectTimerRef.current = setTimeout(() => {
        connectTimerRef.current = null;
        if (!activeRef.current) return;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        setError('Call ended or audio unavailable');
        setStatus('error');
      }, 5000);

      ws.onopen = () => {
        clearConnectTimer();
        if (!activeRef.current) return;
        setStatus('listening');
      };
      ws.onerror = () => {
        clearConnectTimer();
        if (!activeRef.current) return;
        setError('Could not connect to live audio');
        setStatus('error');
      };
      ws.onclose = () => {
        clearConnectTimer();
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
          if (buf.byteLength < 4) return;

          let pcm = pcm16ToFloat32(buf);

          if (stereoModeRef.current === 'unknown') {
            const down = maybeDownmixStereo(pcm);
            if (down !== pcm) {
              stereoModeRef.current = 'stereo';
              pcm = down;
            } else {
              stereoModeRef.current = 'mono';
            }
          } else if (stereoModeRef.current === 'stereo') {
            const frames = Math.floor(pcm.length / 2);
            const mixed = new Float32Array(frames);
            for (let i = 0, o = 0; o < frames; i += 2, o++) {
              mixed[o] = (pcm[i] + pcm[i + 1]) * 0.5;
            }
            pcm = mixed;
          }

          const targetRate = ctxRef.current.sampleRate || SOURCE_SAMPLE_RATE;
          const rendered = resampleLinear(pcm, SOURCE_SAMPLE_RATE, targetRate);
          if (!rendered.length) return;

          const audioBuf = ctxRef.current.createBuffer(1, rendered.length, targetRate);
          audioBuf.copyToChannel(rendered, 0);
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
  }, [listenUrl, stop, clearConnectTimer]);

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
