# AGENTS.md — Sync2Dine frontend

Start here before feature work. This map keeps agents out of the wrong trees.

## Always open first

1. **[docs/APPLICATION_MASTER.md](docs/APPLICATION_MASTER.md) §24 Feature Location Atlas** — Feature ? UI route ? components ? engine ? API ? data. (Atlas still mixes construction/Builder Diddies history — prefer Sync2Dine live host below.)
2. This file for traps and aliases.
3. Phone runtime SoT (backend): [`../sync2dine-backend/docs/PHONE_ARCHITECTURE.md`](../sync2dine-backend/docs/PHONE_ARCHITECTURE.md).
4. Post-restructure audit: [`docs/POST_RESTRUCTURE_AUDIT.md`](docs/POST_RESTRUCTURE_AUDIT.md).
5. Live product: **https://app.sync2dine.io** (SPA/API via `bash scripts/push-live-local.sh`).

## Repo layout

| Path | Role |
|------|------|
| `src/app/App.tsx` | Auth bootstrap + experience gate; mounts route trees |
| `src/app/routes.tsx` | Route trees; re-exports `ROUTE_MAP` |
| `src/app/routeMap.ts` | Declarative path catalogue (`ROUTE_MAP` definition) |
| `src/app/domainTypes.ts` | Shared domain interfaces (Customer, Quote, …) — prefer importing here, not only via `App.tsx` |
| `src/app/components/` | Screens / UI |
| `src/app/engine/` | Domain logic, stores, API clients |
| `src/app/config/` | Registries (trades, integrations, AI) |
| `src/app/auth/` | Login / signup / profile |
| `src/lib/supabase/` | Browser Supabase client + types |
| `public/` | Embed widgets |
| `server-legacy/` | **LEGACY — do not edit.** Not production API |

## Sibling backend

Canonical Node API + Supabase: **`../sync2dine-backend`**. Never SCP frontend files onto the VPS backend.

Live deploy: `bash scripts/push-live-local.sh` (SPA from this repo; API from sibling backend).

## Experience modes

- Construction vs restaurant: `src/app/engine/platform/experience.ts`, branched in `App.tsx`.
- Org context: `src/app/engine/platform/orgContext.ts`.

## Brain / persona aliases

| Name | Role |
|------|------|
| **Cynthia** | Staff AI UI — web; phone staff tools = Sally staff mode |
| **Sally** | Phone sales + staff PIN tools |
| **Judie** | Diner phone ordering |
| **Cyrus** | Legacy widget alias — prefer Cynthia |

## When adding a feature

Update APPLICATION_MASTER §23 matrix, §24 atlas row, and §25 API line in the same session.
