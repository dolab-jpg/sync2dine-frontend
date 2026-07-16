# Cynthia phone setup (Vapi + ElevenLabs)

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §16. Sibling deep-dive: `tradepro-backend/docs/VAPI_SIP.md`.

**Production phone voice path (the one that has worked on live calls):**

```text
Caller ↔ Soho66 SIP ↔ Vapi (media) ↔ ElevenLabs (female Cockney) ↔ POST /webhooks/vapi ↔ Cynthia phone-brain
```

- Provider: `VOICE_PROVIDER=vapi` (required)
- Spoken voice: **ElevenLabs** via Vapi (`provider: '11labs'`) — female British / Cockney (**Lizzie** voice id `EQx6HGDYjkDpcli6vorJ` when configured on the API host)
- Webhooks: `POST /webhooks/vapi` on `https://app.b-diddies.com`
- In-app Cynthia mic: `POST /api/vapi/web-session`
- Soft Phone (JsSIP) is optional for **humans** only — not used for Cynthia AI answering

There is **no** sip-bridge / `local_realtime` / turn-by-turn local STT→TTS rollback for AI answering. Misconfigured providers fail closed.

---

## 1. Environment (API host / `/etc/tradepro-api.env`)

```env
VOICE_PROVIDER=vapi
VAPI_PRIVATE_KEY=••••
VAPI_PUBLIC_KEY=••••
VAPI_REGION=eu
VAPI_WEBHOOK_BASE_URL=https://app.b-diddies.com
VAPI_PHONE_NUMBER_ID=••••
VAPI_SIP_CREDENTIAL_ID=••••
ELEVENLABS_API_KEY=••••
VAPI_ELEVENLABS_VOICE_ID=EQx6HGDYjkDpcli6vorJ
ELEVENLABS_VOICE_ID=EQx6HGDYjkDpcli6vorJ
SOHO66_SIP_*=••••
SOHO66_FROM_NUMBER=02037453233
OPENAI_API_KEY=••••
```

Also paste the ElevenLabs key into **Vapi dashboard → Integrations** if your org requires it.

Provision trunk + DID into Vapi from `tradepro-backend`:

```powershell
cd tradepro-backend
npm run vapi:setup
```

Confirm: `GET /api/vapi/health` → `{ "ok": true, "provider": "vapi" }`.

Full SIP / REGISTER notes: `tradepro-backend/docs/VAPI_SIP.md`.

---

## 2. Live answering

1. Open **Call Centre** (`/calls`).
2. Toggle **Cynthia is answering inbound calls** = ON.
3. AI lines use purpose `aria` (compat alias), labeled **Cynthia AI (Vapi)** on Phone Lines.
4. Set transfer numbers for human handoff where needed.

**Inbound DID (same Soho66 + Vapi + Lizzie — no softphone required):**

Outbound: Vapi dials via Soho66 BYO trunk.  
Inbound: a small Asterisk REGISTER bridge on the VPS acts as the “IP phone” for Soho66 **Ring my IP phone**, then bridges to Vapi (ElevenLabs Lizzie / Cynthia). Branding: **Builder Diddies**.

| Item | Value |
|------|--------|
| DID | `02037453233` / `+442037453233` |
| Bridge | VPS Docker `tradepro-sip-bridge` (`/var/www/vhosts/b-diddies.com/tradepro-sip-bridge`) |
| REGISTER | `1005090093@sbc.soho66.co.uk:8060` (only one REGISTER — log out VOIS on that user) |
| Vapi | phone + Cynthia assistant + webhook `https://app.b-diddies.com/webhooks/vapi` |
| Voice | ElevenLabs Lizzie `EQx6HGDYjkDpcli6vorJ` |

Keep Soho66 Routing Wizard as **Ring my IP phone** (then voicemail if needed). Staff mid-call divert: Call Centre **Call Transfer Destinations** → mobile (prod all depts → `+447576442345`). No Force/Forward and no web softphone required — resolution is `transfer-numbers.ts` / `transferToHuman` / Vapi `transferCall`.

**Ops:** `docker compose -f …/tradepro-sip-bridge/docker-compose.yml ps` · `asterisk -rx 'pjsip show registrations'` inside the container must show **Registered**.

---

## 3. Live retest checklist

### A — Outbound to staff mobile (PIN)

1. Confirm super_admin mobile is registered (e.g. `+447576442345`) with PIN (e.g. `1234`) under **Settings → Team**.
2. `/calls?tab=outbound` → dial that E.164 → template `lead_callback`  
   (or `POST /api/calls/outbound` with the same body).
3. On answer: voice must be the **female Cockney ElevenLabs** voice (same as prior successful calls).
4. Speak PIN to unlock staff tools; exercise CRM lookups / snapshot.

### B — Inbound from a random / second phone

1. Leave answering ON.
2. From a **different** handset, dial the company DID.
3. Confirm same ElevenLabs voice and customer/lead path (no staff PIN required).

If the voice sounds like generic OpenAI TTS or the old mock pipeline, stop — fix `VAPI_ELEVENLABS_VOICE_ID` / Vapi Integrations before continuing.

---

## 4. Softphones (humans only)

- Staff lines: `purpose: 'staff'`
- Soft Phone tab: `/calls?tab=softphone`
- Soho66 public WSS is often unavailable; prefer desk phone / VOIS for humans

---

## 5. Optional IVR

Set `IVR_ENABLED=1` to play a DTMF menu before Cynthia on inbound calls.

---

## 6. Retired / not for live phone AI

| Path | Status |
|------|--------|
| sip-bridge / `VOICE_PROVIDER=local_realtime` / `soho66` AI answering | Unsupported — fail closed |
| Chatterbox WAV clone + `/api/agent/tts` turn pipeline | **Not** the live phone media path (mock / legacy UI only) |
| Call Centre **Test Call (Mock)** tab | Local simulation only — does not place a real Vapi call |

Do not document Chatterbox as how Cynthia speaks on real phone calls. Live media TTS is ElevenLabs through Vapi.
