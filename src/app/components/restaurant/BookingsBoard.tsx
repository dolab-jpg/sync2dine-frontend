import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Phone, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import CallRecordingPlayer, { CalledBadge } from './CallRecordingPlayer';
import { setBoardBadgeCounts } from '../../engine/restaurant/kitchenAlertStore';

export type ReservationStatus =
  | 'enquiry'
  | 'held'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type Reservation = {
  id: string;
  tableId?: string;
  tableLabel?: string;
  partySize: number;
  customerName: string;
  customerPhone: string;
  startsAt: string;
  endsAt?: string;
  status: ReservationStatus;
  channel: string;
  callId?: string;
  recordingUrl?: string;
  notes?: string;
};

type Filter = 'today' | 'upcoming' | 'cancelled';

function orgHeaders(): HeadersInit {
  const orgId = getActiveOrgId();
  return {
    'Content-Type': 'application/json',
    ...(orgId ? { 'x-org-id': orgId } : {}),
  };
}

function mapReservation(raw: Record<string, unknown>): Reservation {
  return {
    id: String(raw.id ?? ''),
    tableId: raw.tableId != null ? String(raw.tableId) : raw.table_id != null ? String(raw.table_id) : undefined,
    tableLabel: raw.tableLabel != null ? String(raw.tableLabel) : raw.table_label != null ? String(raw.table_label) : undefined,
    partySize: Number(raw.partySize ?? raw.party_size ?? 1) || 1,
    customerName: String(raw.customerName ?? raw.customer_name ?? 'Guest'),
    customerPhone: String(raw.customerPhone ?? raw.customer_phone ?? ''),
    startsAt: String(raw.startsAt ?? raw.starts_at ?? ''),
    endsAt: raw.endsAt != null ? String(raw.endsAt) : raw.ends_at != null ? String(raw.ends_at) : undefined,
    status: String(raw.status ?? 'confirmed') as ReservationStatus,
    channel: String(raw.channel ?? 'phone'),
    callId: raw.callId != null ? String(raw.callId) : raw.call_id != null ? String(raw.call_id) : undefined,
    recordingUrl: raw.recordingUrl != null ? String(raw.recordingUrl) : raw.recording_url != null ? String(raw.recording_url) : undefined,
    notes: raw.notes != null ? String(raw.notes) : undefined,
  };
}

function isSameDay(iso: string, day: Date): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const d = new Date(t);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

function statusClass(status: ReservationStatus): string {
  if (status === 'cancelled' || status === 'no_show') return 'bg-slate-200 text-slate-700';
  if (status === 'seated') return 'bg-emerald-600 text-white';
  if (status === 'confirmed') return 'bg-s2d-teal-deep text-white';
  if (status === 'held' || status === 'enquiry') return 'bg-amber-500 text-white';
  return 'bg-slate-800 text-white';
}

