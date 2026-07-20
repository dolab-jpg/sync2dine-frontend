/**
 * Provision Soho66 BYO SIP + phone number on the new Vapi org (US).
 * Updates local sync2dine-backend/.env and frontend deploy.env (IDs only + keys).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..', '..');
const backendRoot = join(frontendRoot, '..', 'sync2dine-backend');

const PRIVATE_KEY = '11bd3161-f7d5-4e09-a0ec-fa862d5c64e6';
const PUBLIC_KEY = 'ea2af560-5182-4d7c-a5d8-451ddf965f9a';
const REGION = 'us';
const API = 'https://api.vapi.ai';
const WEBHOOK = 'https://app.sync2dine.io';

const SIP_USER = '1006090093';
const SIP_PASS = 'V2PXPUQV';
const SIP_DOMAIN = 'sbc.soho66.co.uk';
const SIP_PORT = 8060;
const DID = '+442037453233';
const VOICE_ID = 'EQx6HGDYjkDpcli6vorJ';

function upsertEnv(filePath, updates) {
  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, line);
    else content = `${content.trimEnd()}\n${line}\n`;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

async function main() {
  const headers = {
    Authorization: `Bearer ${PRIVATE_KEY}`,
    'Content-Type': 'application/json',
  };

  // List existing phone numbers / credentials � reuse if present
  const phones = await (await fetch(`${API}/phone-number`, { headers })).json();
  const creds = await (await fetch(`${API}/credential`, { headers })).json();
  console.log('existing phones', Array.isArray(phones) ? phones.length : phones);
  console.log('existing creds', Array.isArray(creds) ? creds.length : typeof creds);

  let trunkId = Array.isArray(creds)
    ? creds.find((c) => c.provider === 'byo-sip-trunk' && /soho|1006090093/i.test(JSON.stringify(c)))?.id
    : null;

  if (!trunkId) {
    const trunkRes = await fetch(`${API}/credential`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: 'byo-sip-trunk',
        name: 'Sync2Dine Soho66 Sally',
        gateways: [
          {
            ip: SIP_DOMAIN,
            port: SIP_PORT,
            inboundEnabled: false,
            outboundEnabled: true,
            outboundProtocol: 'udp',
          },
        ],
        outboundLeadingPlusEnabled: true,
        outboundAuthenticationPlan: {
          authUsername: SIP_USER,
          authPassword: SIP_PASS,
        },
      }),
    });
    const trunkText = await trunkRes.text();
    if (!trunkRes.ok) {
      console.error('Trunk failed', trunkRes.status, trunkText.slice(0, 800));
      process.exit(1);
    }
    trunkId = JSON.parse(trunkText).id;
    console.log('created trunk', trunkId);
  } else {
    console.log('reusing trunk', trunkId);
  }

  let phoneId = Array.isArray(phones)
    ? phones.find((p) => String(p.number || '').includes('442037453233'))?.id
    : null;

  if (!phoneId) {
    const phoneRes = await fetch(`${API}/phone-number`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: 'byo-phone-number',
        name: 'Sync2Dine 020 3745 3233',
        number: DID,
        numberE164CheckEnabled: true,
        credentialId: trunkId,
        serverUrl: `${WEBHOOK}/webhooks/vapi`,
      }),
    });
    const phoneText = await phoneRes.text();
    if (!phoneRes.ok) {
      console.error('Phone failed', phoneRes.status, phoneText.slice(0, 800));
      process.exit(1);
    }
    phoneId = JSON.parse(phoneText).id;
    console.log('created phone', phoneId);
  } else {
    // Ensure webhook URL is set
    await fetch(`${API}/phone-number/${phoneId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        serverUrl: `${WEBHOOK}/webhooks/vapi`,
        credentialId: trunkId,
      }),
    });
    console.log('reusing phone', phoneId);
  }

  let assistantId = '';
  const asstRes = await fetch(`${API}/assistant`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Sync2Dine Sally (placeholder)',
      firstMessage: "Hi, it's Sally from Sync2Dine � how can I help?",
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are Sally for Sync2Dine. Speak concise British English. Real prompts are injected per call by Sync2Dine.',
          },
        ],
      },
      voice: {
        provider: '11labs',
        voiceId: VOICE_ID,
        model: 'eleven_turbo_v2_5',
        stability: 0.35,
        similarityBoost: 0.8,
        style: 0.45,
        optimizeStreamingLatency: 3,
      },
      serverUrl: `${WEBHOOK}/webhooks/vapi`,
    }),
  });
  const asstText = await asstRes.text();
  if (asstRes.ok) {
    assistantId = JSON.parse(asstText).id;
    console.log('created assistant', assistantId);
  } else {
    console.warn('assistant skipped', asstRes.status, asstText.slice(0, 400));
  }

  // Keep existing server secret if present
  let serverSecret = '';
  const backendEnv = join(backendRoot, '.env');
  if (existsSync(backendEnv)) {
    const m = readFileSync(backendEnv, 'utf8').match(/^VAPI_SERVER_SECRET=(.*)$/m);
    if (m?.[1]?.trim()) serverSecret = m[1].trim();
  }
  if (!serverSecret) serverSecret = randomBytes(24).toString('base64url');

  const updates = {
    VOICE_PROVIDER: 'vapi',
    VAPI_REGION: REGION,
    VAPI_PRIVATE_KEY: PRIVATE_KEY,
    VAPI_API_KEY: PRIVATE_KEY,
    VAPI_PUBLIC_KEY: PUBLIC_KEY,
    VAPI_PHONE_NUMBER_ID: phoneId,
    VAPI_SIP_CREDENTIAL_ID: trunkId,
    VAPI_WEBHOOK_BASE_URL: WEBHOOK,
    VAPI_SERVER_SECRET: serverSecret,
    VAPI_ELEVENLABS_VOICE_ID: VOICE_ID,
    ...(assistantId ? { VAPI_ASSISTANT_ID: assistantId } : {}),
  };

  upsertEnv(backendEnv, updates);
  upsertEnv(join(frontendRoot, '.cursor', 'local', 'deploy.env'), updates);
  // Also write a masked summary for the agent
  writeFileSync(
    join(__dirname, 'vapi-new-org-ids.json'),
    JSON.stringify(
      {
        orgEmail: 'dolab@diamondea.co.uk',
        region: REGION,
        privateKey: PRIVATE_KEY,
        publicKey: PUBLIC_KEY,
        phoneNumberId: phoneId,
        sipCredentialId: trunkId,
        assistantId: assistantId || null,
        webhook: `${WEBHOOK}/webhooks/vapi`,
        inboundSipHint: `sip:${DID}@${trunkId}.sip.vapi.ai`,
      },
      null,
      2,
    ),
  );
  console.log('wrote env + ids');
  console.log('inbound SIP target:', `sip:${DID}@${trunkId}.sip.vapi.ai`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
