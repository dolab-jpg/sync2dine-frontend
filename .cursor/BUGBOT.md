# TradePro Bugbot rules

## Setup (one-time — Cursor Dashboard)

1. Open https://cursor.com/dashboard?tab=bugbot
2. Connect the GitHub App for `dolab-jpg`
3. Enable Bugbot on:
   - `https://github.com/dolab-jpg/tradepro-frontend`
   - `https://github.com/dolab-jpg/tradepro-backend`
4. Enable **Autofix** with mode **Create new branch** (never commit straight to `master`)
5. Confirm the **Cursor Bugbot** check appears on the next PR

## Surgical-fix policy (always)

- Prefer the **smallest diff** that clears the reported error / failing path.
- Do **not** redesign the whole product, rewrite every page, or recreate full features when a small patch works.
- Light UI tweak on **one** screen is OK if required for that fix.
- No dependency upgrades, no secret changes (`.env`, `.cursor/local/deploy.env`), no drive-by cleanups.
- Supabase migrations live only in `tradepro-backend/supabase/migrations/`.
- If the request needs a multi-page redesign or module rewrite: **stop**, leave a comment that **Cursor approval** is required, and do not spray large changes.

## Repos

| Area | Repo |
|------|------|
| Frontend (Vite/React `src/`, AI `server/`) | tradepro-frontend |
| Backend (API + Supabase) | tradepro-backend |
