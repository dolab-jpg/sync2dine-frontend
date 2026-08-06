# Sync2Dine capability inventory

Living ownership matrix. Deep lists live in registries � keep rows short.  
Atlas: [`APPLICATION_MASTER.md`](./APPLICATION_MASTER.md) �24��25.  
AI: [`../sync2dine-backend/docs/AI_REGISTRY.md`](../../sync2dine-backend/docs/AI_REGISTRY.md) � Tools: [`TOOL_REGISTRY.md`](../../sync2dine-backend/docs/TOOL_REGISTRY.md) � Workers: [`WORKERS.md`](../../sync2dine-backend/docs/WORKERS.md) � Routes: [`ROUTE_MAP.md`](../../sync2dine-backend/docs/ROUTE_MAP.md)

**Verify host:** `https://app.sync2dine.io` unless the user asks for local.

## Phone & AI

| Capability | Domain | FE | BE | AI / tools | SoT | Status | Verify |
|------------|--------|----|----|------------|-----|--------|--------|
| Judie diner phone | phone | kiosk / calls | `brains/judie`, `phone/vapi-*` | `judie` / `phone_judie` | Supabase orders | live | PHONE_ARCHITECTURE |
| Sally sales phone | phone | CRM dial | `brains/sally`, `sally-sales-phone` | `sally` | offer + platform org | live | SALLY_ARCHITECTURE |
| Sally staff PIN | phone | � | Sally staff mode | `sally_staff` | CRM/mailbox | live | PIN on Sally line |
| Sally Web | web | widget / hero | `POST /api/sally/web` | `sally_web` | shared BI | live | `npm run smoke:sally-web` |
| Cynthia staff web | ai | `/cynthia`, overlay | `/api/ai/orchestrate`, staff | `cynthia` | session | live | staff login |
| Cyrus widget alias | ai | widgets | `/api/cyrus/*` | `cyrus` | � | live | widget |
| Sales Brain | ai | `/platform/sales-brain` | `/api/sales-brain` | `sales_brain` worker | Supabase | live | panel |
| Sally product KB | ai | `/platform/sally-knowledge` | `/api/sally-knowledge` | KB worker | Supabase | live | approved Atmosphere talking points + panel |
| Sally offer | sales | `/platform/sally-offer` | `sally/offer.ts` + phone USPs | � | offer module | live | formatOfferFactsBlock; Atmosphere discovery/USPs |
| Atmosphere (SKU) | sales | `/atmosphere` | package + Sally pitch | � | saas-packages | thin product / live sales language | sales proposition only — not in-app audio controls |
| Ops alert contacts | platform | `/platform/ops` | `/api/platform/ops-contacts` | VPS cron watchdog | `ops-contacts.json` | live | email/SMS/Trae on API down |
| AI Studio | config | Settings ? AI | `/api/ai/studio` | config only | studio store | live | settings |
| Self-heal | ai | `/ai-audit` | `/api/ai/code-fix*` | utility | `code_fix_jobs` | live | Trae handoff LIVE badge |
| Foreman / project / planning / BC AI | construction | panels | `/api/ai/*` | domain agents | � | live | construction UI |
| Call Centre UI | phone | `/calls` | `/api/agent`, vapi, calls | human softphone | lines | live | softphone |
| Legacy phone orchestrator | � | � | throw stub | quarantined | � | dead | do not edit |
| IVR | phone | � | `ivr-handler` | disabled | � | off | `IVR_ENABLED` |
| Concierge outbound | channel | � | `/api/concierge/outbound` | partial | queue | partial | API |

## Restaurant operations

| Capability | Domain | FE | BE | Status | Verify |
|------------|--------|----|----|--------|--------|
| Live / kitchen / till / delivery | orders | `/`, `/orders/*` | `/api/orders` | live | boards; orders 401 |
| Menu + meal deals | menu | `/menu` | `/api/menu` | live | MEAL_DEALS.md |
| Bookings | reservations | `/bookings` | `/api/reservations` | live | board |
| Front kiosk | diner | `/front` | orders/menu as wired | live | `/front` |
| Connectors / POS | integrations | platform | `/api/connectors` | live | connector tests |

## Auth, org, platform

| Capability | Domain | FE | BE | Status | Verify |
|------------|--------|----|----|--------|--------|
| Auth / invites / profile | auth | `/login` � | `/api/auth/*` | live | login |
| Platform orgs / clients | platform | `/platform/clients` | `/api/platform` | live | CRM |
| Org OpenAI / integrations | admin | settings | org-* routes | live | settings |
| Experience modes | platform | `experience.ts` | � | live | restaurant vs construction |

## Communications

| Capability | Domain | FE | BE | Status | Verify |
|------------|--------|----|----|--------|--------|
| Comms hub / mailbox | mailbox | `/communications` | `/api/mailbox` | live | inbox |
| Leads inbox | leads | comms tab | `/api/leads` | live | inbox |
| WhatsApp Web | wa | integrations | `/api/whatsapp-web` | live | QR panel |
| Meta WhatsApp | wa | � | webhook gated | cold | `WHATSAPP_META_ENABLED` |
| Push notifications | push | bridge | `/api/push` | partial | native |
| Calendar | calendar | � | `/api/calendar` | live | API |

## Construction / money (still shipped)

| Capability | Domain | FE | BE | Status |
|------------|--------|----|----|--------|
| CRM / quotes / projects / portal | construction | `/crm`, `/quotes`, `/projects` | sync, portal, contracts | live |
| Banking / accounts | money | `/accounts` | `/api/banking` | flag-gated |
| Stripe / weekly / phone billing | billing | pricing/start | `billing/*` | live/partial |
| Recruitment | hr | `/recruitment` | phone tools | flag-gated |
| Building control / planning | compliance | hubs | BC + planning AI | live |

## Edit here, not there

| Task | Edit | Do not edit |
|------|------|-------------|
| Vapi / assistant | `server/phone/vapi-routes.ts`, `vapi-assistant.ts` | stub only; `_quarantine` |
| Sally prices | `server/sally/offer.ts` | hardcoded prompt prices |
| Sally phone overlay | `phone/sally-sales-phone.ts` | Cynthia orch |
| Staff web chat | `ai/orchestrator-handler.ts` | `sally/web-chat.ts` |
| Orders / menu | `server/orders/*` | JSON as SoT; FE twin |
| Restaurant UI | `components/restaurant/*` | construction `/orders` alone |

## Related

- [`CHANGE_IMPACT.md`](./CHANGE_IMPACT.md) � [`DEPLOYMENT_MAP.md`](./DEPLOYMENT_MAP.md) � [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`LEGACY_ALIASES.md`](../../sync2dine-backend/docs/LEGACY_ALIASES.md)
