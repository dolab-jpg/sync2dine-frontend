---
name: sync2dine-orders
description: Restaurant orders, menu, meal deals, kitchen/till/delivery boards.
---

# Sync2Dine orders

## When

Kitchen/till/delivery, menu, meal deals, reservations, Judie order tools.

## Open

- `docs/CAPABILITY_INVENTORY.md` (restaurant section)
- `docs/APPLICATION_MASTER.md` �24.J
- `docs/MEAL_DEALS.md` when deals
- BE `server/orders/*`, Supabase orders
- Phone food tools: TOOL_REGISTRY `phone_shared` / Judie

## Do not

- Treat JSON under `server/data` as production SoT
- Edit construction `/orders` alone for restaurant boards

## Verify

```bash
curl -sS -o NUL -w "%{http_code}" https://app.sync2dine.io/api/orders
# expect 401
cd ../sync2dine-backend && npm run smoke:orders
```

Update CHANGE_IMPACT / CAPABILITY if mounts change.