export default function BookingsBoard() {
  const [rows, setRows] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<Filter>('today');
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reservations', { headers: orgHeaders() });
      if (res.status === 404) {
        setApiMissing(true);
        setRows([]);
        return;
      }
      if (!res.ok) return;
      setApiMissing(false);
      const data = await res.json() as { reservations?: Array<Record<string, unknown>> };
      const next = Array.isArray(data.reservations) ? data.reservations.map(mapReservation) : [];
      setRows(next);
      const todayCount = next.filter((r) => isSameDay(r.startsAt, new Date()) && r.status !== 'cancelled').length;
      setBoardBadgeCounts({ bookingsToday: todayCount });
    } catch {
      setApiMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(poll);
  }, [load]);

  const visible = useMemo(() => {
    const now = new Date();
    return rows
      .filter((r) => {
        if (filter === 'cancelled') return r.status === 'cancelled' || r.status === 'no_show';
        if (filter === 'today') return isSameDay(r.startsAt, now) && r.status !== 'cancelled';
        const t = Date.parse(r.startsAt);
        return Number.isFinite(t) && t >= Date.now() - 60_000 && r.status !== 'cancelled';
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [rows, filter]);

  async function patch(id: string, status: ReservationStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = status === 'cancelled'
        ? await fetch(`/api/reservations/${encodeURIComponent(id)}/cancel`, {
            method: 'POST',
            headers: orgHeaders(),
            body: JSON.stringify({}),
          })
        : await fetch(`/api/reservations/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: orgHeaders(),
            body: JSON.stringify({ status }),
          });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(status.replace('_', ' '));
      await load();
    } catch {
      toast.error('Could not update booking');
      await load();
    }
  }

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <main className="min-h-full bg-s2d-cream p-3 sm:p-5" data-testid="bookings-board">
      <section className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Bookings</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black tracking-tight">
            <CalendarDays className="h-8 w-8 text-s2d-gold" />
            Table reservations
          </h1>
        </div>

        {apiMissing && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
            Could not reach `/api/reservations` — check API auth / org header.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1 shadow-sm">
          {([
            ['today', 'Today'],
            ['upcoming', 'Upcoming'],
            ['cancelled', 'Cancelled'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`min-h-12 rounded-xl text-sm font-bold touch-manipulation ${
                filter === id ? 'bg-s2d-teal-deep text-white' : 'text-s2d-teal-deep hover:bg-s2d-cream'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && visible.length === 0 ? (
          <p className="text-center text-slate-500">Loading bookings…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-s2d-teal/30 bg-white/70 p-10 text-center">
            <p className="text-xl font-bold text-s2d-teal-deep">No bookings in this view</p>
            <p className="mt-1 text-s2d-teal-soft">Phone table bookings appear here when Lizzie confirms a reservation.</p>
          </div>
        ) : (
          <div className="space-y-3 lg:space-y-2">
            {/* denser list on lg+ */}
            <div className="hidden lg:grid lg:grid-cols-[6rem_4rem_1fr_7rem_7rem_8rem] lg:gap-2 lg:px-2 lg:text-xs lg:font-bold lg:uppercase lg:tracking-wide lg:text-slate-500">
              <span>Time</span>
              <span>Party</span>
              <span>Guest</span>
              <span>Table</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {visible.map((r) => {
              const time = Number.isFinite(Date.parse(r.startsAt))
                ? new Date(r.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '—';
              return (
                <article
                  key={r.id}
                  data-testid="booking-card"
                  className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm lg:grid lg:grid-cols-[6rem_4rem_1fr_7rem_7rem_8rem] lg:items-center lg:gap-2 lg:rounded-xl lg:p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 lg:contents">
                    <p className="text-2xl font-black text-s2d-teal-deep lg:text-lg">{time}</p>
                    <p className="flex items-center gap-1 font-bold text-slate-800">
                      <Users className="h-4 w-4" />
                      {r.partySize}
                    </p>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-slate-950 lg:text-base">{r.customerName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        {r.customerPhone ? (
                          <a href={`tel:${r.customerPhone}`} className="inline-flex items-center gap-1 font-semibold text-s2d-teal-deep hover:underline">
                            <Phone className="h-3.5 w-3.5" />
                            {r.customerPhone}
                          </a>
                        ) : null}
                        <CalledBadge hasRecording={Boolean(r.recordingUrl)} />
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold capitalize">{r.channel}</span>
                      </p>
                    </div>
                    <p className="font-semibold text-slate-700">{r.tableLabel || 'Unassigned'}</p>
                    <Badge className={`w-fit rounded-xl px-3 py-1 capitalize ${statusClass(r.status)}`}>
                      {r.status.replace('_', ' ')}
                    </Badge>
                    <div className="mt-3 flex flex-wrap gap-2 lg:mt-0 lg:flex-col xl:flex-row">
                      {r.status === 'enquiry' || r.status === 'held' ? (
                        <Button type="button" className="min-h-12 flex-1 bg-s2d-gold font-bold text-s2d-teal-deep lg:min-h-10" onClick={() => void patch(r.id, 'confirmed')}>
                          Confirm
                        </Button>
                      ) : null}
                      {r.status === 'confirmed' ? (
                        <Button type="button" className="min-h-12 flex-1 bg-s2d-teal-deep font-bold text-white lg:min-h-10" onClick={() => void patch(r.id, 'seated')}>
                          Seat
                        </Button>
                      ) : null}
                      {r.status !== 'cancelled' && r.status !== 'completed' ? (
                        <Button type="button" variant="outline" className="min-h-12 flex-1 lg:min-h-10" onClick={() => void patch(r.id, 'cancelled')}>
                          Cancel
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-12 flex-1 lg:min-h-10"
                        disabled={!r.customerPhone}
                        onClick={() => {
                          if (r.customerPhone) window.location.href = `tel:${r.customerPhone}`;
                        }}
                      >
                        Call back
                      </Button>
                      <Button type="button" variant="ghost" className="min-h-12 lg:min-h-10" onClick={() => setSelectedId(r.id)}>
                        Details
                      </Button>
                    </div>
                  </div>
                  {r.recordingUrl ? (
                    <div className="mt-3 lg:col-span-6">
                      <CallRecordingPlayer url={r.recordingUrl} compact />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setSelectedId(null)}>
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="booking-detail"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-black">{selected.customerName}</h2>
                <p className="text-slate-600">
                  {new Date(selected.startsAt).toLocaleString()} · party of {selected.partySize}
                </p>
              </div>
              <button type="button" className="min-h-11 min-w-11 rounded-xl hover:bg-slate-100" onClick={() => setSelectedId(null)} aria-label="Close">
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>
            {selected.notes ? (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">{selected.notes}</p>
            ) : null}
            <CallRecordingPlayer url={selected.recordingUrl} />
          </div>
        </div>
      )}
    </main>
  );
}
