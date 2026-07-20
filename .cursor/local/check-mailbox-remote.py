import json
p = "/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/mailbox-data.json"
d = json.load(open(p))
conns = d.get("connections") if isinstance(d, dict) else d
if not isinstance(conns, list):
    conns = []
print("connections", len(conns))
for c in conns:
    if not isinstance(c, dict):
        continue
    keys = ("id", "email", "status", "provider", "userId", "orgId", "accountEmail", "emailAddress")
    print({k: c.get(k) for k in keys})
