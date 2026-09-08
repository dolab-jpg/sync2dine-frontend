---
name: sync2dine-navigate
description: Cold-start navigation for Sync2Dine FE+BE � use before any feature or bug work.
---

# Sync2Dine navigate

## When

Any feature, bug, or exploration in sync2dine-frontend or sync2dine-backend.

## Open (in order)

1. `AGENTS.md` (this repo)
2. `docs/ARCHITECTURE.md`
3. `docs/CAPABILITY_INVENTORY.md`
4. Backend `docs/AI_REGISTRY.md`, `docs/TOOL_REGISTRY.md`, `docs/WORKERS.md`, `docs/ROUTE_MAP.md`
5. `docs/DEPLOYMENT_MAP.md`, `docs/CHANGE_IMPACT.md`
6. Atlas detail: `docs/APPLICATION_MASTER.md` �24��25

## Do not

- Follow `docs/archive/*` or bannered HISTORICAL docs as live SoT
- Edit FE `server-legacy/` or BE `server/_quarantine/`
- Treat root `server/*.ts` re-export stubs as implementation

## Verify before done

```bash
npm run check:agent-maps
```

(FE and/or BE)
