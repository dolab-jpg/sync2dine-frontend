# Backend moved to tradepro-backend

The Node server, Supabase migrations, Edge Functions, and data layer now live in the sibling repo:

**[../tradepro-backend](../tradepro-backend)**

This folder retains legacy JSON data at `data/` for migration only. Run:

```bash
cd ../tradepro-backend
npm run migrate
```

The Vite dev server proxies AI/webhook routes to `VITE_API_BASE_URL` (tradepro-backend on port 3001).
