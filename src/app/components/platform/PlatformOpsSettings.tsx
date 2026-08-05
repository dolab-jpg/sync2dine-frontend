import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { BellRing, Mail, Phone, RefreshCw, Save, Send, Webhook } from 'lucide-react';
import {
  fetchOpsContacts,
  saveOpsContacts,
  testOpsContacts,
  type OpsContacts,
} from '../../engine/platform/platformApi';

const empty: OpsContacts = {
  alertEmail: 'dolab@diamondea.co.uk',
  alertPhone: '',
  traeWebhookUrl: '',
};

export default function PlatformOpsSettings() {
  const [form, setForm] = useState<OpsContacts>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOpsContacts();
      setForm({
        alertEmail: data.contacts.alertEmail || empty.alertEmail,
        alertPhone: data.contacts.alertPhone || '',
        traeWebhookUrl: data.contacts.traeWebhookUrl || '',
      });
      setUpdatedAt(data.contacts.updatedAt ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load ops contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = async () => {
    setSaving(true);
    try {
      const data = await saveOpsContacts(form);
      setForm({
        alertEmail: data.contacts.alertEmail,
        alertPhone: data.contacts.alertPhone,
        traeWebhookUrl: data.contacts.traeWebhookUrl,
      });
      setUpdatedAt(data.contacts.updatedAt ?? null);
      toast.success('Ops alert contacts saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      // Persist first so the test uses the form values.
      await saveOpsContacts(form);
      const result = await testOpsContacts();
      const bits = [
        result.results.email ? `email=${result.results.email.ok ? 'ok' : result.results.email.error}` : 'email=skip',
        result.results.sms ? `sms=${result.results.sms.ok ? 'ok' : result.results.sms.error}` : 'sms=skip',
        result.results.webhook
          ? `webhook=${result.results.webhook.ok ? 'ok' : result.results.webhook.error}`
          : 'webhook=skip',
      ];
      toast.success(`Test sent — ${bits.join(', ')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Ops alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform-owner contacts for API outages and critical ops (email, SMS, Trae webhook).
            The VPS watchdog reads these even when the API process is down.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notify us</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alertEmail" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Alert email
            </Label>
            <Input
              id="alertEmail"
              type="email"
              value={form.alertEmail}
              onChange={(e) => setForm((f) => ({ ...f, alertEmail: e.target.value }))}
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alertPhone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Alert mobile (SMS)
            </Label>
            <Input
              id="alertPhone"
              type="tel"
              value={form.alertPhone}
              onChange={(e) => setForm((f) => ({ ...f, alertPhone: e.target.value }))}
              placeholder="+447..."
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">E.164 format. Requires Twilio on the API host.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="traeWebhookUrl" className="flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" />
              Trae / agent webhook URL
            </Label>
            <Input
              id="traeWebhookUrl"
              type="url"
              value={form.traeWebhookUrl}
              onChange={(e) => setForm((f) => ({ ...f, traeWebhookUrl: e.target.value }))}
              placeholder="https://…"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Optional HTTPS endpoint. Watchdog POSTs JSON{' '}
              <code className="text-[11px]">{'{ source, event, severity, title, message, at, healthUrl }'}</code>{' '}
              on down / recovery / test — point Trae MCP at this later.
            </p>
          </div>

          {updatedAt && (
            <p className="text-xs text-muted-foreground">Last saved {new Date(updatedAt).toLocaleString()}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => void onSave()} disabled={loading || saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={() => void onTest()} disabled={loading || testing || saving}>
              <Send className="h-4 w-4 mr-1" />
              {testing ? 'Sending…' : 'Send test'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
