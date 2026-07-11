import { useState, useEffect, useCallback, useContext } from 'react';
import { Card, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Plug, Shield, RefreshCw } from 'lucide-react';
import { INTEGRATION_REGISTRY } from '../../config/integrations/registry';
import type { IntegrationCategory, IntegrationsStoreData } from '../../config/integrations/types';
import { integrationService } from '../../engine/integrations/integrationService';
import { getIntegrationValues } from '../../engine/integrations/integrationsStore';
import { IntegrationCard } from './IntegrationCard';
import { AppContext } from '../../App';
import { simulateInboundWhatsApp } from '../../engine/cyrus/cyrusChatService';
import { toast } from 'sonner';
import { Button } from '../ui/button';

interface PackageUpdate {
  package: string;
  githubRepo: string;
  installed: string | null;
  latest: string | null;
  updateAvailable: boolean;
  releasesUrl: string;
}

const CATEGORIES: { value: IntegrationCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ai', label: 'AI' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'payments', label: 'Payments' },
  { value: 'database', label: 'Database' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'files', label: 'Files' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'general', label: 'General' },
];

export default function IntegrationsHub() {
  const context = useContext(AppContext);
  const [store, setStore] = useState<IntegrationsStoreData>(() => integrationService.getStore());
  const [filter, setFilter] = useState<IntegrationCategory | 'all'>('all');
  const [packageUpdates, setPackageUpdates] = useState<PackageUpdate[] | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const refresh = useCallback(() => {
    setStore(integrationService.getStore());
  }, []);

  useEffect(() => {
    return integrationService.subscribe(refresh);
  }, [refresh]);

  const filtered = INTEGRATION_REGISTRY.filter(
    def => filter === 'all' || def.category === filter
  );

  const connectedCount = integrationService.getConnectedCount();
  const bankingProvider = getIntegrationValues('open_banking').provider || 'mock';
  const bankingIsMock =
    bankingProvider === 'mock'
    || integrationService.isMockMode('open_banking')
    || integrationService.getStatus('open_banking') !== 'connected';

  const handleSimulateWhatsApp = async (message: string) => {
    try {
      const reply = await simulateInboundWhatsApp(message, context?.customers ?? [], context?.quotes ?? []);
      toast.success(`Cyrus replied: ${reply.slice(0, 80)}...`);
      refresh();
    } catch {
      toast.error('Simulation failed');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-slate-800 to-slate-900 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Plug className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Integrations Hub</h2>
              <p className="text-slate-300 mt-1">
                Configure all API connections in one place. {connectedCount} of {INTEGRATION_REGISTRY.length} active.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Badge className="bg-white/20 text-white">
                  {store.masterMockMode ? 'Master Mock Mode ON' : 'Live Mode'}
                </Badge>
                <Badge className="bg-white/20 text-white capitalize">{store.environment}</Badge>
                <Badge className={bankingIsMock ? 'bg-amber-500/90 text-white' : 'bg-emerald-500/90 text-white'}>
                  Open Banking: {bankingIsMock ? 'Demo / mock feed' : `Connected (${bankingProvider})`}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-6 p-4 bg-gray-50 rounded-xl border">
        <div className="flex items-center gap-2">
          <Switch
            checked={store.masterMockMode}
            onCheckedChange={v => {
              integrationService.setMasterMockMode(v);
              refresh();
            }}
          />
          <Label>Master mock mode (simulate all integrations)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label>Environment</Label>
          <Select
            value={store.environment}
            onValueChange={(v: IntegrationsStoreData['environment']) => {
              integrationService.setEnvironment(v);
              refresh();
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Label>Filter</Label>
          <Select value={filter} onValueChange={v => setFilter(v as IntegrationCategory | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        <Shield className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          API keys are stored in localStorage for development. At go-live, migrate to Supabase with server-side encryption.
          Only super admins can access this page.
        </span>
      </div>

      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900">
        <strong>WhatsApp Groups API:</strong> Project group chats (max 8 participants, invite-only) require Meta Official Business Account
        and eligible messaging tier. Configure WhatsApp below, then use Projects → Comms tab to create a group per project.
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-semibold">Integration SDK updates</h3>
              <p className="text-sm text-gray-600">Check npm for mailbox and messaging package updates</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={checkingUpdates}
              onClick={async () => {
                setCheckingUpdates(true);
                try {
                  const res = await fetch('/api/integrations/package-updates');
                  const data = await res.json() as { updates?: PackageUpdate[] };
                  setPackageUpdates(data.updates ?? []);
                  const count = (data.updates ?? []).filter(u => u.updateAvailable).length;
                  toast.success(count ? `${count} update(s) available` : 'All packages up to date');
                } catch {
                  toast.error('Failed to check updates');
                } finally {
                  setCheckingUpdates(false);
                }
              }}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${checkingUpdates ? 'animate-spin' : ''}`} />
              Check for updates
            </Button>
          </div>
          {packageUpdates && (
            <ul className="text-sm space-y-1">
              {packageUpdates.map(u => (
                <li key={u.package} className="flex flex-wrap gap-2 items-center">
                  <code>{u.package}</code>
                  <span>{u.installed ?? '?'} → {u.latest ?? '?'}</span>
                  {u.updateAvailable && <Badge variant="destructive">Update available</Badge>}
                  <a href={u.releasesUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">GitHub</a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filtered.map(def => (
          <IntegrationCard
            key={def.id}
            definition={def}
            instance={store.integrations[def.id]}
            userName={context?.user.name ?? 'Admin'}
            onUpdate={refresh}
            simulateWhatsApp={def.id === 'whatsapp' ? handleSimulateWhatsApp : undefined}
          />
        ))}
      </div>
    </div>
  );
}
