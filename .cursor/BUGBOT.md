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

## Self-heal LIVE (CRM → Cursor Cloud Agents → GitHub)

For the in-app self-heal queue (`/api/ai/code-fix`) to show **LIVE** and auto-fix surgical bugs:

1. Set on the **live server** (and optionally local `.cursor/local/deploy.env`):
   - `CURSOR_API_KEY` — Cursor Dashboard → API Keys (Cloud Agents)
   - `GITHUB_TOKEN` — GitHub PAT with `repo` scope on `dolab-jpg/tradepro-frontend` and `tradepro-backend` (needed for **Approve & merge** from chat / AI Audit)
2. In Cursor Dashboard, grant the API key’s GitHub App access to both repos.
3. Confirm green **LIVE** on `/ai-audit` → **Code fixes**, and the LIVE badge in the Cynthia / Builder Diddies AI chat header.
4. Surgical errors **auto-start** (toggle in AI Studio: “Auto-start surgical self-heal fixes”). You approve merges in chat (**Approve & merge**) or bulk in AI Audit.
5. Larger / redesign-scoped jobs still ask Yes/No and may open a plan-mode Cursor agent first.

Without `GITHUB_TOKEN`, Approve & merge falls back to opening the PR on GitHub for a manual merge.

## Repos

| Area | Repo |
|------|------|
| Frontend (Vite/React `src/`, AI `server/`) | tradepro-frontend |
| Backend (API + Supabase) | tradepro-backend |
