#!/usr/bin/env python3
import hashlib
import os
import re
import subprocess
from pathlib import Path

paths = [
    "/var/www/vhosts/b-diddies.com/tradepro-sip-bridge/.env",
    "/var/www/vhosts/b-diddies.com/tradepro-sip-bridge/config/.env",
    "/var/www/vhosts/sync2dine.io/sync2dine-backend/.env",
    "/etc/tradepro-api.env",
]

def parse_env(p):
    vals = {}
    if not os.path.isfile(p):
        return None
    for line in open(p, errors="ignore"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        if "SOHO66" in k or k in ("VAPI_PHONE_NUMBER_ID", "VAPI_WEBHOOK_BASE_URL", "APP_BASE_URL"):
            vals[k] = v
    return vals

for p in paths:
    vals = parse_env(p)
    if vals is None:
        print("MISS", p)
        continue
    print("FILE", p)
    for k, v in vals.items():
        if any(x in k.upper() for x in ("PASS", "SECRET", "KEY", "TOKEN")):
            print(f"  {k}: len={len(v)} sha12={hashlib.sha256(v.encode()).hexdigest()[:12]}")
        else:
            print(f"  {k}: {v}")

conf = subprocess.check_output(
    ["docker", "exec", "tradepro-sip-bridge", "cat", "/etc/asterisk/pjsip.conf"],
    text=True,
    errors="ignore",
)
m = re.search(r"\[soho66-auth\][\s\S]*?password=(\S+)", conf)
if m:
    pw = m.group(1)
    print(
        "CONTAINER_AUTH len=",
        len(pw),
        "sha12=",
        hashlib.sha256(pw.encode()).hexdigest()[:12],
    )
print("REG")
print(
    subprocess.check_output(
        ["docker", "exec", "tradepro-sip-bridge", "asterisk", "-rx", "pjsip show registrations"],
        text=True,
        errors="ignore",
    )
)
print("LOG401")
logs = subprocess.check_output(
    ["docker", "logs", "tradepro-sip-bridge", "--tail", "200"],
    text=True,
    errors="ignore",
)
for line in logs.splitlines():
    if "401" in line or "registration" in line.lower() or "Registered" in line:
        print(line)
