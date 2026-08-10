/**
 * Parse Google Sheet / CSV exports for Sally outbound dials.
 * Supports headers like company_name, phone, address, opening_hours, hours_mon…hours_sun.
 */
import type { Customer } from '../../App';
import { parseCustomersCsv } from './dataImportExportService';

export type SallyDialRow = {
  company: string;
  phone: string;
  customerId?: string;
  venueType?: string;
  openingHours?: string;
  notes?: string;
  address?: string;
  leadId?: string;
};

export type ParsedSallyLeadSheet = {
  dialRows: SallyDialRow[];
  customers: Customer[];
  errors: string[];
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
}

/** Split CSV/TSV line respecting quotes. */
export function parseSheetLine(line: string): string[] {
  const delim = line.includes('\t') && !line.includes(',') ? '\t' : ',';
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
    } else if (ch === delim || (delim === ',' && (ch === ';' || ch === '|'))) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function colIndex(headers: string[], ...aliases: string[]): number {
  const norms = aliases.map((a) => normalizeHeader(a));
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (norms.includes(h)) return i;
  }
  // Prefer exact company_name over bare "name" substring matches on lead_id etc.
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const a of norms) {
      if (a === 'name' && (h === 'name' || h === 'company' || h === 'company_name' || h === 'business_name')) {
        return i;
      }
      if (a !== 'name' && h === a) return i;
    }
  }
  return -1;
}

function cell(values: string[], index: number): string {
  return index >= 0 ? (values[index] ?? '').trim().replace(/^"|"$/g, '') : '';
}

/** Merge opening_hours or hours_mon…hours_sun into one free-text string. */
export function mergeOpeningHoursFromRow(
  get: (key: string) => string,
): string {
  const direct =
    get('opening_hours')
    || get('openinghours')
    || get('hours')
    || get('opening_hours_text');
  if (direct.trim()) return direct.trim();

  const parts: string[] = [];
  for (const day of DAY_KEYS) {
    const raw =
      get(`hours_${day}`)
      || get(`${day}_hours`)
      || get(day);
    const v = raw.trim();
    if (!v || /^closed$/i.test(v) || v === '-') continue;
    parts.push(`${DAY_LABELS[day]}: ${v}`);
  }
  return parts.join('; ');
}

function normalizeTakeawayVenue(category: string): string | undefined {
  const s = category.trim();
  if (!s) return 'takeaway';
  if (/takeaway|take-away|fish.?chip|kebab|pizza|delivery|indian|chinese|thai|chippy/i.test(s)) {
    return 'takeaway';
  }
  return s;
}

function buildAddress(get: (key: string) => string): string {
  return [get('address'), get('city'), get('postcode') || get('postal_code')]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

function buildNotes(opts: {
  get: (key: string) => string;
  address: string;
  leadId: string;
}): string {
  const bits: string[] = [];
  if (opts.leadId) bits.push(`lead_id=${opts.leadId}`);
  if (opts.address) bits.push(`Address: ${opts.address}`);
  const category = opts.get('category');
  if (category) bits.push(`Category: ${category}`);
  const cuisine = opts.get('cuisine_language') || opts.get('cuisine');
  if (cuisine) bits.push(`Cuisine/language: ${cuisine}`);
  const agent = opts.get('agent_name');
  if (agent) bits.push(`Agent: ${agent}`);
  const phoneType = opts.get('phone_type');
  if (phoneType) bits.push(`Phone type: ${phoneType}`);
  const notes = opts.get('notes');
  if (notes) bits.push(notes);
  return bits.join(' | ');
}

/**
 * Parse Sally lead sheet CSV/TSV (Google Sheet export) into dial rows + CRM customers.
 */
export function parseSallyLeadSheetCsv(text: string, opts?: { batchId?: string }): ParsedSallyLeadSheet {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { dialRows: [], customers: [], errors: ['CSV is empty.'] };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const headerCells = parseSheetLine(lines[0]).map(normalizeHeader);
  const hasHeader =
    headerCells.some((h) => h === 'phone' || h.includes('phone'))
    && headerCells.some((h) =>
      h === 'company_name'
      || h === 'company'
      || h === 'name'
      || h === 'business_name'
      || h === 'lead_id'
    );

  const headers = hasHeader ? headerCells : ['company', 'phone'];
  const body = hasHeader ? lines.slice(1) : lines;

  const companyI = colIndex(headers, 'company_name', 'company', 'business_name', 'name');
  const phoneI = colIndex(headers, 'phone', 'telephone', 'tel', 'mobile');
  const leadIdI = colIndex(headers, 'lead_id', 'leadid', 'id');
  // Avoid treating lead_id as company: if companyI resolved to lead_id column, fix.
  const companyIdx =
    companyI >= 0 && headers[companyI] === 'lead_id'
      ? colIndex(headers, 'company_name', 'company', 'business_name')
      : companyI === leadIdI && leadIdI >= 0
        ? colIndex(headers, 'company_name', 'company', 'business_name')
        : companyI;

  const dialRows: SallyDialRow[] = [];
  const errors: string[] = [];
  const batchId = opts?.batchId || `sales-${new Date().toISOString().slice(0, 10)}`;

  const headerGet = (h: string[], values: string[], key: string) => {
    const i = colIndex(h, key);
    return cell(values, i);
  };

  for (let r = 0; r < body.length; r++) {
    const values = parseSheetLine(body[r]);
    if (values.every((v) => !v.trim())) continue;

    const get = (key: string) => headerGet(headers, values, key);
    const phone =
      cell(values, phoneI >= 0 ? phoneI : 1)
      || values.find((p) => /\d{7,}/.test(p.replace(/\D/g, '')))
      || '';
    if (!phone || !/\d{7,}/.test(phone.replace(/\D/g, ''))) {
      errors.push(`Row ${r + (hasHeader ? 2 : 1)}: phone required.`);
      continue;
    }

    let company = cell(values, companyIdx >= 0 ? companyIdx : 0);
    if (!company || /^\d+$/.test(company) || company === cell(values, leadIdI)) {
      company =
        get('company_name')
        || get('company')
        || get('business_name')
        || get('name')
        || '';
    }
    if (!company || company === phone) {
      errors.push(`Row ${r + (hasHeader ? 2 : 1)}: company name required.`);
      continue;
    }

    const leadId = cell(values, leadIdI);
    const address = buildAddress(get);
    const openingHours = mergeOpeningHoursFromRow(get);
    const venueType = normalizeTakeawayVenue(get('category') || get('venue_type') || get('venue'));
    const notes = buildNotes({ get, address, leadId });

    dialRows.push({
      company,
      phone,
      customerId: leadId || undefined,
      venueType,
      openingHours: openingHours || undefined,
      notes: notes || undefined,
      address: address || undefined,
      leadId: leadId || undefined,
    });
  }

  // Build CRM customers via existing parser (synthetic CSV with aliases).
  const csvHeader = 'id,name,phone,address,notes,source,campaign,leadBatchId,tags\n';
  const csvBody = dialRows
    .map((row) => {
      const esc = (v: string) => (/,|"|\n/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      return [
        esc(row.leadId || ''),
        esc(row.company),
        esc(row.phone),
        esc(row.address || ''),
        esc(row.notes || ''),
        'purchased',
        esc(batchId),
        esc(batchId),
        esc(['sales-csv', 'sally', batchId].join(';')),
      ].join(',');
    })
    .join('\n');
  const { customers, errors: custErrors } = parseCustomersCsv(csvHeader + csvBody);
  errors.push(...custErrors);

  return { dialRows, customers, errors };
}
