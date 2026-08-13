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
      await saveOpsContacts(form);
      const result = await testOpsContacts();
      const { email, sms, webhook } = result.results;

      if (sms) {
        if (sms.stub || sms.error === 'twilio_not_configured') {
          toast.error('SMS is not configured on the server (Twilio).');
        } else if (sms.ok) {
          toast.success('Test text sent to your alert mobile.');
        }
      }

      const bits = [
        email ? `email=${email.ok ? 'ok' : email.error}` : 'email=skip',
        sms ? `sms=${sms.ok ? 'ok' : sms.error ?? (sms.stub ? 'stub' : 'fail')}` : 'sms=skip',
        webhook ? `webhook=${webhook.ok ? 'ok' : webhook.error}` : 'webhook=skip',
      ];
      if (email?.ok) {
        toast.success(`Test sent — ${bits.join(', ')}`);
      } else {
        toast.error(`Test incomplete — ${bits.join(', ')}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-s2d-teal">
            <BellRing className="h-6 w-6" />
            Ops alerts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-owner contacts for API outages, Judie/Sally phone-line offline alerts, and
            critical ops. Alert email is sent via the connected Gmail mailbox (OAuth). SMS needs
            Twilio; webhook is optional for Trae/agents.
          </p>
          {updatedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last saved {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Notify us
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="alertEmail" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Alert email
            </Label>
            <Input
              id="alertEmail"
              type="email"
              value={form.alertEmail}
              onChange={(e) => setForm((f) => ({ ...f, alertEmail: e.target.value }))}
              placeholder="dolab@diamondea.co.uk"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Delivered from the connected Google mailbox (Gmail OAuth), not a separate SMTP password.
            </p>
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
              placeholder="+447576442345"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Optional. You&apos;ll get a short plain-English text if the app goes down or a
              Judie/Sally phone line goes offline — for example: &quot;Judie on 0203… is offline.
              Callers may not get through.&quot; UK numbers like 07576… are fine; we save E.164
              (+447…). Requires Twilio on the API host.
            </p>
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
              Optional HTTPS POST on down / recovery / test.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={loading || saving}
              onClick={() => void onSave()}
              className="min-h-11 rounded-xl bg-s2d-teal font-bold text-white hover:bg-s2d-teal-deep"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || testing || saving}
              onClick={() => void onTest()}
            >
              <Send className="mr-2 h-4 w-4" />
              {testing ? 'Sending…' : 'Send test'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
