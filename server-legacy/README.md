# Legacy frontend Node tree (not production API)

This folder is **migration / historical reference only**.

Canonical API + Supabase live in the sibling repo:

**[../sync2dine-backend](../sync2dine-backend)**

Do **not** edit this tree for live features. Do **not** SCP these files onto the VPS (that overwrites the real backend).

Live deploy: `bash scripts/push-live-local.sh` (SPA from this repo; API from `../sync2dine-backend`).

Legacy JSON under `data/` may still be useful for one-off migration:

```bash
cd ../sync2dine-backend
npm run migrate
```
