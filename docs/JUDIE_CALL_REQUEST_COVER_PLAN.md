# Judie call, request-card, and overflow-cover plan

## Status

This plan has not been implemented yet. No product code, database migration, commit, push, or production deployment was created from it.

Implementation previously stopped before editing because Cursor's mandatory internal-browser MCP was unavailable. Before UI work resumes, `cursor-ide-browser` must expose navigation, refresh, and screenshot tools.

Execute the work in independently testable batches:

1. Judie call safety.
2. Request persistence.
3. Request cards.
4. PAYG billing and checkout.
5. Sally cover proposition.
6. Optional scheduled cover.

Preserve all unrelated uncommitted work.

## Audit conclusions

- Caller requests currently reach operational cards only partially.
- Order notes and allergies usually reach kitchen and delivery, but compact cards truncate them.
- Item-level requests such as "no lettuce", "extra sauce", or "sauce on the side" are not reliably attached to the relevant item.
- Menu option and upgrade selections are not persisted in placed order lines.
- Booking notes appear only after opening Details.
- Generic messages, transfer reasons, and guest callback reasons do not have a reliable operational card.
- Some Vapi metering, recording, and transcript writes use the demo organisation instead of the DID-resolved organisation.
- A valid restaurant call can fall back to the demo kitchen if assistant construction times out.
- Judie's warm-transfer assistant still identifies itself to staff as Cynthia from Builder Diddies.
- Judie diners receive a broader phone-tool set than they require.
- `judie_payg_inbound` already exists. Keep this package ID.
- PAYG is a weekly inbound package: �46 launch, �77 standard, 60 included AI minutes, then �0.45 per minute. It is not true usage-only billing.
- A manually provisioned Judie DID can be supplied for a venue to forward calls to during sickness, overflow, or after-hours cover.
- Automated carrier diversion, instant number allocation, and scheduled cover are not currently live and must not be advertised as live.

## Phase 0 � Baseline and isolation

- Capture focused frontend and backend diffs before editing.
- Run existing tests to establish a baseline.
- Treat unrelated dirty files as out of scope.
- Open the live kitchen, delivery, bookings, calls, pricing/start, and platform-client Judie pages in Cursor's internal browser before UI edits.
- Freeze compatibility expectations:
  - No package ID changes.
  - Preserve existing `[[s2d:...]]` order-note metadata.
  - Preserve order statuses, bump actions, payment behavior, and POS payloads.
  - Do not alter Sally, Cynthia, Atmosphere, or construction routing.

## Phase 1 � Fix Judie call-path safety

### Correct organisation attribution

Update [vapi-routes.ts](../sync2dine-backend/server/phone/vapi-routes.ts) so usage, transcripts, and recording ingestion use the organisation resolved from the inbound DID and stored call metadata. Remove remaining demo-org `phoneOrgId()` fallbacks from live Judie finalisation.

### Safe assistant timeout

Resolve the DID before racing assistant construction. If construction times out:

- Return a minimal assistant scoped to the same restaurant; or
- Fail closed with a clear phone incident.

Never load another restaurant's demo menu.

### Correct transfer identity

Parameterise [transfer-numbers.ts](../sync2dine-backend/server/phone/transfer-numbers.ts):

- Judie: "Judie from Restaurant Name".
- Sally: Sally / Sync2Dine.
- Cynthia: Cynthia / the configured construction company.

The staff member receiving a warm transfer must receive the correct caller reason and restaurant identity.

### Diner-only tool pack

Create a Judie diner allowlist containing only:

- Menu and delivery tools.
- Order tools.
- Reservation tools.
- Message and callback tools.
- Human transfer.
- Language and call control.

Do not expose construction, recruitment, quote, or unrelated CRM tools to diner calls.

### Phone incidents

Record these failures in the existing phone-incidents surface without delaying Vapi responses:

- Unknown DID.
- Assistant timeout.
- Tool timeout or failure.
- Ambiguous order completion.
- Finalisation failure.

## Phase 2 � Make requests durable

### Order-level requests

Judie must explicitly collect general kitchen and delivery instructions:

- "Leave at the door."
- "Ring twice."
- "Include extra napkins."

Persist these through `placeFoodOrder.notes`.

