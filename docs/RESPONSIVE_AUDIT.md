# Responsive audit log

Repeatable checklist for phone, tablet, and desktop. Automated checks: `npm run test:responsive`.

## Device matrix

| Profile | Viewport | Playwright project | Smoke overflow | Snapshots |
|---------|----------|-------------------|----------------|-----------|
| Phone | 390 x 844 | `phone` | Pass | Pass |
| Phone small | 375 x 667 | `phone-small` | Pass | Skipped (phone/tablet/desktop only) |
| Tablet portrait | 768 x 1024 | `tablet` | Pass | Pass |
| Tablet landscape | 1024 x 768 | `tablet-landscape` | Pass | Skipped |
| Desktop | 1280 x 800 | `desktop` | Pass | Pass |

Last automated run: **70 tests — 56 passed, 14 skipped, 0 failed** (local `http://localhost:5174`).

Routes covered after demo login: `/`, `/crm`, `/projects`, `/accounts`, `/integrations`, `/quotes`, plus public `/` login and `/platform/clients`.

Pass criteria: `document.documentElement.scrollWidth <= clientWidth + 1`.

## Environments

| Env | URL | Notes |
|-----|-----|-------|
| Local | `http://localhost:5174` | Default for Playwright (`npm run dev`) |
| Online | Set `PLAYWRIGHT_BASE_URL=https://your-deployed-app.example` | Required for real phone testing |

Run online smoke:

```powershell
cd "Bathroom Sales Estimation Platform"
$env:PLAYWRIGHT_BASE_URL = "https://your-deployed-app.example"
npm run test:responsive
```

## Phase 1 — DevTools / Playwright (automated)

```powershell
cd "Bathroom Sales Estimation Platform"
npm run test:responsive
```

Snapshot baselines live in `tests/visual/responsive.spec.ts-snapshots/` (login, dashboard, projects, integrations for phone/tablet/desktop).

## Phase 2 — Real device (online)

Use your **deployed** frontend URL on a physical phone (Safari + Chrome) and tablet. A phone cannot reach `localhost` unless you tunnel (ngrok) or use the deployed URL.

### Checklist (manual — run against production/staging URL)

1. [ ] Login layout readable; inputs do not force zoom (16px base font on inputs)
2. [ ] Hamburger nav on phone; sidebar on tablet landscape (768px+)
3. [ ] Projects → Payments → Mark paid / Send receipt tappable (44px min targets)
4. [ ] Integrations → Company Profile → logo upload works
5. [ ] Rotate landscape — nav still usable

### Simulated online pass (Playwright mobile viewport)

When a deployed URL is available, re-run Phase 1 with `PLAYWRIGHT_BASE_URL` set. That validates layout on phone/tablet/desktop against live build without a physical device.

## Bug log

```
Screen: AppShell / post-login
Device: all / 390–1280px
Env: local
Issue: White screen after demo login — AIChatPanel referenced staffContext before initialization
Severity: blocker
Fixed: yes — moved staffContext useMemo before sessionId/syncConversation in AIChatPanel.tsx
```

```
Screen: /projects → Payments
Device: iPhone 14 / 390px
Env: local (automated)
Issue: Payment action buttons below 44px tap target
Severity: major
Fixed: yes — min-h-11 touch-manipulation on payment buttons
```

```
Screen: /accounts
Device: phone
Env: local
Issue: Header/tabs overflow
Severity: major
Fixed: yes — responsive padding, scrollable tab bar, min-w-0
```

```
Screen: Login inputs
Device: phone (iOS)
Env: local
Issue: Zoom on focus when font-size < 16px
Severity: major
Fixed: yes — Input stays text-base at all breakpoints
```

```
Screen: AppShell main
Device: all
Env: local
Issue: Page-level horizontal scroll
Severity: major
Fixed: yes — overflow-x-hidden on main
```

## Fixes applied (this audit)

