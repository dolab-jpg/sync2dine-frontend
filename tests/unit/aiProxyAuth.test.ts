import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProfileByBearer: vi.fn(),
  handleOrchestrator: vi.fn(),
}));

vi.mock('../../server/auth', () => ({
  isAuthEnforced: () => true,
  requireAuth: () => null,
  resolveOrgIdForRequest: () => null,
}));

vi.mock('../../server/account-auth', () => ({
  getProfileByBearer: mocks.getProfileByBearer,
}));

vi.mock('../../server/openai-connection', () => ({
  OpenAIConnectionError: class extends Error {},
  resolveOpenAIApiKeyAsync: vi.fn().mockResolvedValue('test-key'),
}));

vi.mock('../../server/orchestrator-handler', () => ({
  handleOrchestrator: mocks.handleOrchestrator,
}));

import { handleAiRequest } from '../../server/ai-proxy';

class MockRequest extends EventEmitter {
  method = 'POST';
  headers = { authorization: 'Bearer supabase-session' };
}

class MockResponse {
  statusCode = 200;
  body = '';

  setHeader() {}

  end(body = '') {
    this.body = body;
  }
}

describe('AI proxy authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfileByBearer.mockResolvedValue({
      id: 'user-1',
      role: 'super_admin',
      org_id: 'org-1',
    });
    mocks.handleOrchestrator.mockResolvedValue({
      content: 'ok',
      proposedActions: [],
      autoActions: [],
      detectedTrades: [],
    });
  });

  it('accepts a Supabase session and uses its profile organization', async () => {
    const req = new MockRequest();
    const res = new MockResponse();
    const response = handleAiRequest(req as never, res as never, '/api/ai/orchestrate');

    setTimeout(() => {
      req.emit('data', JSON.stringify({ messages: [] }));
      req.emit('end');
    }, 0);
    await response;

    expect(res.statusCode).toBe(200);
    expect(mocks.handleOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1' }),
    );
  });
});
