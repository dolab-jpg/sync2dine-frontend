# Cynthia phone setup (Vapi + ElevenLabs)

> **Inventory SoT:** [APPLICATION_MASTER.md](./APPLICATION_MASTER.md) §16. Sibling deep-dive: `tradepro-backend/docs/VAPI_SIP.md`.

**Production phone voice path (the one that has worked on live calls):**

```text
Caller ↔ Soho66 SIP ↔ Vapi (media) ↔ ElevenLabs (female Cockney) ↔ POST /webhooks/vapi ↔ Cynthia phone-brain
```

- Provider: `VOICE_PROVIDER=vapi` (required)
- Spoken voice: **ElevenLabs** via Vapi (`provider: '11labs'`) — female British / Cockney (**Lizzie** voice id `EQx6HGDYjkDpcli6vorJ` when configured on the API host). **English stays Lizzie (do not change).** Non-English calls use a per-language female funny/sassy map in `server/phone-voices.ts` (Aerisita/Aleksandra/Klava/Kira/Zicai/Laura/Veronica). She always says her name is **Cynthia**. Mid-call switch: tool `setCallLanguage` (persist + best-effort voice PATCH).
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
# Optional: override non-English voices only (never override en / Lizzie)
# VAPI_ELEVENLABS_VOICE_ID_ES=03vEurziQfq3V8WZhQvn
# VAPI_ELEVENLABS_VOICE_MAP={"es":"…","pl":"…"}
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
SOHO66_SIP_*=••••
SOHO66_FROM_NUMBER=02037453233
OPENAI_API_KEY=••••
```

| Lang | Default voice | Voice id |
|------|---------------|----------|
| en | **Lizzie (locked)** | `EQx6HGDYjkDpcli6vorJ` |
| es | Aerisita — Sassy and Comedic | `03vEurziQfq3V8WZhQvn` |
| pl | Aleksandra — dynamic Polish | `NOWYzprzTwfZQqU76pBX` |
| ru | Klava — energetic | `bi0tSQTrp58MDdPUkrEl` |
| uk | Kira — Ukrainian female | `2HWb7sZSrZqPB8HOI0KI` |
| zh | Zicai — sitcom / comedic | `DVE92KG0Yd4X7RoMqy8J` |
| fa | Laura — quirky | `FGY2WhTYpPnrIDTdsKH5` |
| sq | Veronica — Sassy & Energetic | `ejl43bbp2vjkAFGSmAMa` |

Library voices must be available on the ElevenLabs account used by Vapi. Missing voice → fall back to Lizzie + multilingual model (log `voiceUpdated: false`).

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
| Voice (English) | ElevenLabs Lizzie `EQx6HGDYjkDpcli6vorJ` (locked) |
| Voice (other langs) | `server/phone-voices.ts` map — see table above; identity always Cynthia |

Keep Soho66 Routing Wizard as **Ring my IP phone** (then voicemail if needed). Staff mid-call divert: Call Centre **Call Transfer Destinations** → mobile (prod all depts → `+447576442345`). **Warm consult** (`warm-transfer-experimental`): caller on hold → dial staff → Cynthia briefs → bridge. No Force/Forward and no web softphone required — `transfer-numbers.ts` / `transferToHuman` / Vapi `transferCall` + `transferPlan`.

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

### C — Mid-call language switch (AUDITED 2026-07-16)

1. On an inbound or outbound Cynthia call, ask her to speak Spanish or Polish.
2. She must call `setCallLanguage`, then **continue speaking** in that language (not list languages and stop).
3. She must still say her name is **Cynthia** (never Aerisita / Klava / etc.).
4. Ask to switch back to English → Lizzie voice / Cockney Cynthia again.
5. CRM tools still work; tool results / written artifacts stay English.

If the voice sounds like generic OpenAI TTS or the old mock pipeline, stop — fix `VAPI_ELEVENLABS_VOICE_ID` / Vapi Integrations before continuing.

### Audit snapshot (2026-07-16)

| Check | Result |
|-------|--------|
| `origin/master` frontend | `49e51da` → `dolab-jpg/tradepro-frontend` |
| `origin/master` backend | `3438f2f` → `dolab-jpg/tradepro-backend` (voice code `d3e348f`) |
| VPS `tradepro-api` | **active**; `GET /api/vapi/health` → `{ ok: true, provider: "vapi" }` |
| VPS files | `phone-voices.ts` + `phone-language.ts` present; `getVapiVoiceConfigForLang` wired; no `en-GB ONLY` hard block |
| English voice | Lizzie locked — not remapped |

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
