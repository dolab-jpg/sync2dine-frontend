# server-legacy removal

**Date:** 2026-07-23  
**Reason:** Full alternate Node API twin confused agents and was not the live Sync2Dine API.

## Verification before removal

| Check | Result |
|-------|--------|
| FE `src/` imports | None |
| Vite / package scripts | None pointing at `server-legacy` |
| `push-live-local.sh` | Syncs `../sync2dine-backend` only; explicitly avoids FE server tree |
| GH SPA workflow | Publishes `dist/` only |
| Deploy Sally overwrite | Disabled |
| Live VPS process | `sync2dine-backend` on port **3011** |

## Restore (reversible)

```bash
cd sync2dine-frontend
git log --oneline -- server-legacy | head
git checkout <commit-before-removal> -- server-legacy
```

Or use the git tag `pre-server-legacy-removal` if present on the removal commit’s parent.

## SoT after removal

- API: `../sync2dine-backend`
- Deploy: `bash scripts/push-live-local.sh`
- Sally: `../sync2dine-backend/docs/SALLY_ARCHITECTURE.md`
