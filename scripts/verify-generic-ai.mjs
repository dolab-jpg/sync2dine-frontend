/**
 * Lightweight verification for generic AI dataPolicy + readData behaviour.
 * Server modules live in the canonical tradepro-backend sibling checkout.
 * Run: npx --yes tsx scripts/verify-generic-ai.mjs
 */
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const backendServerUrl = new URL('../../tradepro-backend/server/', import.meta.url);
if (!existsSync(fileURLToPath(backendServerUrl))) {
  console.error(
    'tradepro-backend checkout not found at ../tradepro-backend.\n' +
    'Clone it as a sibling of this repo: git clone <tradepro-backend> ../tradepro-backend',
  );
  process.exit(1);
}

const { filterRecordsForRole, redactRecord, canReadCollection, canWriteCollection } =
  await import(new URL('dataPolicy.ts', backendServerUrl).href);
const { executeReadData } = await import(new URL('orchestrator-tool-exec.ts', backendServerUrl).href);
const { requiresSafetyConfirm } = await import('../src/app/engine/ai/actionPolicy.ts');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log('dataPolicy scoping');
const customerCtx = { role: 'customer', customerId: 'C001' };
const customers = [
  { id: 'C001', name: 'Alice', margin: 25, profit: 5000 },
  { id: 'C002', name: 'Bob', margin: 30 },
];
const scoped = filterRecordsForRole('customers', customers, customerCtx);
assert(scoped.length === 1 && scoped[0].id === 'C001', 'customer sees only own record');
const redacted = redactRecord('customer', customers[0]);
assert(!('margin' in redacted) && !('profit' in redacted), 'customer record redacts financial fields');
assert(canReadCollection('staff', 'customers'), 'staff can read customers');
assert(!canReadCollection('customer', 'builders'), 'customer cannot read builders');
assert(!canWriteCollection('customer', 'customers', 'delete'), 'customer cannot delete customers');
assert(canWriteCollection('staff', 'customers', 'create'), 'staff can create customers');

console.log('\nbuilder project scope');
const builderCtx = { role: 'builder', builderId: 'B1' };
const projects = [
  { id: 'P1', assignedBuilder: 'B1', profit: 1000 },
  { id: 'P2', assignedBuilder: 'B2', profit: 2000 },
];
const builderProjects = filterRecordsForRole('projects', projects, builderCtx);
assert(builderProjects.length === 1 && builderProjects[0].id === 'P1', 'builder sees assigned project only');

console.log('\nexecuteReadData (customer)');
const body = {
  messages: [],
  customerContext: { role: 'customer', customerId: 'C001' },
  dataContext: {
    customers,
    quotes: [{ id: 'Q1', customerId: 'C001', margin: 10 }, { id: 'Q2', customerId: 'C002' }],
  },
};
const readOwn = executeReadData({ collection: 'customers' }, body);
assert(readOwn.allowed === true && readOwn.count === 1, 'readData returns scoped customer records');
assert(!readOwn.records?.[0]?.margin, 'readData redacts margin on server');

const readDenied = executeReadData({ collection: 'builders' }, body);
assert(readDenied.allowed === false, 'readData denies builders collection for customer');

const readOther = executeReadData({ collection: 'quotes', query: 'C002' }, body);
assert(readOther.count === 0, 'customer cannot read other customer quotes via query');

console.log('\nexecuteReadData (staff)');
const staffBody = {
  messages: [],
  staffContext: { role: 'staff', customers, quotes: [] },
  dataContext: { customers },
};
const staffRead = executeReadData({ collection: 'customers' }, staffBody);
assert(staffRead.count === 2, 'staff sees all customers');
assert(staffRead.records?.[0]?.margin === 25, 'staff sees financial fields');

console.log('\nactionPolicy delete confirm');
assert(
  requiresSafetyConfirm('writeData', false, { operation: 'delete', collection: 'customers' }),
  'writeData delete requires safety confirm'
);
assert(
  !requiresSafetyConfirm('writeData', false, { operation: 'create', collection: 'customers' }),
  'writeData create runs without confirm'
);
assert(!requiresSafetyConfirm('saveCustomer'), 'saveCustomer does not require delete-style confirm');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
