# Engineering knowledge report

**Date:** 2026-07-23  
**Scope:** sync2dine-frontend + sync2dine-backend  
**Method:** Tree-wide extract (`docs/_generated/`), reviewed registries, negative checks, read-only live smokes where network allows.

Epistemology: **runtime code** = behaviour · **`_generated/`** = evidence · **reviewed markdown** = knowledge layer.

---

## 1. Capability inventory

Living: [`CAPABILITY_INVENTORY.md`](./CAPABILITY_INVENTORY.md) — phone/AI, restaurant, auth/platform, communications, construction/money. Atlas: [`APPLICATION_MASTER.md`](./APPLICATION_MASTER.md) §24–§25.

## 2. AI surface inventory

Living: [`../sync2dine-backend/docs/AI_REGISTRY.md`](../../sync2dine-backend/docs/AI_REGISTRY.md).

Phone brains: `judie`, `sally` + staff mode. Web: Cynthia, Sally Web, Cyrus adapter. Domain: Foreman, Project, Planning, BC. Workers: Sales Brain, Sally KB. Config: AI Studio, Company AI Brain (not chat AIs). Quarantine: phone-orchestrator, vps forks. Disabled: IVR without flag.

## 3. Runtime tool inventory

Living: [`TOOL_REGISTRY.md`](../../sync2dine-backend/docs/TOOL_REGISTRY.md).  
Evidence: ~**180** unique tool names in `_generated/tools-discovered.json`. Surfaces: phone packs, Sally web/BI, orchestrator catalogs, gap tools, optional facade, FE executors.

## 4. Worker / background inventory

Living: [`WORKERS.md`](../../sync2dine-backend/docs/WORKERS.md).  
**10** boot hooks from `server/index.ts` (mailbox, outbound, connectors, sales-brain, sally-kb, warm cache, scheduled messages, weekly billing, code-fix, WhatsApp Web) + upgrade handler.

## 5. Route and handler inventory

Living: [`ROUTE_MAP.md`](../../sync2dine-backend/docs/ROUTE_MAP.md) + `server/README.md`.  
Evidence: **212** pathname prefixes discovered (includes duplicates across files).

## 6. Deployment map

Living: [`DEPLOYMENT_MAP.md`](./DEPLOYMENT_MAP.md). Authoritative: `scripts/push-live-local.sh`. Disabled: deploy-vps, deploy-nginx.

## 7. Agent skills created

Under `.cursor/skills/`:

- `sync2dine-navigate`
- `sync2dine-phone-change`
- `sync2dine-orders`
- `sync2dine-runtime-tool`
- `sync2dine-ship-live`
- `sync2dine-diagnose-prod`

## 8. Hidden capabilities discovered

- Dual `getSallyPhoneSessionChatTools` (slim Vapi vs full `sally/tools`)
- Staff allowlists (`listPendingCallbacks`, `searchLeads`) without Vapi schemas
- FE `orchestratorMode: 'sally'` not on BE OrchestratorMode
- Dynamic boot workers via `void import()` (scheduled message, weekly billing, code-fix, WA)
- Transfer mini-assistant + IVR (off) with legacy branding
- Language “friends” as labels, not brains
- Atmosphere SKU mistaken for AI in marketing

## 9. Duplicate / competing implementations

- Sally phone slim vs Sally BI full tool packs
- Cynthia / Cyrus / Lizzie naming vs Judie/Sally runtime
- `navigate` vs `navigateTo`; `bookDemo` alias
- Root re-export stubs vs domain files
- Widget twins: cynthia-widget.js ? cyrus-widget.js

## 10. Disconnected / unreachable / partial

- Allowlist-without-schema phone tools
- `pickPhoneTools('verifyStaffPhonePin')` dead pick
- Full Sally exclusive tools not on live Vapi sales
- `AI_TOOL_FACADE` default off
- Concierge WhatsApp note-only path
- Meta WhatsApp cold
- phone-orchestrator throw stub
- FE executor fallthrough to project/foreman actions (not every name proven BE)

## 11. Docs-versus-code mismatches

Documented in AI_REGISTRY. Bannered HISTORICAL: VOICE_SETUP, VAPI_SIP, INTEGRATION_MAP. Archive BUILDER_DIDDIES_OPS. FE sales UI Sally mode vs BE.

## 12. Permission and security concerns

- Prompt-only restrictions insufficient for money/destructive — prefer executor + auth (flagged in TOOL_REGISTRY)
- Public Sally Web must keep `SALLY_WEB_BLOCKED_TOOLS` code-enforced
- Org isolation for Judie orders: DID?org runtime (good)
- Staff PIN: runtime phone-auth (good)
- code-fix remotes corrected to sync2dine-* (was tradepro trap)

## 13. Generated verification mechanisms

