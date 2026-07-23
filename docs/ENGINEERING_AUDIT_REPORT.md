# Sync2Dine Engineering Audit Report

**Date:** 2026-07-23  
**Scope:** `sync2dine-frontend` + `sync2dine-backend` working trees  
**Method:** Static code verification only (imports, mounts, typecheck, scripts, docs). Live runtime behaviour marked **Unverified** unless separately proven.  
**Rule:** Code is the sole source of truth. Documentation claims were accepted only when confirmed in source.

Companion visual: Cursor canvas `engineering-audit.canvas.tsx`.  
Verified diagrams: [`ARCHITECTURE_DIAGRAMS.md`](./ARCHITECTURE_DIAGRAMS.md) and backend [`docs/ARCHITECTURE_DIAGRAMS.md`](../../sync2dine-backend/docs/ARCHITECTURE_DIAGRAMS.md).

---

## 1. Executive Summary

Sync2Dine has a **directionally correct product architecture**: SPA + sibling Node API, domain folders under `server/`, distinct phone brains (`sally` / `judie` / `cynthia`), Sally Web separated from Cynthia staff AI, Supabase-first persistence intent, and a living documentation layer oriented at `https://app.sync2dine.io`.

It is **not yet architecturally production-ready as a codebase**. `npm run typecheck` reports **247** TypeScript errors. Several errors are not cosmetic: post-split modules reference symbols and modules that are not in scope (`server/ai/orchestrator/handle.ts`, `server/sally/execute.ts`, `server/phone/tools/execute.ts`). The product can still run under `tsx` for happy paths (unit tests pass; Sally Web pricing was previously proven live ù **Unverified in this audit session**), but whole tool families are one call away from `ReferenceError` / failed dynamic import.

The repository is a **partially rebranded dual-product tree** (restaurant Sync2Dine + construction/TradePro residue). That residue appears in live FE source (`tradepro_*` keys, Builder Diddies copy), backend symbols (`ensureBdiddiesHomeOrg`, JWT fallback secret name), and hazardous scripts (`scripts/auto-ssl-app.sh` ? `app.b-diddies.com`).

---

## 2. Overall Repository Health ù **56 / 100**

| Band | Score contribution | Evidence |
|------|-------------------:|----------|
| Product shape / domain split | +18 | `server/index.ts` mounts; `server/brains/index.ts`; FE `routes.tsx` / experience modes |
| Living docs / agent maps | +10 | `AGENTS.md`, `docs/ARCHITECTURE.md`, BE registries, ADRs |
| Deploy path clarity | +8 | `scripts/push-live-local.sh`, VPS dir `ù/sync2dine.io/sync2dine-backend` |
| Tests covering critical slices | +6 | BE `npm test` (explicit file list); FE `test:bridge` |
| Typecheck / compile health | ?18 | **247** `tsc` errors |
| Split/import integrity (AI/phone/Sally) | ?14 | Missing imports / wrong relative dynamic import |
| Auth / multi-tenant safety | ?8 | JWT hardcoded fallback; module-global `requestOrgId` |
| Legacy / dual-product residue | ?6 | FE branding, `auto-ssl-app.sh`, vite ùtradepro-backendù comments |
| Bundle / FE hygiene | ?4 | ~2.8 MB main chunk; unguarded `:7756` ingest calls |

**56** = shippable product surface with serious structural debt. Not a greenfield ùclean architectureù score.

---

## 3. Architecture Assessment

### Verified shape

| Layer | Path | Evidence |
|-------|------|----------|
| SPA entry | `src/main.tsx` ? `src/app/App.tsx` | FE |
| FE routes | `src/app/routes.tsx`, `routeMap.ts` | Dual shells: restaurant vs construction |
| API entry | `server/index.ts` | Raw Node `createServer`, sequential handlers |
| Phone brains | `server/brains/{sally,judie,cynthia}` | `resolveBrainId` in `server/brains/index.ts` |
| Sally BI + web | `server/sally/*`, `server/sally-web-routes.ts` | Mounted before catch-all `/api/ai/` |
| Staff web AI | `server/ai/*`, `/api/cynthia`, `/api/ai/*` | Cynthia ? Sally Web |
| Orders | `server/orders/*` (+ root re-exports) | Mounted in `index.ts` |
| Billing | `server/billing/*` | Stripe + weekly billing workers |
| Quarantine | `server/_quarantine/*` | Not imported by `index.ts` |

