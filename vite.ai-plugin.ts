import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

const API_PREFIXES = ['/api/', '/webhooks/'];
// Prefer IPv4 loopback — `localhost` can resolve to ::1 and 502 when the backend listens on IPv4 only.
const DEFAULT_API_BASE = 'http://127.0.0.1:3001';

/**
 * Proxies API/webhook routes to the tradepro-backend Node companion
 * (VITE_API_BASE_URL, default http://localhost:3001). The embedded
 * server/ fallback has been removed — tradepro-backend is canonical.
 */
export function aiProxyPlugin(): Plugin {
  const apiBase = (process.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const pathname = url.pathname;

        const isApiRoute = API_PREFIXES.some(p => pathname.startsWith(p));
        if (!isApiRoute) {
          next();
          return;
        }

        await proxyRequest(req, res, `${apiBase}${pathname}${url.search}`);
      });
    },
  };
}

async function proxyRequest(req: IncomingMessage, res: ServerResponse, targetUrl: string): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value && key !== 'host') headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }

    const body = req.method !== 'GET' && req.method !== 'HEAD'
      ? await readBody(req)
      : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // Fail fast when the backend is down instead of hanging the dev server.
      signal: AbortSignal.timeout(10_000),
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key !== 'transfer-encoding') res.setHeader(key, value);
    });
    const text = await response.text();
    res.end(text);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'backend_unreachable',
      message: err instanceof Error ? err.message : 'Proxy error',
      hint: 'start tradepro-backend: npm run dev (port 3001)',
    }));
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