### Item-level requests

When the caller says:

- "Burger with no lettuce."
- "Extra sauce on the kebab."
- "Sauce on the side."
- "Make the curry extra spicy."

Judie must attach the request to the exact item, not only to a general order note.

Add optional fields to `placeFoodOrder.items[]`:

```ts
{
  name: string;
  qty: number;
  notes?: string;
  selectedOptions?: Array<{
    group: string;
    choice: string;
  }>;
}
```

Validate selected options against the restaurant menu in [order-service.ts](../../sync2dine-backend/server/orders/order-service.ts). Persist the optional fields in the existing `orders.items` JSONB, so no table migration is required.

Compatible POS connectors should receive item notes. Connectors without modifier support must retain a readable order-level fallback rather than silently dropping the request.

### Allergies

- Keep `customerAllergies` and `allergyConfirmed` as structured fields.
- Keep a prominent red kitchen warning.
- Do not rely only on merged notes.
- Do not silently truncate safety warnings.

### Bookings

- Preserve and merge booking notes when a reservation is updated.
- Show requirements such as high chair, wheelchair access, birthday, or window table on the booking list card.
- Keep complete text in Details.

### Messages and transfers

- Deep-merge call metadata instead of replacing it.
- Persist captured message text, department, urgency, and transfer reason.
- A taken message must produce a visible request block in Call Centre or Call Register, not only an outcome badge.

### Callbacks

- Retain callback reason and brief for guest callers.
- Show the reason in the outbound queue/request surface.

### Order timeout and deduplication

Remove the ambiguous six-second order race where Judie can announce failure while the order saves later.

The final behavior must:

- Produce one authoritative order result.
- Avoid accidental duplicate orders.
- Never let source-call deduplication silently discard added items or new requests.
- Record an incident when completion remains ambiguous.

## Phase 3 � Make requests visible

Update:

- [RestaurantOrders.tsx](../src/app/components/RestaurantOrders.tsx)
- [foodOrderTypes.ts](../src/app/engine/restaurant/foodOrderTypes.ts)
- [BookingsBoard.tsx](../src/app/components/restaurant/BookingsBoard.tsx)
- Call Centre and Call Register request surfaces.

Kitchen and delivery cards should render item requests clearly:

```text
Burger
NO LETTUCE � EXTRA SAUCE

Chips
NO SALT

Order request
Extra napkins
```

Requirements:

- Compact cards show a prominent two-line summary without hiding the existence of a request.
- Details show complete text.
- Item notes remain attached to their correct dish.
- Allergies remain visually distinct.
- Delivery instructions are visible on delivery cards.
- Booking requirements are visible without opening Details.
- Generic messages and transfer reasons have a named operational card.
- CSV exports include order and item notes.
- Existing payment, bump, timing, recording, and POS controls remain unchanged.

## Phase 4 � Repair PAYG commercial wiring

### Preserve package identity

Carry `judie_payg_inbound` through:

- Sally terms.
- Signed contract.
- CRM sale.
- Organisation provisioning.
- `organizations.saas_package_id`.
- Weekly usage billing.

Keep a legacy `plan: starter` value only where compatibility requires it. Never infer PAYG allowances from that legacy plan when an explicit package ID exists.

### Package-aware Stripe checkout

Sally's Stripe link currently builds package-specific line items and then discards them for legacy plan pricing.

Create one package-aware checkout service used by:

- Sally signed-contract checkout.
- SaaS quotes.
- Public `/start` checkout.

Stripe amounts must come from the signed package and billing interval.

### Setup fee

Carry the platform-configured one-off setup fee through:

1. Offer.
2. Terms confirmation.
3. Contract.
4. Quote.
5. Stripe line item.

Do not hard-code a new setup-fee amount.

### PAYG enforcement

- Test PAYG's 60-minute allowance and �0.45 overage.
- Enforce `inboundOnly` for restaurant outbound tools.
- Add overage-action enforcement only after package resolution is proven.
- Initially scope enforcement to organisations with explicit `saas_package_id = judie_payg_inbound`.

## Phase 5 � Productise honest temporary and overflow cover

Use the existing PAYG package. Do not create parallel sickness or overflow package IDs.