### Structural issues

1. **Root re-export stubs** keep flat import paths (`./vapi-routes`, `./phone-webhook`) while canonical code lives in domain folders ù intentional, but agents still edit the wrong file if maps fail.
2. **Dual experience frontend** (restaurant + construction) increases blast radius for shared `App.tsx` / auth / CRM.
3. **Persistence dual-write**: Supabase clients exist; `server/data-store.ts` + many JSON stores remain active fallbacks.
4. **Deploy dual path**: local `push-live-local.sh` (excludes `.env`, `server/data`) vs GitHub Actions SCP of `.` (exclusion behaviour for secrets/data **Unverified** ù `appleboy/scp-action` source `.` without documented exclude).

---

## 4. AI Architecture Assessment

### Verified personas

| Persona | Role (from code) | Key files |
|---------|------------------|-----------|
| **Sally phone** | SaaS sales (+ staff PIN mode) | `brains/sally`, `phone/sally-sales-phone.ts` |
| **Sally web** | Anonymous marketing chat | `sally/web-chat.ts`, `sally-web-routes.ts` ? `/api/sally/web` |
| **Judie** | Diner ordering phone (default brain) | `brains/judie`; legacy persona alias `lizzie` |
| **Cynthia phone** | Construction phone when purpose/persona `cynthia` | `brains/cynthia` |
| **Cynthia web/staff** | Logged-in staff orchestrator | `ai/orchestrator/*`, `cynthia-routes.ts` |
| **Cyrus** | Legacy alias / widget routes | `cyrus-routes.ts`; FE redirects `/cyrus` ? Cynthia |

### Critical AI integrity defects (proven by typecheck + import graph)

| Defect | Evidence | Runtime risk |
|--------|----------|--------------|
| Orchestrator uses unbound helpers | `handle.ts` calls `safeParseObject`, `executeVisionTool`, `buildActionsSummaryText` but does not import them; they live in `helpers.ts` | Tool-round path ? `ReferenceError` |
| Sally execute missing session helpers | `sally/execute.ts` uses `readDraft`, `writeDraft`, `requireTermsConfirmed`, `generateTempPassword`, etc. without definitions/imports | Provision/checkout tools break |
| `SALLY_TOOL_NAMES` not imported in tools | Defined in `sally/offer.ts`; used in `sally/tools.ts:708` | `isSallyToolName` throws |
| Phone tools wrong dynamic import | `phone/tools/execute.ts` imports `../sally-receptionist` ? expects `phone/sally-receptionist`; file is `server/sally-receptionist.ts` | Receptionist tool path fails |
| `isStaffPartyPhone` unbound | Used in `phone/tools/execute.ts`; exported from `phone/tools/leads.ts` but not imported | `bookCallback` / related paths throw |

**Conclusion:** Shared Sally BI docs (`SALLY_ARCHITECTURE.md`) match the *intended* split. Execution modules after splits are **not internally consistent**. Happy-path web Q&A can work without hitting broken tool branches; that must not be read as ùAI layer healthy.ù

---

## 5. Runtime Tool Assessment

| Catalog | Executor | Notes |
|---------|----------|-------|
| `phone/tools/catalog.ts` | `phone/tools/execute.ts` | Import/symbol defects above |
| `sally/tools.ts` | `sally/execute.ts` | Split incompleteness |
| `ai/orchestrator/tool-catalog*.ts` | `orchestrator-tool-exec.ts`, channel executors, phone/restaurant | Mode gating in `tools-for-mode.ts` + `role-permissions.ts` |
| Restaurant tools | `restaurant-ai-tools` | Used from phone + orchestrator |

Registries `docs/TOOL_REGISTRY.md` / `AI_REGISTRY.md` describe ownership accurately at a high level but overstate readiness relative to compile/import integrity.

Workers started from `server/index.ts` listen callback: mailbox poller, outbound worker, connector queue, sales-brain, Sally KB + cache warm, scheduled messages, weekly billing, code-fix, WhatsApp Web client. Persistence mix: Supabase when configured, else JSON/memory ù **Unverified** which store is live for each worker on VPS without env inspection.

---

## 6. Frontend Assessment

**Strengths**

- Clear entry/bootstrap (`App.tsx`), route catalogue, experience switching.
- Sally Web clients correctly hit `/api/sally/web` (`AskSync2DineHero.tsx`, `public/sally-widget.js`).
- No tracked FE `server/` / `server-legacy/` API twin in current git tree.
- `npm run build` succeeds; `test:bridge` passes (63 tests observed in prior session ù **re-run Unverified here**).

