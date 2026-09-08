#!/usr/bin/env python3
from pathlib import Path
p = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/lead-inbox.json")
if p.exists():
    raw = p.read_text(encoding="utf-8")
    print("before bytes", len(raw))
p.write_text('{"processedMessageIds":[],"items":[]}\n', encoding="utf-8")
print("emptied lead-inbox.json")
