#!/usr/bin/env python3
import json, os, urllib.request
# Confirm Vapi has the new DID and live lines show registered. No secrets printed.
env = {}
for line in open('/var/www/vhosts/sync2dine.io/sync2dine-backend/.env'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, _, v = line.partition('=')
    env[k] = v.strip().strip('"').strip("'")
key = env.get('VAPI_PRIVATE_KEY') or env.get('VAPI_API_KEY')
region = (env.get('VAPI_REGION') or 'us').lower()
base = 'https://api.vapi.ai' if region == 'us' else 'https://api.eu.vapi.ai'
req = urllib.request.Request(base + '/phone-number', headers={'Authorization': 'Bearer ' + key})
nums = json.loads(urllib.request.urlopen(req, timeout=20).read().decode())
print('vapi_numbers')
for n in nums:
    print(' ', n.get('number'), 'id', str(n.get('id'))[:8] + '…', 'server', (n.get('server') or {}).get('url') or n.get('serverUrl'), 'assistant', n.get('assistantId'))
print('== lines ==')
print(urllib.request.urlopen('http://127.0.0.1:3011/api/agent/lines', timeout=10).read().decode()[:2500])
print('== registrations ==')
import subprocess
print(subprocess.check_output("docker exec tradepro-sip-bridge asterisk -rx 'pjsip show registrations'", shell=True, text=True))