**Weaknesses**

- Dev proxy default `http://127.0.0.1:3001` with comments still naming **tradepro-backend** (`vite.ai-plugin.ts`) ù works only if local BE uses 3001; live is 3011.
- Hardcoded debug ingest to `http://127.0.0.1:7756/ingest/...` in multiple production source files (SoftPhone, WhatsApp, calendar, OAuth, integrations, experience).
- Dual-product residue in live UI/strings/storage (`tradepro_session_user`, Builder Diddies messaging).
- Main bundle ~2.8 MB minified; no package `typecheck` / default `test` script.
- `check:agent-maps` reported failing on backend stub expectations (prior session).
- Playwright suite named `test:responsive` is broad; many flows need seeded creds ù not a production gate.

---

## 7. Backend Assessment

**Strengths**

- Single dispatcher with explicit mount order (`server/index.ts`).
- Domain folders + quarantine boundary documented.
- Phone brain resolution is centralized and testable (`brains/resolve-brain.test.ts` in test script).
- Stripe/Vapi webhook verification code present in respective route modules.

**Weaknesses**

- **247** typecheck errors; top hotspots: `supabase-data.ts` (28), quarantine forks (60 combined), `sally/execute.ts` (20), `orchestrator/handle.ts` (11), `phone/tools/execute.ts` (9), `whatsapp-webhook.ts` (8), Stripe/provision/ai-proxy.
- Quarantine still typechecked ? noise + false confidence that ùlegacy is inert.ù
- Module-global `requestOrgId` in `data-store.ts` (concurrent request tenant bleed risk).
- `analytics-routes.ts` present but **not** mounted in `index.ts` (orphaned handler).
- `PORT` defaults to **3001** in code; production relies on env `PORT=3011` (**Unverified** without reading live `.env`).

---

## 8. API Assessment

Mount order (verified from `server/index.ts`): WhatsApp ? phone webhook ? Vapi ? agent ? projects ? building-control ? AI Studio ? sales-brain ? Sally KB ? conversation audit ? banking ? mailbox ? calendar ? package-updates ? messages ? price-research ? contracts ? Stripe ? auth ? org OpenAI/integrations/phone billing ? weekly billing ? platform ? leads ? orders/menu/reservations ? connectors ? Cyrus ? Cynthia ? **Sally Web** ? channel ? agent credentials ? push ? WhatsApp Web ? gap APIs ? agent activity ? catch-all `/api/ai/*` ? 404.

**Auth pattern:** per-handler, not framework middleware. JWT secret falls back to `'tradepro-dev-jwt-secret-change-in-production'` when `JWT_SECRET` unset (`server/auth.ts`). `AUTH_ENFORCED` appears in a **small** set of files (`auth.ts`, mailbox, calendar, connectors) ù docs that imply blanket `/api/ai/*` auth are **drifted**.

Public/marketing surfaces intentionally looser: Sally Web / Cyrus web CORS branches in `index.ts`.

---

## 9. Deployment Assessment

| Path | What it does | Risk |
|------|--------------|------|
| `frontend/scripts/push-live-local.sh` | SPA ? `app.sync2dine.io` docroot; tar/rsync BE; restart tsx; probe health | Authoritative local ship; excludes `.env` / `server/data` |
| `backend/.github/workflows/deploy-sync2dine-backend.yml` | `npm test` then SCP `.` to VPS + restart | May diverge from local script exclusions; ADR text understates BE CI |
| Disabled `deploy-vps.sh` / `deploy-nginx.sh` | Exit early | Safe if left disabled |
| `scripts/auto-ssl-app.sh` | Issues cert for **app.b-diddies.com** | **Hazardous active legacy** |

Frontend deploy cannot overwrite backend domain sources if operators use `push-live-local.sh` as written (BE synced from sibling repo, SPA to app docroot only). **Unverified:** whether any other cron/script still curls FE trees onto BE.

---

## 10. Documentation Assessment

**Living / mostly aligned:** `AGENTS.md` (both), `docs/ARCHITECTURE.md`, `DEPLOYMENT_MAP.md`, `PHONE_ARCHITECTURE.md`, `SALLY_ARCHITECTURE.md`, ADRs 001ù007, domain READMEs, `LEGACY_ALIASES.md`.

