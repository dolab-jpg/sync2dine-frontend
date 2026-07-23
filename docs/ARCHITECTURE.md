# Sync2Dine architecture (short)

Living orientation. Registries hold depth.

## Cold path

[`AGENTS.md`](../AGENTS.md) ? this file ? [`CAPABILITY_INVENTORY.md`](./CAPABILITY_INVENTORY.md) ? BE [`AI_REGISTRY.md`](../../sync2dine-backend/docs/AI_REGISTRY.md) ? [`TOOL_REGISTRY.md`](../../sync2dine-backend/docs/TOOL_REGISTRY.md) ? [`WORKERS.md`](../../sync2dine-backend/docs/WORKERS.md) ? [`ROUTE_MAP.md`](../../sync2dine-backend/docs/ROUTE_MAP.md) ? [`DEPLOYMENT_MAP.md`](./DEPLOYMENT_MAP.md) ? [`CHANGE_IMPACT.md`](./CHANGE_IMPACT.md) ? [`.cursor/skills/`](../.cursor/skills/)

## Repos

| Role | Path |
|------|------|
| SPA | `sync2dine-frontend` |
| API + Supabase | `sync2dine-backend` |

Live: https://app.sync2dine.io ó VPS API **:3011**. Diagrams: [`ARCHITECTURE_DIAGRAMS.md`](./ARCHITECTURE_DIAGRAMS.md). Audit: [`ENGINEERING_AUDIT_REPORT.md`](./ENGINEERING_AUDIT_REPORT.md).

## Experience modes

Restaurant vs construction: `src/app/engine/platform/experience.ts` + `routeMap.ts`.

## AI surfaces (summary)

Phone brains `judie` | `sally` (+ staff mode). Web: Cynthia, Sally Web, Cyrus alias. Domain agents: Foreman, Project, Planning, BC. Workers: Sales Brain, Sally KB. Config: AI Studio (not a chat AI). Detail: AI_REGISTRY.

## Persistence

Supabase primary. JSON / localStorage = cache. ADR 002.

## Deploy

Authoritative: `bash scripts/push-live-local.sh`. Detail: DEPLOYMENT_MAP.

## Generated vs reviewed

BE `docs/_generated/` = discovery evidence. Reviewed markdown = knowledge layer. ADR 006.

## Atlas

UI/API path tables: [`APPLICATION_MASTER.md`](./APPLICATION_MASTER.md) ù24ùù25 (not AI/tool SoT).
