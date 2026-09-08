#!/bin/bash
python3 <<'PY'
import re
from pathlib import Path
js = Path('/var/www/vhosts/sync2gear.io/httpdocs/assets/index-Cn6dkR96.js').read_text(errors='ignore')
print('size', len(js))
for n in ['/login','SignIn','admin@','Dashboard','MusicLibrary','Zones','auth/login','admin123','test.com','LandingPage','Get a Quote','sync2gear']:
    print(n, js.count(n))
paths = sorted(set(re.findall(r'path:"([^"]+)"', js)))
print('paths', paths)
for m in re.finditer(r'.{0,40}admin@.{0,60}', js):
    print('ADMIN', m.group(0)[:140]); break
for m in re.finditer(r'.{0,30}/login.{0,50}', js):
    print('LOGIN', m.group(0)[:140]); break
PY
echo "=== api hosts ==="
curl -sSI --max-time 10 https://api.sync2gear.io/ 2>&1 | head -12 || echo fail_io
curl -sSI --max-time 10 https://api.sync2gear.com/ 2>&1 | head -12 || echo fail_com
ls /etc/nginx/plesk.conf.d/vhosts/ | grep -iE 'gear|api'
echo "=== manage.py / django ==="
find /var/www /home /opt /root -name manage.py 2>/dev/null | head -20
echo "=== when marketing index appeared ==="
stat /var/www/vhosts/sync2gear.io/https/index.html /var/www/vhosts/sync2gear.io/httpdocs/index.html
ls -la --time-style=full-iso /var/www/vhosts/sync2gear.io/httpdocs/assets/index-Cn6dkR96.js /var/www/vhosts/sync2gear.io/httpdocs/assets/index-1_y1ouK9.js