**Drift / hazard (actionable-looking wrong hosts or backends):**

| Doc | Issue |
|-----|--------|
| `docs/VOICE_SETUP.md`, BE `docs/VAPI_SIP.md` | Historical banners but Builder Diddies / tradepro / `:3001` content |
| `docs/WHATSAPP_GO_LIVE.md`, `CASA_MAILBOX_CHECKLIST.md` | Still say `tradepro-backend` |
| `docs/MEAL_DEALS.md` | Points at `deploy-spa.sh` vs authoritative `push-live-local.sh` |
| `docker/soho66-vapi-bridge/README.md` | b-diddies / Cynthia deploy path |
| `server/phone/README.md` | Omits `brains/cynthia` (fixed in this audit pass) |
| `APPLICATION_MASTER.md` mermaid | Understated BE GitHub deploy (fixed in this audit pass) |
| Capability inventories marking ùLIVEù | Often mean ùwired in code,ù not ùtypecheck-clean / toolpath-provenù |

**75** Markdown files catalogued across both repos; **0** PlantUML; Mermaid limited to APPLICATION_MASTER + archive ops (plus new diagrams from this audit).

---

## 11. Diagram Assessment

| Diagram | Status |
|---------|--------|
| APPLICATION_MASTER deploy flowchart | Updated to include BE CI + exclude note |
| New FE/BE `ARCHITECTURE_DIAGRAMS.md` | Regenerated from `index.ts` + brains + FE clients |
| Archive Builder Diddies mermaid | Correctly historical ù leave archived |
| Backend prior to audit | No Mermaid ù gap closed with verified diagrams |

No invented components: every node maps to a file or mount found in code.

---

## 12. Files / Modules Requiring Attention

1. `server/ai/orchestrator/handle.ts` ù re-bind helper imports  
2. `server/sally/execute.ts` ù restore draft/terms helpers or import from offer/session module  
3. `server/sally/tools.ts` ù import `SALLY_TOOL_NAMES`  
4. `server/phone/tools/execute.ts` ù fix `sally-receptionist` path; import `isStaffPartyPhone`  
5. `server/supabase-data.ts` ù type/contract drift (28 errors)  
6. `server/whatsapp-webhook.ts` ù unbound `from` / `phoneNumberId` / `accessToken`  
7. `server/data-store.ts` ù replace global `requestOrgId`  
8. `server/auth.ts` ù remove JWT fallback secret  
9. `server/_quarantine/**` ù exclude from `tsc`  
10. FE `:7756` ingest call sites (8 files)  
11. `scripts/auto-ssl-app.sh` ù delete or hard-disable  
12. `vite.ai-plugin.ts` comments / default port documentation  
13. `analytics-routes.ts` ù mount or delete  

---

## 13. Duplicate Implementations

| Area | Evidence | Verdict |
|------|----------|---------|
| Offer facts | Phone imports shared `formatOfferFactsBlock` from `sally/offer.ts` | Shared after Phase 4 ù good |
| SaaS packages | FE `engine/saas/saasPackages.ts` mirrors BE `saas-packages` | Intentional mirror ù drift risk |
| Planning action names | FE `planningActionNames.ts` ? BE planning tools | Mirror ù needs sync test |
| Cynthia vs Cyrus clients | Parallel FE engines + BE routes | Compatibility layer, not pure dupe |
| Construction + restaurant shells | Two product UIs in one SPA | Product duality, not accidental copy |
| Quarantine Vapi forks | `_quarantine/*.vps.ts` vs live `phone/vapi-routes.ts` | Orphaned duplicates (quarantined) |

---

## 14. Dead Code

| Item | Evidence |
|------|----------|
| `server/_quarantine/*` | No imports from `index.ts` |
| `server/phone/phone-orchestrator.ts` | Stub throw; not on Vapi path |
| `server/analytics-routes.ts` | Not mounted |
| FE `server-legacy/` | Removed from git |
| Disabled deploy scripts | Early exit |

**Unverified:** whether any external system still POSTs to paths only implemented in quarantine forks.

---

## 15. Legacy Code Still Connected

| Item | Still live? |
|------|-------------|
| `ensureBdiddiesHomeOrg` boot | Yes ù `index.ts` |
| JWT secret name `tradepro-dev-ù` | Yes ù fallback |
| Cynthia construction phone brain | Yes ù when purpose/persona matches |
| Cyrus routes / widgets | Yes |
| FE `tradepro_*` storage/events | Yes |
| Building-control / projects / recruitment routes | Yes ù construction surface |
| `auto-ssl-app.sh` | Yes ù wrong product host |

