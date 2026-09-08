import assert from 'node:assert/strict';
import { parseSallyLeadSheetCsv } from '../../src/app/engine/data/sallyLeadSheetParser.ts';

const csv = [
  'lead_id,company_name,category,cuisine_language,agent_name,address,city,postcode,phone,phone_type,opening_hours,hours_mon,hours_tue,hours_wed,hours_thu,hours_fri,hours_sat,hours_sun',
  'L1,Acme Kebab,Takeaway,Turkish,Sally,1 High St,London,E1 1AA,+447700900111,landline,16:00-23:00,,,,,,,,',
  'L2,Night Chips,Takeaway,English,Sally,2 Road,Manchester,M1 1AA,+447700900222,mobile,,17:00-02:00,17:00-02:00,17:00-02:00,17:00-02:00,17:00-02:00,17:00-02:00,17:00-02:00',
].join('\n');

const parsed = parseSallyLeadSheetCsv(csv, { batchId: 'test-batch' });
assert.equal(parsed.dialRows.length, 2);
assert.equal(parsed.dialRows[0].company, 'Acme Kebab');
assert.notEqual(parsed.dialRows[0].company, 'L1');
assert.equal(parsed.dialRows[0].contactName, 'Manager');
assert.equal(parsed.dialRows[1].contactName, 'Manager');
assert.equal(parsed.dialRows[0].openingHours, '16:00-23:00');
assert.equal(parsed.dialRows[0].venueType, 'takeaway');
assert.match(parsed.dialRows[1].openingHours || '', /Mon:/);
assert.ok(parsed.customers.length >= 2);
console.log('sallyLeadSheetParser ok', parsed.dialRows.map((r) => ({ company: r.company, contact: r.contactName, hours: r.openingHours })));
