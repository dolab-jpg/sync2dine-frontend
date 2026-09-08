# AI engineering harness audit

## Knowledge layer (2026-07-23)

Full inventories, skills, extract/baseline verification: [ENGINEERING_KNOWLEDGE_REPORT.md](./ENGINEERING_KNOWLEDGE_REPORT.md).
Cold path: AGENTS → ARCHITECTURE → CAPABILITY → AI/TOOL/WORKERS/ROUTE registries → DEPLOYMENT_MAP → CHANGE_IMPACT → `.cursor/skills/`.

---

**Date:** 2026-07-23  
**Scope:** `sync2dine-frontend` + `sync2dine-backend` after harness optimisation pass.  
**Method:** Implementation verification + independent second-pass review (cold-agent path: AGENTS ? CAPABILITY ? PHONE/SALLY). Scores are skeptical.

## Pre ? post (summary)

| Dimension | Pre (est.) | Post |
|-----------|------------|------|
| AI engineering readiness | ~5.5 | **7.5** |
| Repository navigation | ~6.5 | **8.0** |
| Architecture clarity | ~7.0 | **7.5** |
| Source-of-truth consistency | ~5.0 | **8.0** |
| Maintainability | ~6.0 | **6.5** |
| Deployment clarity | ~7.5 | **9.0** |

## Scores (1–10)

### 1. AI engineering readiness — **7.5**

Cold agents can answer the eight target questions from AGENTS + CAPABILITY + PHONE/SALLY without digging Builder Diddies archaeology. `npm run check:agent-maps` gates path/mount drift. Remaining drag: dual Sally trees, partial domain regroup, satellite docs that still need skimming discipline.

### 2. Repository navigation — **8.0**

Entry funnel is coherent: FE/BE `AGENTS.md` ? `ARCHITECTURE.md` / `CAPABILITY_INVENTORY.md` ? domain README ? PHONE/SALLY. §24.J maps restaurant UI. Edit-here-not-there tables name real files. Root re-export stubs carry `// RE-EXPORT STUB` banners (~80).

### 3. Architecture clarity — **7.5**

Phone personalities (Judie / Sally sales / Sally staff) and Cynthia-as-web-only are documented and consistent with `brains/` + `vapi-routes`. Quarantine and throw-stub orchestrator are explicit. Dual Sally module trees and fat root modules (`data-store`, `auth`, …) still require judgment.

### 4. Source-of-truth — **8.0**

Living docs converge on `https://app.sync2dine.io`, Supabase primary, JSON cache-only. Historical body archived (`docs/archive/BUILDER_DIDDIES_OPS.md`). `LEGACY_ALIASES.md` maps tradepro/b-diddies/Lizzie/Cyrus. Self-heal repos retargeted to `sync2dine-*`. CASA checklist corrected to Sync2Dine host.

### 5. Maintainability — **6.5**

Maps outpace code cleanup. Construction atlas rows remain large; restaurant is now first-class but construction volume can still dominate attention. DomainTypes adoption incomplete. No CODEOWNERS. Harness check helps but does not enforce Sally single-edit-path.

### 6. Deployment clarity — **9.0**

Decision table in both AGENTS: `push-live-local.sh` = SPA+API; master push = SPA CI only; never `deploy-vps.sh` / `deploy-nginx.sh` (both hard-disabled). Ports: live **3011** vs local **3001**. Smoke: `smoke:sally-web`, `smoke:orders`.

## Cold-agent checklist (verified answerable)

| Question | Answer without archive dig? |
|----------|------------------------------|
| Where does orders live? | Yes — `server/orders/*`, `/api/orders`, §24.J |
| What owns Sally Web? | Yes — `sally/web-chat.ts`, `POST /api/sally/web` |
| Judie vs Sally vs Cynthia? | Yes — PHONE + CAPABILITY + AGENTS aliases |
| Deploy path? | Yes — `bash scripts/push-live-local.sh` |
| Production host / SoT? | Yes — app.sync2dine.io + Supabase |
| Legacy files? | Yes — `_quarantine/`, removed `server-legacy/`, archive ops |
| Stub vs domain? | Yes — `RE-EXPORT STUB` + edit-here table |
| How to verify? | Yes — live curls + `check:agent-maps` + smokes |

## Landed in this pass

- Lean [`APPLICATION_MASTER.md`](./APPLICATION_MASTER.md) + [`archive/BUILDER_DIDDIES_OPS.md`](./archive/BUILDER_DIDDIES_OPS.md)
- §24.J restaurant atlas; §25 refreshed from `server/index.ts`
- [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`CAPABILITY_INVENTORY.md`](./CAPABILITY_INVENTORY.md), BE [`LEGACY_ALIASES.md`](../../sync2dine-backend/docs/LEGACY_ALIASES.md)
- Enriched FE/BE `AGENTS.md`
- Deleted FE `server-legacy/`; full gitignore; disabled `deploy-nginx.sh`
- Bannered VOICE_SETUP, VAPI_SIP, INTEGRATION_MAP; fixed CASA host; refreshed POST_RESTRUCTURE header
- Fixed `server/README.md` prefixes + SoT table; PHONE quarantine wording; stub banners; `code-fix-handler` sync2dine repos
- `check:agent-maps` (FE+BE), `smoke:sally-web`, `smoke:orders`

## Remaining barriers

1. Dual Sally sales/prompt trees (`server/sally/*` vs `phone/sally-sales-phone.ts`) — ownership documented, not unified.
2. Domain regroup incomplete — many fat modules still at `server/` root.
3. FE `domainTypes.ts` adoption incomplete (many imports still via `App.tsx`).
4. Historical doc bodies remain searchable; banners help but agents that ignore banners can still misread VOICE_SETUP / VAPI_SIP.
5. Construction §24.A–I still large relative to primary Sync2Dine restaurant product.
6. No CODEOWNERS / automated “offer facts only from `sally/offer.ts`” lint.
7. WhatsApp Web session SoT remains local `.wwebjs_auth` (documented honestly).

## Highest-impact next recommendations

1. **Unify Sally sales** around `sally/offer.ts` + thin phone/web adapters (largest duplicate-edit risk).
2. **Finish `domainTypes` adoption** and stop growing types on `App.tsx`.
3. **Extend `check:agent-maps`** to fail living docs that cite `app.b-diddies.com` / `tradepro-api` outside archive + HISTORICAL-bannered files.
4. **Continue domain moves** for `data-store` / WhatsApp / platform or explicitly freeze “root remains” in README.
5. **Add CODEOWNERS** (or equivalent) for `phone/`, `orders/`, `sally/`, `ai/`, `billing/`.

## How to re-run

```bash
# Frontend
cd sync2dine-frontend && npm run check:agent-maps

# Backend
cd sync2dine-backend && npm run check:agent-maps
npm run smoke:orders
npm run smoke:sally-web
```
