---
name: sync2dine-ship-live
description: Deploy and verify Sync2Dine production (SPA + API).
---

# Sync2Dine ship live

## When

User asks to ship, deploy, or refresh live app/API.

## Open

- `docs/DEPLOYMENT_MAP.md`
- `AGENTS.md` deploy table
- Script: `scripts/push-live-local.sh`

## Do not

- Run `deploy-vps.sh` or `deploy-nginx.sh`
- Deploy SPA into marketing `httpdocs/`
- Claim live API updated after GitHub SPA-only push alone

## Verify

```bash
bash scripts/push-live-local.sh   # when shipping
curl -sS https://app.sync2dine.io/health
cd ../sync2dine-backend && npm run smoke:orders
```

Required evidence: health 200; orders unauth 401; note whether API sync ran.
