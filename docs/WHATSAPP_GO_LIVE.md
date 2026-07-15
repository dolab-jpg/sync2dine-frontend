# WhatsApp Go-Live Checklist (WhatsApp Web only)

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §18. This file is an ops checklist only.

## Current path — WhatsApp Web.js (LIVE)

Path B Meta Cloud API is **disabled permanently** (`WHATSAPP_META_ENABLED` off). Do not configure Meta credentials on production.

1. Deploy / run **tradepro-backend** with WWeb client (`initWWebClient` on listen)
2. Log in as **Super Admin** → **Integrations → WhatsApp Web**
3. Scan the **QR** with a long-lived real WhatsApp number on your phone
4. Confirm status `ready` (`GET /api/whatsapp-web/status` → 200)
5. Keep `INTEGRATIONS_MOCK_MODE=false`
6. On VPS: leave Meta env blank (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_APP_SECRET`); leave `WHATSAPP_META_ENABLED` unset or `false`
7. Prefer project mode **WhatsApp 1:1 + portal** (Meta group create returns 503)

Session files live under `tradepro-backend/server/data/.wwebjs_auth/` — **DO_NOT_SHIP** / never wholesale scp.

## UK compliance

- Obtain explicit **WhatsApp opt-in** before marketing messages (stored on customer record)
- Update privacy policy to mention WhatsApp communications
- Honour opt-out requests promptly

## Local / product testing

- Use **Integrations → WhatsApp Web** QR (prod API), not the legacy frontend `server/` Meta paths
- Use **Simulate inbound WhatsApp (dev)** on the Integrations card to exercise Cynthia without a live send when needed

---

## Archived — Meta Cloud API (not in use)

The following Meta Business / WABA steps are **archived**. Path B source remains cold in the repo; **do not enable** `WHATSAPP_META_ENABLED` in production.

<details>
<summary>Historical Meta WABA checklist (do not use)</summary>

1. Create a Meta Business Manager account
2. Create a Meta Developer App and add the WhatsApp product
3. Link a WhatsApp Business Account (WABA)
4. Verify a dedicated Cloud API phone number
5. Generate a permanent access token (Phone Number ID, Business Account ID, App Secret)
6. Point webhook to `https://your-api.example.com/webhooks/whatsapp`
7. Approve message templates for outside-24h outbound

</details>
