/**
 * One-click lead-sheet normalise: POST /api/leads/normalize-csv then local parse.
 * Applies phoneE164 / contact / restaurant onto customers. Falls back to parseSallyLeadSheetCsv.
 */
import type { Customer } from '../../App';
import * as sallyParser from './sallyLeadSheetParser';
import type { ParsedSallyLeadSheet, SallyDialRow } from './sallyLeadSheetParser';

export type InspectedLeadSheet = {
  headers: string[];
  rows: string[][];
};

export type NormalizedLeadRow = {
  phoneE164?: string;
  phone?: string;
  contact?: string;
  contactName?: string;
  restaurant?: string;
  name?: string;
  email?: string;
  address?: string;
  notes?: string;
  id?: string;
  leadId?: string;
  role?: string;
  phoneNeedsResearch?: boolean;
  people?: Array<{ name: string; role?: string; phone?: string }>;
  [key: string]: unknown;
};

const SMALL_SHEET_ROWS = 250;

function pick(...vals: Array<string | undefined | null>): string {
  for (const v of vals) {
    const s = (v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function asString(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Tabs if the header line has tabs; otherwise comma. Quote-aware, kept tiny. */
function splitDelim(line: string, delim: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function inspectLeadSheetLocal(text: string): InspectedLeadSheet {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { headers: [], rows: [] };
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const headerLine = lines[0] ?? '';
  const delim = headerLine.includes('\t') ? '\t' : ',';
  const parse = (line: string) => splitDelim(line, delim);
  return {
    headers: parse(headerLine),
    rows: lines.slice(1).map(parse),
  };
}

export function inspectLeadSheet(text: string): InspectedLeadSheet {
  const fn = (sallyParser as { inspectLeadSheetCsv?: (t: string) => InspectedLeadSheet }).inspectLeadSheetCsv;
  if (typeof fn === 'function') {
    const inspected = fn(text);
    const headers = Array.isArray(inspected?.headers) ? inspected.headers.map(String) : [];
    const rawRows = Array.isArray(inspected?.rows) ? inspected.rows : [];
    const rows: string[][] = rawRows.map((row) => {
      if (Array.isArray(row)) return row.map((c) => asString(c));
      if (row && typeof row === 'object') {
        return headers.map((h) => asString((row as Record<string, unknown>)[h]));
      }
      return [];
    });
    return { headers, rows };
  }
  return inspectLeadSheetLocal(text);
}

function peopleFromRow(
  row: NormalizedLeadRow | undefined,
  contact: string,
  phone: string,
  existing?: Customer['people'],
): Customer['people'] {
  if (Array.isArray(row?.people) && row.people.length) {
    return row.people
      .map((p) => ({
        name: asString(p?.name),
        role: asString(p?.role) || undefined,
        phone: asString(p?.phone) || undefined,
      }))
      .filter((p) => p.name);
  }
  if (contact) {
    return [{ name: contact, role: asString(row?.role) || 'Manager', phone: phone || undefined }];
  }
  return existing;
}

function overlayCustomer(c: Customer, row?: NormalizedLeadRow): Customer {
  if (!row) {
    const contact = (c.contactName ?? '').trim();
    const people = c.people?.length
      ? c.people
      : contact
        ? [{ name: contact, role: 'Manager', phone: c.phone || undefined }]
        : c.people;
    return people ? { ...c, people } : c;
  }
  const contact = pick(asString(row.contact), asString(row.contactName), c.contactName);
  const phone = pick(asString(row.phoneE164), asString(row.phone), c.phone);
  const restaurant = pick(asString(row.restaurant), asString(row.name), c.name);
  const people = peopleFromRow(row, contact, phone, c.people);
  return {
    ...c,
    name: restaurant || c.name,
    contactName: contact || c.contactName,
    phone: phone || c.phone,
    ...(people?.length ? { people } : {}),
  };
}

function customerFromNorm(row: NormalizedLeadRow, index: number, batchId: string): Customer | null {
  const name = pick(asString(row.restaurant), asString(row.name));
  const contactName = pick(asString(row.contact), asString(row.contactName)) || 'Manager';
  const phone = pick(asString(row.phoneE164), asString(row.phone));
  const needsResearch = row.phoneNeedsResearch === true;
  if (!name) return null;
  if (!phone && !needsResearch) return null;
  const people = peopleFromRow(row, contactName, phone);
  return {
    id: pick(asString(row.id), asString(row.leadId)) || `${batchId}-${index}`,
    name,
    contactName,
    email: asString(row.email),
    phone,
    address: asString(row.address),
    status: 'lead',
    createdAt: new Date().toISOString(),
    photos: [],
    notes: [asString(row.notes), !phone ? 'needs_phone_research' : ''].filter(Boolean).join(' | '),
    whatsappOptIn: false,
    preferredChannel: 'phone',
    ...(people?.length ? { people } : {}),
  };
}

function dialFromCustomer(c: Customer): SallyDialRow {
  return {
    company: c.name,
    contactName: c.contactName,
    phone: c.phone,
    customerId: c.id,
    notes: c.notes || undefined,
    address: c.address || undefined,
  };
}

function cellsToNorm(obj: Record<string, unknown>): NormalizedLeadRow {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    lower[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
  }
  const phoneE164 = asString(obj.phoneE164 ?? lower.phonee164 ?? lower.phone_e164);
  const phone = asString(obj.phone ?? lower.phone ?? lower.telephone ?? lower.mobile ?? lower.tel);
  const contact = asString(
    obj.contact ?? obj.contactName ?? lower.contact ?? lower.contact_name ?? lower.manager ?? lower.owner,
  );
  const restaurant = asString(
    obj.restaurant
    ?? obj.name
    ?? lower.restaurant
    ?? lower.restaurant_name
    ?? lower.company
    ?? lower.company_name
    ?? lower.business_name
    ?? lower.name,
  );
  return {
    ...obj,
    phoneE164: phoneE164 || undefined,
    phone: phone || undefined,
    contact: contact || undefined,
    restaurant: restaurant || undefined,
    email: asString(obj.email ?? lower.email) || undefined,
    address: asString(obj.address ?? lower.address) || undefined,
    notes: asString(obj.notes ?? lower.notes) || undefined,
    id: asString(obj.id ?? lower.id) || undefined,
    leadId: asString(obj.leadId ?? lower.lead_id ?? lower.leadid) || undefined,
    role: asString(obj.role ?? lower.role) || undefined,
    phoneNeedsResearch: obj.phoneNeedsResearch === true || lower.phone_needs_research === true,
  };
}

function coerceNormalizedRows(raw: unknown, headers: string[]): NormalizedLeadRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    if (Array.isArray(row)) {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return cellsToNorm(obj);
    }
    if (row && typeof row === 'object') return cellsToNorm(row as Record<string, unknown>);
    return {};
  });
}

async function fetchNormalizedRows(
  inspected: InspectedLeadSheet,
): Promise<NormalizedLeadRow[] | null> {
  const payload: { headers: string[]; sampleRows: string[][]; rows?: string[][] } = {
    headers: inspected.headers,
    sampleRows: inspected.rows.slice(0, 8),
  };
  if (inspected.rows.length > 0 && inspected.rows.length <= SMALL_SHEET_ROWS) {
    payload.rows = inspected.rows;
  }
  const res = await fetch('/api/leads/normalize-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    rows?: unknown;
    customers?: unknown;
  };
  if (Array.isArray(data.rows) && data.rows.length) {
    return coerceNormalizedRows(data.rows, inspected.headers);
  }
  if (Array.isArray(data.customers) && data.customers.length) {
    return coerceNormalizedRows(data.customers, inspected.headers);
  }
  return null;
}

function mergeParsedWithApi(
  parsed: ParsedSallyLeadSheet,
  apiRows: NormalizedLeadRow[],
  batchId: string,
): ParsedSallyLeadSheet {
  // API returns one object per sheet row. Local parse may have dropped rows, so
  // never overlay by array index  trust the normalised rows as the source of truth.
  const customers = apiRows
    .map((row, i) => customerFromNorm(row, i, batchId))
    .filter((c): c is Customer => !!c)
    .map((c) => overlayCustomer(c));
  if (customers.length) {
    return {
      ...parsed,
      customers,
      dialRows: customers.map(dialFromCustomer),
      errors: parsed.errors.filter((e) => !/point of contact required/i.test(e)),
    };
  }
  return {
    ...parsed,
    customers: parsed.customers.map((c) => overlayCustomer(c)),
    dialRows: parsed.dialRows,
  };
}

/** Inspect sheet, normalise via API when possible, else parse locally. */
export async function normalizeLeadSheet(
  text: string,
  batchId: string,
): Promise<ParsedSallyLeadSheet> {
  const inspected = inspectLeadSheet(text);
  let apiRows: NormalizedLeadRow[] | null = null;
  try {
    apiRows = await fetchNormalizedRows(inspected);
  } catch {
    apiRows = null;
  }

  const parsed = sallyParser.parseSallyLeadSheetCsv(text, { batchId });
  if (apiRows?.length) {
    return mergeParsedWithApi(parsed, apiRows, batchId);
  }
  return {
    ...parsed,
    customers: parsed.customers.map((c) => overlayCustomer(c)),
  };
}
