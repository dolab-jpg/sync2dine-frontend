# Cynthia phone setup (Company AI Brain + cloned Cockney accent)

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §16 (voice) + §27 (mobile softphone). This file is an ops checklist only.

Cynthia uses the **Company AI Brain** (OpenAI by default; optional DeepSeek for text) for conversation logic and **Chatterbox TTS** / ElevenLabs for the spoken voice. Photo pricing, vision, Whisper, and OpenAI TTS fallback always use the **OpenAI** key.

## 0. Production voice path (Vapi only)

**Cynthia answers via Vapi + Soho66 SIP trunk** (`VOICE_PROVIDER=vapi` on tradepro-backend). There is **no sip-bridge / local_realtime rollback** — misconfigured providers fail closed.

- Webhooks: `POST /webhooks/vapi` on the API host (production: `https://app.b-diddies.com`)
- In-app Cynthia mic: `POST /api/vapi/web-session`
- CRM caller match happens in Vapi webhooks (`resolveContactByPhone`) and shows on Call Centre → Live Call Status
- Soft Phone (JsSIP) is an **optional** staff browser channel — Soho66 public WSS is often unavailable; use desk phone / VOIS for humans

See `tradepro-backend/docs/VAPI_SIP.md` for the accurate setup.
For routes that live only on the API host, see [BACKEND_DEPS.md](./BACKEND_DEPS.md).

## 1. Environment variables

Copy `.env.example` to `.env.local` and set:

```env
OPENAI_API_KEY=sk-...
VOICE_PROVIDER=vapi

CHATTERBOX_BASE_URL=http://YOUR_VPS_IP:8004
CHATTERBOX_API_KEY=optional-if-your-server-requires-it
CHATTERBOX_TTS_PATH=/tts

WEBHOOK_BASE_URL=https://your-public-server.com
APP_BASE_URL=http://localhost:5174
```

- `CHATTERBOX_TTS_PATH` — adjust if your Chatterbox server uses a different synth route.
- `WEBHOOK_BASE_URL` — must be publicly reachable for TTS/play URLs on real calls.

You can also configure Chatterbox under **Settings → Integrations → Chatterbox TTS**.

## 2. Clone a Cockney / Del Boy voice

1. Record or obtain a **short WAV sample** (10–30 seconds) of the accent you want. Use audio you have rights to — do not use copyrighted TV clips.
2. Open **Call Centre → Dashboard → Voice Settings**.
3. Enter a name (e.g. `Del Boy`) and upload the WAV.
4. Click the voice card to set it as **active**.

The mock test tab will auto-play Cynthia's replies in that voice.

## 3. Test in the dashboard

1. Go to **Call Centre → Test Call (Mock)**.
2. Speak or type a caller turn.
3. Cynthia replies with OpenAI logic; audio plays via `/api/agent/tts` using your cloned voice.
4. Use the speaker icon on any Cynthia line to replay.

## 4. Live answering

1. Call Centre → toggle **Cynthia is answering inbound calls**.
2. AI lines use purpose `aria` (compat alias) labeled **Cynthia AI (Vapi)** in Phone Lines.
3. Transfer numbers: set departments where Cynthia should hand off to a human.

## 5. Softphones (humans)

Human softphones are separate from Cynthia AI:

- Staff lines use `purpose: 'staff'`
- Soft Phone tab: `/calls?tab=softphone`

**WSS note:** `wss://ws.soho66.co.uk/ws` often does not complete a SIP WebSocket session. Use Soho66 VOIS or a desk phone for staff.

## 6. Optional IVR

Set `IVR_ENABLED=1` to play a DTMF menu before Cynthia on inbound calls.
