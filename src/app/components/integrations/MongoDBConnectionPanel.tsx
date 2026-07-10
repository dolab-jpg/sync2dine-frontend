import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Database, Loader2, Zap } from 'lucide-react';
import { integrationService } from '../../engine/integrations/integrationService';
import type { IntegrationStatus } from '../../config/integrations/types';
import { toast } from 'sonner';

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  not_configured: 'bg-gray-100 text-gray-700',
  mock: 'bg-amber-100 text-amber-800',
  connected: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: 'Not connected',
  mock: 'Mock',
  connected: 'Connected',
  error: 'Error',
};

interface MongoDBConnectionPanelProps {
  userName: string;
}

export function MongoDBConnectionPanel({ userName }: MongoDBConnectionPanelProps) {
  const [connectionString, setConnectionString] = useState('');
  const [databaseName, setDatabaseName] = useState('tradepro');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<IntegrationStatus>('not_configured');
  const [lastMessage, setLastMessage] = useState<string | undefined>();

  useEffect(() => {
    const inst = integrationService.getInstance('mongodb');
    setConnectionString(inst.values.connectionString ?? '');
    setDatabaseName(inst.values.databaseName || 'tradepro');
    setStatus(integrationService.getStatus('mongodb'));
    setLastMessage(inst.lastTestError);
  }, []);

  const persist = (nextStatus?: IntegrationStatus, testError?: string) => {
    integrationService.updateIntegration('mongodb', {
      enabled: true,
      mockMode: false,
      values: { connectionString, databaseName },
      ...(nextStatus ? { status: nextStatus } : {}),
      lastTestedAt: new Date().toISOString(),
      lastTestError: testError,
    });
    integrationService.logAudit('mongodb', userName);
    if (nextStatus) setStatus(nextStatus);
    setLastMessage(testError);
  };

  const handleSave = () => {
    if (!connectionString.trim()) {
      toast.error('Paste your MongoDB connection string first');
      return;
    }
    persist();
    toast.success('MongoDB settings saved');
  };

  const handleTest = async () => {
    if (!connectionString.trim()) {
      toast.error('Paste your MongoDB connection string first');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: 'mongodb',
          values: { connectionString, databaseName },
        }),
      });
      const data = await res.json() as { success: boolean; message?: string };

      if (!res.ok || !data.success) {
        const message = data.message || 'Connection failed';
        persist('error', message);
        toast.error(message);
        return;
      }

      persist('connected');
      toast.success(data.message || 'MongoDB connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      persist('error', message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-2 border-emerald-200 bg-emerald-50/40">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="w-5 h-5 text-emerald-600" />
            MongoDB Database
          </CardTitle>
          <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>
        </div>
        <p className="text-sm text-gray-600">
          Paste your Atlas connection string below, click Test Connection, then Save. No terminal needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="mongo-uri">Connection String</Label>
          <Input
            id="mongo-uri"
            type="password"
            className="mt-1 font-mono text-sm"
            placeholder="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/tradepro"
            value={connectionString}
            onChange={e => setConnectionString(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Full URI from Atlas → Connect → Drivers. Include username and password in the string.
          </p>
        </div>

        <div>
          <Label htmlFor="mongo-db">Database Name</Label>
          <Input
            id="mongo-db"
            className="mt-1"
            placeholder="tradepro"
            value={databaseName}
            onChange={e => setDatabaseName(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Test Connection
          </Button>
          <Button variant="outline" onClick={handleSave}>
            Save
          </Button>
        </div>

        {lastMessage && status === 'error' && (
          <p className="text-sm text-red-600">{lastMessage}</p>
        )}

        {status === 'connected' && (
          <p className="text-sm text-emerald-700">
            Connected — app data will sync to MongoDB when you save projects or CRM records.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
