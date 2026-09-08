---
name: sync2dine-diagnose-prod
description: Diagnose production runtime failures on app.sync2dine.io without local-as-SoT mistakes.
---

# Sync2Dine diagnose production

## When

Live bugs, 5xx, phone failures, orders not updating, Sally web down.

## Open

- Live host only: https://app.sync2dine.io (unless user asks local)
- `docs/ROUTE_MAP.md`, `docs/WORKERS.md`, `docs/AI_REGISTRY.md`
- VPS logs / health � not `server/data/*.json` as proof of live state

## Procedure

1. `curl` health + failing route status
2. Identify handler via ROUTE_MAP
3. Check workers if async (outbound, connectors, WA)
4. For phone: PHONE_ARCHITECTURE path (Vapi, not phone-orchestrator)
5. Reproduce with staff login on live if UI

## Do not

- �Fix� by editing local JSON and claiming production fixed
- Debug against FE server-legacy
- Follow b-diddies historical docs

## Evidence before done

- Failing URL + status code
- Handler module named
- Whether issue is SPA, API, Supabase, or worker
