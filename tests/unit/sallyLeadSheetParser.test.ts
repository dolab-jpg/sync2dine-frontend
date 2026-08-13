import { describe, expect, it } from 'vitest';
import {
  detectSheetDelimiter,
  inspectLeadSheetCsv,
  parseSallyLeadSheetCsv,
  parseSheetLine,
  toUkE164,
} from '../../src/app/engine/data/sallyLeadSheetParser';

const TSV_HEADERS = [
  'company_name',
  '',
  '',
  'address',
  'city',
  'postcode',
  'phone',
  'phone_type',
  'opening_hours',
  'hours_mon',
  'hours_tue',
  'hours_wed',
  'hours_thu',
  'hours_fri',
  'hours_sat',
  'hours_sun',
  'website',
].join('\t');

const TSV_ROW_CHUTNEY = [
  'Chutney Jacks',
  '',
  '',
  '36A High St, Winslow, Buckingham MK18 3HB, United Kingdom',
  'Winslow',
  'MK18 3HB',
  '1296715055',
  'landline',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
].join('\t');

const TSV_ROW_NO1 = [
  'No.1 Kitchen',
  '',
  '',
  'High St, Waddesdon, Aylesbury HP18 0JA, United Kingdom',
  'Waddesdon',
  'HP18 0JA',
  '1296658688',
  'landline',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
].join('\t');

const TSV_SHEET = [TSV_HEADERS, TSV_ROW_CHUTNEY, TSV_ROW_NO1].join('\n');

describe('detectSheetDelimiter / parseSheetLine', () => {
  it('treats a tab header as TSV even when data cells contain commas', () => {
    expect(detectSheetDelimiter(TSV_HEADERS)).toBe('\t');
    const cells = parseSheetLine(TSV_ROW_CHUTNEY, detectSheetDelimiter(TSV_HEADERS));
    expect(cells[0]).toBe('Chutney Jacks');
    expect(cells[3]).toContain('Winslow');
    expect(cells[3]).toContain(',');
    expect(cells[6]).toBe('1296715055');
  });
});

describe('toUkE164', () => {
  it('normalises UK landlines missing +, 0, or 44', () => {
    expect(toUkE164('1296715055')).toBe('+441296715055');
    expect(toUkE164('01296715055')).toBe('+441296715055');
    expect(toUkE164('+441296715055')).toBe('+441296715055');
    expect(toUkE164('441296715055')).toBe('+441296715055');
  });

  it('keeps mobiles as +4477…', () => {
    expect(toUkE164('+447700900123')).toBe('+447700900123');
    expect(toUkE164('07700900123')).toBe('+447700900123');
  });
});

describe('parseSallyLeadSheetCsv TSV without contact_name', () => {
  it('yields 2 dial rows with Manager and E.164 phones', () => {
    const parsed = parseSallyLeadSheetCsv(TSV_SHEET, { batchId: 'test-tsv' });
    expect(parsed.dialRows).toHaveLength(2);
    expect(parsed.dialRows[0].company).toBe('Chutney Jacks');
    expect(parsed.dialRows[1].company).toBe('No.1 Kitchen');
    expect(parsed.dialRows[0].contactName).toBe('Manager');
    expect(parsed.dialRows[1].contactName).toBe('Manager');
    expect(parsed.dialRows[0].phone).toBe('+441296715055');
    expect(parsed.dialRows[1].phone).toBe('+441296658688');
    expect(parsed.dialRows[0].address).toContain('Winslow');
    expect(parsed.errors.filter((e) => /point of contact/i.test(e))).toHaveLength(0);
  });

  it('inspectLeadSheetCsv keeps blank header columns and tab delimiter', () => {
    const inspected = inspectLeadSheetCsv(TSV_SHEET);
    expect(inspected.delimiter).toBe('\t');
    expect(inspected.headers[0]).toBe('company_name');
    expect(inspected.headers[1]).toBe('');
    expect(inspected.headers[2]).toBe('');
    expect(inspected.headers[3]).toBe('address');
    expect(inspected.rows).toHaveLength(2);
    expect(inspected.rows[0][3]).toContain('Winslow');
  });
});

describe('parseSallyLeadSheetCsv comma CSV with contact_name', () => {
  it('still parses quoted addresses and named contacts', () => {
    const csv = [
      'company_name,contact_name,address,city,postcode,phone',
      'Acme Kebab,Priya,"1 High St, London",London,E1 1AA,+447700900111',
      'Night Chips,Omar,"2 Road, Manchester",Manchester,M1 1AA,07700900123',
    ].join('\n');
    const parsed = parseSallyLeadSheetCsv(csv, { batchId: 'test-csv' });
    expect(parsed.dialRows).toHaveLength(2);
    expect(parsed.dialRows[0].contactName).toBe('Priya');
    expect(parsed.dialRows[0].phone).toBe('+447700900111');
    expect(parsed.dialRows[1].phone).toBe('+447700900123');
    expect(parsed.dialRows[0].address).toContain('London');
  });

  it('skips rows with missing phone and records an error', () => {
    const csv = [
      'company_name,contact_name,phone',
      'Silent Chippy,Manager,',
    ].join('\n');
    const parsed = parseSallyLeadSheetCsv(csv);
    expect(parsed.dialRows).toHaveLength(0);
    expect(parsed.errors.some((e) => /phone required/i.test(e))).toBe(true);
  });
});
