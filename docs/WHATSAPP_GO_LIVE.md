# WhatsApp + Cyrus Go-Live Checklist

## Meta Business Setup (your tasks)

1. Create a [Meta Business Manager](https://business.facebook.com) account
2. Create a [Meta Developer App](https://developers.facebook.com) and add the **WhatsApp** product
3. Link a **WhatsApp Business Account (WABA)** to your business
4. Verify a **dedicated phone number** (not used on personal WhatsApp)
5. Generate a **permanent access token** and note:
   - Phone Number ID
   - Business Account ID
   - App ID and App Secret
6. Choose a **Webhook Verify Token** (any secure string you define)

## Enter credentials in the app

1. Log in as **Super Admin**
2. Go to **Settings → Integrations**
3. Configure **OpenAI**, **WhatsApp**, **Email**, and **Company Profile**
4. Use **Test Connection** on each card
5. Turn off **Master mock mode** when ready for live sends

## Deploy webhook server

WhatsApp requires HTTPS webhooks for inbound messages (Cyrus replies).

```bash
# Deploy server/index.ts to Railway, Render, or Fly.io
# Set environment variables from .env.example
# Point Meta webhook to: https://your-api.example.com/webhooks/whatsapp
```

Subscribe to webhook fields: `messages`

## Message templates (required for proactive outbound)

Outside the 24-hour customer reply window, you must use **approved templates**:

| Template name | Purpose |
|---------------|---------|
| `quote_ready` | Hi {{1}}, your quote for {{2}} is ready. Total: {{3}}. Reply to chat with Cyrus. |
| `booking_confirmed` | Hi {{1}}, your site survey is booked for {{2}} at {{3}}. |
| `document_delivery` | Hi {{1}}, here is your {{2}}. Reply if you have questions. |

Submit templates in Meta Business Manager — approval typically takes 24–48 hours.

## UK compliance

- Obtain explicit **WhatsApp opt-in** before marketing messages (stored on customer record)
- Update privacy policy to mention WhatsApp communications
- Honour opt-out requests promptly

## Supabase migration (when going live)

Replace `localStorage` with Supabase tables:

- `customers`, `quotes`, `message_logs`, `whatsapp_conversations`
- `integrations` (encrypted JSON per provider)

## Local dev testing

- Use **Integrations → WhatsApp → Simulate inbound message** to test Cyrus without Meta
- Use ngrok to expose `/webhooks/whatsapp` for real webhook testing:
  `ngrok http 5173` (Vite dev) or `ngrok http 3001` (standalone server)