- `npm run extract:registries` ? `docs/_generated/*`
- `reviewed-baseline.json` fingerprints
- `npm run check:agent-maps` (FE + BE): required docs, skills, disabled deploy scripts, no quarantine in index, snapshot diff message on change

## 14. Architecture improvements completed

- Full knowledge layer (registries, maps, ADRs, skills, extract, baseline check)
- Prior harness: lean APPLICATION_MASTER, stub banners, server-legacy removal, Sync2Dine remotes

## 15. Deliberately deferred

- Unify Sally dual tool/prompt trees
- Mass `domainTypes` adoption off App.tsx
- Finish domain regroup of fat root modules (`data-store`, WhatsApp)
- Rewrite every legacy Builder Diddies string in transfer/IVR/cyrus
- CODEOWNERS file

## 16. Remaining engineering risks

- Agents ignoring HISTORICAL banners
- FE?BE action fallthrough claiming live without schema
- Env-gated features (facade, IVR, Meta WA) mis-documented as always on
- WhatsApp Web local session SoT
- Construction atlas volume still large vs restaurant primary product

## 17. Confidence by area

| Area | Confidence | Notes |
|------|------------|-------|
| AI surface discovery | **high** | brains + mounts + AI_REGISTRY cross-check |
| Route / mount discovery | **high** | index.ts + extract prefixes |
| Worker startup discovery | **high** | explicit index listen list |
| Runtime tool **declaration** | **high** | ~180 names from catalogs |
| Runtime tool **reachability** | **medium** | selectors/PIN/mode matrix not exhaustively proven per role |
| Role/channel tool exposure | **medium** | documented defects; not every orch mode×role matrix enumerated |
| FE action ? BE mapping | **medium-low** | toolRuntime fallthrough paths |
| Env-gated / dynamic import | **medium** | listed; runtime env on VPS not re-read this pass |

## 18. Absolute certainty not possible

- Live VPS env flag values without SSH
- Every FE `executeProjectAction` branch
- WhatsApp Web session state on server
- Whether facade/IVR are enabled in production at this moment
- Exhaustive proof no string-named tool exists outside scan heuristics (camelCase filter may miss rare names)

---

## Negative verification (Phase 14) — results

| Check | Result |
|-------|--------|
| `_quarantine` not in `index.ts` | pass (check:agent-maps) |
| deploy-vps / deploy-nginx disabled | pass |
| DEPLOYMENT_MAP authoritative = push-live-local | pass |
| phone-orchestrator not live Vapi path | pass (docs + code) |
| tradepro repos in code-fix | pass (sync2dine) |
| Dual Sally packs documented | pass |

## Live smoke (read-only)

| Probe | Result (2026-07-23) |
|-------|---------------------|
| `GET /health` | `{"status":"ok"}` |
| `GET /api/orders` | **401** |
| `npm run smoke:orders` | pass |
| `npm run smoke:sally-web` | **200** (Judie Starter pricing reply) |
| `npm test` (BE) | **94** pass / 0 fail |
| `npm run check:agent-maps` | FE + BE OK |

## 16. Recent product facts (2026-08-14) — Sally outbound + login

Other agents: read this before changing CRM dial / Call Centre / Sally greeting.

- **Start calling this list** on `/crm` queues **all dialable home-org phones** via `POST /api/campaigns/queue-crm` `{ allCrm: true, template: 'sally_sales', remapLeeds: false }`. Not Leeds-only. Reloads Supabase customers. `venueAware: false` (no `needs_hours` hold).
- **Go live (all lines)** only SIP-registers. It does not enqueue CRM.
- **Call Centre `/calls`**: Start/Pause/Stop + capacity. Quiet hours / max attempts / retry / post-call note / concurrent knobs removed. Running ≠ queued. Worker ignores stored quiet hours; reclaim stale `dialling` before capacity.
- **Spoken brand:** say **sync Two dine** (`SYNC2DINE_SPOKEN` in `home-org.ts`). Write Sync2Dine. Judie venue greetings unchanged.
- **UK phones:** 10-digit NSN starting `1–9` → `+44`. Skip implausible E.164. Vapi DeepSeek models must be `deepseek-chat` / `deepseek-reasoner` (`vapiDeepSeekModelName`).
- **Login** is Supabase Auth (`signInWithPassword`), not `/api/auth/login`. SPA has a 12s timeout so the button cannot spin forever if Auth hangs.
- Atlas: APPLICATION_MASTER §24.C / §24.F / §24.J. Detail: SALLY_ARCHITECTURE “CRM / Call Centre outbound”. Routes: ROUTE_MAP `queue-crm`.

## Related

- [`AGENT_HARNESS_AUDIT.md`](./AGENT_HARNESS_AUDIT.md)
- ADRs under `sync2dine-backend/docs/adr/`
