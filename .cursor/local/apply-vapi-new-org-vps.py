#!/usr/bin/env python3
"""Apply new Vapi org credentials on Sync2Dine VPS + update SIP bridge inbound host."""
from pathlib import Path
import re
import subprocess
import time

BACKEND_ENV = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/.env")
BRIDGE_ENV = Path("/var/www/vhosts/b-diddies.com/tradepro-sip-bridge/.env")

UPDATES = {
    "VOICE_PROVIDER": "vapi",
    "VAPI_REGION": "us",
    "VAPI_PRIVATE_KEY": "11bd3161-f7d5-4e09-a0ec-fa862d5c64e6",
    "VAPI_API_KEY": "11bd3161-f7d5-4e09-a0ec-fa862d5c64e6",
    "VAPI_PUBLIC_KEY": "ea2af560-5182-4d7c-a5d8-451ddf965f9a",
    "VAPI_PHONE_NUMBER_ID": "a09912e1-9d13-4a91-8789-7cb3eacd26ca",
    "VAPI_SIP_CREDENTIAL_ID": "bf62dc42-6b14-4e73-a113-20cb996136e3",
    "VAPI_ASSISTANT_ID": "fe520080-4b31-4787-9f13-5f9c1b4fe814",
    "VAPI_WEBHOOK_BASE_URL": "https://app.sync2dine.io",
    "VAPI_ELEVENLABS_VOICE_ID": "EQx6HGDYjkDpcli6vorJ",
}

BRIDGE_UPDATES = {
    "AI_SIP_HOST": "bf62dc42-6b14-4e73-a113-20cb996136e3.sip.vapi.ai",
    "AI_SIP_PORT": "5060",
    "AI_SIP_TRANSPORT": "udp",
    "VAPI_INBOUND_USER": "+442037453233",
    # Keep Soho REGISTER creds already set to 1006090093
}


def upsert(path: Path, updates: dict):
    text = path.read_text() if path.exists() else ""
    # preserve existing VAPI_SERVER_SECRET if not in updates
    lines = text.splitlines()
    keys_seen = set()
    out = []
    for line in lines:
        if not line.strip() or line.strip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        k, _, _ = line.partition("=")
        if k in updates:
            out.append(f"{k}={updates[k]}")
            keys_seen.add(k)
        else:
            out.append(line)
    for k, v in updates.items():
        if k not in keys_seen:
            out.append(f"{k}={v}")
    bak = path.with_name(path.name + f".bak-vapi-{int(time.time())}")
    bak.write_bytes(path.read_bytes() if path.exists() else b"")
    path.write_text("\n".join(out) + "\n")
    print("updated", path, "backup", bak.name)


upsert(BACKEND_ENV, UPDATES)
upsert(BRIDGE_ENV, BRIDGE_UPDATES)

print("recreate sip bridge...")
subprocess.check_call(
    ["docker", "compose", "up", "-d", "--force-recreate", "asterisk"],
    cwd="/var/www/vhosts/b-diddies.com/tradepro-sip-bridge",
)
time.sleep(8)
print("REG")
print(
    subprocess.check_output(
        ["docker", "exec", "tradepro-sip-bridge", "asterisk", "-rx", "pjsip show registrations"],
        text=True,
        errors="ignore",
    )
)
print("AI host in container:")
conf = subprocess.check_output(
    ["docker", "exec", "tradepro-sip-bridge", "grep", "-E", "vapi|100609|AI_|soho66", "/etc/asterisk/pjsip.conf"],
    text=True,
    errors="ignore",
)
for line in conf.splitlines():
    if "password=" in line.lower():
        continue
    print(line)

# Restart Sync2Dine API
print("restart api...")
subprocess.call(["pkill", "-9", "-f", "sync2dine.io/sync2dine-backend.*server/index.ts"])
time.sleep(2)
subprocess.Popen(
    [
        "/opt/plesk/node/24/bin/node",
        "--require",
        "./node_modules/tsx/dist/preflight.cjs",
        "--import",
        "file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs",
        "--env-file=.env",
        "server/index.ts",
    ],
    cwd="/var/www/vhosts/sync2dine.io/sync2dine-backend",
    stdout=open("/tmp/sync2dine-api.log", "a"),
    stderr=subprocess.STDOUT,
    start_new_session=True,
)
time.sleep(6)
print("HEALTH")
print(subprocess.check_output(["curl", "-sS", "--max-time", "10", "https://app.sync2dine.io/health"], text=True))
print("VAPI")
print(subprocess.check_output(["curl", "-sS", "--max-time", "10", "https://app.sync2dine.io/api/vapi/health"], text=True))
