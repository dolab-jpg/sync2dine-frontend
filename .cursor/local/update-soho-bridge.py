#!/usr/bin/env python3
from pathlib import Path
import subprocess
import time

env_path = Path("/var/www/vhosts/b-diddies.com/tradepro-sip-bridge/.env")
backup = env_path.with_name(env_path.name + f".bak-{int(time.time())}")
backup.write_bytes(env_path.read_bytes())

repl = {
    "SOHO66_SIP_USERNAME": "1006090093",
    "SOHO66_SIP_PASSWORD": "V2PXPUQV",
    "SOHO66_SIP_DOMAIN": "sbc.soho66.co.uk",
    "SOHO66_SIP_PORT": "8060",
    "VAPI_INBOUND_USER": "+442037453233",
}

out = []
seen = set()
for line in env_path.read_text().splitlines():
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    k, _, _v = line.partition("=")
    if k in repl:
        out.append(f"{k}={repl[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in repl.items():
    if k not in seen:
        out.append(f"{k}={v}")
env_path.write_text("\n".join(out) + "\n")

user_line = next(l for l in env_path.read_text().splitlines() if l.startswith("SOHO66_SIP_USERNAME"))
pw_line = next(l for l in env_path.read_text().splitlines() if l.startswith("SOHO66_SIP_PASSWORD"))
print("backup", backup)
print(user_line)
print("password_len", len(pw_line.split("=", 1)[1]))

subprocess.check_call(
    ["docker", "compose", "up", "-d", "--force-recreate", "asterisk"],
    cwd="/var/www/vhosts/b-diddies.com/tradepro-sip-bridge",
)
time.sleep(10)
print("REG")
print(
    subprocess.check_output(
        ["docker", "exec", "tradepro-sip-bridge", "asterisk", "-rx", "pjsip show registrations"],
        text=True,
        errors="ignore",
    )
)
print("AUTH")
conf = subprocess.check_output(
    ["docker", "exec", "tradepro-sip-bridge", "grep", "-E", "username=|client_uri=", "/etc/asterisk/pjsip.conf"],
    text=True,
    errors="ignore",
)
for line in conf.splitlines():
    if "password=" in line:
        continue
    print(line)
print("LOG")
logs = subprocess.check_output(
    ["docker", "logs", "tradepro-sip-bridge", "--tail", "40"],
    text=True,
    errors="ignore",
)
for line in logs.splitlines():
    low = line.lower()
    if any(x in low for x in ("401", "403", "registered", "registration", "fatal", "soho66")):
        print(line)
