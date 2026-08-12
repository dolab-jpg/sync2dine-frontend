import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldShowWorkspaceLoader } from '../../src/app/engine/platform/workspaceLoader';

describe('shouldShowWorkspaceLoader', () => {
  it('shows the branded loader only while logged in and experience is not ready', () => {
    expect(shouldShowWorkspaceLoader(true, false)).toBe(true);
    expect(shouldShowWorkspaceLoader(true, true)).toBe(false);
    expect(shouldShowWorkspaceLoader(false, false)).toBe(false);
    expect(shouldShowWorkspaceLoader(false, true)).toBe(false);
  });
});

describe('WorkspaceLoadingScreen', () => {
  it('uses a turning indicator and workspace copy', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/app/components/WorkspaceLoadingScreen.tsx'),
      'utf8',
    );
    expect(src).toContain('Loading your workspace…');
    expect(src).toContain('animate-spin');
    expect(src).toContain('motion-reduce:animate-none');
    expect(src).toContain('role="status"');
  });
});
