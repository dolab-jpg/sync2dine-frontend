import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AIChatPanel', () => {
  it('destructures isOpen from the assistant context used by the default-open sales shell', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/app/components/AI/AIChatPanel.tsx'),
      'utf8',
    );
    const destructure = src.match(/const \{([\s\S]*?)\} = useAIAssistant\(\);/);
    expect(destructure?.[1]).toMatch(/\bisOpen\b/);
    expect(src).toContain('if (!isOpen || !preferVoiceOnOpen)');
  });
});
