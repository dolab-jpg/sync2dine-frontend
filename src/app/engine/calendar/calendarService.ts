export interface CalendarConnection {
  id: string;
  orgId: string;
  userId: string;
  emailAddress: string;
  calendarId: string;
  status: 'connected' | 'needs_reconnect' | 'error' | 'disconnected';
  connectedAt: string;
  lastError?: string;
}

function headers(userId?: string, orgId?: string): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) h['X-User-Id'] = userId;
  if (orgId) h['X-Org-Id'] = orgId;
  return h;
}

export const calendarService = {
  async getConnection(userId?: string, orgId?: string): Promise<{
    connection: CalendarConnection | null;
    configured: boolean;
    redirectUri?: string;
  }> {
    const res = await fetch('/api/calendar/connection', { headers: headers(userId, orgId) });
    const data = await res.json() as {
      connection?: CalendarConnection | null;
      configured?: boolean;
      redirectUri?: string;
    };
    return {
      connection: data.connection ?? null,
      configured: Boolean(data.configured),
      redirectUri: data.redirectUri,
    };
  },

  async startConnect(userId?: string, orgId?: string, loginHint?: string): Promise<{ authUrl?: string; error?: string }> {
    const params = new URLSearchParams();
    if (loginHint) params.set('loginHint', loginHint);
    if (typeof window !== 'undefined') params.set('appOrigin', window.location.origin);
    const qs = params.toString();
    const res = await fetch(`/api/calendar/connect${qs ? `?${qs}` : ''}`, {
      headers: headers(userId, orgId),
    });
    const data = await res.json().catch(() => ({})) as { authUrl?: string; error?: string };
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'A',location:'calendarService.ts:startConnect',message:'connect HTTP response',data:{status:res.status,ok:res.ok,hasAuthUrl:Boolean(data.authUrl),error:data.error||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!res.ok && !data.error) {
      return { error: `Calendar API ${res.status} — is the Sync2Dine API running with calendar routes?` };
    }
    return data;
  },

  async disconnect(userId?: string, orgId?: string): Promise<void> {
    await fetch('/api/calendar/connection', {
      method: 'DELETE',
      headers: headers(userId, orgId),
    });
  },

  async createEvent(
    payload: {
      title: string;
      start: string;
      end: string;
      description?: string;
      location?: string;
      attendees?: string[];
    },
    userId?: string,
    orgId?: string,
  ): Promise<{ ok?: boolean; event?: { id: string; htmlLink?: string }; error?: string; code?: string }> {
    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: headers(userId, orgId),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async pushSecrets(values: Record<string, string>, userId?: string, orgId?: string): Promise<void> {
    await fetch('/api/calendar/secrets', {
      method: 'POST',
      headers: headers(userId, orgId),
      body: JSON.stringify(values),
    });
  },
};
