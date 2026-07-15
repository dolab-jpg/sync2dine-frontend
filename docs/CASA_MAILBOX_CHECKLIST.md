# CASA / Production Mailbox Checklist

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §19.1. This file is an ops checklist only.

Use this checklist before enabling live Gmail OAuth in production (Google CASA verification).

## OAuth & Security

- [ ] Register production OAuth client in Google Cloud Console (Web application).
- [ ] Set `MAILBOX_OAUTH_REDIRECT_BASE` to your HTTPS production URL.
- [ ] Set `TOKEN_ENCRYPTION_KEY` to a 32-byte random hex secret (never commit).
- [ ] Store OAuth client secrets in server env / Supabase vault — not localStorage.
- [ ] Enable Google CASA assessment for restricted Gmail scopes (`gmail.readonly` / IMAP).
- [ ] Configure Microsoft Azure app registration for Outlook (tenant + redirect URIs).
- [ ] Configure Yahoo developer app if offering Yahoo connect.

## Data & Storage

- [ ] Run `docs/supabase/mailbox-schema.sql` on production Supabase.
- [ ] Migrate `server/data/mailbox-data.json` dev store to Supabase tables.
- [ ] Set `INTEGRATIONS_MOCK_MODE=false` in production.
- [ ] Restrict mailbox API routes to authenticated users (JWT / session).

## Infrastructure

- [ ] Deploy standalone server (`server/index.ts`) with mailbox poller running.
- [ ] Set `MAILBOX_POLL_INTERVAL_MS` (default 180000 = 3 min).
- [ ] Configure Gmail Pub/Sub push to `/webhooks/gmail` (optional, reduces poll lag).
- [ ] Configure Microsoft Graph change notifications to `/webhooks/outlook` (optional).
- [ ] Verify outbound SMTP/IMAP from production IP (some hosts block port 587/993).

## Load & Reliability

- [ ] Load-test IMAP sync with 10+ concurrent connections (target: sync within poll interval).
- [ ] Monitor token refresh failures (`needs_reconnect` status in UI).
- [ ] Alert on repeated `lastError` on mailbox connections.
- [ ] Cap cached message count per connection (archive old messages to Supabase storage).

## UX & Compliance

- [ ] Privacy policy mentions email access scope and retention.
- [ ] Disconnect flow revokes refresh tokens (`DELETE /api/mailbox/connections/:id`).
- [ ] HTML email rendering uses sanitization (plain-text fallback in dev UI).
- [ ] Customer-facing portal: only allow connect for own mailbox (org scoping).

## Optional Nylas Fallback

- [ ] If CASA is delayed, set `MAILBOX_PROVIDER=nylas` and configure `NYLAS_API_KEY`.
- [ ] Implement `server/mailbox/providers/nylas-fallback.ts` beyond stub if needed.

## Verification Smoke Test

1. Connect Google account (live mode) from Settings → Email & Inbox.
2. Send test email to connected address; run Sync; confirm Inbox tab shows thread.
3. Compose reply with PDF attachment; confirm delivery.
4. Confirm inbound email triggers Cyrus via `commsEventBus` and appears on project timeline.
5. Ask TradePro AI: "List my recent emails" — confirm `listRecentEmails` tool works.
6. Integrations Hub → Check for updates — confirm imapflow/mailparser versions load.
