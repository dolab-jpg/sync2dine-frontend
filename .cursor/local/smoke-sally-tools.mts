import { executeSallySalesPhoneTool, buildOfferTermsPayload, resolveCallbackIso } from './sally-sales-phone.ts';
import { getDataStore } from './data-store.ts';

const offer = buildOfferTermsPayload();
console.log('OFFER', JSON.stringify({
  ok: offer.ok,
  packages: (offer.packages as unknown[]).length,
  demo: offer.demoPhone,
  spoken: offer.spokenDemoPhone,
  iso: resolveCallbackIso('tomorrow 4pm'),
}, null, 2));

const follow = await executeSallySalesPhoneTool('sendSalesFollowUp', {
  channel: 'email',
  toEmail: 'dolab@dolab.me',
  includeDemoPhone: true,
  body: 'Smoke test from Sally pricing close deploy.',
}, { partyPhone: '+447464207366', callId: 'smoke-sally-pricing' });
console.log('EMAIL', JSON.stringify(follow, null, 2));

const booked = await executeSallySalesPhoneTool('bookDemo', {
  when: 'tomorrow 4pm',
  name: 'Dolab',
  phone: '+447464207366',
  email: 'dolab@dolab.me',
  restaurant: 'Pizza Go Go',
  postcode: 'GU12 5QW',
  notes: 'Smoke bookDemo after pricing close deploy',
}, { partyPhone: '+447464207366', callId: 'smoke-sally-pricing' });
console.log('BOOK', JSON.stringify(booked, null, 2));

const store = getDataStore();
const cust = store.customers.find((c) => String(c.phone || '').includes('7464207366') || String(c.id) === '1784487882245');
console.log('CUSTOMER', cust ? JSON.stringify({
  id: cust.id,
  name: cust.name,
  address: cust.address,
  email: cust.email,
  nextFollowUp: cust.nextFollowUp,
  notes: String(cust.notes || '').slice(0, 200),
}, null, 2) : 'not found');

const jobs = (store.outboundJobs || []).filter((j: Record<string, unknown>) =>
  String(j.scheduledAt || '').includes('2026-07-21') || String((j.context as Record<string, unknown>)?.postcode || '') === 'GU12 5QW'
).slice(-3);
console.log('JOBS', JSON.stringify(jobs.map((j: Record<string, unknown>) => ({
  id: j.id,
  to: j.to,
  status: j.status,
  scheduledAt: j.scheduledAt,
  template: j.template,
})), null, 2));
