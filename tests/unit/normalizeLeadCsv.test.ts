import { describe, it, expect } from 'vitest';
import { buildNormalizeCsvPayload, inspectLeadSheet } from '../../src/app/engine/data/normalizeLeadCsv';

describe('buildNormalizeCsvPayload', () => {
  it('always includes full rows even when the sheet has more than 250 lines', () => {
    const header = 'company_name,phone';
    const body = Array.from({ length: 251 }, (_, i) => {
      const nsn = String(1200000000 + i);
      return `Venue ${i},${nsn}`;
    });
    const text = [header, ...body].join('\n');
    const inspected = inspectLeadSheet(text);
    expect(inspected.rows).toHaveLength(251);

    const payload = buildNormalizeCsvPayload(inspected);
    expect(payload.sampleRows).toHaveLength(8);
    expect(payload.rows).toHaveLength(251);
    expect(payload.rows[0][1]).toBe('1200000000');
    expect(payload.rows[250][1]).toBe('1200000250');
  });

  it('keeps 01494 and 01865 phones in the full rows payload', () => {
    const text = [
      'company_name,phone',
      'Golden Palace,1494437982',
      'Little Four Seasons,1865817005',
    ].join('\n');
    const payload = buildNormalizeCsvPayload(inspectLeadSheet(text));
    expect(payload.rows).toHaveLength(2);
    expect(payload.rows[0][1]).toBe('1494437982');
    expect(payload.rows[1][1]).toBe('1865817005');
  });
});
