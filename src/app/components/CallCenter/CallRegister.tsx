'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Search,
  ExternalLink,
  Headphones,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import CallRecordingPlayer from '../restaurant/CallRecordingPlayer';
import CallTranscriptTurns from './CallTranscriptTurns';
import type { CallTurn } from '../../App';

type DirectionFilter = 'all' | 'inbound' | 'outbound';
type GuestFilter = 'all' | 'guest' | 'named';

type RegisterCall = {
  id: string;
  direction: 'inbound' | 'outbound';
  from?: string;
  to?: string;
  status?: string;
  intent?: string;
  outcome?: string;
  customerId?: string;
  contactName?: string;
  isGuest?: boolean;
  durationSec?: number | null;
  recordingUrl?: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: CallTurn[];
};

type OutboundTodayRow = { to: string; name: string; count: number };

type CallsSummary = {
  outboundToday: OutboundTodayRow[];
  outboundTodayTotal: number;
  inboundGuestCount: number;
  withRecordingCount: number;
  matched: number;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 30-minute slot labels for a local day (00:00–23:30). */
export function buildHalfHourSlots(): Array<{ value: string; label: string }> {
  const slots: Array<{ value: string; label: string }> = [{ value: 'all', label: 'All day' }];
  for (let m = 0; m < 24 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const endM = m + 30;
    const eh = Math.floor(endM / 60) % 24;
    const emin = endM % 60;
    const value = `${pad2(h)}:${pad2(min)}`;
    slots.push({
      value,
      label: `${pad2(h)}:${pad2(min)}–${pad2(eh)}:${pad2(emin)}`,
    });
  }
  return slots;
}

function dayBounds(dateStr: string, slot: string): { from: string; to: string } {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const start = new Date(y, (mo || 1) - 1, d || 1, 0, 0, 0, 0);
  const end = new Date(y, (mo || 1) - 1, d || 1, 23, 59, 59, 999);
  if (slot && slot !== 'all') {
    const [hh, mm] = slot.split(':').map(Number);
    start.setHours(hh || 0, mm || 0, 0, 0);
    end.setTime(start.getTime() + 30 * 60 * 1000 - 1);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

function formatPhone(n?: string) {
  const s = String(n ?? '').trim();
  return s || '—';
}

function formatDuration(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${pad2(s)}`;
}

function displayName(call: RegisterCall) {
  const name = String(call.contactName ?? '').trim();
  if (name) return name;
  if (call.isGuest) return 'Guest';
  return call.direction === 'outbound' ? formatPhone(call.to) : formatPhone(call.from);
}

const HALF_HOUR_SLOTS = buildHalfHourSlots();

export default function CallRegister() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [slot, setSlot] = useState('all');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [guest, setGuest] = useState<GuestFilter>('all');
  const [calls, setCalls] = useState<RegisterCall[]>([]);
  const [summary, setSummary] = useState<CallsSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('callId'));

  const selected = useMemo(
    () => calls.find((c) => c.id === selectedId) ?? null,
    [calls, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = dayBounds(date, slot);
      const params = new URLSearchParams({
        limit: '200',
        offset: '0',
        from,
        to,
        guest,
      });
      if (direction !== 'all') params.set('direction', direction);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/calls?${params}`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.calls) ? (data.calls as RegisterCall[]) : [];
      setCalls(list);
      setTotal(Number(data.total ?? list.length) || 0);
      setSummary((data.summary as CallsSummary) ?? null);
      const deep = searchParams.get('callId');
      if (deep && list.some((c) => c.id === deep)) setSelectedId(deep);
      else if (selectedId && !list.some((c) => c.id === selectedId)) {
        // keep selection if still wanted via detail fetch
      }
    } catch {
      setCalls([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [date, slot, direction, guest, q, searchParams, selectedId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    if (calls.some((c) => c.id === selectedId)) return;
    void (async () => {
      try {
        const res = await fetch(`/api/calls/${encodeURIComponent(selectedId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.call) {
          setCalls((prev) => {
            if (prev.some((c) => c.id === data.call.id)) return prev;
            return [data.call as RegisterCall, ...prev];
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, [selectedId, calls]);

  const selectCall = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('callId', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="call-register-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Call Register</h1>
          <p className="text-sm text-slate-600">
            Find inbound and outbound calls, play recordings, and see what the agent did.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 font-bold" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {summary ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calling out today — {summary.outboundTodayTotal}</CardTitle>
            <CardDescription>
              Destinations with name · guests in filter: {summary.inboundGuestCount} · with recording: {summary.withRecordingCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.outboundToday.length === 0 ? (
              <p className="text-sm text-slate-500">No outbound calls so far today.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary.outboundToday.map((row) => (
                  <Badge
                    key={`${row.to}-${row.name}`}
                    variant="secondary"
                    className="gap-1 px-2.5 py-1 text-xs font-semibold"
                  >
                    <PhoneOutgoing className="h-3 w-3" />
                    {row.name}
                    <span className="font-mono text-[10px] opacity-70">{formatPhone(row.to)}</span>
                    <span className="rounded bg-white/80 px-1.5">{row.count}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 pt-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2 space-y-1">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="min-h-11 pl-9"
                placeholder="Name, phone, outcome, call id…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load();
                }}
                data-testid="call-register-search"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Date</Label>
            <Input
              type="date"
              className="min-h-11"
              value={date}
              onChange={(e) => setDate(e.target.value || todayInputValue())}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">30‑min slot</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger className="min-h-11" data-testid="call-register-slot">
                <SelectValue placeholder="All day" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {HALF_HOUR_SLOTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-500">Guest / Private</Label>
            <Select value={guest} onValueChange={(v) => setGuest(v as GuestFilter)}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All callers</SelectItem>
                <SelectItem value="guest">Guests / Private</SelectItem>
                <SelectItem value="named">Named only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,420px)]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Calls <span className="font-normal text-slate-500">({total})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {calls.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {loading ? 'Loading…' : 'No calls in this window.'}
              </p>
            ) : (
              calls.map((call) => {
                const active = call.id === selectedId;
                const guestBadge = call.isGuest || /^guest$/i.test(String(call.contactName ?? ''));
                return (
                  <button
                    key={call.id}
                    type="button"
                    onClick={() => selectCall(call.id)}
                    className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition touch-manipulation ${
                      active ? 'border-s2d-teal bg-s2d-cream/70 ring-1 ring-s2d-teal' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                    data-testid={`call-register-row-${call.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {call.direction === 'outbound' ? (
                        <PhoneOutgoing className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <PhoneIncoming className="h-4 w-4 text-emerald-600" />
                      )}
                      <span className="font-bold text-slate-900">{displayName(call)}</span>
                      {guestBadge ? (
                        <Badge className="bg-amber-500 text-[10px] text-white">Guest / Private</Badge>
                      ) : null}
                      {call.recordingUrl ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-violet-800">
                          <Headphones className="h-3 w-3" /> Rec
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-slate-500">
                        {call.startedAt
                          ? new Date(call.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                        {' · '}
                        {formatDuration(call.durationSec)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="font-mono">{formatPhone(call.direction === 'outbound' ? call.to : call.from)}</span>
                      {call.direction === 'outbound' && call.to ? (
                        <span>→ {formatPhone(call.to)}</span>
                      ) : null}
                      {call.outcome ? <Badge variant="outline">{call.outcome}</Badge> : null}
                      {call.intent ? <Badge variant="secondary">{call.intent}</Badge> : null}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-4 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Call detail</CardTitle>
            <CardDescription>Recording, transcript, and agent actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <p className="text-sm text-slate-400">Select a call to manage it.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">{displayName(selected)}</p>
                  <p className="font-mono text-sm text-slate-600">
                    <Phone className="mr-1 inline h-3.5 w-3.5" />
                    {formatPhone(selected.direction === 'outbound' ? selected.to : selected.from)}
                  </p>
                  {selected.isGuest || /^guest$/i.test(String(selected.contactName ?? '')) ? (
                    <Badge className="bg-amber-500 text-white">Guest / Private — number registered</Badge>
                  ) : null}
                </div>
                <CallRecordingPlayer
                  recordingUrl={selected.recordingUrl}
                  testId={`call-register-recording-${selected.id}`}
                />
                {!selected.recordingUrl ? (
                  <p className="text-xs text-slate-500">No recording URL on this call yet.</p>
                ) : null}
                <CallTranscriptTurns turns={selected.transcript} maxHeightClass="max-h-[360px]" />
                <div className="flex flex-wrap gap-2">
                  {selected.customerId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 font-bold"
                      onClick={() => navigate(`/crm?customerId=${encodeURIComponent(selected.customerId!)}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open lead / customer
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 font-bold"
                    onClick={() => navigate(`/calls?callId=${encodeURIComponent(selected.id)}`)}
                  >
                    Open in Call Centre
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
