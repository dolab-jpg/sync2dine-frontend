# Phone / SIP full audit ù evidence table

**Date:** 2026-07-26  
**WIP ship SHAs:** BE `40261b0` (Phase 0) ? `9acfe4a` (Phase 2); FE `8771183` (Phase 0) ? `49e035f` (Phase 2)  
**Live:** https://app.sync2dine.io  
**Live SPA:** `assets/index-CQqXvw5d.js`

Clarification: **`aria` = Judie** (legacy line purpose). Not a third assistant.  
**Third customer line:** not in the AI set until credentials are provided.

## Phase 1 gates

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| A1 | SPA asset hash vs local dist | PASS | Live `assets/index-CQqXvw5d.js` matches post-Phase-2 build |
| A2 | Bundle contains `Go live (all lines)` | PASS | Live JS grep matched |
| A3 | `/health` ok, `/api/orders` 401, `/api/ops/alerts` 200 | PASS | 200 / 401 / 200 |
| A4 | One listener on `:3011`; pid file matches; `asteriskBridge.ts` == origin/master | PASS | pid `2460638`; empty diff vs `origin/master` Phase 0 files |
| A5 | `/api/platform/sally-offer` 200 | PASS | Returns offer + stored |
| A6 | `/api/platform/phone-lines/ai-set` = exactly Sally + Judie demo, passwords masked | PASS | count=2; users `1005090093` / `1014090093` |
| B7 | VPS `lines.json` equals `ai-set` | PASS | `/var/www/vhosts/b-diddies.com/tradepro-sip-bridge/lines.json` |
| B8 | Both REGISTERs = Registered | PASS | `reg-1005090093` + `reg-1014090093` Registered |
| B9 | Displacement: sync-asterisk-bridge apply ? both still Registered, count=2, ok:true | PASS | HTTP 200; Objects found: 2; both Registered (exp. 282s) |
| B10 | Parser: Unregistered ? Registered | PASS | Unit test in `phone-lines.test.ts` |
| C11 | assistant-request smokes | PASS | Sally `+442037453233` ? sales tools; Judie `+442071128727` ? Judie, no Sally pack |
| C12 | Vapi BYO both DIDs on cred `bf62dc42ù`, serverUrl webhook | PASS | `vapi-ensure-byo.mjs` both `already provisioned` |
| C13 | Human PSTN audio | SKIP | Requires human dial; not executed in this session |
| D14 | Demo kitchen Judie UI: DID/user filled, status registered, Go live present | PASS | Browser: `02071128727` / `1014090093` / badge `registered` |
| D15 | Sally offer phone: DID `02037453233`, status registered | PASS | Browser screenshot: badge `registered` |
| D16 | Test honesty (BYO gate) | PASS | Phase 2 live: Go live returns `byo.ok=true` for both DIDs; Test checks BYO |
| E17 | `npm test` ?120 pass | PASS | 120/120 |
| E18 | extract registries show new routes | PASS* | `ai-set`, `sync-asterisk-bridge`, `sally-offer` in `routes-discovered.json`; `check:agent-maps` fingerprint drift includes unrelated WIP ù baseline deferred |

## Live AI line set (post-audit)

| Role | Org | SIP user | DID | E.164 | Asterisk | Stored status |
|------|-----|----------|-----|-------|----------|---------------|
| Sally | home `4fc49703-ù` | `1005090093` | `02037453233` | `+442037453233` | Registered | registered |
| Judie | demo kitchen `c2887ddb-ù` | `1014090093` | `02071128727` | `+442071128727` | Registered | registered |

Staff softphone `1015090093` is **not** in the AI bridge (correct).

## Phase 2 hardening shipped

| Item | Status |
|------|--------|
| Go live ensures Vapi BYO (`server/telephony/vapiByo.ts`) | Done |
| Test checks BYO | Done |
| AI per-line Register ? full-set sync (no displacement) | Done |
| Retire single-line `.env` swap script | Done (exits 1 with pointer) |
| Deploy probes (SPA hash / Go-live string / sally-offer / ai-set) | Done |
| Sally UI independent offer vs phone load | Done |
| Org-scoped status writes in `lineRegistry` | Done |
| Restart uses `lsof` when `fuser` missing | Done |
| Env fallback in `generate.py` loud-warns | Done |
| phone-change skill updated | Done |

## Residual risks

- **Human PSTN (C13):** not dialed this session ù call both DIDs to confirm greeting audio.
- **GH Actions deploy path:** may still restart differently from local `push-live-local.sh`; prefer local hardened script until GH workflow uses `restart-sync2dine-api.sh`.
- **Demo kitchen ? home alias:** `getDemoKitchenOrgId()` identity debt remains; FE badges distinguish them; DID routing was not changed.
- **`check:agent-maps` baseline:** defer until unrelated dirty-tree WIP (phone-incidents, provision-from-crm, etc.) is either committed or discarded.
- **Third customer line:** not in set until credentials are provided.
