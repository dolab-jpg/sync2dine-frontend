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
    expect(src).toContain('if (!allowVoiceAutoStart || !isOpen || !preferVoiceOnOpen)');
    expect(src).not.toContain('cynthiaVoiceAutoStartClaim');
  });

  it('gates voice auto-start behind allowVoiceAutoStart from the visible host', () => {
    const panelSrc = readFileSync(
      resolve(__dirname, '../../src/app/components/AI/AIChatPanel.tsx'),
      'utf8',
    );
    const overlaySrc = readFileSync(
      resolve(__dirname, '../../src/app/components/AI/AIAssistantOverlay.tsx'),
      'utf8',
    );
    expect(panelSrc).toMatch(/allowVoiceAutoStart\s*=\s*false/);
    expect(overlaySrc).toContain('<AIChatPanel allowVoiceAutoStart={allowVoiceAutoStart} />');
  });
});

describe('AppShell Cynthia overlay mount', () => {
  it('mounts floating XOR docked panel (no CSS-hidden duplicate)', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/app/components/AppShell.tsx'),
      'utf8',
    );
    expect(src).toContain('aiDockedInline ? (');
    expect(src).toContain('allowVoiceAutoStart');
    // Must not keep a CSS-hidden floating host while the docked panel is also mounted.
    expect(src).not.toMatch(/aiDockedInline\s*\?\s*['"]hidden['"]/);
    expect(src).not.toContain("aiDockedInline ? 'hidden' : 'fixed'");
  });
});
