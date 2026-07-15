/**
 * Compact live feed of what Cynthia is doing right now, mirrored on every
 * device logged in as the same staff user. Collapsible pill bottom-right.
 * Navigation is always user-initiated via the "Open" button — never automatic.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Compass,
  Loader2,
  PenLine,
  PlayCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  useAgentActivityFeed,
  type AgentActivityEvent,
  type AgentActivityPhase,
} from '../../engine/ai/agentActivity';

const PHASE_META: Record<AgentActivityPhase, { icon: typeof Activity; className: string }> = {
  started: { icon: PlayCircle, className: 'text-sky-600' },
  working: { icon: Loader2, className: 'text-sky-600 animate-spin' },
  changed: { icon: PenLine, className: 'text-amber-600' },
  saved: { icon: Save, className: 'text-emerald-600' },
  navigate: { icon: Compass, className: 'text-indigo-600' },
  completed: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: AlertCircle, className: 'text-red-600' },
};

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return new Date(then).toLocaleDateString();
}

function ActivityRow({ event, onOpen }: { event: AgentActivityEvent; onOpen: (route: string) => void }) {
  const meta = PHASE_META[event.phase] ?? PHASE_META.working;
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-2 px-3 py-2 border-b border-slate-100 last:border-b-0">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.className}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs leading-snug break-words ${event.phase === 'error' ? 'text-red-700' : 'text-slate-700'}`}>
          {event.summary}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {event.action ? `${event.action} · ` : ''}{relativeTime(event.createdAt)}
        </p>
      </div>
      {event.route && (
        <button
          type="button"
          onClick={() => onOpen(event.route!)}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 text-[11px] font-medium transition-colors touch-manipulation"
          title={`Open ${event.route}`}
        >
          Open
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </li>
  );
}

export default function CynthiaActivityPanel({ userId }: { userId: string }) {
  const { events, isWorking, error } = useAgentActivityFeed(userId);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // Stay out of the way until Cynthia has actually done something.
  if (events.length === 0 && !isWorking) return null;

  const newestFirst = [...events].reverse().slice(0, 30);

  return (
    <div className="fixed right-3 z-40 bottom-[calc(3.5rem+var(--safe-area-bottom,0px)+0.75rem)] md:bottom-4 flex flex-col items-end pointer-events-none">
      {expanded && (
        <div className="pointer-events-auto mb-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-slate-900/95 to-slate-800/95 text-amber-100">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold truncate">Cynthia activity</span>
              {isWorking && (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  working…
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="min-h-8 min-w-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors touch-manipulation"
              aria-label="Collapse Cynthia activity"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          {error && (
            <p className="px-3 py-2 text-[11px] text-red-600 bg-red-50 border-b border-red-100">
              Live feed unavailable — retrying. {error}
            </p>
          )}
          <ul className="max-h-72 overflow-y-auto overscroll-contain">
            {newestFirst.length === 0 ? (
              <li className="px-3 py-4 text-xs text-slate-400 text-center">No activity yet</li>
            ) : (
              newestFirst.map((event) => (
                <ActivityRow key={event.id || event.seq} event={event} onOpen={(route) => navigate(route)} />
              ))
            )}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900/95 hover:bg-slate-800 text-amber-100 shadow-xl border border-white/10 pl-3 pr-4 py-2 text-xs font-medium transition-all touch-manipulation"
        aria-label={expanded ? 'Hide Cynthia activity' : 'Show Cynthia activity'}
      >
        {isWorking ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
        ) : (
          <Activity className="w-3.5 h-3.5 text-amber-400" />
        )}
        {isWorking ? 'Cynthia is working…' : 'Cynthia activity'}
      </button>
    </div>
  );
}
