# Deployment map (live SoT)

Live product: **https://app.sync2dine.io** (SPA + same-origin API / webhooks).

## Hosts and ports

| Surface | Where |
|---------|--------|
| SPA docroot | `/var/www/vhosts/sync2dine.io/app.sync2dine.io` |
| API tree | `/var/www/vhosts/sync2dine.io/sync2dine-backend` |
| API listen | `127.0.0.1:3011` (nginx proxies `/api`, `/webhooks`, `/health`) |
| API log | `/tmp/sync2dine-api.log` |
| Watchdog log | `/tmp/sync2dine-api-watchdog.log` |

## Credentials

| Action | How |
|--------|-----|
| `git push` (GitHub) | HTTPS + Windows Credential Manager (no SSH key) |
| SSH to VPS | `C:\Users\dolab\.ssh\id_ed25519` → `ssh vps` → `77.68.51.27` |
| Cloud agents | Need Cursor secrets `VPS_SSH_KEY` / `VPS_USER` / `VPS_HOST` (copy of that private key) |

Do **not** switch GitHub remotes to SSH unless you intentionally want that.

## Ship (canonical)

From a machine with `ssh vps` and both repos side by side:

```bash
cd sync2dine-frontend
bash scripts/push-live-local.sh
```

API-only: `SKIP_SPA=1 bash scripts/push-live-local.sh`  
Restart only:

```bash
ssh vps 'bash /var/www/vhosts/sync2dine.io/sync2dine-backend/scripts/restart-sync2dine-api.sh'
```

Never use legacy `deploy-vps.sh` / `deploy-nginx.sh` for routine ships.

## Health and outage notify

| Check | Expect |
|-------|--------|
| `GET https://app.sync2dine.io/health` | `{"status":"ok"}` (not nginx 502 HTML) |
| `GET https://app.sync2dine.io/api/vapi/health` | `{ ok: true, provider: "vapi" }` |

**API-down (502)** means nginx has no upstream on `:3011`. In-app `/api/ops/alerts` **cannot** page anyone when the process is dead.

### Watchdog (outside Node)

- Script: `sync2dine-backend/scripts/api-health-watchdog.sh`
- Install: `scripts/install-api-health-watchdog.sh` (also called from `restart-sync2dine-api.sh`)
- Cron: every minute, probe `127.0.0.1:3011/health`
- After 2 failures: run restart script, then notify
- Contacts file: `server/data/ops-contacts.json` (writable via UI)

### Platform UI: Ops alerts

- Route: `/platform/ops` (`platform_owner` only)
- API: `GET/PUT /api/platform/ops-contacts`, `POST /api/platform/ops-contacts/test`
- Fields: `alertEmail`, `alertPhone` (SMS), `traeWebhookUrl`
- Default email until saved: `dolab@diamondea.co.uk`
- Trae payload: `{ source: "sync2dine-ops", event, severity, title, message, at, healthUrl }`

When the API **is** up, critical `raiseOpsAlert` also fans out to the same contacts.

## Phone note

Inbound Judie/Sally depends on the API answering `POST /webhooks/vapi` (`assistant-request`) within Vapi’s budget. A 502 at nginx drops every call.

## Related

- [`CHANGE_IMPACT.md`](./CHANGE_IMPACT.md)
- Backend [`PHONE_ARCHITECTURE.md`](../../sync2dine-backend/docs/PHONE_ARCHITECTURE.md)
- Backend [`WORKERS.md`](../../sync2dine-backend/docs/WORKERS.md)
