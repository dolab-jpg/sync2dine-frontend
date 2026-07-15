import { useCallback, useRef } from 'react';
import { integrationService } from '../engine/integrations/integrationService';
import { isNativeBridgeAvailable } from '../bridge/nativeBridge';

export function useVoiceOutput() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakOpenAi = useCallback(async (text: string): Promise<boolean> => {
    const openaiConfig = integrationService.getConfig('openai');
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: openaiConfig.ttsVoice || 'fable',
          apiKey: integrationService.getLiveOpenAIApiKey(),
        }),
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  const speakBrowser = useCallback((text: string): boolean => {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 1;
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    return true;
  }, []);

  const speak = useCallback(async (
    text: string,
    mode: 'openai' | 'browser' | 'auto' | 'off' = 'auto',
  ) => {
    if (mode === 'off' || !text) return;

    // Flutter WebView often lacks usable speechSynthesis — prefer OpenAI TTS there.
    const preferOpenAi =
      mode === 'openai'
      || (mode === 'auto' && isNativeBridgeAvailable())
      || (mode === 'auto' && typeof window !== 'undefined' && !('speechSynthesis' in window));

    if (preferOpenAi || mode === 'openai') {
      if (await speakOpenAi(text)) return;
      if (mode === 'openai') {
        speakBrowser(text);
        return;
      }
    }

    if (mode === 'browser' || mode === 'auto') {
      if (speakBrowser(text)) return;
      await speakOpenAi(text);
    }
  }, [speakOpenAi, speakBrowser]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return { speak, stop };
}
