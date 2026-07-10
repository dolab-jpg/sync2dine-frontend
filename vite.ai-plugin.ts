import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

const API_PREFIXES = ['/api/', '/webhooks/'];

/**
 * Proxies API/webhook routes to the tradepro-backend Node companion.
 * Falls back to local server handlers when VITE_API_BASE_URL is not set.
 */
export function aiProxyPlugin(): Plugin {
  const apiBase = process.env.VITE_API_BASE_URL?.replace(/\/$/, '');

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

        // Proxy to tradepro-backend when configured
        if (apiBase) {
          await proxyRequest(req, res, `${apiBase}${pathname}${url.search}`);
          return;
        }

        // Fallback: local server handlers (legacy dev without backend running separately)
        try {
          const { handleStripeRoutes } = await import('./server/stripe-routes');
          const { handleAuthRoutes } = await import('./server/auth');
          const { handlePlatformRoutes } = await import('./server/platform-routes');
          const { handleWhatsAppRoutes } = await import('./server/whatsapp-webhook');
          const { handlePhoneRoutes } = await import('./server/phone-webhook');
          const { handleAgentRoutes } = await import('./server/agent-routes');
          const { handleProjectRoutes } = await import('./server/project-routes');
          const { handleBuildingControlRoutes } = await import('./server/building-control-routes');
          const { handleAIStudioRoutes } = await import('./server/ai-studio-routes');
          const { handleConversationAudit } = await import('./server/conversation-audit');
          const { handleBankingRoutes } = await import('./server/banking-routes');
          const { handleMessageRoutes } = await import('./server/messages-routes');
          const { handlePriceResearchRoutes } = await import('./server/price-research-routes');
          const { handleContractRoutes } = await import('./server/contract-routes');
          const { handleMailboxRoutes } = await import('./server/mailbox-routes');
          const { handlePackageUpdatesRoute } = await import('./server/mailbox/package-updates');
          const { handleChannelRoutes } = await import('./server/channel-routes');
          const { handleAgentCredentialsRoutes } = await import('./server/agent-credentials-routes');
          const { handleAiRequest } = await import('./server/ai-proxy');

          if (await handleAgentCredentialsRoutes(req, res, pathname)) return;

          if (await handleStripeRoutes(req, res, pathname)) return;
          if (await handleAuthRoutes(req, res, pathname)) return;
          if (await handlePlatformRoutes(req, res, pathname)) return;
          if (await handleWhatsAppRoutes(req, res, pathname, url)) return;
          if (await handlePhoneRoutes(req, res, pathname, url)) return;
          if (await handleAgentRoutes(req, res, pathname, url)) return;
          if (await handleProjectRoutes(req, res, pathname)) return;
          if (await handleBuildingControlRoutes(req, res, pathname)) return;
          if (await handleAIStudioRoutes(req, res, pathname)) return;
          if (await handleConversationAudit(req, res, pathname)) return;
          if (await handleBankingRoutes(req, res, pathname, url)) return;
          if (await handleMailboxRoutes(req, res, pathname, url)) return;
          if (await handlePackageUpdatesRoute(pathname, res)) return;
          if (await handleMessageRoutes(req, res, pathname)) return;
          if (await handlePriceResearchRoutes(req, res, pathname)) return;
          if (await handleContractRoutes(req, res, pathname)) return;
          if (await handleChannelRoutes(req, res, pathname)) return;

          if (pathname.startsWith('/api/ai/')) {
            await handleAiRequest(req, res, pathname);
            return;
          }
        } catch {
          // handlers unavailable
        }

        next();
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
      error: 'Backend unavailable',
      message: err instanceof Error ? err.message : 'Proxy error',
      hint: 'Start tradepro-backend: cd ../tradepro-backend && npm run dev',
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
