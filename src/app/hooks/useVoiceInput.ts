import { useState, useCallback, useRef, useEffect } from 'react';
import {
  isNativeBridgeAvailable,
  nativeStartVoice,
  nativeStopVoice,
} from '../bridge/nativeBridge';
import {
  createMediaRecorder,
  mediaRecorderAvailable,
  stopMediaSession,
  transcribeAudioDataUrl,
  transcribeBlob,
  type MediaSession,
} from './voiceRecord';

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
  /** Fired after the mic is actually live (permission granted / recorder started). */
  onStarted?: () => void;
}

/**
 * Voice input for Cynthia / chat.
 * Prefers Flutter native hold-to-record + Whisper (`/api/ai/transcribe`) when
 * `TradeProNative` is available; otherwise records in the browser and transcribes
 * with the same Whisper endpoint. Web Speech API is a last-resort fallback.
 */
export function useVoiceInput(
  onTranscript: (text: string) => void,
  options?: UseVoiceInputOptions,
) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRef = useRef<MediaSession | null>(null);
  const nativeActiveRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(options?.onError);
  const onStartedRef = useRef(options?.onStarted);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = options?.onError;
  onStartedRef.current = options?.onStarted;

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

  useEffect(() => () => {
    stopMediaSession(mediaRef.current);
    mediaRef.current = null;
    recognitionRef.current?.stop();
  }, []);

  const webSttAvailable =
    typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isSupported = nativeAvailable || mediaRecorderAvailable() || webSttAvailable;

  const reportError = useCallback((message: string) => {
    onErrorRef.current?.(message);
  }, []);

  const startMediaRecorder = useCallback(async (): Promise<boolean> => {
    if (!mediaRecorderAvailable()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const recorder = createMediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRef.current = { stream, recorder, chunks };
      recorder.start();
      setIsListening(true);
      onStartedRef.current?.();
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        reportError('Microphone permission denied — allow the mic and try again');
        return true; // handled; do not fall through to Web Speech
      }
      if (name === 'NotFoundError') {
        reportError('No microphone found');
        return true;
      }
      return false;
    }
  }, [reportError]);

  const startWebSpeech = useCallback(() => {
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
      onStartedRef.current?.();
    } catch {
      reportError('Could not start voice recognition');
      setIsListening(false);
    }
  }, [reportError]);

  const startListening = useCallback(async () => {
    if (isNativeBridgeAvailable()) {
      const result = await nativeStartVoice();
      if (!result?.ok) {
        reportError(result?.error || 'Could not start microphone');
        return;
      }
      nativeActiveRef.current = true;
      setIsListening(true);
      onStartedRef.current?.();
      return;
    }

    const recorded = await startMediaRecorder();
    if (recorded) return;
    startWebSpeech();
  }, [reportError, startMediaRecorder, startWebSpeech]);

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

    const session = mediaRef.current;
    if (session) {
      mediaRef.current = null;
      setIsListening(false);
      setIsTranscribing(true);
      const blob = await new Promise<Blob>((resolve) => {
        session.recorder.onstop = () => {
          resolve(new Blob(session.chunks, { type: session.recorder.mimeType || 'audio/webm' }));
        };
        try {
          if (session.recorder.state !== 'inactive') session.recorder.stop();
          else resolve(new Blob(session.chunks, { type: session.recorder.mimeType || 'audio/webm' }));
        } catch {
          resolve(new Blob(session.chunks, { type: session.recorder.mimeType || 'audio/webm' }));
        }
      });
      session.stream.getTracks().forEach((track) => track.stop());
      try {
        if (blob.size < 800) {
          reportError('No speech detected — tap the mic, speak, then tap again');
          return;
        }
        const text = await transcribeBlob(blob);
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
