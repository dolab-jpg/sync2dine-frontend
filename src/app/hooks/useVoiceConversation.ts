import { useCallback, useEffect, useRef, useState } from 'react';
import {
  JUDIE_VOICE_ID,
  createMediaRecorder,
  mediaRecorderAvailable,
  rmsFromAnalyser,
  stopStream,
  transcribeBlob,
} from './voiceRecord';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface UseVoiceConversationOptions {
  /** Send a transcript to the assistant and resolve with the spoken reply. */
  onUserMessage: (text: string) => Promise<string | undefined>;
  onError?: (message: string) => void;
}

const SPEECH_RMS = 0.045;
const SILENCE_MS = 800;
const MIN_SPEECH_MS = 400;
const MAX_UTTERANCE_MS = 20_000;
const POLL_MS = 50;

/**
 * Hands-free, ChatGPT-style voice loop: listen → send → speak (Judie) → listen again.
 * Mic is paused while the assistant speaks to avoid echo; tap-to-interrupt
 * stops playback and resumes listening.
 */
export function useVoiceConversation({ onUserMessage, onError }: UseVoiceConversationOptions) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [active, setActive] = useState(false);
  const [lastUser, setLastUser] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const interruptedRef = useRef(false);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const listenGenRef = useRef(0);

  const onUserMessageRef = useRef(onUserMessage);
  const onErrorRef = useRef(onError);
  useEffect(() => { onUserMessageRef.current = onUserMessage; }, [onUserMessage]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const isSupported = mediaRecorderAvailable();

  const clearVad = useCallback(() => {
    if (vadTimerRef.current != null) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch { /* already stopped */ }
    }
  }, []);

  const teardownMic = useCallback(() => {
    clearVad();
    stopRecorder();
    stopStream(streamRef.current);
    streamRef.current = null;
    chunksRef.current = [];
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, [clearVad, stopRecorder]);

  const stopAudio = useCallback(() => {
    interruptedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  const playAudioBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      if (interruptedRef.current || !activeRef.current) {
        resolve();
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      const finish = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;
      void audio.play().catch(finish);
    });
  }, []);

  const fetchJudieTts = useCallback(async (text: string): Promise<Blob | null> => {
    const body = JSON.stringify({ text, voiceId: JUDIE_VOICE_ID });
    const headers = { 'Content-Type': 'application/json' };
    const tryAgent = await fetch('/api/agent/tts', { method: 'POST', headers, body });
    if (tryAgent.ok) return tryAgent.blob();
    const tryAi = await fetch('/api/ai/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voice: JUDIE_VOICE_ID }),
    });
    if (tryAi.ok) return tryAi.blob();
    return null;
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text || interruptedRef.current || !activeRef.current) return;
    const blob = await fetchJudieTts(text);
    if (blob && !interruptedRef.current && activeRef.current) {
      await playAudioBlob(blob);
      return;
    }
    if (!('speechSynthesis' in window) || interruptedRef.current) return;
    await new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }, [fetchJudieTts, playAudioBlob]);

  const speakChunked = useCallback(async (text: string): Promise<void> => {
    const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (parts.length === 0) return;
    setStatus('speaking');
    interruptedRef.current = false;
    for (const part of parts) {
      if (!activeRef.current || interruptedRef.current) return;
      await speak(part);
    }
  }, [speak]);

  const collectStoppedBlob = useCallback((rec: MediaRecorder, chunks: Blob[]): Promise<Blob> => {
    return new Promise((resolve) => {
      rec.onstop = () => {
        resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      try {
        if (rec.state !== 'inactive') rec.stop();
        else resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      } catch {
        resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      }
    });
  }, []);

  const startListening = useCallback(async () => {
    if (!activeRef.current || processingRef.current) return;
    const gen = ++listenGenRef.current;
    teardownMic();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('Microphone permission denied — allow the mic and try again');
        activeRef.current = false;
        setActive(false);
        setStatus('idle');
        return;
      }
      onErrorRef.current?.('Could not start microphone');
      window.setTimeout(() => {
        if (activeRef.current && listenGenRef.current === gen) void startListening();
      }, 800);
      return;
    }

    if (!activeRef.current || listenGenRef.current !== gen) {
      stopStream(stream);
      return;
    }

    streamRef.current = stream;
    const recorder = createMediaRecorder(stream);
    const chunks: Blob[] = [];
    chunksRef.current = chunks;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start(200);
    setStatus('listening');

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));

    let speaking = false;
    let speechStartedAt = 0;
    let lastLoudAt = 0;
    const loopStartedAt = Date.now();

    const finishUtterance = async () => {
      if (processingRef.current || listenGenRef.current !== gen) return;
      clearVad();
      const rec = recorderRef.current;
      recorderRef.current = null;
      const blob = rec
        ? await collectStoppedBlob(rec, chunks)
        : new Blob(chunks, { type: 'audio/webm' });
      teardownMic();
      if (!activeRef.current || listenGenRef.current !== gen) return;

      if (blob.size < 800) {
        window.setTimeout(() => {
          if (activeRef.current) void startListening();
        }, 250);
        return;
      }

      processingRef.current = true;
      setStatus('thinking');
      try {
        const text = await transcribeBlob(blob);
        if (!activeRef.current || listenGenRef.current !== gen) return;
        if (!text) {
          processingRef.current = false;
          void startListening();
          return;
        }
        setLastUser(text);
        const reply = await onUserMessageRef.current(text);
        if (!activeRef.current || listenGenRef.current !== gen) return;
        if (reply) {
          setStatus('speaking');
          await speakChunked(reply);
        }
      } catch (err) {
        onErrorRef.current?.(err instanceof Error ? err.message : 'Voice recognition failed');
      } finally {
        processingRef.current = false;
        if (activeRef.current && listenGenRef.current === gen) {
          void startListening();
        } else if (!activeRef.current) {
          setStatus('idle');
        }
      }
    };

    vadTimerRef.current = window.setInterval(() => {
      if (!activeRef.current || listenGenRef.current !== gen || processingRef.current) {
        clearVad();
        return;
      }
      const rms = rmsFromAnalyser(analyser, buffer);
      const now = Date.now();
      if (rms >= SPEECH_RMS) {
        if (!speaking) {
          speaking = true;
          speechStartedAt = now;
        }
        lastLoudAt = now;
      }
      if (speaking && now - lastLoudAt >= SILENCE_MS && now - speechStartedAt >= MIN_SPEECH_MS) {
        void finishUtterance();
        return;
      }
      if (now - loopStartedAt >= MAX_UTTERANCE_MS) {
        if (speaking) void finishUtterance();
        else {
          clearVad();
          teardownMic();
          window.setTimeout(() => {
            if (activeRef.current) void startListening();
          }, 200);
        }
      }
    }, POLL_MS);
  }, [clearVad, collectStoppedBlob, speakChunked, teardownMic]);

  const start = useCallback(() => {
    if (!isSupported) {
      onErrorRef.current?.('Hands-free voice needs a browser that can record audio');
      return;
    }
    activeRef.current = true;
    processingRef.current = false;
    interruptedRef.current = false;
    setActive(true);
    void startListening();
  }, [isSupported, startListening]);

  const stop = useCallback(() => {
    listenGenRef.current += 1;
    activeRef.current = false;
    processingRef.current = false;
    setActive(false);
    teardownMic();
    stopAudio();
    setStatus('idle');
  }, [stopAudio, teardownMic]);

  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    stopAudio();
    if (status === 'speaking') {
      processingRef.current = false;
      void startListening();
    }
  }, [status, stopAudio, startListening]);

  useEffect(() => () => { stop(); }, [stop]);

  return { status, active, lastUser, isSupported, start, stop, interrupt };
}
