# Deployment audit — 2026-07-15

> **Historical snapshot.** For the current verified inventory (including DRIFT vs this file — VPS now runs tradepro-backend; WhatsApp Web APIs return 200; 14 migrations), use **[APPLICATION_MASTER.md](./APPLICATION_MASTER.md)**.

Read-only check of local → GitHub → VPS (`https://app.b-diddies.com`) → Supabase.  
No deploys, restarts, or migrations were applied during this audit.

## Three layers (reminder)

| Layer | What “shipped” means | This audit |
|-------|----------------------|------------|
| GitHub `origin/master` | `git push` | Synced for both repos |
| VPS docroot + `tradepro-api` | Build + `scp` + `scripts/deploy-vps.sh` | Frontend static + monorepo `server/` live from deploy at **16:53 UTC** |
| Supabase cloud | `supabase` push / MCP migration | All 13 local migrations applied remotely |

Pushing GitHub alone never updates the live site.

---

## Layer A — Local vs GitHub

### Frontend (`Bathroom Sales Estimation Platform`)

| Item | Result |
|------|--------|
| Checked out branch | `cursor/cynthia-builder-diddies-branding` @ `c5edae0` |
| `master` vs `origin/master` | **In sync** @ `90ebbe8` |
| Branch tip vs `origin/master` | **1 behind** (missing test-only commit `90ebbe8`) |
| Branding / Cynthia commits | On `master` (`1403228`, `c5edae0`) |
| Feature branches | `cursor/address-map-links`, `cursor/channel-ops-full-tools` — **already ancestors of master** (archived) |
| Uncommitted “features” | **None** — only noise: `playwright-report/`, `test-results/`, `debug-login.png` |

### Backend (`tradepro-backend`)

| Item | Result |
|------|--------|
| Branch | `master` @ `13e2fab` = `origin/master` |
| Uncommitted feature code | **None** shipping-worthy |
| Local-only / must not ship | `server/data/*`, `.wwebjs_auth/`, `tmp-aria-lizzie.mp3` |
| Scratch scripts (ignore) | `_patch_vapi_routes.cjs`, `_tmp_inspect_call.cjs` |

---

## Layer B — GitHub vs VPS (what users get)

| Check | Result |
|-------|--------|
| Live `index.html` assets | `index-BYeBPC49.js` + `index-1oaGsVcY.css` |
| Local `dist/` | **Same hashes** (mtime ~17:53 UK / 16:53 UTC) |
| VPS `index.html` mtime | `2026-07-15 16:53:04 UTC` |
| `tradepro-api` | **active** (entered ~16:53:50 UTC) |
| `server/index.ts` MD5 local vs VPS | **Match** `ab15e8c2…` |
| `package.json` MD5 | Slight drift (VPS still lists `tsx` as a dependency key difference only) |
| Production env | `VITE_SUPABASE_URL` = cloud (not localhost); `VITE_DEMO_LOGIN=false`; `VITE_API_BASE_URL` empty (same-origin `/api` — expected) |

### Feature needles in live JS bundle

| Signal | In live bundle |
|--------|----------------|
| Cynthia / Builder Diddies | FOUND |
| WhatsApp / QR / Vapi | FOUND |
| self-heal / preferredLanguage | FOUND |

### HTTP smoke (GET unless noted)

| Path | Status | Meaning |
|------|--------|---------|
| `/health` | 200 | API up |
| `/api/ai/chat` | 405 | Route alive (method) |
| `/api/ai/code-fix` | 200 | Self-heal path present |
| `/api/org/staff/list` | 200 | Org/staff present |
| `/api/auth/me` | 401 | Auth gate present |
| `POST /api/auth/customers` | 401 | Route present |
| `/webhooks/vapi` | 405 | Vapi webhook wired |
| `/api/vapi/webhook` | 405 | Alternate Vapi path wired |
| `/webhooks/whatsapp` | 403 | Meta webhook path exists (auth/token) |
| `/api/whatsapp-web/status` | **404** | **Gap** — see below |
| `/api/whatsapp-web/qr` | **404** | **Gap** — see below |

`master` tip commit `90ebbe8` only changes `scripts/responsive-audit.cjs` (tests) — **no VPS redeploy needed** for that commit alone.

---

## Layer C — Supabase

All **13** migrations match local and remote:

`202607090001` … `202607090008`, `202607110001`, `202607140001`, `202607140002`, `202607150001`, `202607160001` (preferred language).

**No missing cloud migrations.**

---

## Gap checklist

### Already live — leave alone

- [x] Frontend UI on VPS matches latest production build (incl. Cynthia / Builder Diddies branding)
- [x] Frontend + backend `origin/master` contain recent shipped commits
- [x] Supabase schema/migrations fully applied
- [x] Core API: health, AI chat, code-fix, org staff, auth, Vapi webhooks
- [x] Classic WhatsApp Meta webhook path (`/webhooks/whatsapp`) responds (not 404)

### On GitHub, not on VPS API — needs deliberate ship later

| Gap | Evidence | Why |
|-----|----------|-----|
| **WhatsApp Web QR API** | UI calls `/api/whatsapp-web/*`; live returns **404** | Implementation + `whatsapp-web.js` live in **tradepro-backend** only. VPS runs **frontend monorepo `server/`**, which has Meta `whatsapp-webhook.ts` but **no** `whatsapp-web-routes.ts` / `whatsapp-web-client.ts` and **no** `whatsapp-web.js` dependency. |

UI panel exists in the live bundle (`WhatsAppWebPanel` → those URLs), so Integrations → WhatsApp QR will look broken in production until the API is ported into the VPS server (or the VPS is switched to run the backend server).

### On GitHub, not on Supabase

- None (migrations aligned).

### Only local / dirty — do not deploy

- Frontend: Playwright reports, `debug-login.png`
- Backend: `server/data/*`, `.wwebjs_auth/`, scratch `_patch_*` / `_tmp_*` scripts

### Needs human verify (browser, after login)

1. Sign in on https://app.b-diddies.com — confirm Cynthia intro / branding (bundle already contains strings).
2. Integrations → WhatsApp Web — expect QR/status failure until API gap is fixed.
3. Phone / Vapi flow if you use it — webhooks respond; full call still needs credentials on `/etc/tradepro-api.env`.
4. Self-heal UI — `/api/ai/code-fix` is up; confirm screen after auth.

---

## Recommended next actions (only after you approve — not done now)

1. **Do not** run another overlapping VPS deploy “just in case” — static site already matches current `dist`.
2. **WhatsApp Web:** port `whatsapp-web-*` from tradepro-backend into the frontend monorepo `server/` (and `package.json`), then **one** build + single `deploy-vps.sh` — or explicitly run the backend server on the VPS instead of the monorepo server (architecture choice).
3. Keep **one deploy at a time** (shared `/tmp/tradepro-deploy.tar.gz`).
4. Never upload WhatsApp session data from the backend working tree.

---

## Summary verdict

Most work that reached GitHub **did** get to production (latest VPS deploy today matches local `dist`; Supabase is complete). The main “I thought it was deployed but it only works locally” item found is **WhatsApp Web.js QR connect**: UI is on the live site, API is only in the sibling backend repo that the VPS API process does not serve.