---

## 16. Security Observations

1. **Hardcoded JWT fallback** if `JWT_SECRET` missing (`server/auth.ts`).  
2. **CORS default `*`** when `APP_BASE_URL` unset (`index.ts`).  
3. **Org spoofing risk** if handlers trust `X-Org-Id` / body `orgId` without enforced auth ù pattern present; enforcement uneven.  
4. **Module-global org context** can cross-contaminate concurrent requests (`data-store.ts`).  
5. **Sally Web** is intentionally public ù rate limit/CORS must remain correct; secrets must never land in widget responses (logging discipline exists in web path ù depth **Unverified**).  
6. **GitHub SCP of repo root** may copy local artifacts if present on runner checkout (usually clean) ù still weaker than rsync excludes.  
7. FE **local ingest** endpoints can leak operational metadata to any local listener.  
8. Stripe/Vapi signature verification ù code present; live secret correctness **Unverified**.

---

## 17. Performance Observations

- FE main JS ~2.8 MB minified / ~838 KB gzip ù slow mobile first paint risk.  
- Many workers use `setInterval` polling ù acceptable at small scale; watch mailbox/WhatsApp/Puppeteer memory on VPS.  
- Orchestrator tool rounds + vision path are heavy when fixed ù no evidence of request-level concurrency limits beyond Sally Web rate limit.  
- Global data-store + disk JSON sync can amplify latency under multi-tenant load.

---

## 18. Technical Debt

### High
- Repair split imports/symbols in orchestrator / Sally execute / phone tools  
- Make `tsc --noEmit` green (or exclude quarantine + fix active tree)  
- Auth enforcement consistency + remove JWT fallback  
- Tenant context concurrency (`requestOrgId`)  
- Neutralize `auto-ssl-app.sh` and FE `:7756` telemetry  

### Medium
- Dual-product FE cleanup / rename `tradepro_*` namespaces  
- Align deploy ADR + CI excludes with `push-live-local.sh`  
- Supabase typing (`supabase-data.ts` never[] cascade)  
- Bundle splitting for SPA  
- Mount-or-delete `analytics-routes.ts`  

### Low
- Comment renames (tradepro-backend ? sync2dine-backend)  
- Historical docs discoverability (move more under `archive/`)  
- Phone README / map check script drift  

---

## 19. Regression Risks

| Change | Risk |
|--------|------|
| Fixing Sally execute helpers | Provision/checkout behaviour may change if drafts were silently failing |
| Fixing phone tool imports | Receptionist/staff callback paths start working ù may expose latent logic bugs |
| Enabling AUTH_ENFORCED broadly | FE clients relying on header org spoofing break |
| Excluding quarantine from tsc only | Low risk |
| Removing construction experience | High product risk ù still mounted |
| Changing deploy CI excludes | Could delete VPS `.env` if misconfigured ù test carefully |

---

## 20. Recommended Priority Order

1. Restore compile/import integrity for AI/phone/Sally executors (stop latent `ReferenceError`s).  
2. Gate CI on `npm run typecheck` for non-quarantine sources.  
3. Auth hardening: require `JWT_SECRET`, tighten org resolution, audit `AUTH_ENFORCED` coverage.  
4. Fix `requestOrgId` concurrency model.  
5. Remove/disable hazardous legacy scripts + FE debug ingest.  
6. Align GitHub deploy excludes with local ship script; document dual deploy in APPLICATION_MASTER (done for diagram).  
7. Dual-product strategy decision: keep construction surface explicitly or extract.  
8. FE bundle performance pass.  
9. Archive remaining actionable-looking historical phone/ops docs.  
10. Add sync tests for FE/BE SaaS package + tool-name mirrors.

---

## 21. Confidence by Subsystem

