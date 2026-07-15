import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  mergeAgentActivityEvents,
  latestSeq,
  computeIsWorking,
  rowToAgentActivityEvent,
  fetchAgentActivityEvents,
  postAgentActivity,
  type AgentActivityEvent,
} from '../../src/app/engine/ai/agentActivity';

function event(overrides: Partial<AgentActivityEvent>): AgentActivityEvent {
  return {
    id: overrides.id ?? `id-${overrides.seq ?? Math.random()}`,
    seq: overrides.seq ?? 0,
    phase: overrides.phase ?? 'completed',
    summary: overrides.summary ?? 'did something',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('mergeAgentActivityEvents', () => {
  it('dedupes by id and keeps seq order', () => {
    const existing = [event({ id: 'a', seq: 1 }), event({ id: 'b', seq: 2 })];
    const incoming = [event({ id: 'b', seq: 2, summary: 'duplicate' }), event({ id: 'c', seq: 3 })];
    const merged = mergeAgentActivityEvents(existing, incoming);
    expect(merged.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    // First-seen wins for duplicates
    expect(merged[1].summary).toBe('did something');
  });

  it('sorts out-of-order realtime + replay batches by seq', () => {
    const merged = mergeAgentActivityEvents(
      [event({ id: 'x', seq: 5 })],
      [event({ id: 'y', seq: 3 }), event({ id: 'z', seq: 9 })],
    );
    expect(merged.map((e) => e.seq)).toEqual([3, 5, 9]);
  });

  it('caps the in-memory list', () => {
    const many = Array.from({ length: 120 }, (_, i) => event({ id: `e${i}`, seq: i + 1 }));
    const merged = mergeAgentActivityEvents([], many, 100);
    expect(merged).toHaveLength(100);
    expect(merged[0].seq).toBe(21);
    expect(merged[99].seq).toBe(120);
  });

  it('drops events without id or seq', () => {
    const merged = mergeAgentActivityEvents([], [event({ id: '', seq: 0 })]);
    expect(merged).toHaveLength(0);
  });
});

describe('latestSeq', () => {
  it('returns the max seq for replay cursors', () => {
    expect(latestSeq([event({ seq: 4 }), event({ seq: 11 }), event({ seq: 7 })])).toBe(11);
    expect(latestSeq([])).toBe(0);
  });
});

describe('computeIsWorking', () => {
  it('pulses when a recent started event has no newer terminal event', () => {
    const events = [
      event({ seq: 1, phase: 'started', createdAt: new Date().toISOString() }),
    ];
    expect(computeIsWorking(events)).toBe(true);
  });

  it('stops pulsing once completed/error lands after the active event', () => {
    const events = [
      event({ seq: 1, phase: 'started' }),
      event({ seq: 2, phase: 'completed' }),
    ];
    expect(computeIsWorking(events)).toBe(false);
    expect(computeIsWorking([
      event({ seq: 3, phase: 'working' }),
      event({ seq: 4, phase: 'error' }),
    ])).toBe(false);
  });

  it('ignores stale started events older than the recency window', () => {
    const events = [
      event({ seq: 1, phase: 'started', createdAt: new Date(Date.now() - 10 * 60_000).toISOString() }),
    ];
    expect(computeIsWorking(events)).toBe(false);
  });
});

describe('rowToAgentActivityEvent', () => {
  it('maps snake_case realtime rows', () => {
    const mapped = rowToAgentActivityEvent({
      id: 'row-1',
      seq: 42,
      phase: 'saved',
      summary: 'Saved quote Q1',
      action: 'saveQuote',
      session_id: 'sess-9',
      route: '/quotes',
      created_at: '2026-07-15T10:00:00Z',
    });
    expect(mapped).toMatchObject({
      id: 'row-1',
      seq: 42,
      phase: 'saved',
      summary: 'Saved quote Q1',
      action: 'saveQuote',
      sessionId: 'sess-9',
      route: '/quotes',
      createdAt: '2026-07-15T10:00:00Z',
    });
  });
});

describe('fetchAgentActivityEvents (replay)', () => {
  it('passes sinceSeq + limit and the user header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [event({ id: 'r1', seq: 6 })] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const events = await fetchAgentActivityEvents('user-1', 5, 25);
    expect(events).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/agent-activity?sinceSeq=5&limit=25');
    expect((init.headers as Record<string, string>)['X-User-Id']).toBe('user-1');
  });

  it('throws on non-ok responses so the hook can surface an error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchAgentActivityEvents('user-1')).rejects.toThrow('500');
  });
});

describe('postAgentActivity', () => {
  it('fire-and-forgets a POST with the event body', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    postAgentActivity({ userId: 'user-1', phase: 'completed', summary: 'Saved customer', route: '/customers' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/agent-activity');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ phase: 'completed', summary: 'Saved customer', route: '/customers', channel: 'web' });
  });

  it('does nothing without a user or summary and never throws on network failure', () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    postAgentActivity({ userId: '', phase: 'completed', summary: 'x' });
    postAgentActivity({ userId: 'u', phase: 'completed', summary: '  ' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(() =>
      postAgentActivity({ userId: 'u', phase: 'error', summary: 'boom' }),
    ).not.toThrow();
  });
});
