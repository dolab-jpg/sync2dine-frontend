import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSheetDelimiter,
  inspectLeadSheetCsv,
  parseSallyLeadSheetCsv,
  parseSheetLine,
  toUkE164,
  ukPhoneDigest,
} from './sallyLeadSheetParser.ts';

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
    assert.equal(detectSheetDelimiter(TSV_HEADERS), '\t');
    const cells = parseSheetLine(TSV_ROW_CHUTNEY, detectSheetDelimiter(TSV_HEADERS));
    assert.equal(cells[0], 'Chutney Jacks');
    assert.ok(cells[3].includes('Winslow'));
    assert.ok(cells[3].includes(','));
    assert.equal(cells[6], '1296715055');
  });
});

describe('toUkE164', () => {
  it('normalises UK landlines missing +, 0, or 44', () => {
    assert.equal(toUkE164('1296715055'), '+441296715055');
    assert.equal(toUkE164('01296715055'), '+441296715055');
    assert.equal(toUkE164('+441296715055'), '+441296715055');
    assert.equal(toUkE164('441296715055'), '+441296715055');
  });

  it('normalises High Wycombe 01494 and Oxford 01865 missing leading 0', () => {
    assert.equal(toUkE164('1494437982'), '+441494437982');
    assert.equal(toUkE164('1865817005'), '+441865817005');
  });

  it('ukPhoneDigest matches bare NSN to E.164', () => {
    assert.equal(ukPhoneDigest('1296715055'), '1296715055');
    assert.equal(ukPhoneDigest('+441296715055'), '1296715055');
    assert.equal(ukPhoneDigest('01296715055'), '1296715055');
  });

  it('keeps mobiles as +4477', () => {
    assert.equal(toUkE164('+447700900123'), '+447700900123');
    assert.equal(toUkE164('07700900123'), '+447700900123');
    assert.equal(toUkE164('7700900123'), '+447700900123');
    assert.equal(toUkE164('+7700900123'), '+447700900123');
  });
});

describe('parseSallyLeadSheetCsv TSV without contact_name', () => {
  it('yields 2 dial rows with Manager and E.164 phones', () => {
    const parsed = parseSallyLeadSheetCsv(TSV_SHEET, { batchId: 'test-tsv' });
    assert.equal(parsed.dialRows.length, 2);
    assert.equal(parsed.dialRows[0].company, 'Chutney Jacks');
    assert.equal(parsed.dialRows[1].company, 'No.1 Kitchen');
    assert.equal(parsed.dialRows[0].contactName, 'Manager');
    assert.equal(parsed.dialRows[1].contactName, 'Manager');
    assert.equal(parsed.dialRows[0].phone, '+441296715055');
    assert.equal(parsed.dialRows[1].phone, '+441296658688');
    assert.ok(parsed.dialRows[0].address?.includes('Winslow'));
    assert.equal(parsed.errors.filter((e) => /point of contact/i.test(e)).length, 0);
  });

  it('inspectLeadSheetCsv keeps blank header columns and tab delimiter', () => {
    const inspected = inspectLeadSheetCsv(TSV_SHEET);
    assert.equal(inspected.delimiter, '\t');
    assert.equal(inspected.headers[0], 'company_name');
    assert.equal(inspected.headers[1], '');
    assert.equal(inspected.headers[2], '');
    assert.equal(inspected.headers[3], 'address');
    assert.equal(inspected.rows.length, 2);
    assert.ok(inspected.rows[0][3].includes('Winslow'));
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
    assert.equal(parsed.dialRows.length, 2);
    assert.equal(parsed.dialRows[0].contactName, 'Priya');
    assert.equal(parsed.dialRows[0].phone, '+447700900111');
    assert.equal(parsed.dialRows[1].phone, '+447700900123');
    assert.ok(parsed.dialRows[0].address?.includes('London'));
  });

  it('skips rows with missing phone and records an error', () => {
    const csv = [
      'company_name,contact_name,phone',
      'Silent Chippy,Manager,',
    ].join('\n');
    const parsed = parseSallyLeadSheetCsv(csv);
    assert.equal(parsed.dialRows.length, 0);
    assert.ok(parsed.errors.some((e) => /phone required/i.test(e)));
  });

  it('skips duplicate phones in the same sheet', () => {
    const csv = [
      'company_name,phone',
      'No.1 Kitchen,1296658688',
      'Top Chips Top Chef,1296658688',
      'Chutney Jacks,1296715055',
    ].join('\n');
    const parsed = parseSallyLeadSheetCsv(csv, { batchId: 'dup-test' });
    assert.equal(parsed.dialRows.length, 2);
    assert.equal(parsed.dialRows[0].company, 'No.1 Kitchen');
    assert.equal(parsed.dialRows[1].company, 'Chutney Jacks');
    assert.ok(parsed.errors.some((e) => /duplicate phone/i.test(e)));
  });

  it('parses 251+ rows including 01494 and 01865 area codes', () => {
    const header = 'company_name,phone,address,city,postcode';
    const rows = [
      'Golden Palace,1494437982,"11 Mentmore Rd",High Wycombe,HP12 4LU',
      'Little Four Seasons,1865817005,"65 London Rd",Headington,OX3 7RD',
      'Chutney Jacks,1296715055,"36A High St",Winslow,MK18 3HB',
    ];
    for (let i = 0; i < 248; i++) {
      // Unique 10-digit NSNs in the 1xxx geographic range (missing leading 0).
      const nsn = String(1200000000 + i);
      rows.push(`Venue ${i},${nsn},"${i} High St",Town,AB1 2CD`);
    }
    assert.equal(rows.length, 251);
    const parsed = parseSallyLeadSheetCsv([header, ...rows].join('\n'), { batchId: 'big-sheet' });
    assert.equal(parsed.dialRows.length, 251);
    assert.equal(parsed.customers.length, 251);
    assert.equal(parsed.dialRows[0].phone, '+441494437982');
    assert.equal(parsed.dialRows[1].phone, '+441865817005');
    assert.equal(parsed.dialRows[2].phone, '+441296715055');
  });
});
