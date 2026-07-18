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
import { WhatsAppWebPanel } from './WhatsAppWebPanel';
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
    void integrationService.initCompanyProfile().then(refresh);
    return integrationService.subscribe(refresh);
  }, [refresh]);

  // Seed Integrations status from server env (testing: keys copied from b-diddies).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/integrations/voice-config');
        if (!res.ok) return;
        const data = await res.json() as {
          vapi?: { configured?: boolean; region?: string; webhookUrl?: string; voiceId?: string };
          elevenlabs?: { configured?: boolean; voiceId?: string; modelId?: string };
          openai?: { configured?: boolean };
          sip?: { username?: string; domain?: string; did?: string; bridgeUrl?: string; hasPassword?: boolean };
        };
        if (data.vapi?.configured) {
          const cur = integrationService.getInstance('vapi');
          if (!cur?.values?.privateKey) {
            integrationService.updateIntegration('vapi', {
              enabled: true,
              mockMode: false,
              status: 'connected',
              values: {
                ...(cur?.values ?? {}),
                region: data.vapi.region || 'eu',
                webhookUrl: data.vapi.webhookUrl || 'https://app.sync2dine.io/webhooks/vapi',
                privateKey: '(configured on server)',
                publicKey: '(configured on server)',
                phoneNumberId: '(configured on server)',
                serverSecret: '(configured on server)',
              },
            });
          }
        }
        if (data.elevenlabs?.configured) {
          const cur = integrationService.getInstance('elevenlabs');
          if (!cur?.values?.voiceId && !cur?.values?.apiKey) {
            integrationService.updateIntegration('elevenlabs', {
              enabled: true,
              mockMode: false,
              status: 'connected',
              values: {
                ...(cur?.values ?? {}),
                voiceId: data.elevenlabs.voiceId || '',
                modelId: data.elevenlabs.modelId || '',
                apiKey: '(configured on server)',
              },
            });
          }
        }
        if (data.openai?.configured) {
          const cur = integrationService.getInstance('openai');
          if (!cur?.values?.apiKey) {
            integrationService.updateIntegration('openai', {
              enabled: true,
              mockMode: false,
              status: 'connected',
              values: {
                ...(cur?.values ?? {}),
                provider: 'openai',
                apiKey: '(configured on server)',
              },
            });
            integrationService.setMasterMockMode(false);
          }
        }
        if (data.sip?.username || data.sip?.did) {
          const cur = integrationService.getInstance('voice_telephony');
          integrationService.updateIntegration('voice_telephony', {
            enabled: true,
            mockMode: false,
            status: 'connected',
            values: {
              ...(cur?.values ?? {}),
              provider: 'soho66',
              sipUsername: data.sip.username || cur?.values?.sipUsername || '',
              sipDomain: data.sip.domain || cur?.values?.sipDomain || 'sbc.soho66.co.uk',
              did: data.sip.did || cur?.values?.did || '',
              sipBridgeUrl: data.sip.bridgeUrl || cur?.values?.sipBridgeUrl || '',
              sipPassword: data.sip.hasPassword ? '(configured on server)' : (cur?.values?.sipPassword || ''),
            },
          });
        }
        refresh();
      } catch {
        /* offline */
      }
    })();
  }, [refresh]);

  const filtered = INTEGRATION_REGISTRY.filter(
    def => filter === 'all' || def.category === filter
  );

  const connectedCount = integrationService.getConnectedCount();
  const statusSummary = integrationService.getStatusSummary();
  const bankingProvider = getIntegrationValues('open_banking').provider || 'mock';
  const bankingIsMock =
    bankingProvider === 'mock'
    || integrationService.isMockMode('open_banking')
    || integrationService.getStatus('open_banking') !== 'connected';

  const handleSimulateWhatsApp = async (message: string) => {
    try {
      const reply = await simulateInboundWhatsApp(message, context?.customers ?? [], context?.quotes ?? []);
      toast.success(`Cynthia replied: ${reply.slice(0, 80)}...`);
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
                <Badge className="bg-emerald-500/90 text-white">
                  Connected: {statusSummary.connected}
                </Badge>
                <Badge className="bg-white/20 text-white">
                  Not configured: {statusSummary.notConfigured}
                </Badge>
                {statusSummary.error > 0 && (
                  <Badge className="bg-red-500/90 text-white">
                    Error: {statusSummary.error}
                  </Badge>
                )}
                {statusSummary.mock > 0 && (
                  <Badge className="bg-amber-500/90 text-white">
                    Mock: {statusSummary.mock}
                  </Badge>
                )}
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

      <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
        <Shield className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          API keys are stored encrypted in Supabase (server-side). Only super admins and platform owners can access this page.
          Secret values are never kept in browser localStorage when cloud is configured.
        </span>
      </div>

      <WhatsAppWebPanel />

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
