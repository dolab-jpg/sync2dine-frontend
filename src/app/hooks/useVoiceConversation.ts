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

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!text) { resolve(); return; }
      const openaiConfig = integrationService.getConfig('openai');

      const browserFallback = () => {
        if (!('speechSynthesis' in window)) { resolve(); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-GB';
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      };

      void fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: openaiConfig.ttsVoice || 'fable',
          apiKey: openaiConfig.apiKey || undefined,
        }),
      })
        .then(async (res) => {
          if (!res.ok) { browserFallback(); return; }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          await audio.play();
        })
        .catch(() => browserFallback());
    });
  }, []);

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
        await speak(reply);
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
  }, [speak, startListening]);

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
