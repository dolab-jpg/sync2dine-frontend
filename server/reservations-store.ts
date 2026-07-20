/**
 * Restaurant table reservations — JSON-backed store for Judie phone tools.
 * Signatures match server/phone-tools.ts call sites.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const FILE = join(DATA_DIR, 'reservations.json');

export type Reservation = {
  id: string;
  orgId: string;
  name: string;
  phone?: string;
  partySize: number;
  startsAt: string;
  notes?: string;
  status: 'booked' | 'cancelled' | 'completed' | 'no_show';
  tableId?: string;
  callId?: string;
  callIds?: string[];
  channel?: string;
  createdAt: string;
  updatedAt: string;
};

type OkResult<T> = { ok: true } & T;
type ErrResult = { ok: false; error: string };

let memory: Reservation[] | null = null;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load(): Reservation[] {
  if (memory) return memory;
  try {
    if (existsSync(FILE)) {
      const parsed = JSON.parse(readFileSync(FILE, 'utf-8'));
      memory = Array.isArray(parsed) ? (parsed as Reservation[]) : [];
      return memory;
    }
  } catch {
    /* ignore */
  }
  memory = [];
  return memory;
}

function persist() {
  ensureDir();
  try {
    writeFileSync(FILE, JSON.stringify(memory || [], null, 2));
  } catch (err) {
    console.warn('[reservations] persist failed:', err instanceof Error ? err.message : err);
  }
}

function resolveOrg(orgId?: string): string {
  return String(orgId || '').trim() || 'default';
}

export async function createReservation(
  input: {
    startsAt: string;
    partySize: number;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    callId?: string;
    channel?: string;
    tableId?: string;
  },
  orgId?: string,
): Promise<OkResult<{ reservation: Reservation }> | ErrResult> {
  const startsAt = String(input.startsAt || '').trim();
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) {
    return { ok: false, error: 'invalid_startsAt' };
  }
  const now = new Date().toISOString();
  const row: Reservation = {
    id: `res_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`,
    orgId: resolveOrg(orgId),
    name: String(input.customerName || '').trim() || 'Guest',
    phone: input.customerPhone ? String(input.customerPhone).trim() : undefined,
    partySize: Math.max(1, Math.floor(Number(input.partySize) || 1)),
    startsAt,
    notes: input.notes ? String(input.notes).trim() : undefined,
    status: 'booked',
    tableId: input.tableId,
    callId: input.callId,
    callIds: input.callId ? [input.callId] : [],
    channel: input.channel || 'phone',
    createdAt: now,
    updatedAt: now,
  };
  const all = load();
  all.unshift(row);
  memory = all;
  persist();
  return { ok: true, reservation: row };
}

export async function listReservations(
  orgId: string,
  filter?: { phone?: string; day?: string; from?: string; to?: string },
): Promise<Reservation[]> {
  const oid = resolveOrg(orgId);
  let rows = load().filter((r) => r.orgId === oid);
  const phone = filter?.phone ? String(filter.phone).replace(/\D/g, '') : '';
  if (phone.length >= 7) {
    rows = rows.filter((r) => (r.phone || '').replace(/\D/g, '').endsWith(phone.slice(-10)));
  }
  if (filter?.day) {
    const day = String(filter.day).slice(0, 10);
    rows = rows.filter((r) => r.startsAt.slice(0, 10) === day);
  }
  return rows;
}

export async function updateReservation(
  id: string,
  patch: Record<string, unknown>,
  orgId?: string,
): Promise<OkResult<{ reservation: Reservation }> | ErrResult> {
  const oid = resolveOrg(orgId);
  const all = load();
  const idx = all.findIndex((r) => r.id === id && r.orgId === oid);
  if (idx < 0) return { ok: false, error: 'not_found' };
  const prev = all[idx]!;
  const next: Reservation = {
    ...prev,
    name: patch.name != null ? String(patch.name) : prev.name,
    phone: patch.phone != null || patch.customerPhone != null
      ? String(patch.phone ?? patch.customerPhone)
      : prev.phone,
    partySize: patch.partySize != null ? Math.max(1, Number(patch.partySize) || prev.partySize) : prev.partySize,
    startsAt: patch.startsAt != null ? String(patch.startsAt) : prev.startsAt,
    notes: patch.notes != null ? String(patch.notes) : prev.notes,
    status: (patch.status as Reservation['status']) || prev.status,
    tableId: patch.tableId != null ? String(patch.tableId) : prev.tableId,
    callId: patch.callId != null ? String(patch.callId) : prev.callId,
    callIds: Array.isArray(patch.callIds) ? (patch.callIds as string[]) : prev.callIds,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = next;
  memory = all;
  persist();
  return { ok: true, reservation: next };
}

export async function cancelReservation(
  id: string,
  _reason?: string,
  orgId?: string,
): Promise<OkResult<{ reservation: Reservation }> | ErrResult> {
  return updateReservation(id, { status: 'cancelled', notes: _reason }, orgId);
}

export async function checkTableAvailability(
  input: { startsAt: string; partySize: number },
  orgId?: string,
): Promise<
  | {
      ok: true;
      available: boolean;
      availableTables: Array<{ id: string; seats: number }>;
      nextSlots?: string[];
      reason?: string;
    }
  | ErrResult
> {
  const party = Math.max(1, Math.floor(Number(input.partySize) || 1));
  const start = Date.parse(input.startsAt);
  if (!Number.isFinite(start)) {
    return { ok: false, error: 'invalid_startsAt' };
  }
  const sameSlot = (await listReservations(resolveOrg(orgId))).filter((r) => {
    if (r.status === 'cancelled') return false;
    const t = Date.parse(r.startsAt);
    return Number.isFinite(t) && Math.abs(t - start) < 90 * 60 * 1000;
  });
  if (sameSlot.length >= 8 || party > 12) {
    return {
      ok: true,
      available: false,
      availableTables: [],
      nextSlots: [
        new Date(start + 30 * 60_000).toISOString(),
        new Date(start + 60 * 60_000).toISOString(),
      ],
      reason: party > 12 ? 'Parties over 12 need staff confirmation' : 'That time looks busy',
    };
  }
  return {
    ok: true,
    available: true,
    availableTables: [
      { id: 't1', seats: Math.max(party, 2) },
      { id: 't2', seats: Math.max(party, 4) },
    ],
  };
}
