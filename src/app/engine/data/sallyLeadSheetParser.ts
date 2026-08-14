/**
 * Parse Google Sheet / CSV exports for Sally outbound dials.
 * Supports headers like company_name, phone, address, opening_hours, hours_monùhours_sun.
 */
import type { Customer } from '../../App';
import { parseCustomersCsv } from './dataImportExportService';

export type SallyDialRow = {
  company: string;
  contactName?: string;
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

export type SallyLeadSheetColumnMap = {
  restaurant?: string;
  contact?: string;
  phone?: string;
};

export type ParseSallyLeadSheetOpts = {
  batchId?: string;
  columnMap?: SallyLeadSheetColumnMap;
  defaultContact?: string;
};

export type InspectedLeadSheet = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
}

/**
 * Detect delimiter from the HEADER only.
 * Tabs win even when later data cells contain commas (Google Sheet TSV addresses).
 */
export function detectSheetDelimiter(headerLine: string): '\t' | ',' {
  return headerLine.includes('\t') ? '\t' : ',';
}

/**
 * Thin UK E.164 helper for dial rows (also used when DeepSeek is down).
 * 1296715055 / 01296715055 / 441296715055 / +441296715055 -> +441296715055
 * 07700900123 / +447700900123 -> +447700900123
 */
export function toUkE164(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (digits.startsWith('44')) return `+${digits}`;
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`;
  // 10-digit NSN missing leading 0 (landline 1ù or mobile 7ù), including a wrong + prefix.
  if (digits.length === 10 && (digits.startsWith('1') || digits.startsWith('7'))) {
    return `+44${digits}`;
  }
  if (trimmed.startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}

/** Stable UK phone key for dedupe (last 10 national digits). */
export function ukPhoneDigest(raw: string): string {
  const e164 = toUkE164(String(raw || '').trim());
  const digits = e164.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('44') && digits.length >= 12) return digits.slice(-10);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

/** Loose venue-name key so "No.1 Kitchen" matches re-imports. */
export function venueNameDigest(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Split CSV/TSV line respecting quotes. Pass delim from the header -- do not re-detect per data line. */
export function parseSheetLine(line: string, delim?: '\t' | ','): string[] {
  const d = delim ?? detectSheetDelimiter(line);
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
    } else if (ch === d || (d === ',' && (ch === ';' || ch === '|'))) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Sample headers + rows for DeepSeek / UI column mapping.
 * Empty header cells keep their column index (not collapsed).
 */
export function inspectLeadSheetCsv(text: string): InspectedLeadSheet {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { headers: [], rows: [], delimiter: ',' };
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const delimiter = detectSheetDelimiter(lines[0]);
  const headers = parseSheetLine(lines[0], delimiter);
  const rows = lines.slice(1).map((l) => parseSheetLine(l, delimiter));
  return { headers, rows, delimiter };
}

function colIndex(headers: string[], ...aliases: string[]): number {
  const norms = aliases.map((a) => normalizeHeader(a)).filter(Boolean);
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue; // blank header cells keep position but are not named
    if (norms.includes(h)) return i;
  }
  // Prefer exact company_name over bare "name" substring matches on lead_id etc.
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
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

/** Merge opening_hours or hours_monùhours_sun into one free-text string. */
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
  leadId: string;
}): string {
  const bits: string[] = [];
  if (opts.leadId) bits.push(`lead_id=${opts.leadId}`);
  const category = opts.get('category');
  if (category) bits.push(`Category: ${category}`);
  const cuisine = opts.get('cuisine_language') || opts.get('cuisine');
  if (cuisine) bits.push(`Cuisine/language: ${cuisine}`);
  const hours = mergeOpeningHoursFromRow(opts.get);
  if (hours) bits.push(`Hours: ${hours}`);
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
 * Blank / missing contact_name fills defaultContact ('Manager') instead of rejecting the row.
 */
export function parseSallyLeadSheetCsv(text: string, opts?: ParseSallyLeadSheetOpts): ParsedSallyLeadSheet {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { dialRows: [], customers: [], errors: ['CSV is empty.'] };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const delim = detectSheetDelimiter(lines[0]);
  const headerCells = parseSheetLine(lines[0], delim).map(normalizeHeader);
  const hasHeader =
    headerCells.some((h) => h === 'phone' || h.includes('phone'))
    && headerCells.some((h) =>
      h === 'restaurant_name'
      || h === 'restaurant'
      || h === 'venue_name'
      || h === 'company_name'
      || h === 'company'
      || h === 'name'
      || h === 'business_name'
      || h === 'lead_id'
    );

  const headers = hasHeader ? headerCells : ['company', 'phone'];
  const body = hasHeader ? lines.slice(1) : lines;
  const map = opts?.columnMap;
  const defaultContact = opts?.defaultContact || 'Manager';

  const companyI = colIndex(
    headers,
    ...(map?.restaurant ? [map.restaurant] : []),
    'restaurant_name',
    'restaurant',
    'venue_name',
    'company_name',
    'company',
    'business_name',
    'name',
  );
  const contactI = colIndex(
    headers,
    ...(map?.contact ? [map.contact] : []),
    'contact_name',
    'contact',
    'contact_person',
    'manager',
    'owner',
    'point_of_contact',
    'poc',
  );
  const phoneI = colIndex(
    headers,
    ...(map?.phone ? [map.phone] : []),
    'phone',
    'telephone',
    'tel',
    'mobile',
  );
  const leadIdI = colIndex(headers, 'lead_id', 'leadid', 'id');
  // Avoid treating lead_id as company: if companyI resolved to lead_id column, fix.
  const companyIdx =
    companyI >= 0 && headers[companyI] === 'lead_id'
      ? colIndex(headers, 'restaurant_name', 'company_name', 'company', 'business_name')
      : companyI === leadIdI && leadIdI >= 0
        ? colIndex(headers, 'restaurant_name', 'company_name', 'company', 'business_name')
        : companyI;

  const dialRows: SallyDialRow[] = [];
  const errors: string[] = [];
  const batchId = opts?.batchId || `sales-${new Date().toISOString().slice(0, 10)}`;
  const seenPhones = new Set<string>();

  const headerGet = (h: string[], values: string[], key: string) => {
    const i = colIndex(h, key);
    return cell(values, i);
  };

  for (let r = 0; r < body.length; r++) {
    const values = parseSheetLine(body[r], delim);
    if (values.every((v) => !v.trim())) continue;

    const get = (key: string) => headerGet(headers, values, key);
    const phoneRaw =
      cell(values, phoneI >= 0 ? phoneI : 1)
      || values.find((p) => /\d{7,}/.test(p.replace(/\D/g, '')))
      || '';
    if (!phoneRaw || !/\d{7,}/.test(phoneRaw.replace(/\D/g, ''))) {
      errors.push(`Row ${r + (hasHeader ? 2 : 1)}: phone required.`);
      continue;
    }
    const phone = toUkE164(phoneRaw);
    const phoneKey = ukPhoneDigest(phone);
    if (phoneKey && seenPhones.has(phoneKey)) {
      errors.push(`Row ${r + (hasHeader ? 2 : 1)}: duplicate phone skipped (${phone}).`);
      continue;
    }
    if (phoneKey) seenPhones.add(phoneKey);

    let company = cell(values, companyIdx >= 0 ? companyIdx : 0);
    if (!company || /^\d+$/.test(company) || company === cell(values, leadIdI)) {
      company =
        get('restaurant_name')
        || get('restaurant')
        || get('venue_name')
        || get('company_name')
        || get('company')
        || get('business_name')
        || get('name')
        || '';
    }
    if (!company || company === phone || company === phoneRaw) {
      errors.push(`Row ${r + (hasHeader ? 2 : 1)}: restaurant name required.`);
      continue;
    }

    const contactName =
      cell(values, contactI)
      || get('contact_name')
      || get('contact')
      || get('manager')
      || get('owner')
      || defaultContact;

    const leadId = cell(values, leadIdI);
    const address = buildAddress(get);
    const openingHours = mergeOpeningHoursFromRow(get);
    const venueType = normalizeTakeawayVenue(get('category') || get('venue_type') || get('venue'));
    const notes = buildNotes({ get, leadId });

    dialRows.push({
      company,
      contactName,
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
  const csvHeader = 'id,restaurant_name,contact_name,phone,address,notes,source,campaign,leadBatchId,tags\n';
  const csvBody = dialRows
    .map((row) => {
      const esc = (v: string) => (/,|"|\n/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      return [
        esc(row.leadId || ''),
        esc(row.company),
        esc(row.contactName || ''),
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
