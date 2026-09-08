# Post-restructure audit (Phase 1�3) � dated evidence

**Date:** 2026-07-23 (original) � **Harness refresh:** 2026-07-23  
**Scope:** `sync2dine-frontend` + `sync2dine-backend` after domain regroup and agent-harness pass.

**Living SoT (prefer these over this file):**

- [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`CAPABILITY_INVENTORY.md`](./CAPABILITY_INVENTORY.md), [`APPLICATION_MASTER.md`](./APPLICATION_MASTER.md)
- BE [`PHONE_ARCHITECTURE.md`](../../sync2dine-backend/docs/PHONE_ARCHITECTURE.md), [`LEGACY_ALIASES.md`](../../sync2dine-backend/docs/LEGACY_ALIASES.md)
- Scores: [`AGENT_HARNESS_AUDIT.md`](./AGENT_HARNESS_AUDIT.md)

## Superseded claims (do not re-apply)

| Old claim in this audit | Current state |
|-------------------------|---------------|
| FE `server-legacy/` still a full twin hazard on disk | **Removed** from disk and gitignored wholly |
| APPLICATION_MASTER Builder Diddies-heavy as living ops | Historical body ? [`archive/BUILDER_DIDDIES_OPS.md`](./archive/BUILDER_DIDDIES_OPS.md) |
| Cursor rules pointed at b-diddies | Fixed to `app.sync2dine.io` + `push-live-local.sh` |
| `*.vps.ts` as active deploy variants | Only under `server/_quarantine/` |

The narrative below is **dated evidence** from the restructure day. Use CAPABILITY_INVENTORY for current ownership.

---

# Original audit body

**Method:** Code + mount table + live probes � not �files exist ? works�.

## Verdict (restructure day)

The reorganisation **improved navigability** (domain folders, AGENTS maps, disabled FE?BE Sally SCP, live phone path documented). It did **not** finish architecture cleanup. Large parts remained a flat junk drawer with stubs and dual Sally sales trees.

## Live probes (audit day)

| Probe | Result |
|-------|--------|
| `GET /health` | 200 `{"status":"ok"}` |
| `GET /api/orders` | 401 (expected) |
| `GET /api/ops/alerts` | 200 |
| `POST /api/sally/web` | **404** before fix � then mounted |

## Capability inventory (abbreviated � superseded)

See living [`CAPABILITY_INVENTORY.md`](./CAPABILITY_INVENTORY.md).

| Capability | Lives | Owner | Notes |
|------------|-------|-------|-------|
| Judie diner phone | `brains/judie`, `phone/vapi-*` | BE phone | Live Vapi path |
| Sally sales phone | `phone/sally-sales-phone.ts` + `brains/sally` | BE phone | Parallel to `server/sally/*` |
| Sally staff (PIN) | Sally brain staff mode | BE phone | Wired on Sally line |
| Web staff orchestrator | `server/ai/*` | BE ai | Cynthia � not phone |
| Marketing Sally web | `sally/web-chat.ts` | BE | `POST /api/sally/web` |
| Orders / menu | `server/orders/*` | BE orders | Supabase |
| FE SPA routes | `routes.tsx` + `routeMap.ts` | FE | Yes |
| FE Node API twin | `server-legacy/` | � | **Removed** (harness pass) |
| Legacy phone turn | `phone/phone-orchestrator.ts` | � | Throw stub |
| Deploy variants | `_quarantine/*.vps.ts` | � | Not mounted |

## Phone runtime (verified path)

```
Inbound DID ? phone-lines ? brains (sally|judie) ? vapi-assistant ? vapi-routes
  ? tool-calls ? phone/tools/execute or phone/sally-sales-phone
```

## Priority next work (still open after harness pass)

1. Unify Sally sales: one module tree; phone adapter imports shared offer � delete drift.
2. Finish FE type adoption (`from './domainTypes'`, not `App`).
3. Continue domain moves for `data-store`, WhatsApp, platform (or document �root remains�).
4. Keep satellite ops docs bannered when they still cite b-diddies.
