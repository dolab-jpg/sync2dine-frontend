import { executeSallySalesPhoneTool, resolveMeetingConfirmOutcome } from './server/sally-sales-phone.ts';
import { getDataStore } from './server/data-store.ts';

const when = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const r = await executeSallySalesPhoneTool(
  'bookIntegrationMeeting',
  {
    when,
    name: 'Dolab',
    phone: '+447464207366',
    restaurant: 'Pizza Go Go',
    postcode: 'GU12 5QW',
    attendeeHint: 'owner',
  },
  { partyPhone: '+447464207366' },
);
console.log('book', JSON.stringify(r, null, 2));

const store = getDataStore();
const cust = store.customers.find((c) => String(c.id) === String(r.customerId));
console.log('meeting', JSON.stringify(cust?.meeting || null, null, 2));
const confirmJobs = (store.outboundQueue || []).filter((j) => {
  const ctx = j.context && typeof j.context === 'object' ? j.context : {};
  return String(ctx.aim || '') === 'meeting_confirm' && String(j.status) === 'queued';
});
console.log('confirm_jobs', confirmJobs.length, confirmJobs[0]?.scheduledAt, confirmJobs[0]?.bypassQuietHours);

// Simulate no-answer cancel
const cancel = resolveMeetingConfirmOutcome({
  customerId: String(r.customerId || ''),
  partyPhone: '+447464207366',
  callId: 'smoke-confirm-noanswer',
  endedReason: 'customer-did-not-answer',
  answered: false,
});
console.log('cancel_sim', cancel);
const cust2 = getDataStore().customers.find((c) => String(c.id) === String(r.customerId));
console.log('meeting_after_cancel', JSON.stringify(cust2?.meeting || null, null, 2));
console.log('SMOKE_OK');