Add sales-intent metadata:

- `full_time`
- `temporary_cover`
- `sickness_cover`
- `peak_overflow`
- `after_hours`

This metadata describes why the customer bought Judie; it does not alter price by itself.

Approved proposition:

> Sync2Dine provisions a dedicated Judie number. The venue forwards its main line when it wants cover. Judie is customised with the venue identity, menu, delivery rules, bookings, transfer destinations, and operational requests.

Required disclosure:

- PAYG is a weekly subscription with included minutes and overage.
- Number and SIP setup are currently assisted/manual.
- The venue or its carrier controls the forward/divert rule.

Update:

- Sally offer facts and objection handling.
- Sally phone sales wording.
- Approved Sally knowledge.
- Pricing and start copy.
- Quotes and sales emails.
- [OrgJudiePhoneCredentials.tsx](../src/app/components/platform/OrgJudiePhoneCredentials.tsx) with onboarding status and safe forwarding instructions.

Do not claim:

- Instant number assignment.
- Automatic carrier configuration.
- Schedule-based routing.
- Usage-only billing.

## Phase 6 � Optional scheduled cover

Implement only after the core rollout is stable and customers require Sync2Dine-managed schedules.

Add optional configuration inside existing `agent_settings.data`:

- `coverMode`
- `coverUntil`
- Schedule.
- Fallback number.

Safety rules:

- Default `coverMode` to `always`.
- Gate only DID routes where `purpose === 'aria'`.
- Never apply cover rules to Sally or Cynthia.
- Require a valid fallback number before enabling a non-always mode.
- Preserve existing AI-capacity overflow independently.
- Roll back by resetting `coverMode` to `always`.

## Acceptance tests

### Request guarantee

A controlled Judie call must contain at least:

- Burger: no lettuce, extra sauce.
- Chips: no salt.
- Whole order: extra napkins.
- A declared allergy.

Prove each value remains correct through:

1. Vapi tool arguments.
2. Order service.
3. Supabase.
4. Orders API.
5. Kitchen card.
6. Delivery card where applicable.
7. Detail view.
8. CSV.
9. Compatible POS output.

### Other request types

Prove:

- Booking requirement on booking card.
- Generic message on Call Centre/Register.
- Transfer reason preserved for staff.
- Callback reason visible in the queue.

### Phone safety

Prove:

- DID and menu stay organisation-scoped.
- Assistant timeout never loads demo-kitchen data for another restaurant.
- Usage, transcripts, and recordings use the correct organisation.
- Transfer branding matches Judie, Sally, or Cynthia.
- Judie receives only diner tools.
- Failures create phone incidents.

### Commercial

Prove:

- PAYG contract provisions the explicit PAYG package.
- Stripe test-mode amount matches the signed package and interval.
- Setup fee appears exactly once.
- Weekly metering uses PAYG allowance and overage.
- Inbound-only blocks restaurant outbound behavior without affecting Sally sales calls.

## Regression checks

Run:

- Backend `npm test`.
- Backend typecheck, separating pre-existing errors from introduced errors.
- Frontend `npm run test:bridge`.
- Focused Playwright tests.
- Frontend and backend `npm run check:agent-maps`.
- Registry extraction when tool discovery changes.
- Order and Sally live smokes.

Also verify unchanged behavior for:

- Sally phone and Sally Web.
- Cynthia web and Cynthia construction phone.
- Atmosphere.
- Restaurant till.
- Meal deals.
- Delivery.
- POS connectors.
- Existing order bump and payment actions.

## Production rollout

Deploy independently reversible batches:

1. Phone safety fixes.
2. Request persistence and cards.
3. PAYG provisioning and checkout.
4. Sally cover proposition.
5. Optional cover controls.

For every UI batch:

- Refresh the live page in Cursor's internal browser.
- Capture screenshot proof.

For phone and API batches:

- Run controlled test calls.
- Verify `/health`.
- Verify `/api/vapi/health`.
- Verify order, reservation, usage, and incident records.
- Verify correct organisation attribution.
- Verify Stripe test-mode amounts before enabling production checkout.

Only update architecture, capability, tool, route, and application-master documentation after the corresponding behavior is proven live.
