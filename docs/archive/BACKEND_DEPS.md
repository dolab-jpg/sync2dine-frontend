# Backend Dependencies (tradepro-backend)

Routes and features that the frontend / local `server/` expects from **tradepro-backend**
(`https://github.com/dolab-jpg/tradepro-backend.git`). They are not fully implemented in this repo.

## Required on tradepro-backend

| Method | Path | Used by | Notes |
|--------|------|---------|-------|
| POST | `/api/vapi/web-session` | `src/app/hooks/useCynthiaVapiVoice.ts` | In-app Cynthia mic session for Vapi. See [VOICE_SETUP.md](./VOICE_SETUP.md). |
| POST | `/webhooks/vapi` | Production voice | Vapi + Soho66 SIP; documented in `tradepro-backend/docs/VAPI_SIP.md`. |
| POST | `/api/phone/outbound` | `server/outbound-worker.ts` | Outbound call queue worker may target backend in production. |

## Implemented in this frontend `server/` (parity)

These were previously missing client targets and are now handled locally:

| Method | Path | Handler |
|--------|------|---------|
| GET / PATCH | `/api/agent/transfer-numbers` | `server/agent-routes.ts` — Call Centre transfer destinations |
| POST | `/api/push/notify` | `server/push-routes.ts` — stub that accepts Cynthia card pushes |

## Adding a new backend-only route

1. Prefer implementing in `tradepro-backend` when it needs production secrets (Vapi, live telephony).
2. Document the path here and in the relevant setup doc (`VOICE_SETUP.md`, etc.).
3. Keep a local stub or proxy in this repo only when Call Centre / Cynthia would otherwise 404 in dev.
