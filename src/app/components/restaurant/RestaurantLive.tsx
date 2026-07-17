import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PhoneIncoming, PhoneOutgoing, Radio } from 'lucide-react';
import RestaurantOrders from '../RestaurantOrders';
import { useAgentLive, LiveIndicator } from './RestaurantShell';

/**
 * Restaurant Live board: inbound/outbound calls strip above the orders board.
 */

interface ActiveCall {
  id: string;
  from: string;
  to?: string;
  contactName?: string;
  elapsedSec?: number;
  status: string;
  lineLabel?: string;
}

interface RecentCall {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  status: string;
  contactName?: string;
  intent?: string;
  outcome?: string;
  startedAt: string;
  durationSec?: number;
}

function elapsedLabel(sec?: number) {
  if (sec == null || !Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeLabel(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function RestaurantLive() {
  const navigate = useNavigate();
  const live = useAgentLive(5_000);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [statusRes, callsRes] = await Promise.all([
          fetch('/api/agent/status'),
          fetch('/api/calls?limit=8'),
        ]);
        if (cancelled) return;
        if (statusRes.ok) {
          const data = await statusRes.json() as { activeCall?: ActiveCall | null; activeCalls?: ActiveCall[] };
          setActiveCalls(data.activeCalls ?? (data.activeCall ? [data.activeCall] : []));
        }
        if (callsRes.ok) {
          const data = await callsRes.json() as { calls?: RecentCall[] };
          setRecentCalls((data.calls ?? []).slice(0, 8));
        }
      } catch {
        // API offline — keep last known strip
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-full bg-s2d-cream p-3 sm:p-5">
      <section className="mx-auto mb-4 max-w-7xl">
        <div className="rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Radio className="h-6 w-6 text-s2d-gold" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Live</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Calls & orders right now</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LiveIndicator live={live} />
              <button
                type="button"
                onClick={() => navigate('/calls')}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20"
              >
                Open Calls
              </button>
            </div>
          </div>

          {activeCalls.length > 0 ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {activeCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => navigate(`/calls?callId=${encodeURIComponent(call.id)}`)}
                  className="min-w-[16rem] shrink-0 rounded-2xl border border-s2d-gold/40 bg-white/10 p-3 text-left transition hover:bg-white/15"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                    </span>
                    <p className="truncate text-lg font-bold">{call.contactName || call.from}</p>
                  </div>
                  <p className="mt-1 text-sm text-s2d-cream/80">
                    {call.lineLabel ? `${call.lineLabel} · ` : ''}{call.status}
                    {call.elapsedSec != null ? ` · ${elapsedLabel(call.elapsedSec)}` : ''}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-s2d-cream/70">
              No live calls — the phone agent {live.reachable && live.isActive ? 'is answering for you' : 'is offline'}.
            </p>
          )}

          {recentCalls.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {recentCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => navigate(`/calls?callId=${encodeURIComponent(call.id)}`)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-s2d-cream hover:bg-white/20"
                  title={`${call.direction} · ${call.status}${call.outcome ? ` · ${call.outcome}` : ''}`}
                >
                  {call.direction === 'outbound'
                    ? <PhoneOutgoing className="h-3.5 w-3.5 text-s2d-gold" />
                    : <PhoneIncoming className="h-3.5 w-3.5 text-emerald-300" />}
                  {call.contactName || (call.direction === 'outbound' ? call.to : call.from)}
                  <span className="text-s2d-cream/60">{timeLabel(call.startedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <RestaurantOrders embedded showTabs={false} />
    </div>
  );
}
