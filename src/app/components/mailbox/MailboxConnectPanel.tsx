import { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2, Mail, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { mailboxService, type MailboxConnection } from '../../engine/mailbox/mailboxService';
import { integrationService } from '../../engine/integrations/integrationService';

interface Props {
  userId: string;
  orgId?: string;
  onConnectionChange?: () => void;
}

export function MailboxConnectPanel({ userId, orgId, onConnectionChange }: Props) {
  const [connections, setConnections] = useState<MailboxConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

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

  const handleConnect = async (provider: 'google' | 'microsoft' | 'yahoo') => {
    try {
      const oauthCfg = integrationService.getConfig('email_oauth');
      const hasGoogleCreds = Boolean(oauthCfg.googleClientId && oauthCfg.googleClientSecret);
      const live = hasGoogleCreds && !integrationService.isMockMode('email_oauth') && !integrationService.isMasterMockMode();
      if (live) {
        await fetch('/api/integrations/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId: 'email_oauth', values: oauthCfg }),
        });
      }
      const result = await mailboxService.startConnect(provider, userId, orgId, undefined, live);
      if (result.mock && result.connection) {
        toast.success(`Mock ${provider} mailbox connected`);
        await refresh();
        onConnectionChange?.();
        return;
      }
      if (result.authUrl) {
        window.location.href = result.authUrl;
      }
    } catch {
      toast.error('Failed to start OAuth');
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
          <p className="text-sm text-gray-600">No mailbox connected. Connect Gmail, Outlook, or Yahoo to read and send email from TradePro.</p>
        )}
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
          <Button onClick={() => void handleConnect('google')}>Connect with Google</Button>
          <Button variant="outline" onClick={() => void handleConnect('microsoft')}>Connect with Microsoft</Button>
          <Button variant="outline" onClick={() => void handleConnect('yahoo')}>Connect with Yahoo</Button>
        </div>
      </CardContent>
    </Card>
  );
}
