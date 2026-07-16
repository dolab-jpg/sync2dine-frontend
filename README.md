# Builder Diddies — Bathroom Sales Estimation Platform (Frontend)

React/Vite frontend for the Builder Diddies multi-trade construction estimation platform.

**Full inventory / audit (SPA · backend · Flutter mobile · GitHub · VPS · Supabase):** [docs/APPLICATION_MASTER.md](docs/APPLICATION_MASTER.md) — single living SoT (Flutter = §27).

## Backend

Data, auth, and storage live in the separate **[tradepro-backend](../tradepro-backend)** repo (Supabase + Node companion for AI/webhooks).

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase dashboard
npm run dev
```

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (safe for browser) |
| `VITE_API_BASE_URL` | Node companion for AI/webhooks (default `http://localhost:3001`) |

**Never put the service role key in this repo.**

## Sync DB types from backend

```bash
npm run sync:types
```

## Development

- Frontend: `npm run dev` (port 5174)
- Backend companion: `cd ../tradepro-backend && npm run dev` (port 3001)
- Local Supabase: `cd ../tradepro-backend && npm run supabase:start`

## Production SPA deploy

Publish static `dist/` to **`app.b-diddies.com`** only (not marketing `httpdocs/`):

```powershell
npm run build
tar -czf tradepro-deploy.tar.gz dist
scp tradepro-deploy.tar.gz vps:/tmp/tradepro-deploy.tar.gz
scp scripts/deploy-spa.sh vps:/tmp/deploy-spa.sh
ssh vps "sudo bash /tmp/deploy-spa.sh"
```

See [docs/APPLICATION_MASTER.md](docs/APPLICATION_MASTER.md) §11.
