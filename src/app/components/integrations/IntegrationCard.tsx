import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { IntegrationDefinition, IntegrationInstanceState, IntegrationStatus } from '../../config/integrations/types';
import { IntegrationFieldForm } from './IntegrationFieldForm';
import { CompanyLogoUpload } from './CompanyLogoUpload';
import { GoogleOAuthJsonUpload } from './GoogleOAuthJsonUpload';
import { integrationService } from '../../engine/integrations/integrationService';
import { fetchEmbedSnippet } from '../../engine/cyrus/cyrusThreadApi';
import { PRODUCTION_MAILBOX_REDIRECT_URI } from '../../engine/integrations/googleOAuthClientJson';

interface IntegrationCardProps {
  definition: IntegrationDefinition;
  instance: IntegrationInstanceState;
  userName: string;
  onUpdate: () => void;
  simulateWhatsApp?: (message: string) => Promise<void>;
}

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  not_configured: 'bg-gray-100 text-gray-700',
  mock: 'bg-amber-100 text-amber-800',
  connected: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: 'Not configured',
  mock: 'Mock',
  connected: 'Connected',
  error: 'Error',
};

export function IntegrationCard({ definition, instance, userName, onUpdate, simulateWhatsApp }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [localValues, setLocalValues] = useState(instance.values);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [simulateMsg, setSimulateMsg] = useState('What is the status of my quote?');
  const [embedSnippet, setEmbedSnippet] = useState('');

  const status = integrationService.getStatus(definition.id);
  const hasCredentials = integrationService.hasCredentials(definition.id, localValues);

  useEffect(() => {
    setLocalValues(instance.values);
  }, [instance.values]);

  useEffect(() => {
    if (definition.id !== 'email_oauth') return;
    setLocalValues((prev) =>
      prev.redirectUri === PRODUCTION_MAILBOX_REDIRECT_URI
        ? prev
        : { ...prev, redirectUri: PRODUCTION_MAILBOX_REDIRECT_URI }
    );
  }, [definition.id, expanded]);

  useEffect(() => {
    if (definition.id !== 'company' || !expanded) return;
    void fetchEmbedSnippet()
      .then((data) => setEmbedSnippet(data.snippet))
      .catch(() => setEmbedSnippet(''));
  }, [definition.id, expanded, savedAt, localValues.website]);

  const handleSave = async () => {
    if (definition.id === 'openai') {
      if (!hasCredentials) {
        toast.error(
          localValues.provider === 'deepseek'
            ? 'Enter your DeepSeek API key before saving'
            : 'Enter your OpenAI API key before saving',
        );
        return;
      }
    } else if (definition.fields.some(f => f.required) && !hasCredentials) {
      toast.error('Fill in all required fields before saving');
      return;
    }

    try {
      await integrationService.saveIntegrationValues(definition.id, localValues);
      integrationService.logAudit(definition.id, userName);
      setSavedAt(new Date().toLocaleString());
      onUpdate();

      if (hasCredentials && definition.id === 'openai') {
        const inst = integrationService.getInstance('openai');
        const providerLabel = (localValues.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI');
        if (inst.status === 'connected') {
          toast.success(`Company AI Brain connected — ${providerLabel} live for the whole company`);
        } else {
          toast.error(inst.lastTestError || `Saved but ${providerLabel} did not connect — check the key`);
        }
        if (inst.lastTestError && inst.status === 'connected') toast.warning(inst.lastTestError);
      } else if (hasCredentials) {
        toast.success(`${definition.name} settings saved — live mode enabled`);
      } else {
        toast.success(`${definition.name} settings saved`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      onUpdate();
    }
  };

  const handleTest = async () => {
    if (!hasCredentials) {
      toast.error('Enter your API credentials before testing');
      return;
    }

    setTesting(true);
    try {
      await integrationService.saveIntegrationValues(definition.id, localValues);
      const result = await integrationService.testConnection(definition.id);
      onUpdate();

      if (result.success) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
      onUpdate();
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = (key: 'enabled' | 'mockMode', value: boolean) => {
    integrationService.updateIntegration(definition.id, { [key]: value });
    integrationService.logAudit(definition.id, userName);
    onUpdate();
  };

  return (
    <Card className={`border-2 transition-colors ${instance.enabled ? 'border-blue-200' : 'border-gray-100'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{definition.name}</CardTitle>
              <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{definition.category}</Badge>
            </div>
            <p className="text-sm text-gray-600 mt-1">{definition.description}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <Switch checked={instance.enabled} onCheckedChange={v => handleToggle('enabled', v)} />
            <Label className="text-sm">Enabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={instance.mockMode} onCheckedChange={v => handleToggle('mockMode', v)} />
            <Label className="text-sm">Mock mode</Label>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4 border-t">
          {definition.id === 'company' && (
            <CompanyLogoUpload
              logoUrl={localValues.logoUrl ?? ''}
              onLogoUrlChange={(url) => setLocalValues((prev) => ({ ...prev, logoUrl: url }))}
            />
          )}

          {definition.id === 'email_oauth' && (
            <GoogleOAuthJsonUpload
              onParsed={(parsed) => {
                setLocalValues((prev) => ({
                  ...prev,
                  googleClientId: parsed.clientId,
                  googleClientSecret: parsed.clientSecret,
                  redirectUri: PRODUCTION_MAILBOX_REDIRECT_URI,
                }));
              }}
            />
          )}

          {definition.setupGuide && (
            <div className="p-4 bg-sky-50 rounded-lg border border-sky-200 space-y-3">
              <div>
                <Label className="font-semibold text-sky-950">{definition.setupGuide.title}</Label>
                {definition.setupGuide.intro && (
                  <p className="text-xs text-sky-900/80 mt-1 leading-relaxed">{definition.setupGuide.intro}</p>
                )}
              </div>
              <ol className="space-y-3 list-decimal list-inside text-sm text-sky-950">
                {definition.setupGuide.steps.map((step) => (
                  <li key={step.label} className="space-y-1">
                    <span className="font-medium">{step.label}</span>
                    {step.value && (
                      <div className="ml-5 flex flex-wrap items-center gap-2 mt-1">
                        <code className="text-xs bg-white border border-sky-200 rounded px-2 py-1 break-all">
                          {step.value}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            void navigator.clipboard.writeText(step.value!).then(() => {
                              toast.success(`Copied ${step.label}`);
                            });
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    )}
                    {step.note && (
                      <p className="ml-5 text-xs text-sky-800/80">{step.note}</p>
                    )}
                  </li>
                ))}
              </ol>
              {definition.setupGuide.footer && (
                <p className="text-xs text-sky-900/90 border-t border-sky-200 pt-2 leading-relaxed">
                  {definition.setupGuide.footer}
                </p>
              )}
            </div>
          )}

          <IntegrationFieldForm
            fields={definition.fields}
            values={localValues}
            onChange={(key, value) => {
              setLocalValues((prev) => {
                const next = { ...prev, [key]: value };
                if (definition.id === 'openai' && key === 'provider') {
                  const mapModel = (current?: string) => {
                    if (value === 'deepseek') {
                      if (!current || current.startsWith('gpt-')) return 'deepseek-v4-flash';
                      if (current === 'deepseek-chat' || current === 'deepseek-reasoner') return current;
                      return current.startsWith('deepseek') ? current : 'deepseek-v4-flash';
                    }
                    if (!current || current.startsWith('deepseek')) return 'gpt-4o-mini';
                    return current;
                  };
                  next.staffModel = mapModel(prev.staffModel);
                  next.cyrusModel = mapModel(prev.cyrusModel);
                  next.summaryModel = mapModel(prev.summaryModel);
                }
                return next;
              });
            }}
          />

          {integrationService.isMasterMockMode() && definition.id === 'openai' && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Master mock mode is on — AI will stay simulated until you turn it off above, or click Save with a valid API key (live mode is enabled automatically).
            </p>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            {savedAt && (
              <span className="text-xs text-green-700 font-medium">Saved {savedAt}</span>
            )}
            {definition.docsUrl && (
              <Button variant="ghost" asChild>
                <a href={definition.docsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Docs
                </a>
              </Button>
            )}
          </div>

          {instance.lastTestedAt && (
            <p className="text-xs text-gray-500">
              Last tested: {new Date(instance.lastTestedAt).toLocaleString()}
              {instance.lastTestError && (
                <span className="text-red-600 block mt-1">{instance.lastTestError}</span>
              )}
            </p>
          )}

          {definition.id === 'company' && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <Label className="font-semibold text-slate-900">Cynthia website chat (existing site)</Label>
              <p className="text-xs text-slate-600">
                Paste this into your company website footer (the URL above). Visitors chat with Cynthia;
                threads appear under Cynthia for staff handoff.
              </p>
              <pre className="text-xs bg-white border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {embedSnippet || 'Save Company Profile to generate the snippet.'}
              </pre>
              <Button
                size="sm"
                variant="outline"
                disabled={!embedSnippet}
                onClick={() => {
                  void navigator.clipboard.writeText(embedSnippet).then(() => {
                    toast.success('Embed snippet copied');
                  });
                }}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy snippet
              </Button>
            </div>
          )}

          {definition.id === 'whatsapp' && simulateWhatsApp && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-2">
              <Label className="font-semibold text-green-900">Simulate inbound WhatsApp (dev)</Label>
              <textarea
                className="w-full p-2 border rounded-lg text-sm"
                rows={2}
                value={simulateMsg}
                onChange={e => setSimulateMsg(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => simulateWhatsApp(simulateMsg)}
              >
                Send to Cynthia
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
