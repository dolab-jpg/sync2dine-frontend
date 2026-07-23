# Sync2Dine architecture diagrams (code-verified)

Generated 2026-07-23 from repository source. Every node maps to a file or mount found in code.  
Full findings: [`ENGINEERING_AUDIT_REPORT.md`](./ENGINEERING_AUDIT_REPORT.md).

## Deploy and data flow

Verified from `scripts/push-live-local.sh`, `sync2dine-backend/.github/workflows/deploy-sync2dine-backend.yml`, FE Supabase client, BE `data-store` / Supabase modules.

```mermaid
flowchart LR
  localDev[Local_dev_workspaces]
  github[GitHub_origin_master]
  vpsApp[VPS_app_sync2dine_io_SPA]
  vpsApi[VPS_sync2dine_backend_API]
  supabase[Supabase_cloud]
  localDev -->|git_push| github
  localDev -->|push_live_local_sh_SPA| vpsApp
  localDev -->|push_live_local_sh_API| vpsApi
  github -->|FE_CI_optional_Unverified| vpsApp
  github -->|BE_workflow_SCP_and_restart| vpsApi
  localDev -->|supabase_push_or_MCP| supabase
  browser[Browser] --> vpsApp
  browser -->|same_origin_api| vpsApi
  browser -->|anon_client| supabase
  vpsApi -->|service_role| supabase
```

Notes:

- Live API port is env-driven; code default in `server/index.ts` is `3001`. Production uses **3011** per deploy docs — live `.env` value **Unverified** in this diagram pass.
- `push-live-local.sh` excludes `.env` and `server/data`. GitHub SCP exclusions are **Unverified**.

## Frontend AI clients ? API

Verified from FE source clients only (no invented Judie web chat).

```mermaid
flowchart TB
  subgraph fe [sync2dine_frontend]
    sallyHero[AskSync2DineHero_and_sally_widget]
    cynthiaUI[CynthiaHome_orchestratorService]
    cyrusUI[cyrusChatService_legacy]
    vapiWeb[useCynthiaVapiVoice]
  end
  subgraph api [sync2dine_backend]
    sallyWeb["/api/sally/web"]
    orch["/api/ai/orchestrate"]
    cynthiaApi["/api/cynthia/*"]
    cyrusApi["/api/cyrus/*"]
    vapiSess["/api/vapi/web-session"]
  end
  sallyHero --> sallyWeb
  cynthiaUI --> orch
  cynthiaUI --> cynthiaApi
  cyrusUI --> orch
  cyrusUI --> cyrusApi
  vapiWeb --> vapiSess
```

Judie has marketing UI and platform phone-line APIs; no Judie web-chat client was found.

## Experience shells

Verified from `routes.tsx` / `experience.ts` / shells.

```mermaid
flowchart LR
  app[App.tsx]
  exp[experience_mode]
  rest[RestaurantShell]
  cons[AppShell_construction]
  app --> exp
  exp -->|restaurant| rest
  exp -->|construction| cons
```
