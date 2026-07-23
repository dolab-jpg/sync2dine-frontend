# Sync2Dine frontend

React/Vite SPA for Sync2Dine (AI phone + restaurant ordering platform).

**AI / agent navigation:** start at [AGENTS.md](AGENTS.md), then [docs/APPLICATION_MASTER.md](docs/APPLICATION_MASTER.md) §24 Feature Location Atlas. Post-restructure review: [docs/POST_RESTRUCTURE_AUDIT.md](docs/POST_RESTRUCTURE_AUDIT.md).

Live product: **https://app.sync2dine.io**.

## Backend

Data, auth, telephony, and AI live in the sibling **[sync2dine-backend](../sync2dine-backend)** repo (Supabase + Node). Do **not** edit this frontend’s `server-legacy/` folder — it is a quarantined historical Node tree, not the live API.

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
- Backend: `npm run dev` in `../sync2dine-backend` (port 3001)

## Deploy

```bash
bash scripts/push-live-local.sh
```

SPA → VPS `app.sync2dine.io`; API synced from `../sync2dine-backend`. Do not run `deploy-vps.sh` or Sally overwrite scripts.
