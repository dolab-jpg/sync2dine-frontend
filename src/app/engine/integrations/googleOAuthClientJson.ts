/**
 * Parse Google Cloud "Download JSON" OAuth client files
 * (e.g. client_secret_….apps.googleusercontent.com.json).
 */
export interface GoogleOAuthClientJson {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  javascriptOrigins: string[];
  projectId?: string;
}

export function parseGoogleOAuthClientJson(raw: unknown): GoogleOAuthClientJson {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid file — expected a Google OAuth client JSON object');
  }

  const root = raw as Record<string, unknown>;
  const web = (root.web && typeof root.web === 'object' ? root.web : root) as Record<string, unknown>;

  const clientId = String(web.client_id ?? web.clientId ?? '').trim();
  const clientSecret = String(web.client_secret ?? web.clientSecret ?? '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('JSON must include client_id and client_secret (Google Web client download)');
  }
  if (!clientId.includes('.apps.googleusercontent.com')) {
    throw new Error('client_id does not look like a Google OAuth Web client ID');
  }

  const redirectUris = Array.isArray(web.redirect_uris)
    ? web.redirect_uris.map(String)
    : Array.isArray(web.redirectUris)
      ? web.redirectUris.map(String)
      : [];
  const javascriptOrigins = Array.isArray(web.javascript_origins)
    ? web.javascript_origins.map(String)
    : Array.isArray(web.javascriptOrigins)
      ? web.javascriptOrigins.map(String)
      : [];

  return {
    clientId,
    clientSecret,
    redirectUris,
    javascriptOrigins,
    projectId: web.project_id ? String(web.project_id) : web.projectId ? String(web.projectId) : undefined,
  };
}

export const PRODUCTION_MAILBOX_REDIRECT_URI = 'https://app.sync2dine.io/api/mailbox/callback';
export const PRODUCTION_CALENDAR_REDIRECT_URI = 'https://app.sync2dine.io/api/calendar/callback';
export const PRODUCTION_MAILBOX_ORIGIN = 'https://app.sync2dine.io';

export function validateGoogleOAuthForProduction(parsed: GoogleOAuthClientJson): string[] {
  const warnings: string[] = [];
  if (parsed.redirectUris.length && !parsed.redirectUris.includes(PRODUCTION_MAILBOX_REDIRECT_URI)) {
    warnings.push(
      `Redirect URI should include ${PRODUCTION_MAILBOX_REDIRECT_URI} (found: ${parsed.redirectUris.join(', ') || 'none'})`
    );
  }
  if (parsed.redirectUris.length && !parsed.redirectUris.includes(PRODUCTION_CALENDAR_REDIRECT_URI)) {
    warnings.push(
      `For Google Calendar connect, also add ${PRODUCTION_CALENDAR_REDIRECT_URI}`
    );
  }
  if (parsed.javascriptOrigins.length && !parsed.javascriptOrigins.includes(PRODUCTION_MAILBOX_ORIGIN)) {
    warnings.push(
      `JavaScript origin should include ${PRODUCTION_MAILBOX_ORIGIN} (found: ${parsed.javascriptOrigins.join(', ') || 'none'})`
    );
  }
  return warnings;
}
