import { useEffect, useState } from 'react';
import type { AIStudioConfig } from '../config/ai/types';
import { AI_STUDIO_CONFIG_EVENT, loadAIStudioConfig } from '../engine/ai/aiStudioStore';

export function useAIStudioConfig(): AIStudioConfig {
  const [config, setConfig] = useState<AIStudioConfig>(() => loadAIStudioConfig());

  useEffect(() => {
    const refresh = () => setConfig(loadAIStudioConfig());
    window.addEventListener(AI_STUDIO_CONFIG_EVENT, refresh);
    return () => window.removeEventListener(AI_STUDIO_CONFIG_EVENT, refresh);
  }, []);

  return config;
}
