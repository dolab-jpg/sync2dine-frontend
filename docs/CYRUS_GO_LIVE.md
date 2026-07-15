# Cynthia website / WhatsApp go-live checklist

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §19.3 / §18. This file is an ops checklist only.  
> Filename keeps `CYRUS_GO_LIVE` for links; product name is **Cynthia**. Transport APIs remain `/api/cyrus/*`.

1. **Integrations → OpenAI** — paste a live `sk-…` key, click **Save**, then **Test Connection** (must show connected). Master mock mode turns off automatically when you save a valid key.
2. **Integrations → Company Profile** — set **Website** to your live company site URL (used for embed origin checks). Copy the **Cynthia website chat** script snippet into that site’s footer/theme (`cynthia-widget.js`; existing `cyrus-widget.js` embeds keep working).
3. **Integrations → WhatsApp Web** — scan QR (Path B Meta is cold forever); turn off mock mode. Display name defaults to Cynthia (`cyrusDisplayName` config key). See [WHATSAPP_GO_LIVE.md](./WHATSAPP_GO_LIVE.md).
4. Set `INTEGRATIONS_MOCK_MODE=false` in production env (`.env` / host secrets).
5. Confirm `OPENAI_API_KEY` org key is stored (Super Admin Save) or env fallback for single-tenant.
6. Smoke test: Integrations → WhatsApp → Simulate inbound, or open `/cynthia` staff chat. Website visitors use the embed; portal clients use **Ask Cynthia** on `/portal/:token`. Staff website inbox: `/cyrus/legacy`.
