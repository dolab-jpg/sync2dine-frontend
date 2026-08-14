# Change impact (blast radius)

Before editing shared surfaces, review the rows below. Update registries when behaviour changes.

| Change area | Channels | Personas | Tool packs / code | Tests / smokes | Routes | Docs to update | Deploy |
|-------------|----------|----------|-------------------|----------------|--------|----------------|--------|
| `sally/offer.ts` pricing | phone + web | Sally sales, Sally Web | phone slim + sally/tools | `sally/web-chat` tests; `smoke:sally-web` | `/api/sally/web`, Vapi sally | SALLY_ARCHITECTURE, TOOL_REGISTRY, CAPABILITY | API |
| Orders / menu / deals | Judie phone, restaurant UI, connectors | Judie, staff UI | `PHONE_TOOLS` food/reservations; `orders/*` | order-service, food-guards, meal-deals docs | `/api/orders`, `/api/menu` | CAPABILITY ?24.J, MEAL_DEALS | API + SPA |
| Judie brain / diner tools | Vapi aria | Judie | `phone_judie` | did-routing, phone-lines | `/webhooks/vapi` | AI_REGISTRY, PHONE, TOOL_REGISTRY | API |
| Sally phone overlay | Vapi sally | Sally sales/staff | `phone_sally_*` + native `voicemail` | phone tests; live call | vapi | SALLY, TOOL_REGISTRY | API |
| Outbound dial meta (`agentPersona`/`aim`) | Vapi outbound | Sally | `vapiAdapter.placeCall`, bulk outbound, `sally/schedule-outbound` | live sales CSV | `/api/calls/outbound*` | CHANGE_IMPACT | API |
| Sally venue dials / referrals | Vapi Sally + CSV | Sally | `dial-windows`, `schedule-outbound`, `captureReferralAndQueue` | tier1 tests | campaigns + vapi | SALLY, TOOL_REGISTRY | API |
| CSV campaign research + Cynthia progress | Vapi Sally + Cynthia chat | Sally, Cynthia | `outbound-campaigns` WithResearch, `campaign-progress`, `getCampaignProgress`, `queue-crm`, outbound voice health | `sally/campaign-ops.test.ts` | `/api/campaigns/upload`, `/api/campaigns/queue-crm`, `/api/campaigns/progress` (staff bearer always); `/api/calls/outbound/bulk` → same scheduler | TOOL_REGISTRY, ROUTE_MAP, CAPABILITY | API + SPA |
| Sally outbound queue policy | `/calls` + `/crm` + worker | Sally | `queue-crm` `allCrm`, preserve CRM pipeline status, reclaim sets `needs_retry`, Supabase reload throws, bulk `venueAware` default false | `sally/campaign-ops.test.ts` + live queue | `/api/campaigns/queue-crm`, `/api/calls/outbound/bulk`, outbound worker | WORKERS, SALLY_ARCHITECTURE, APPLICATION_MASTER §24.C/§24.F, ROUTE_MAP, CAPABILITY | API |
| Sally spoken brand | Vapi Sally firstMessage / voicemail / hang-up | Sally | `SYNC2DINE_SPOKEN` = `sync Two dine` in `home-org.ts`, `brains/sally`, `vapi-assistant`, sales-os | live outbound greeting | Vapi assistant-request | SALLY_ARCHITECTURE, PHONE_ARCHITECTURE | API |
| Login hang / Auth timeout | `/login` | staff | LoginPage 12s sign-in timeout + supabase-js lock passthrough | login.spec | `/login` → Supabase Auth (not `/api/auth/login`) | APPLICATION_MASTER §24.A, CHANGE_IMPACT | SPA |
| Inbox phone thread playback | `/inbox` | staff | `CyrusConversations` + `/api/calls` | manual | `/api/calls`, `/api/ai/summarize` | CHANGE_IMPACT | API + SPA |
| Cynthia orch catalogs | staff web | Cynthia, foreman, project | `orch_*` | tool-facade test; manual orch | `/api/ai/orchestrate` | TOOL_REGISTRY, AI_REGISTRY | API |
| Billing / Stripe | checkout, webhooks | Sally + staff | stripe routes + gap money tools; `createCheckoutSessionForOrg` must pass `getSallyOfferTerms().setupFeeGbp` when > 0 | quote-checkout, weekly billing, `payg-commercial.test.ts` | `/api/stripe` | CAPABILITY, ROUTE_MAP | API |
| DID / phone lines / org | all phone | Judie/Sally | phone-lines resolve | did-routing.test | vapi + agent lines | PHONE, CHANGE_IMPACT | API |
| Self-heal repos | staff | Cynthia tooling | code-fix-handler | ? | `/api/ai/code-fix` | must stay sync2dine-* remotes | API |
| Auth / org context | all | ? | auth.ts, account-auth | ? | `/api/auth` | CAPABILITY | API |
| Login / signup (public) | SPA auth | staff + new companies | LoginPage, SignupPage, account-auth register-org | oauth.spec, login.spec | `/login`, `/signup`, `POST /api/auth/register-org` | APPLICATION_MASTER §24.A, CHANGE_IMPACT | SPA + API |
| CRM lead identity | `/crm` + CSV + signup + Sally/Vapi | Sally sales, platform_owner | ComprehensiveCRM, UploadLeadsDialog, leedsCampaign (Leeds label), normalizeLeadCsv, rememberPerson, SALES_CAPTURE_LEAD_TOOL, from-call (no caller-as-venue), launch-wipe disk CRM | CSV auto-detect; Upload leads; Start calling this list; from-call 400 | `/crm`, `/api/leads/from-call`, `POST /api/leads/normalize-csv`, `POST /api/campaigns/queue-crm`, Vapi captureLead / rememberPerson | APPLICATION_MASTER §24.C | SPA + API |
| Act as client (FE experience) | SPA shells | platform_owner | `experience.ts`, RestaurantShell, PlatformClientsCRM | manual Act as to Menu to Exit | `/`, `/menu`, `/platform/clients` | CHANGE_IMPACT | SPA |
| Authenticated workspace loader | SPA bootstrap | staff | `WorkspaceLoadingScreen`, `workspaceLoader.ts` | `workspaceLoader.test.ts` | `/login` → authed home | CHANGE_IMPACT | SPA |
| Cynthia panel `isOpen` | sales/platform shell | staff | `AIChatPanel` + `AIAssistantContext` + exclusive AppShell overlay mount (`allowVoiceAutoStart` on visible host only) | `aiChatPanelOpen.test.ts` | `/`, `/platform/clients` | CHANGE_IMPACT | SPA |
| Deploy scripts | ? | ? | push-live-local | health curls | ? | DEPLOYMENT_MAP | ? |
| API outage / ops contacts | email SMS Trae webhook | platform_owner | ops-sms, ops-contacts-store, ops-notify, api-health-watchdog, sip-reg-watchdog | curl /health; Send test SMS | `/platform/ops`, `/api/platform/ops-contacts` | DEPLOYMENT_MAP, WORKERS, ROUTE_MAP | API + SPA + VPS cron (API 1m, SIP 2m) |

## Dual-implementation traps

| If you edit? | Also check? |
|--------------|-------------|
| `phone/sally-sales-phone.ts` tools | `sally/tools.ts` full pack ? do not assume Vapi has web tools |
| Outbound `agentPersona` / `aim` / `source` | Must reach `vapiAdapter.placeCall` metadata **before** `buildVapiAssistantForParty` |
| Root `server/*.ts` stub | Domain file listed in `// RE-EXPORT STUB` |
| FE `toolRuntime` action | Matching BE schema + executor |
| Allowlist in `phone-auth` | Actual Vapi chatTools assembly |
| `getExperience` / `activeOrgId` | platform_owner + non-home org opens restaurant tablet; Exit clears org and returns to sales `/platform/clients` |

## Related

- [`TOOL_REGISTRY.md`](../../sync2dine-backend/docs/TOOL_REGISTRY.md)
- [`AI_REGISTRY.md`](../../sync2dine-backend/docs/AI_REGISTRY.md)
