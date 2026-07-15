/**
 * Live "Cynthia is doing this" activity feed — client side.
 *
 * postAgentActivity(): fire-and-forget POST of client-executed tool results to
 * /api/agent-activity so every device logged in as this staff user sees them.
 *
 * useAgentActivityFeed(): subscribes to Supabase Realtime inserts on
 * agent_activity_events (RLS-scoped to the current user), replays missed
 * events via GET /api/agent-activity?sinceSeq=N on connect/reconnect, and
 * falls back to 5s polling when Supabase is not configured.
 */
import { useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';

export const AGENT_ACTIVITY_PHASES = [
  'started',
  'working',
  'changed',
  'saved',
  'navigate',
  'completed',
  'error',
] as const;

export type AgentActivityPhase = (typeof AGENT_ACTIVITY_PHASES)[number];

export interface AgentActivityEvent {
  id: string;
  seq: number;
  phase: AgentActivityPhase;
  summary: string;
  action?: string;
  channel?: string;
  capability?: string;
  sessionId?: string;
  route?: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_EVENTS_IN_MEMORY = 100;
/** Pulse only for activity from the last few minutes, so stale rows never animate forever. */
const WORKING_RECENCY_MS = 3 * 60_000;

function requestHeaders(userId: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const orgId = localStorage.getItem('tradepro_active_org_id') || localStorage.getItem('activeOrgId');
    if (orgId) h['X-Org-Id'] = orgId;
  } catch { /* ignore */ }
  h['X-User-Id'] = userId;
  return h;
}

/** Fire-and-forget: never throws, never blocks the caller. */
export function postAgentActivity(event: {
  userId: string;
  phase: AgentActivityPhase;
  summary: string;
  action?: string;
  channel?: string;
  capability?: string;
  sessionId?: string;
  route?: string;
  payload?: Record<string, unknown>;
}): void {
  const { userId, ...rest } = event;
  if (!userId || !rest.summary?.trim()) return;
  try {
    void fetch('/api/agent-activity', {
      method: 'POST',
      headers: requestHeaders(userId),
      body: JSON.stringify({ channel: 'web', ...rest }),
    }).catch(() => undefined);
  } catch { /* ignore */ }
}

export async function fetchAgentActivityEvents(
  userId: string,
  sinceSeq = 0,
  limit = 50,
): Promise<AgentActivityEvent[]> {
  const params = new URLSearchParams();
  if (sinceSeq > 0) params.set('sinceSeq', String(sinceSeq));
  params.set('limit', String(limit));
  const res = await fetch(`/api/agent-activity?${params.toString()}`, {
    headers: requestHeaders(userId),
  });
  if (!res.ok) throw new Error(`agent-activity fetch failed (${res.status})`);
  const data = (await res.json()) as { events?: AgentActivityEvent[] };
  return Array.isArray(data.events) ? data.events : [];
}

/** Map a Supabase Realtime row (snake_case) to an AgentActivityEvent. */
export function rowToAgentActivityEvent(row: Record<string, unknown>): AgentActivityEvent {
  return {
    id: String(row.id ?? ''),
    seq: Number(row.seq ?? 0),
    phase: String(row.phase ?? 'working') as AgentActivityPhase,
    summary: String(row.summary ?? ''),
    action: row.action ? String(row.action) : undefined,
    channel: row.channel ? String(row.channel) : undefined,
    capability: row.capability ? String(row.capability) : undefined,
    sessionId: row.session_id ? String(row.session_id) : undefined,
    route: row.route ? String(row.route) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/** Merge incoming events into the list: dedupe by id (then seq), order by seq, cap memory. */
export function mergeAgentActivityEvents(
  existing: AgentActivityEvent[],
  incoming: AgentActivityEvent[],
  max = MAX_EVENTS_IN_MEMORY,
): AgentActivityEvent[] {
  const byKey = new Map<string, AgentActivityEvent>();
  for (const event of [...existing, ...incoming]) {
    if (!event?.id && !event?.seq) continue;
    const key = event.id || `seq:${event.seq}`;
    if (!byKey.has(key)) byKey.set(key, event);
  }
  const merged = [...byKey.values()].sort((a, b) =>
    (a.seq || 0) !== (b.seq || 0)
      ? (a.seq || 0) - (b.seq || 0)
      : a.createdAt.localeCompare(b.createdAt),
  );
  return merged.length > max ? merged.slice(-max) : merged;
}

export function latestSeq(events: AgentActivityEvent[]): number {
  return events.reduce((acc, e) => Math.max(acc, e.seq || 0), 0);
}

/** True while a recent started/working event is newer than the last completed/error. */
export function computeIsWorking(events: AgentActivityEvent[], now = Date.now()): boolean {
  let lastActive: AgentActivityEvent | null = null;
  let lastTerminalSeq = 0;
  for (const event of events) {
    if (event.phase === 'started' || event.phase === 'working') {
      if (!lastActive || (event.seq || 0) > (lastActive.seq || 0)) lastActive = event;
    } else if (event.phase === 'completed' || event.phase === 'error') {
      lastTerminalSeq = Math.max(lastTerminalSeq, event.seq || 0);
    }
  }
  if (!lastActive || (lastActive.seq || 0) <= lastTerminalSeq) return false;
  const age = now - Date.parse(lastActive.createdAt);
  return Number.isFinite(age) ? age < WORKING_RECENCY_MS : false;
}

export interface AgentActivityFeed {
  events: AgentActivityEvent[];
  isWorking: boolean;
  error: string | null;
}

export function useAgentActivityFeed(userId: string | null | undefined): AgentActivityFeed {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    setEvents([]);
    lastSeqRef.current = 0;
    if (!userId || userId === 'default-staff') return;
    let cancelled = false;

    const apply = (incoming: AgentActivityEvent[]) => {
      if (cancelled || incoming.length === 0) return;
      setEvents((prev) => {
        const merged = mergeAgentActivityEvents(prev, incoming);
        lastSeqRef.current = Math.max(lastSeqRef.current, latestSeq(merged));
        return merged;
      });
    };

    const replay = async () => {
      try {
        const fetched = await fetchAgentActivityEvents(userId, lastSeqRef.current);
        if (!cancelled) setError(null);
        apply(fetched);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Activity feed unavailable');
      }
    };

    void replay();

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      const channel = supabase
        .channel(`agent-activity-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_activity_events',
            filter: `target_user_id=eq.${userId}`,
          },
          (payload) => {
            apply([rowToAgentActivityEvent(payload.new as Record<string, unknown>)]);
          },
        )
        .subscribe((status) => {
          // Replays anything missed while offline whenever the socket (re)connects.
          if (status === 'SUBSCRIBED') void replay();
        });
      return () => {
        cancelled = true;
        void supabase.removeChannel(channel);
      };
    }

    const interval = setInterval(() => void replay(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  return { events, isWorking: computeIsWorking(events), error };
}
