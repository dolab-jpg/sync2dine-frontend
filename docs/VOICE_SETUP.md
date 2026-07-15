# Aria Voice Setup (Company AI Brain + cloned Cockney accent)

Aria uses the **Company AI Brain** (OpenAI by default; optional DeepSeek for text) for conversation logic and **Chatterbox TTS** for the spoken voice. Photo pricing, vision, Whisper, and OpenAI TTS fallback always use the **OpenAI** key.

## 1. Environment variables

Copy `.env.example` to `.env.local` and set:

```env
OPENAI_API_KEY=sk-...

CHATTERBOX_BASE_URL=http://YOUR_VPS_IP:8004
CHATTERBOX_API_KEY=optional-if-your-server-requires-it
CHATTERBOX_TTS_PATH=/tts

WEBHOOK_BASE_URL=https://your-public-server.com
APP_BASE_URL=http://localhost:5174
```

- `CHATTERBOX_TTS_PATH` — adjust if your Chatterbox server uses a different synth route.
- `WEBHOOK_BASE_URL` — must be publicly reachable for Twilio `<Play>` audio on real calls.

You can also configure Chatterbox under **Settings → Integrations → Chatterbox TTS**.

## 2. Clone a Cockney / Del Boy voice

1. Record or obtain a **short WAV sample** (10–30 seconds) of the accent you want. Use audio you have rights to — do not use copyrighted TV clips.
2. Open **Call Centre → Dashboard → Voice Settings**.
3. Enter a name (e.g. `Del Boy`) and upload the WAV.
4. Click the voice card to set it as **active**.

The mock test tab will auto-play Aria's replies in that voice.

## 3. Test in the dashboard

1. Go to **Call Centre → Test Call (Mock)**.
2. Start a call and type caller messages.
3. Aria replies with OpenAI logic; audio plays via `/api/agent/tts` using your cloned voice.
4. Use the speaker icon on any Aria line to replay.

## 4. Real phone calls (Twilio)

1. Set `TELEPHONY_PROVIDER=twilio` and Twilio credentials in `.env.local` or Integrations.
2. Set `WEBHOOK_BASE_URL` to your deployed API.
3. Point Twilio voice webhooks to:
   - `POST {WEBHOOK_BASE_URL}/webhooks/voice/inbound`
   - `POST {WEBHOOK_BASE_URL}/webhooks/voice/turn`
   - `POST {WEBHOOK_BASE_URL}/webhooks/voice/status`
4. With an active cloned voice selected, Twilio uses `<Play>` URLs to `/api/agent/tts` instead of Amazon Polly.

## 5. Soho66 multi-line (SIP)

Soho66 is SIP-based. TradePro supports **multiple extensions** logged in at once.

### Add lines

1. Set `TELEPHONY_PROVIDER=soho66` and `SOHO66_SIP_BRIDGE_URL` in `.env.local`.
2. Open **Call Centre → Phone Lines**.
3. For each Soho66 extension, click **Add line** with:
   - Label (e.g. Sales Line 1)
   - DID (the phone number that line answers)
   - SIP username, password, domain from the Soho66 portal
4. Click **Register all lines** to SIP-register every enabled line via the Jambonz bridge.

### Concurrent inbound

- Each inbound call is matched to a line by the `to` (DID) number.
- Multiple calls can be active at once — the **Live Call Status** panel shows all of them.
- Aria answers each call independently (OpenAI + Chatterbox per call).

### Jambonz bridge API (your VPS)

The bridge should implement:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/lines/register` | Register one SIP line |
| DELETE | `/lines/{lineId}` | Unregister line |
| GET | `/lines` | List registration status |
| GET | `/health` | Health check |
| POST | `/calls` | Outbound dial (optional) |

Register payload:

```json
{
  "lineId": "line-abc",
  "sipUsername": "ext101",
  "sipPassword": "***",
  "sipDomain": "sip.soho66.com",
  "did": "+442012345678",
  "webhookBaseUrl": "https://your-api.com"
}
```

The bridge POSTs inbound speech events to `{webhookBaseUrl}/webhooks/voice/inbound` and `/webhooks/voice/turn`.

Legacy single-line env vars (`SOHO66_SIP_USERNAME`, etc.) auto-migrate to one line on first server start.

## 5b. Staff softphones (per-person Soho66 SIP)

Human softphones are separate from Aria:

1. **Settings → Team → Staff Softphones** — assign SIP username, password, domain (`sip.soho66.co.uk`), DID, and user id.
2. **Calls → Soft Phone** — each logged-in user loads `GET /api/agent/lines/mine` (password returned only for the assigned owner) and registers via JsSIP.
3. Flutter (`tradepro-mobile`) opens `/calls?tab=softphone` on navigate / FCM `type=incoming_call`.

**WSS note (tested Jul 2026):** `wss://ws.soho66.co.uk/ws` redirects to the marketing site and does not complete a SIP WebSocket session. Classic Soho66 phones register to `sip.soho66.co.uk:8060`. For in-app browser ring, either use Soho66 VOIS, or put a SIP-over-WSS gateway / Jambonz in front. Staff lines use `purpose: 'staff'` and are **not** registered to the Aria bridge (`register-all` is `purpose: 'aria'` only).

## Architecture

```
Caller → Telephony (Twilio / Soho66+bridge) → OpenAI (brain) → Chatterbox TTS (voice) → Caller hears audio
```

Fallback: if Chatterbox is unavailable, `/api/agent/tts` uses OpenAI `tts-1` (British-ish preset voices, not Cockney).

## 6. Optional IVR menu (off by default)

Set `IVR_ENABLED=1` to play a DTMF menu before Aria on inbound calls:

- **1** — Sales / quotes (continues to AI)
- **2** — Site / foreman queue
- **3** — Transfer to office (`VOICE_TRANSFER_NUMBER`) or take a message
- **9** — Voicemail / capture message

Configure a custom tree via agent settings `ivrTree` JSON (`greeting` + `options[]` with `digit`, `label`, `route`).

Smoke test: `npx tsx server/debug-smoke.ts` (sets `IVR_ENABLED=1` briefly for the IVR check).

Webhooks unchanged: `{WEBHOOK_BASE_URL}/webhooks/voice/inbound` and `/webhooks/voice/turn` (pass `Digits` or DTMF in the turn body for Jambonz/Twilio).
