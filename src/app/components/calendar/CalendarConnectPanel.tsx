import { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Calendar, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { calendarService, type CalendarConnection } from '../../engine/calendar/calendarService';
import { integrationService } from '../../engine/integrations/integrationService';
import { openOAuthPopup } from '../../engine/oauth/googlePopupOAuth';
import { PRODUCTION_CALENDAR_REDIRECT_URI } from '../../engine/integrations/googleOAuthClientJson';

interface Props {
  userId: string;
  orgId?: string;
  compact?: boolean;
  onConnectionChange?: () => void;
}

function calendarCredentialsReady(): boolean {
  const cal = integrationService.getConfig('google_calendar');
  if (cal.clientId?.trim() && cal.clientSecret?.trim()) return true;
  const mail = integrationService.getConfig('email_oauth');
  return Boolean(mail.googleClientId?.trim() && mail.googleClientSecret?.trim());
}

export function CalendarConnectPanel({ userId, orgId, compact, onConnectionChange }: Props) {
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calendarService.getConnection(userId, orgId);
      setConnection(data.connection);
      setConfigured(data.configured || calendarCredentialsReady());
    } finally {
      setLoading(false);
    }
  }, [userId, orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const ready = calendarCredentialsReady();
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'B',location:'CalendarConnectPanel.tsx:handleConnect',message:'connect start',data:{ready,configured,hasUserId:Boolean(userId),hasOrgId:Boolean(orgId)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!ready && !configured) {
        toast.error('Add Google Client ID/Secret under Integrations → Google Calendar (or Mailbox OAuth) first');
        return;
      }

      const calCfg = integrationService.getConfig('google_calendar');
      const mailCfg = integrationService.getConfig('email_oauth');
      const values = {
        clientId: calCfg.clientId || mailCfg.googleClientId || '',
        clientSecret: calCfg.clientSecret || mailCfg.googleClientSecret || '',
        calendarId: calCfg.calendarId || 'primary',
      };
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'B',location:'CalendarConnectPanel.tsx:creds',message:'credential sources',data:{hasCalClientId:Boolean(calCfg.clientId?.trim()),hasMailClientId:Boolean(mailCfg.googleClientId?.trim()),hasMergedSecret:Boolean(values.clientSecret),calendarId:values.calendarId||'primary'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (values.clientId && values.clientSecret) {
        await fetch('/api/integrations/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId: 'google_calendar', values }),
        });
      }

      const result = await calendarService.startConnect(userId, orgId);
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'A',location:'CalendarConnectPanel.tsx:startConnect',message:'startConnect result',data:{hasAuthUrl:Boolean(result.authUrl),error:result.error||null,authHost:result.authUrl?(()=>{try{return new URL(result.authUrl).host}catch{return 'bad-url'}})():null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.authUrl) {
        toast.error('Failed to start Google Calendar OAuth');
        return;
      }

      const oauth = await openOAuthPopup(result.authUrl, {
        messageType: 'calendar_oauth',
        windowName: 'google_calendar_oauth',
      });
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'D',location:'CalendarConnectPanel.tsx:popupResult',message:'popup oauth finished',data:{ok:oauth.ok,error:oauth.ok?null:oauth.error,hasEmail:oauth.ok?Boolean(oauth.email):false},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (oauth.ok) {
        toast.success(oauth.email ? `Calendar connected: ${oauth.email}` : 'Google Calendar connected');
        await refresh();
        onConnectionChange?.();
      } else {
        toast.error(oauth.error);
      }
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'732d78'},body:JSON.stringify({sessionId:'732d78',runId:'pre-fix',hypothesisId:'A',location:'CalendarConnectPanel.tsx:catch',message:'connect threw',data:{err:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error('Failed to connect Google Calendar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await calendarService.disconnect(userId, orgId);
    toast.success('Google Calendar disconnected');
    await refresh();
    onConnectionChange?.();
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4 p-4 border rounded-lg bg-slate-50'}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-700" />
          <h3 className="font-semibold text-slate-900">Google Calendar</h3>
        </div>
      )}
      <p className="text-xs text-slate-600 leading-relaxed">
        Connect with Google opens a popup (calendar access only — separate from Gmail mailbox).
        Redirect URI must include{' '}
        <code className="text-[11px]">{PRODUCTION_CALENDAR_REDIRECT_URI}</code>
        {' '}— see{' '}
        <Link to="/integrations" className="text-blue-700 underline font-medium">Integrations → Google Calendar</Link>.
      </p>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
      ) : connection ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-lg bg-white">
          <div>
            <p className="font-medium text-sm">{connection.emailAddress}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant={connection.status === 'connected' ? 'default' : 'destructive'}>
                {connection.status}
              </Badge>
              <Badge variant="outline">{connection.calendarId || 'primary'}</Badge>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => void handleDisconnect()}>
            <Unplug className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button onClick={() => void handleConnect()} disabled={connecting}>
          {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Connect with Google
        </Button>
      )}
    </div>
  );
}
