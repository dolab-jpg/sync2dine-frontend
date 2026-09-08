#!/bin/bash
set -euo pipefail
FILE=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/mu-plugins/sync2dine-seo.php
cp -a "$FILE" "${FILE}.bak-form-$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
# -*- coding: utf-8 -*-
from pathlib import Path
p = Path("/var/www/vhosts/sync2dine.io/httpdocs/wp-content/mu-plugins/sync2dine-seo.php")
text = p.read_text(encoding="utf-8")
old = "info@all1house.com"
new = "info@sync2gear.com"
print("all1house count before:", text.count(old))
text = text.replace(old, new)
p.write_text(text, encoding="utf-8")
print("all1house count after:", text.count(old))
print("sync2gear.com count:", text.count(new))
for i, line in enumerate(text.splitlines(), 1):
    if "sync2gear.com" in line or "all1house" in line or "$to" in line:
        print("%d: %s" % (i, line.strip()))
PY

chown sync2dine.io_asad090:psacln "$FILE" 2>/dev/null || true
echo DONE
