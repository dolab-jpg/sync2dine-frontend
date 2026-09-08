#!/bin/bash
set -euo pipefail
python3 - <<'PY'
import json, os, glob
paths = [
  '/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/phone-billing.json',
  '/var/www/vhosts/b-diddies.com/tradepro-sip-bridge/lines.json',
  '/var/www/vhosts/sync2dine.io/sync2dine-backend/docker/soho66-vapi-bridge/lines.json',
]
# also common env files: only report whether 1006090093 / 34750458 present
print('== billing / lines inventory (no secrets) ==')
for p in paths:
    print('FILE', p, 'exists', os.path.isfile(p))
    if not os.path.isfile(p):
        continue
    try:
        data = json.load(open(p))
    except Exception as e:
        print('  parse_error', type(e).__name__)
        continue
    if isinstance(data, dict):
        for org, cfg in data.items():
            if not isinstance(cfg, dict):
                continue
            user = str(cfg.get('soho66SipUsername') or '')
            frm = str(cfg.get('soho66FromNumber') or '')
            pwd = str(cfg.get('soho66SipPassword') or '')
            print('  org', org[:12], 'user', user, 'from', frm, 'password_set', bool(pwd), 'password_len', len(pwd))
    elif isinstance(data, list):
        for row in data:
            user = str(row.get('sipUsername') or '')
            did = str(row.get('did') or row.get('didE164') or '')
            pwd = str(row.get('sipPassword') or '')
            print('  line', row.get('label'), 'user', user, 'did', did, 'purpose', row.get('purpose'), 'password_set', bool(pwd))

print('== grep 1006090093 locations ==')
PY
grep -l '1006090093' /var/www/vhosts/sync2dine.io/sync2dine-backend/.env /var/www/vhosts/b-diddies.com/tradepro-sip-bridge/.env /var/www/vhosts/b-diddies.com/tradepro-sip-bridge/lines.json /opt/lines.json 2>/dev/null || true
echo '== registrations =='
docker exec tradepro-sip-bridge asterisk -rx 'pjsip show registrations' 2>/dev/null | head -40
echo '== ai-set =='
curl -sS -m 8 http://127.0.0.1:3011/api/platform/phone-lines/ai-set
echo
echo '== billing from live API =='
curl -sS -m 8 http://127.0.0.1:3011/api/org/phone-billing | python3 -c 'import sys,json; d=json.load(sys.stdin); print({k: ("SET" if "pass" in k.lower() and v else v) for k,v in (d if isinstance(d,dict) else {}).items() if k in ("soho66SipUsername","soho66FromNumber","soho66SipDomain","soho66SipPassword","orgId") or True})' 2>/dev/null | head -c 800
echo
