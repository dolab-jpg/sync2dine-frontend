import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { getActiveOrgId } from '../../engine/platform/orgContext';

export type DiningTable = {
  id: string;
  label: string;
  seats: number;
  zone?: string;
  active: boolean;
};

function orgHeaders(): HeadersInit {
  const orgId = getActiveOrgId();
  return {
    'Content-Type': 'application/json',
    ...(orgId ? { 'x-org-id': orgId } : {}),
  };
}

function mapTable(raw: Record<string, unknown>): DiningTable {
  return {
    id: String(raw.id ?? ''),
    label: String(raw.label ?? 'Table'),
    seats: Number(raw.seats ?? 2) || 2,
    zone: raw.zone != null ? String(raw.zone) : undefined,
    active: raw.active !== false,
  };
}

export default function TablesInventory() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiMissing, setApiMissing] = useState(false);
  const [label, setLabel] = useState('');
  const [seats, setSeats] = useState('2');
  const [zone, setZone] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/dining-tables', { headers: orgHeaders() });
      if (res.status === 404) {
        setApiMissing(true);
        setTables([]);
        return;
      }
      if (!res.ok) return;
      setApiMissing(false);
      const data = await res.json() as { tables?: Array<Record<string, unknown>> };
      setTables(Array.isArray(data.tables) ? data.tables.map(mapTable) : []);
    } catch {
      setApiMissing(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addTable() {
    const seatsN = Number(seats);
    if (!label.trim() || !Number.isFinite(seatsN) || seatsN < 1) {
      toast.error('Need a label and seats');
      return;
    }
    try {
      const res = await fetch('/api/dining-tables', {
        method: 'POST',
        headers: orgHeaders(),
        body: JSON.stringify({ label: label.trim(), seats: seatsN, zone: zone.trim() || undefined, active: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setLabel('');
      setSeats('2');
      setZone('');
      toast.success('Table added');
      await load();
    } catch {
      toast.error(apiMissing ? 'Tables API not available yet' : 'Could not add table');
    }
  }

  async function upsertTable(patch: Partial<DiningTable> & { id?: string; label: string; seats: number }) {
    const res = await fetch('/api/dining-tables', {
      method: 'POST',
      headers: orgHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json() as { ok?: boolean; error?: string };
    if (data.ok === false) throw new Error(data.error || 'upsert failed');
  }

  async function toggleActive(t: DiningTable) {
    try {
      await upsertTable({
        id: t.id,
        label: t.label,
        seats: t.seats,
        zone: t.zone,
        active: !t.active,
      });
      await load();
    } catch {
      toast.error('Could not update table');
    }
  }

  async function removeTable(t: DiningTable) {
    if (!confirm(`Disable ${t.label}?`)) return;
    try {
      // Backend upserts via POST — soft-disable (no DELETE route).
      await upsertTable({
        id: t.id,
        label: t.label,
        seats: t.seats,
        zone: t.zone,
        active: false,
      });
      toast.success('Table disabled');
      await load();
    } catch {
      toast.error('Could not disable table');
    }
  }

  return (
    <div className="space-y-4" data-testid="tables-inventory">
      <div>
        <h2 className="text-xl font-bold text-s2d-teal-deep">Tables inventory</h2>
        <p className="text-sm text-slate-600">
          How many tables and seats — Lizzie uses this for availability when booking.
        </p>
      </div>

      {apiMissing && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
          Could not reach `/api/dining-tables` — check API auth / org header.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="table-label">Label</Label>
          <Input id="table-label" className="mt-1 min-h-12" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Table 1" />
        </div>
        <div>
          <Label htmlFor="table-seats">Seats</Label>
          <Input id="table-seats" type="number" min={1} className="mt-1 min-h-12" value={seats} onChange={(e) => setSeats(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="table-zone">Zone (optional)</Label>
          <Input id="table-zone" className="mt-1 min-h-12" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Window" />
        </div>
      </div>
      <Button type="button" className="min-h-12 bg-s2d-teal-deep font-bold text-white" onClick={() => void addTable()}>
        <Plus className="mr-2 h-4 w-4" />
        Add table
      </Button>

      <ul className="space-y-2">
        {loading && tables.length === 0 ? (
          <li className="text-sm text-slate-500">Loading…</li>
        ) : tables.length === 0 ? (
          <li className="text-sm text-slate-500">No tables configured yet</li>
        ) : (
          tables.map((t) => (
            <li
              key={t.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${t.active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}
            >
              <span className="min-w-0 flex-1 font-bold text-s2d-teal-deep">
                {t.label}
                <span className="ml-2 font-semibold text-slate-600">· {t.seats} seats</span>
                {t.zone ? <span className="ml-2 text-sm font-medium text-slate-500">{t.zone}</span> : null}
              </span>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void toggleActive(t)}>
                {t.active ? 'Disable' : 'Enable'}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" aria-label={`Remove ${t.label}`} onClick={() => void removeTable(t)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