| Screen | Device | Issue | Severity | Fix |
|--------|--------|-------|----------|-----|
| AIChatPanel | all | Post-login crash (TDZ `staffContext`) | blocker | Reordered hooks in `AIChatPanel.tsx` |
| AppShell | all | Debug telemetry fetch to 127.0.0.1:7261 | minor | Removed layout/nav debug hooks |
| AppShell main | all | Page-level horizontal scroll | major | `overflow-x-hidden` on main |
| Projects Payments | phone | Small tap targets on action buttons | major | `min-h-11 touch-manipulation` on payment buttons |
| Accounts | phone | Header/tabs overflow | major | Responsive padding, scrollable tab bar, `min-w-0` |
| Login inputs | phone | iOS zoom on focus (14px text) | major | Input stays `text-base` at all breakpoints |

## Automation added

- `playwright.config.ts` — Chromium, 5 viewport projects, single worker for stability
- `tests/visual/responsive.spec.ts` — overflow checks, mobile hamburger, payments tab, snapshot baselines
- `npm run test:responsive` / `npm run test:responsive:ui`

## Gap analysis (plan vs done)

| Plan item | Status | Notes |
|-----------|--------|-------|
| Viewport matrix 390/375/768/1024/1280 | Done | Playwright Chromium |
| Staff routes overflow (Dashboard/CRM/Projects/Accounts/Integrations/Quotes) | Done | Local only |
| Snapshots Login/Dashboard/Projects/Integrations (3 profiles) | Done | Baselines on disk |
| Login fits + no zoom-on-focus | Partial | Layout overflow yes; zoom fixed in CSS; not asserted in tests |
| Hamburger phone / sidebar tablet+ | Partial | Hamburger asserted; **no explicit sidebar-visible-at-768 test** |
| Header logout reachable | **Gap** | Not automated |
| AI panel bottom sheet vs `lg+` dock | **Gap** | Not automated; not manually verified |
| Payments: Mark paid → receipt toast | **Gap** | Only opens Payments tab if present; no mark-paid / toast |
| Company Profile logo upload on phone | **Gap** | Integrations overflow only; no upload/save flow |
| Invoice PDF on phone mail client | **Gap** | Requires real email + device |
| QuoteBuilder usable (`/quote`) | **Gap** | Spec hits `/quotes` (QuotesList), not QuoteBuilder |
| Online / deployed URL | **Gap** | No production URL in repo; Phase 2 checklist still open |
| Physical phone Safari + Android | **Gap** | Cannot run without your device + live URL |
| Physical tablet sidebar + landscape | **Gap** | Same |
| CI workflow for Playwright on PRs | **Gap** | No `.github/workflows`; optional in plan |
| WhatsApp-related phone flows | **Gap** | Called out as priority; not in matrix |

## Known follow-ups

- Provide deployed frontend URL → re-run `PLAYWRIGHT_BASE_URL=… npm run test:responsive` and complete Phase 2 checklist on a real phone/tablet
- Add tests: logout, tablet sidebar, AI panel open, `/quote` QuoteBuilder, Payments Mark paid (with seed project)
- Wire `test:responsive` into CI when ready
- QuoteBuilder at 375px + AI overlay covering primary actions

## Flutter WebView shell (tradepro-mobile)

Hybrid Flutter app loads the same website in a WebView (online-only). See `tradepro-mobile/docs/DEVICE_TEST_CHECKLIST.md`.

| Check | Automated | Manual |
|-------|-----------|--------|
| Offline gate at launch | `flutter test` (offline screen) | Airplane mode on device |
| Demo login no password | `tests/visual/mobile-shell.spec.ts` | Cold start on device |
| Session restore after reload | `mobile-shell.spec.ts` | Kill app + reopen |
| Online banner | `mobile-shell.spec.ts` (offline emulate) | Toggle airplane mid-session |
| Native bridge contract | `npm run test:bridge` + bridge mock spec | Camera/mic on Android + iOS |
| Safe-area / notch | CSS `env(safe-area-inset-*)` | Physical iPhone + Android |
| Push token register | `server/push/push-routes.test.ts` | FCM on staging with `PUSH_ENABLED=true` |

Commands:

```powershell
# Frontend
npm run test:bridge
npm run test:responsive

# Flutter
cd ..\tradepro-mobile
flutter analyze
flutter test

# Backend push API
cd ..\tradepro-backend
npx tsx server/push/push-routes.test.ts
```
