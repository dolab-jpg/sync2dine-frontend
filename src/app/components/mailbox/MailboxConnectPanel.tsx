import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2, Mail, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { mailboxService, type MailboxConnection } from '../../engine/mailbox/mailboxService';
import { integrationService } from '../../engine/integrations/integrationService';
import { openOAuthPopup } from '../../engine/oauth/googlePopupOAuth';

interface Props {
  userId: string;
  orgId?: string;
  onConnectionChange?: () => void;
}

type MailProvider = 'google' | 'microsoft' | 'yahoo';

function providerCredentialsReady(provider: MailProvider, oauthCfg: Record<string, string>): boolean {
  if (provider === 'google') {
    return Boolean(oauthCfg.googleClientId?.trim() && oauthCfg.googleClientSecret?.trim());
  }
  if (provider === 'microsoft') {
    return Boolean(oauthCfg.microsoftClientId?.trim() && oauthCfg.microsoftClientSecret?.trim());
  }
  return Boolean(oauthCfg.yahooClientId?.trim() && oauthCfg.yahooClientSecret?.trim());
}

export function MailboxConnectPanel({ userId, orgId, onConnectionChange }: Props) {
  const [connections, setConnections] = useState<MailboxConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<MailProvider | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await mailboxService.getConnections(userId, orgId);
      setConnections(list);
    } finally {
      setLoading(false);
    }
  }, [userId, orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleConnect = async (provider: MailProvider) => {
    setConnecting(provider);
    try {
      const oauthCfg = integrationService.getConfig('email_oauth');
      const providerReady = providerCredentialsReady(provider, oauthCfg);
      const live =
        providerReady
        && !integrationService.isMockMode('email_oauth')
        && !integrationService.isMasterMockMode();

      if (!providerReady) {
        toast.error(
          provider === 'google'
            ? 'Add Google Client ID/Secret under Integrations → Mailbox OAuth first'
            : provider === 'yahoo'
              ? 'Add Yahoo Client ID/Secret under Integrations → Mailbox OAuth first'
              : 'Add Microsoft Client ID/Secret under Integrations → Mailbox OAuth first',
        );
        return;
      }

      if (live) {
        await fetch('/api/integrations/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId: 'email_oauth', values: oauthCfg }),
        });
      }

      const usePopup = provider === 'google';
      const result = await mailboxService.startConnect(provider, userId, orgId, undefined, live, usePopup);
      if (result.mock && result.connection) {
        toast.success(`Mock ${provider} mailbox connected — turn Mock mode off under Integrations for real sign-in`);
        await refresh();
        onConnectionChange?.();
        return;
      }
      if (result.authUrl) {
        if (usePopup) {
          const oauth = await openOAuthPopup(result.authUrl, {
            messageType: 'mailbox_oauth',
            windowName: 'mailbox_google_oauth',
          });
          if (oauth.ok) {
            toast.success(oauth.email ? `Connected ${oauth.email}` : 'Mailbox connected');
            await refresh();
            onConnectionChange?.();
          } else {
            toast.error(oauth.error);
          }
          return;
        }
        window.location.href = result.authUrl;
        return;
      }
      toast.error('Failed to start OAuth — check provider credentials');
    } catch {
      toast.error('Failed to start OAuth');
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await mailboxService.sync(id, userId, orgId);
      if (result.error) toast.error(result.error);
      else toast.success(`Synced ${result.synced ?? 0} new message(s)`);
      await refresh();
      onConnectionChange?.();
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    await mailboxService.disconnect(id, userId, orgId);
    toast.success('Mailbox disconnected');
    await refresh();
    onConnectionChange?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5" /> Connected inbox
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {connections.length === 0 && (
          <p className="text-sm text-gray-600">
            No mailbox connected. Click Connect with Google or Yahoo to sign in and integrate your inbox.
          </p>
        )}
        <p className="text-xs text-slate-600 bg-slate-50 border rounded-lg p-3 leading-relaxed">
          First-time setup: a super admin creates a Google Cloud <strong>Web application</strong> OAuth client
          with redirect URI <code className="text-[11px]">https://app.sync2dine.io/api/mailbox/callback</code>,
          then uploads Client ID + Secret under{' '}
          <Link to="/integrations" className="text-blue-700 underline font-medium">Integrations → Mailbox OAuth</Link>
          {' '}(Enabled on, Mock off). After that, use the buttons below to sign in.
        </p>
        {connections.map(conn => (
          <div key={conn.id} className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-lg bg-slate-50">
            <div>
              <p className="font-medium">{conn.emailAddress}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">{conn.provider}</Badge>
                <Badge variant={conn.status === 'connected' ? 'default' : 'destructive'}>{conn.status}</Badge>
                {conn.lastSyncedAt && (
                  <span className="text-xs text-gray-500">Synced {new Date(conn.lastSyncedAt).toLocaleString()}</span>
                )}
              </div>
              {conn.lastError && <p className="text-xs text-red-600 mt-1">{conn.lastError}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void handleSync(conn.id)} disabled={syncing === conn.id}>
                {syncing === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync now'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void handleDisconnect(conn.id)}>
                <Unplug className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => void handleConnect('google')} disabled={connecting !== null}>
            {connecting === 'google' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Connect with Google
          </Button>
          <Button variant="outline" onClick={() => void handleConnect('microsoft')} disabled={connecting !== null}>
            {connecting === 'microsoft' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Connect with Microsoft
          </Button>
          <Button variant="outline" onClick={() => void handleConnect('yahoo')} disabled={connecting !== null}>
            {connecting === 'yahoo' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Connect with Yahoo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
