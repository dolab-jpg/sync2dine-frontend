#!/usr/bin/env python3
"""Wire handleSallyWebRoutes into sync2dine-backend server/index.ts if missing."""
from pathlib import Path

path = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/index.ts")
text = path.read_text(encoding="utf-8")

if "handleSallyWebRoutes" in text:
    print("already_wired")
else:
    if "import { handleCyrusRoutes } from './cyrus-routes';" in text:
        text = text.replace(
            "import { handleCyrusRoutes } from './cyrus-routes';",
            "import { handleCyrusRoutes } from './cyrus-routes';\nimport { handleSallyWebRoutes } from './sally-web-routes';",
            1,
        )
    else:
        raise SystemExit("cannot find cyrus import anchor")

    old_cors = """    // Widget on company site needs dynamic CORS — cyrus-routes sets it for /api/cyrus/web*
    const isCyrusWeb = pathname.startsWith('/api/cyrus/web');
    if (!isCyrusWeb) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    }"""
    new_cors = """    // Widget / marketing chat need dynamic CORS — sally-web + cyrus-web set it themselves
    const isPublicChat =
      pathname.startsWith('/api/cyrus/web') || pathname.startsWith('/api/sally/web');
    if (!isPublicChat) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    }"""
    if old_cors not in text:
        raise SystemExit("cannot find cors block")
    text = text.replace(old_cors, new_cors, 1)

    old_opts = """    if (req.method === 'OPTIONS') {
      if (isCyrusWeb && await handleCyrusRoutes(req, res, pathname)) return;
      res.statusCode = 204;
      res.end();
      return;
    }"""
    new_opts = """    if (req.method === 'OPTIONS') {
      if (pathname.startsWith('/api/sally/web') && await handleSallyWebRoutes(req, res, pathname)) return;
      if (pathname.startsWith('/api/cyrus/web') && await handleCyrusRoutes(req, res, pathname)) return;
      res.statusCode = 204;
      res.end();
      return;
    }"""
    if old_opts not in text:
        raise SystemExit("cannot find OPTIONS block")
    text = text.replace(old_opts, new_opts, 1)

    anchor = "    if (await handleCyrusRoutes(req, res, pathname)) return;"
    if anchor not in text:
        raise SystemExit("cannot find cyrus handler anchor")
    text = text.replace(
        anchor,
        "    if (await handleSallyWebRoutes(req, res, pathname)) return;\n\n" + anchor,
        1,
    )

    path.write_text(text, encoding="utf-8")
    print("patched_ok")

print("has_import", "handleSallyWebRoutes" in path.read_text(encoding="utf-8"))
