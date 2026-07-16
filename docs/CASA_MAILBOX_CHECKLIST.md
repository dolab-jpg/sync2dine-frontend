# CASA / Production Mailbox Checklist

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §19.1. This file is an ops checklist only.

Use this checklist before enabling live Gmail OAuth in production (Google CASA verification).

## OAuth & Security

- [ ] Register production OAuth client in Google Cloud Console (Web application).
- [ ] Authorized redirect URI: `https://app.b-diddies.com/api/mailbox/callback` (must match `MAILBOX_OAUTH_REDIRECT_BASE` / `APP_BASE_URL`).
- [ ] Set `MAILBOX_OAUTH_REDIRECT_BASE` to `https://app.b-diddies.com` (or equivalent HTTPS production base).
- [ ] Set `TOKEN_ENCRYPTION_KEY` to a strong secret (never commit). If unset, server uses a weak hardcoded dev fallback — do not ship that.
- [ ] Store OAuth client secrets in server env and/or Integrations Hub → `email_oauth` (persisted server-side) — not browser localStorage as SoT.
- [ ] Enable Google CASA assessment for restricted scope **`https://mail.google.com/`** (full mail — what the app requests; not `gmail.readonly`).
- [ ] Configure Microsoft Azure app registration for Outlook (tenant + redirect URIs).
- [ ] Configure Yahoo developer app if offering Yahoo connect.

## Data & Storage

- [ ] Know runtime SoT today: `server/data/mailbox-data.json` on the API host. Supabase mailbox tables are schema-only until Node is migrated.
- [ ] (Future) Run mailbox schema migration on production Supabase and migrate JSON → tables.
- [ ] Set `INTEGRATIONS_MOCK_MODE=false` (and/or `MAILBOX_MOCK_MODE=false`) in production for live OAuth.
- [ ] Prefer `AUTH_ENFORCED=true` so mailbox APIs require JWT (today default is header `X-User-Id` / `X-Org-Id` only).

## Infrastructure

- [ ] Deploy backend (`tradepro-backend` / `server/index.ts`) with mailbox poller running.
- [ ] Poller ticks every **60s**; each connection syncs when due per `pollIntervalSec` (default **180**). There is no `MAILBOX_POLL_INTERVAL_MS` env reader.
- [ ] Configure Gmail Pub/Sub push to `/webhooks/gmail` (optional, reduces poll lag).
- [ ] Configure Microsoft Graph change notifications to `/webhooks/outlook` (optional).
- [ ] Verify outbound SMTP/IMAP from production IP (some hosts block port 587/993).

## Load & Reliability

- [ ] Load-test IMAP sync with 10+ concurrent connections (target: sync within poll interval).
- [ ] Monitor token refresh failures (`needs_reconnect` status in UI).
- [ ] Alert on repeated `lastError` on mailbox connections.
- [ ] Cap cached message count per connection (archive old messages when migrating to Supabase storage).

## UX & Compliance

- [ ] Privacy policy mentions email access scope (`https://mail.google.com/`) and retention.
- [ ] Disconnect flow revokes refresh tokens (`DELETE /api/mailbox/connections/:id`).
- [ ] HTML email rendering uses sanitization (plain-text fallback in current Inbox UI).
- [ ] Customer-facing portal: only allow connect for own mailbox (org scoping).

## Nylas (not ready)

- [ ] `server/mailbox/providers/nylas-fallback.ts` is a **stub** — `MAILBOX_PROVIDER=nylas` is **not** wired. Do not treat Nylas as an operable CASA workaround until implemented.

## Verification Smoke Test

1. Connect Google account (live mode) from Settings → Email & Inbox — expect Google consent, not a mock toast.
2. Send test email to connected address; run Sync; confirm Inbox tab shows thread.
3. Compose reply with PDF attachment; confirm delivery.
4. Confirm inbound email triggers lead/Cynthia paths via `commsEventBus` and appears on project timeline when applicable.
5. Ask Cynthia / Builder Diddies AI: "List my recent emails" — confirm `listRecentEmails` tool works.
6. Integrations Hub → Check for updates — confirm imapflow/mailparser versions load.
