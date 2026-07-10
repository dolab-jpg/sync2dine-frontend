import { useCallback, useEffect, useRef, useState } from 'react';
import { integrationService } from '../engine/integrations/integrationService';

interface SpeechRecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEvt {
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvt) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface UseVoiceConversationOptions {
  /** Send a transcript to the assistant and resolve with the spoken reply. */
  onUserMessage: (text: string) => Promise<string>;
}

/**
 * Hands-free, ChatGPT-style voice loop: listen → send → speak → listen again.
 * Mic is paused while the assistant speaks to avoid echo; tap-to-interrupt
 * stops playback and resumes listening. Reuses browser STT + OpenAI/browser TTS.
 * Structured so OpenAI Realtime (WebRTC) can replace the internals later.
 */
export function useVoiceConversation({ onUserMessage }: UseVoiceConversationOptions) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [active, setActive] = useState(false);
  const [lastUser, setLastUser] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);

  // Always call the latest callback so the loop never uses a stale chat history.
  const onUserMessageRef = useRef(onUserMessage);
  useEffect(() => { onUserMessageRef.current = onUserMessage; }, [onUserMessage]);

  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const playAudioBlob = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      void audio.play();
    });
  }, []);

  const fetchTts = useCallback(async (text: string): Promise<Blob | null> => {
    const openaiConfig = integrationService.getConfig('openai');
    const res = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: openaiConfig.ttsVoice || 'fable',
        apiKey: openaiConfig.apiKey || undefined,
      }),
    });
    if (!res.ok) return null;
    return res.blob();
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!text) { resolve(); return; }

      const browserFallback = () => {
        if (!('speechSynthesis' in window)) { resolve(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-GB';
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      };

      void fetchTts(text)
        .then(async (blob) => {
          if (!blob) { browserFallback(); return; }
          await playAudioBlob(blob);
          resolve();
        })
        .catch(() => browserFallback());
    });
  }, [fetchTts, playAudioBlob]);

  /** Speak the first sentence immediately, queue the rest (lower lag while streaming). */
  const speakChunked = useCallback(async (text: string): Promise<void> => {
    const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (parts.length === 0) return;
    setStatus('speaking');
    const first = parts[0];
    const rest = parts.slice(1).join(' ');
    const firstBlobPromise = fetchTts(first);
    if (rest) void fetchTts(rest);
    const firstBlob = await firstBlobPromise;
    if (firstBlob) await playAudioBlob(firstBlob);
    else await speak(first);
    if (rest && activeRef.current) {
      const restBlob = await fetchTts(rest);
      if (restBlob) await playAudioBlob(restBlob);
    }
  }, [fetchTts, playAudioBlob, speak]);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-GB';

    let finalText = '';
    rec.onresult = (e: SpeechRecognitionEvt) => {
      for (let i = 0; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r && r.isFinal) finalText += r[0].transcript;
      }
      if (!finalText) {
        // some engines don't flag isFinal with continuous=false
        finalText = e.results[0]?.[0]?.transcript ?? '';
      }
    };
    rec.onerror = () => { /* handled in onend */ };
    rec.onend = () => {
      recognitionRef.current = null;
      if (!activeRef.current) { setStatus('idle'); return; }
      const text = finalText.trim();
      if (text && !processingRef.current) {
        void handleUtterance(text);
      } else if (!processingRef.current) {
        // nothing heard — keep the loop alive
        setTimeout(() => startListening(), 400);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setStatus('listening');
    } catch {
      setTimeout(() => startListening(), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUtterance = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setLastUser(text);
    setStatus('thinking');
    try {
      const reply = await onUserMessageRef.current(text);
      if (activeRef.current && reply) {
        setStatus('speaking');
        await speakChunked(reply);
      }
    } catch {
      // swallow — keep the conversation going
    } finally {
      processingRef.current = false;
      if (activeRef.current) {
        startListening();
      } else {
        setStatus('idle');
      }
    }
  }, [speakChunked, startListening]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  const start = useCallback(() => {
    if (!isSupported) return;
    activeRef.current = true;
    setActive(true);
    startListening();
  }, [isSupported, startListening]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    processingRef.current = false;
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
    stopAudio();
    setStatus('idle');
  }, [stopAudio]);

  /** Tap-to-interrupt: stop the assistant talking and listen again immediately. */
  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    stopAudio();
    if (status === 'speaking') {
      processingRef.current = false;
      startListening();
    }
  }, [status, stopAudio, startListening]);

  useEffect(() => () => { stop(); }, [stop]);

  return { status, active, lastUser, isSupported, start, stop, interrupt };
}
