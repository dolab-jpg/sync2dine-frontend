# Meal deals + dense delivery board

**Status:** LIVE on production — **https://app.sync2dine.io** (shipped 2026-07-17).

## What shipped

| Layer | Behaviour |
|-------|-----------|
| Menu (`MenuManager` specials) | Edit deal roles (main / side / drink) and choice lists; saved on product `data.deal` |
| Phone / Lizzie | `getMenu` returns deal metadata; `placeFoodOrder` expands e.g. 3× Mile a Meal → ~9 kitchen lines |
| Delivery board (`RestaurantOrders`) | Shows **all** item lines, compact spacing; amber hint when `dealName` present |
| Demo seed | **Mile a Meal** deal + **Huge Party Delivery** multi-line tickets |

## Repos / deploy

- Frontend: `sync2dine-frontend` `@ cd037c8` → `origin/master` → build + `scripts/deploy-spa.sh` → docroot `…/app.sync2dine.io/` (bundle `index-BaNBGGFg.js`)
- Backend: `sync2dine-backend` `@ cc06bdd` → VPS `…/sync2dine-backend` Node on port **3011**

## Verify

1. Staff login → **Menu** → specials → Mile a Meal → “Meal deal choices”
2. **Orders → Delivery** → Huge Party (or large basket) → many compact lines
3. Optional: `npx tsx scripts/verify-meal-deal-expand.ts` in backend repo
