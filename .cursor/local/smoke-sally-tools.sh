#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  <<'EOF'
import { executeSallySalesPhoneTool, buildOfferTermsPayload, resolveCallbackIso } from './server/sally-sales-phone.ts';

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
EOF
