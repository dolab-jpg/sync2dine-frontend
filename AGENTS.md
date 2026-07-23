# AGENTS.md ù Sync2Dine frontend

Start here before feature work.

## Always open first (cold path)

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
2. [`docs/CAPABILITY_INVENTORY.md`](docs/CAPABILITY_INVENTORY.md)
3. Backend [`docs/AI_REGISTRY.md`](../sync2dine-backend/docs/AI_REGISTRY.md)
4. Backend [`docs/TOOL_REGISTRY.md`](../sync2dine-backend/docs/TOOL_REGISTRY.md)
5. Backend [`docs/WORKERS.md`](../sync2dine-backend/docs/WORKERS.md)
6. Backend [`docs/ROUTE_MAP.md`](../sync2dine-backend/docs/ROUTE_MAP.md)
7. [`docs/DEPLOYMENT_MAP.md`](docs/DEPLOYMENT_MAP.md)
8. [`docs/CHANGE_IMPACT.md`](docs/CHANGE_IMPACT.md)
9. Phone/Sally detail: [`../sync2dine-backend/docs/PHONE_ARCHITECTURE.md`](../sync2dine-backend/docs/PHONE_ARCHITECTURE.md), [`SALLY_ARCHITECTURE.md`](../sync2dine-backend/docs/SALLY_ARCHITECTURE.md)
10. Atlas UI paths: [`docs/APPLICATION_MASTER.md`](docs/APPLICATION_MASTER.md) ù24ùù25
11. Skills: [`.cursor/skills/`](.cursor/skills/) (`sync2dine-navigate`, phone, orders, runtime-tool, ship-live, diagnose-prod)
12. Knowledge report: [`docs/ENGINEERING_KNOWLEDGE_REPORT.md`](docs/ENGINEERING_KNOWLEDGE_REPORT.md)
13. Full engineering audit: [`docs/ENGINEERING_AUDIT_REPORT.md`](docs/ENGINEERING_AUDIT_REPORT.md) ∑ [`docs/ARCHITECTURE_DIAGRAMS.md`](docs/ARCHITECTURE_DIAGRAMS.md)

Historical: `docs/archive/*` ó **do not follow** as live SoT.

## Repo layout

| Path | Role |
|------|------|
| `src/app/App.tsx` | Auth + experience gate |
| `src/app/routes.tsx` / `routeMap.ts` | Routes |
| `src/app/domainTypes.ts` | Prefer for types (not only App) |
| `src/app/components/` | UI |
| `src/app/engine/` | Domain logic / API clients |
| `server-legacy/` | **Not in git** ù never restore |

## Sibling backend

Canonical API: **`../sync2dine-backend`**.

## Ports

| Env | Host |
|-----|------|
| Live | https://app.sync2dine.io (API **:3011**) |
| Local API | often `:3001` ù not product SoT |
| Local SPA | `:5174` |

## Deploy

| Goal | Command | API? |
|------|---------|------|
| SPA+API live | `bash scripts/push-live-local.sh` | Yes |
| SPA CI | push `origin/master` | No |
| Never | `deploy-vps.sh`, `deploy-nginx.sh` | ù |

## Verify

```bash
curl -sS https://app.sync2dine.io/health
npm run check:agent-maps
```

## Personas

| Name | Role |
|------|------|
| Cynthia | Staff web AI |
| Sally | Phone sales + staff PIN; marketing web |
| Judie | Diner phone |
| Cyrus | Legacy widget alias |

## When adding a feature

Update CAPABILITY, APPLICATION_MASTER ù24/ù25 if UI/API, CHANGE_IMPACT if shared, BE registries if AI/tools/routes/workers. Run `check:agent-maps`. Backend: `npm run extract:registries` when tools/workers/routes change.
