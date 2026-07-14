import { useCallback, useRef } from 'react';
import { integrationService } from '../engine/integrations/integrationService';

export function useVoiceOutput() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(async (text: string, mode: 'openai' | 'browser' | 'off' = 'browser') => {
    if (mode === 'off' || !text) return;

    if (mode === 'openai') {
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
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await audio.play();
          return;
        }
      } catch {
        // fallback to browser
      }
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = 1;
      utteranceRef.current = u;
      window.speechSynthesis.speak(u);
    }
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { speak, stop };
}
