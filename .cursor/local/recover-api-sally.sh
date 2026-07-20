#!/bin/bash
set -e
IDX=/var/www/vhosts/sync2dine.io/sync2dine-backend/server/index.ts
# Add Sally import after Cyrus import if missing
if ! grep -q handleSallyWebRoutes "$IDX"; then
  sed -i "/import { handleCyrusRoutes } from '.\/cyrus-routes';/a import { handleSallyWebRoutes } from './sally-web-routes';" "$IDX"
fi
# Patch CORS / OPTIONS / route dispatch with a small Python edit
python3 <<'PY'
from pathlib import Path
p = Path('/var/www/vhosts/sync2dine.io/sync2dine-backend/server/index.ts')
t = p.read_text()
old = """    // Widget on company site needs dynamic CORS — cyrus-routes sets it for /api/cyrus/web*
    const isCyrusWeb = pathname.startsWith('/api/cyrus/web');
    if (!isCyrusWeb) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Org-Id, X-User-Id, X-User-Role');

    if (req.method === 'OPTIONS') {
      if (isCyrusWeb && await handleCyrusRoutes(req, res, pathname)) return;
      res.statusCode = 204;
      res.end();
      return;
    }"""
new = """    // Widget / marketing chat need dynamic CORS — sally-web + cyrus-web set it themselves
    const isPublicChat =
      pathname.startsWith('/api/cyrus/web') || pathname.startsWith('/api/sally/web');
    if (!isPublicChat) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Org-Id, X-User-Id, X-User-Role');

    if (req.method === 'OPTIONS') {
      if (pathname.startsWith('/api/sally/web') && await handleSallyWebRoutes(req, res, pathname)) return;
      if (pathname.startsWith('/api/cyrus/web') && await handleCyrusRoutes(req, res, pathname)) return;
      res.statusCode = 204;
      res.end();
      return;
    }"""
if old not in t:
    raise SystemExit('CORS block not found')
t = t.replace(old, new, 1)
needle = "    if (await handleCyrusRoutes(req, res, pathname)) return;"
insert = "    if (await handleSallyWebRoutes(req, res, pathname)) return;\n\n    if (await handleCyrusRoutes(req, res, pathname)) return;"
if 'handleSallyWebRoutes(req, res, pathname)' not in t.split('OPTIONS')[1]:
    if needle not in t:
        raise SystemExit('cyrus route needle missing')
    t = t.replace(needle, insert, 1)
p.write_text(t)
print('patched ok')
PY
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 6
curl -s http://127.0.0.1:3011/health; echo
grep -c '7756/ingest' server/sally-web-routes.ts server/index.ts || true
tail -5 /tmp/sync2dine-api.log
