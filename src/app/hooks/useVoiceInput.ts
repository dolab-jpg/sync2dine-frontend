import { useState, useCallback, useRef, useEffect } from 'react';
import {
  isNativeBridgeAvailable,
  nativeStartVoice,
  nativeStopVoice,
} from '../bridge/nativeBridge';

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export interface UseVoiceInputOptions {
  /** Called when mic / STT / transcription fails so the UI can toast. */
  onError?: (message: string) => void;
}

async function transcribeAudioDataUrl(
  dataUrl: string,
  mimeType?: string,
  fileName?: string,
): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (match) {
    const res = await fetch('/api/ai/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio: match[2],
        mimeType: mimeType || match[1] || 'audio/mp4',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || `Transcription failed (${res.status})`);
    }
    const data = await res.json() as { text?: string };
    return data.text?.trim() ?? '';
  }

  const blobRes = await fetch(dataUrl);
  const blob = await blobRes.blob();
  const form = new FormData();
  form.append(
    'file',
    new File([blob], fileName || 'voice.m4a', { type: mimeType || blob.type || 'audio/mp4' }),
  );
  const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Transcription failed (${res.status})`);
  }
  const data = await res.json() as { text?: string };
  return data.text?.trim() ?? '';
}

/**
 * Voice input for Cynthia / chat.
 * Prefers Flutter native hold-to-record + Whisper (`/api/ai/transcribe`) when
 * `TradeProNative` is available; otherwise uses the Web Speech API.
 */
export function useVoiceInput(
  onTranscript: (text: string) => void,
  options?: UseVoiceInputOptions,
) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const nativeActiveRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(options?.onError);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = options?.onError;

  // Bridge is injected after WebView page load — poll briefly so the mic appears.
  const [nativeAvailable, setNativeAvailable] = useState(
    () => typeof window !== 'undefined' && isNativeBridgeAvailable(),
  );
  useEffect(() => {
    if (nativeAvailable) return;
    const id = window.setInterval(() => {
      if (isNativeBridgeAvailable()) {
        setNativeAvailable(true);
        window.clearInterval(id);
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [nativeAvailable]);

  const webSttAvailable =
    typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isSupported = nativeAvailable || webSttAvailable;

  const reportError = useCallback((message: string) => {
    onErrorRef.current?.(message);
  }, []);

  const startListening = useCallback(async () => {
    if (isNativeBridgeAvailable()) {
      const result = await nativeStartVoice();
      if (!result?.ok) {
        reportError(result?.error || 'Could not start microphone');
        return;
      }
      nativeActiveRef.current = true;
      setIsListening(true);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reportError('Voice input is not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-GB';
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = e.results[0]?.[0]?.transcript ?? '';
        if (transcript) onTranscriptRef.current(transcript);
        else reportError('No speech detected — try again');
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => {
        setIsListening(false);
        const code = e?.error;
        if (code === 'not-allowed') {
          reportError('Microphone permission denied');
        } else if (code === 'no-speech') {
          reportError('No speech detected — try again');
        } else if (code !== 'aborted') {
          reportError('Voice recognition failed — try again or type instead');
        }
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      reportError('Could not start voice recognition');
      setIsListening(false);
    }
  }, [reportError]);

  const stopListening = useCallback(async () => {
    if (nativeActiveRef.current && isNativeBridgeAvailable()) {
      nativeActiveRef.current = false;
      setIsListening(false);
      setIsTranscribing(true);
      try {
        const result = await nativeStopVoice();
        if (!result?.ok || !result.dataUrl) {
          reportError(result?.error || 'Recording failed');
          return;
        }
        const text = await transcribeAudioDataUrl(
          result.dataUrl,
          result.mimeType,
          result.fileName,
        );
        if (text) onTranscriptRef.current(text);
        else reportError('Could not transcribe voice — try again');
      } catch (err) {
        reportError(err instanceof Error ? err.message : 'Voice transcription failed');
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    recognitionRef.current?.stop();
    setIsListening(false);
  }, [reportError]);

  return {
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    isSupported,
    isNative: nativeAvailable,
  };
}
