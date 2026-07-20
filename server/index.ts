/**
 * Standalone server for production deployment (Railway, Render, Fly.io).
 * Run: npx tsx server/index.ts
 */
import { createServer } from 'http';
import { handleAiRequest } from './ai-proxy';
import { handleWhatsAppRoutes } from './whatsapp-webhook';
import { handleWWebRoutes } from './whatsapp-web-routes';
import { handlePhoneRoutes } from './phone-webhook';
import { handleVapiRoutes } from './vapi-routes';
import { handleAgentRoutes } from './agent-routes';
import { handleProjectRoutes } from './project-routes';
import { handleBuildingControlRoutes } from './building-control-routes';
import { handleConversationAudit } from './conversation-audit';
import { handleAIStudioRoutes } from './ai-studio-routes';
import { handleBankingRoutes } from './banking-routes';
import { handleMessageRoutes } from './messages-routes';
import { handlePriceResearchRoutes } from './price-research-routes';
import { handleContractRoutes } from './contract-routes';
import { handlePlatformRoutes } from './platform-routes';
import { handleSaasContractRoutes } from './saas-contract-routes';
import { handleStripeRoutes } from './stripe-routes';
import { handleAuthRoutes } from './auth';
import { handleMailboxRoutes } from './mailbox-routes';
import { handleCalendarRoutes } from './calendar-routes';
import { handlePackageUpdatesRoute } from './mailbox/package-updates';
import { handleChannelRoutes } from './channel-routes';
import { handleCyrusRoutes } from './cyrus-routes';
import { handleSallyWebRoutes } from './sally-web-routes';
import { handleCynthiaRoutes } from './cynthia-routes';
import { handleLeadsRoutes } from './leads-routes';
import { handleAgentCredentialsRoutes } from './agent-credentials-routes';
import { handleOrgOpenAIKeyRoutes } from './org-openai-key-routes';
import { handleOrgIntegrationsRoutes } from './org-integrations-routes';
import { handlePushRoutes } from './push-routes';
import { handleGapApiRoutes } from './gap-api-routes';
import { handleAnalyticsRoutes } from './analytics-routes';
import { startMailboxPoller } from './mailbox/imapSyncService';
import { startOutboundWorker } from './outbound-worker';
import { startUsageAlertsWorker } from './usage-alerts-worker';
import { ensureBdiddiesHomeOrg } from './organizations';

const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGIN = process.env.APP_BASE_URL?.trim() || '*';

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error('Unhandled request error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

async function handleRequest(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Widget / marketing chat need dynamic CORS — sally-web + cyrus-web set it themselves
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
  }

  if (await handleWhatsAppRoutes(req, res, pathname, url)) return;

  if (await handleWWebRoutes(req, res, pathname, url)) return;

  if (await handlePhoneRoutes(req, res, pathname, url)) return;

  if (await handleVapiRoutes(req, res, pathname)) return;

  if (await handleAgentRoutes(req, res, pathname, url)) return;

  if (await handleProjectRoutes(req, res, pathname)) return;

  if (await handleBuildingControlRoutes(req, res, pathname)) return;

  if (await handleAIStudioRoutes(req, res, pathname)) return;

  if (await handleConversationAudit(req, res, pathname)) return;

  if (await handleBankingRoutes(req, res, pathname, url)) return;

  if (await handleMailboxRoutes(req, res, pathname, url)) return;

  if (await handleCalendarRoutes(req, res, pathname, url)) return;

  if (await handlePackageUpdatesRoute(pathname, res)) return;

  if (await handleMessageRoutes(req, res, pathname)) return;

  if (await handlePriceResearchRoutes(req, res, pathname)) return;

  if (await handleContractRoutes(req, res, pathname)) return;

  if (await handleSaasContractRoutes(req, res, pathname)) return;

  if (await handleStripeRoutes(req, res, pathname)) return;

  if (await handleAuthRoutes(req, res, pathname)) return;

  if (await handleOrgOpenAIKeyRoutes(req, res, pathname)) return;

  if (await handleOrgIntegrationsRoutes(req, res, pathname)) return;

  if (await handlePlatformRoutes(req, res, pathname)) return;

  if (await handleChannelRoutes(req, res, pathname)) return;

  if (await handleCyrusRoutes(req, res, pathname)) return;
  if (await handleSallyWebRoutes(req, res, pathname)) return;
  if (await handleCynthiaRoutes(req, res, pathname)) return;

  if (await handlePushRoutes(req, res, pathname)) return;

  if (await handleAnalyticsRoutes(req, res, pathname, url)) return;

  if (await handleGapApiRoutes(req, res, pathname, url)) return;

  if (await handleLeadsRoutes(req, res, pathname, url)) return;

  if (await handleAgentCredentialsRoutes(req, res, pathname)) return;

  if (pathname.startsWith('/api/ai/')) {
    await handleAiRequest(req, res, pathname);
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

server.listen(PORT, () => {
  console.log(`Builder Diddies API server running on port ${PORT}`);
  try {
    ensureBdiddiesHomeOrg();
  } catch (err) {
    console.error(err);
  }
  startMailboxPoller();
  startOutboundWorker();
  startUsageAlertsWorker();
  void import('./code-fix-handler').then(({ startCodeFixWorker }) => startCodeFixWorker());
  if (process.env.SYNC2DINE_SKIP_WWEB === '1') {
    console.log('Skipping WhatsApp Web.js client (SYNC2DINE_SKIP_WWEB=1)');
  } else {
    void import('./whatsapp-web-client').then(({ initWWebClient }) => {
      console.log('Starting WhatsApp Web.js client...');
      initWWebClient().catch((err) => console.error('WhatsApp Web.js init failed:', err));
    });
  }
});
