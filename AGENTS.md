# AGENTS.md — Sync2Dine frontend

Start here before feature work. This map keeps agents out of the wrong trees.

## Always open first

1. **[docs/APPLICATION_MASTER.md](docs/APPLICATION_MASTER.md) §24 Feature Location Atlas** — Feature ? UI route ? components ? engine ? API ? data.
2. This file for traps and aliases.
3. Phone runtime SoT (backend): [`../sync2dine-backend/docs/PHONE_ARCHITECTURE.md`](../sync2dine-backend/docs/PHONE_ARCHITECTURE.md).
4. Live product: **https://app.sync2dine.io** / **https://app.b-diddies.com** (not localhost) unless the user asks for a local repro.

## Repo layout

| Path | Role |
|------|------|
| `src/app/App.tsx` | Auth bootstrap + experience gate; mounts route trees |
| `src/app/routes.tsx` | Route trees + declarative `ROUTE_MAP` (URL ? screen) |
| `src/app/routeMap.ts` | Lightweight path catalogue for search |
| `src/app/components/` | Screens / UI (feature folders + some flat legacy screens) |
| `src/app/engine/` | Domain logic, stores, API clients |
| `src/app/config/` | Registries (trades, integrations, AI) |
| `src/app/auth/` | Login / signup / profile |
| `src/lib/supabase/` | Browser Supabase client + types |
| `public/` | Embed widgets (`cynthia-widget.js`, etc.) |
| `server/` | **LEGACY — do not edit.** Canonical API is the sibling backend repo |

## Sibling backend

Canonical Node API + Supabase migrations live in **`../sync2dine-backend`**. Do not treat this frontend’s `server/` as production SoT.

## Experience modes

- Construction / sales shell vs restaurant shell: `src/app/engine/platform/experience.ts`, branched in `App.tsx`.
- Org context: `src/app/engine/platform/orgContext.ts`.

## Brain / persona aliases

| Name | Role |
|------|------|
| **Cynthia** | Staff AI **UI** (`/cynthia`, overlay) — web; phone staff tools = Sally staff mode |
| **Sally** | Phone sales + staff PIN tools; platform offer / knowledge panels |
| **Judie** | Diner phone ordering (+ marketing landing) |
| **Cyrus** | Legacy widget / WhatsApp thread alias ? prefer Cynthia paths |

## Naming drift (same product)

Sync2Dine · Builder Diddies · TradePro — treat as one product; prefer Sync2Dine in new docs.

## When adding a feature

Update APPLICATION_MASTER §23 matrix, §24 atlas row, and §25 API line in the same session.