| Subsystem | Confidence | Notes |
|-----------|------------|-------|
| Route mounting map | **High** | Read from `index.ts` |
| Brain selection | **High** | `brains/index.ts` + tests listed |
| Sally Web wiring | **High** (code) / **Medium** (live) | Code path clear; live not re-probed this session |
| Sally phone sales tools | **Medium-Low** | Shared offer import OK; execute defects |
| Cynthia orchestrator | **Low** | Unbound runtime helpers in `handle.ts` |
| Judie ordering | **Medium** | Brain default path clear; tool executor shared risks |
| Auth model | **Medium** | Patterns found; production flag values Unverified |
| Supabase as sole SoT | **Low-Medium** | Intent strong; JSON fallbacks still active |
| Stripe | **Medium** | Routes + signature code; live keys Unverified |
| POS/connectors | **Medium** | Mounted; Square modules present |
| Deploy SoT | **High** for local script; **Medium** for CI parity |
| Documentation living layer | **High** orientation; **Medium** readiness claims |
| Workers on VPS | **Low** | Started in code; env/disable flags Unverified |

---

## Executive Conclusion ù Top 10 improvements (impact ù effort)

1. **Re-bind split imports** in `orchestrator/handle.ts`, `sally/execute.ts`, `sally/tools.ts`, `phone/tools/execute.ts` ù highest latent outage risk, localized fixes.  
2. **Exclude `_quarantine` from `tsc` and fail CI on typecheck** ù stops silent structural rot.  
3. **Delete or hard-fail `auto-ssl-app.sh`; strip `:7756` ingest** ù cheap safety.  
4. **Remove JWT fallback; fail boot without `JWT_SECRET` in production** ù small change, large security win.  
5. **Replace global `requestOrgId` with AsyncLocalStorage / explicit args** ù correctness under load.  
6. **Document + enforce single deploy contract** (local script excludes mirrored in CI) ù prevents data/env accidents.  
7. **Auth audit of high-value `/api/*` families** vs FE header trust ù security.  
8. **Decide dual-product fate** (extract construction vs quarantine UI) ù largest maintainability lever.  
9. **FE code-split / drop unused construction weight for restaurant tenants** ù performance.  
10. **Mirror sync tests** for SaaS packages + tool names FE?BE ù prevents silent commercial drift.

---

## 22. Critical remediation addendum (2026-07-23)

Implemented in the same day as the audit. Scope: items 1ñ10 of the critical remediation phase only (no dual-product cleanup / bundle work).

| Item | Result |
|------|--------|
| Split imports (`handle.ts`, `sally/execute.ts`, `phone/tools/execute.ts`, `SALLY_TOOL_NAMES`) | **Fixed** ó helpers rebound; receptionist import is `../../sally-receptionist` |
| `tsc --noEmit` | **0 errors** (was **247**). `server/_quarantine/**` + `scripts/**` + `server/_repair-*.mts` excluded from compile graph; quarantine still unmounted |
| CI typecheck/build gate | BE workflow runs `npm run typecheck` before tests; FE `frontend-tests.yml` runs `npm run build` before bridge/playwright |
| JWT production fail-closed | `server/jwt-secret.ts` + boot assert in `server/index.ts`. Known-dev secrets rejected when `NODE_ENV`/`SYNC2DINE_ENV` is production |
| `requestOrgId` concurrency | `AsyncLocalStorage` in `server/data-store.ts`; each HTTP request enters via `runWithRequestOrgContext` |
| Regression tests | `jwt-secret.test.ts`, `org-context-als.test.ts`, `remediation-imports.test.ts`, `agent-smoke.test.ts`; suite **113** pass |
| Sally Web local probe | **HTTP 200** with Judie weekly pricing (`http://127.0.0.1:3011`) |
| Production JWT on VPS | `JWT_SECRET` provisioned (value redacted); `NODE_ENV=production`, `SYNC2DINE_ENV=production` |

### Confidence updates after remediation

| Subsystem | Was | Now |
|-----------|-----|-----|
| Cynthia orchestrator helpers | Low | **High** (code) ó imports bound; live OpenAI path still env-dependent |
| Sally phone tool imports | Medium-Low | **High** (code-level execution smoke); **live Vapi call Unverified** |
| Auth JWT boot | Medium | **High** for fail-closed unit + smoke-jwt-boot; live secret present |
| Org context isolation | ó | **High** (concurrent ALS test) |
| TypeScript health | Fail (247) | **Pass (0)** on active graph |

### Still deferred (not this phase)

- Dual-product FE cleanup, `:7756` ingest strip, `auto-ssl-app.sh` deletion  
- Bundle optimisation, execute-module splitting, historical-doc archiving  
- Live inbound Sally/Judie phone call (requires external telephony)

---

*Audit body above is the original static findings. Section 22 records remediation evidence.*
