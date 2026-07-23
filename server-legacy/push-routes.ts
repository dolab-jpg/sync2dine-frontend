/**
 * Push notification stub (G6).
 * Cynthia cards call POST /api/push/notify; wire a real FCM/web-push provider later.
 */
import type { IncomingMessage, ServerResponse } from 'http';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function handlePushRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname !== '/api/push/notify') return false;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  try {
    const body = JSON.parse(await readBody(req) || '{}') as {
      userId?: string;
      orgId?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    if (!title && !message) {
      sendJson(res, 400, { error: 'title or body required' });
      return true;
    }

    // Stub: accept and acknowledge. Replace with web-push / FCM when credentials exist.
    console.info('[push/notify]', {
      userId: body.userId ?? null,
      orgId: body.orgId ?? null,
      title: title || '(no title)',
      body: message.slice(0, 120),
      data: body.data ?? null,
      queued: false,
      stub: true,
    });

    sendJson(res, 200, {
      ok: true,
      queued: false,
      stub: true,
      message: 'Push accepted (stub — configure web-push/FCM to deliver)',
    });
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid push payload' });
  }
  return true;
}
