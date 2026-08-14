---
name: sync2dine-phone-change
description: Change Judie/Sally phone, Vapi, DID, or phone tools safely.
---

# Sync2Dine phone change

## When

Vapi, DID routing, Judie/Sally brains, phone tools, voices, staff PIN, SIP credentials,
Asterisk Soho66 bridge, "Go live".

## Open

- `../sync2dine-backend/docs/PHONE_ARCHITECTURE.md`
- `../sync2dine-backend/docs/AI_REGISTRY.md`
- `../sync2dine-backend/docs/TOOL_REGISTRY.md` (phone_* surfaces)
- `server/brains/{judie,sally}/`, `server/phone/vapi-routes.ts`, `vapi-assistant.ts`
- Sally overlay: `server/phone/sally-sales-phone.ts` + offer `server/sally/offer.ts`
- Spoken brand: `SYNC2DINE_SPOKEN` in `server/home-org.ts` (**sync Two dine**). CRM queue: `outbound-campaigns` `allCrm` — see SALLY_ARCHITECTURE.
- Multi-line REGISTER SoT: `server/telephony/asteriskBridge.ts`, `server/telephony/vapiByo.ts`
- Bridge runtime: `/var/www/vhosts/b-diddies.com/tradepro-sip-bridge` (`lines.json` + docker)

## Do not

- Edit `_quarantine/*` or `phone-orchestrator` for product
- Add a third BrainId (`aria` = Judie legacy purpose, not a third assistant)
- Assume `sally/tools.ts` full pack is on Vapi
- Use Builder Diddies / Cynthia-as-phone docs
- **Never single-swap the Asterisk `.env`** (retired: `.cursor/local/update-judie-sip-bridge.sh`).
  One SIP user in `.env` displaces every other REGISTER. Always republish the full set.
- Never claim Test success means live inbound — Test must also see a Vapi BYO for the DID.

## Go live (N concurrent REGISTERs)

1. Save SIP credentials per client (Judie) or on Sally offer (Sally).
2. Click **Go live (all lines)** (or `POST /api/platform/phone-lines/sync-asterisk-bridge {"apply":true}`).
3. That path:
   - Collects EVERY enabled `aria` + `sally` line across orgs
   - Writes `lines.json` (full replace)
   - Recreates the Asterisk container so N SIP accounts REGISTER concurrently
   - Ensures a Vapi BYO number exists for each DID on `VAPI_SIP_CREDENTIAL_ID` with
     `server.url` → `https://app.sync2dine.io/webhooks/vapi`
4. Proof both lines stay up: `docker exec tradepro-sip-bridge asterisk -rx 'pjsip show registrations'`
   must show `Registered` for **each** `reg-<sipUsername>`. Re-running Go live must not drop any.

## Verify

- `npm test` (phone-lines includes `parseRegistrationStatuses` — Unregistered ≠ Registered)
- Live: `GET /api/platform/phone-lines/ai-set` (exactly the AI set, passwords masked)
- Live: `GET /api/platform/sally-offer` (200, not 404 — otherwise Sally UI blanks the phone card)
- Controlled `assistant-request` smokes per DID (Sally sales tools vs Judie)
- `node scripts/vapi-ensure-byo.mjs +44…` idempotent BYO check
- Update TOOL_REGISTRY / AI_REGISTRY if tools or surfaces change
- `npm run extract:registries` + `check:agent-maps` if discovery shifts
- Deploy: `bash scripts/push-live-local.sh` (probes SPA hash, `sally-offer`, `ai-set`, Go-live string)
