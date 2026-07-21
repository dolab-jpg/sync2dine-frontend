import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { BadgePoundSterling, Phone, Plug, Save } from 'lucide-react';
import {
  fetchSallyOffer,
  fetchSallyPhoneLine,
  saveSallyOffer,
  saveSallyPhoneLine,
  testPlatformPhoneLine,
  type PlatformPhoneLine,
  type SallyOfferTerms,
} from '../../engine/platform/platformApi';

const emptyForm: SallyOfferTerms = {
  monthlyPriceGbp: 350,
  setupFeeGbp: 0,
  billing: 'monthly subscription',
  minimumTerm: '1 month rolling',
  cancelPolicy: 'Cancel anytime with 30 days written notice after the first month.',
  demoPhone: '',
  demoVideoUrl: '',
  salesPdfUrl: '',
};

export default function SallyOfferSettings() {
  const [form, setForm] = useState<SallyOfferTerms>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [line, setLine] = useState<PlatformPhoneLine | null>(null);
  const [lineForm, setLineForm] = useState({
    label: 'Sally sales',
    did: '',
    sipUsername: '',
    sipPassword: '',
    sipDomain: 'sbc.soho66.co.uk',
    enabled: true,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [data, phoneLine] = await Promise.all([fetchSallyOffer(), fetchSallyPhoneLine()]);
      setForm({ ...emptyForm, ...data.offer });
      setUpdatedAt(data.stored?.updatedAt || null);
      setLine(phoneLine);
      setLineForm({
        label: phoneLine?.label || 'Sally sales',
        did: phoneLine?.did || data.offer.demoPhone || '',
        sipUsername: phoneLine?.sipUsername || '',
        sipPassword: '',
        sipDomain: phoneLine?.sipDomain || 'sbc.soho66.co.uk',
        enabled: phoneLine?.enabled !== false,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Sally offer');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await saveSallyOffer({
        monthlyPriceGbp: Number(form.monthlyPriceGbp),
        setupFeeGbp: Number(form.setupFeeGbp),
        minimumTerm: form.minimumTerm,
        cancelPolicy: form.cancelPolicy,
        demoPhone: form.demoPhone,
        demoVideoUrl: form.demoVideoUrl,
        salesPdfUrl: form.salesPdfUrl,
      });
      setForm({ ...emptyForm, ...data.offer });
      setUpdatedAt(data.stored?.updatedAt || null);
      toast.success('Sally offer saved — live on the next call/chat');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveLine = async () => {
    if (!lineForm.did.trim() || !lineForm.sipUsername.trim()) {
      toast.error('Sally phone number and SIP username are required');
      return;
    }
    if (!line && !lineForm.sipPassword.trim()) {
      toast.error('SIP password is required for a new Sally line');
      return;
    }
    setSavingLine(true);
    try {
      const saved = await saveSallyPhoneLine({
        label: lineForm.label.trim() || 'Sally sales',
        did: lineForm.did.trim(),
        sipUsername: lineForm.sipUsername.trim(),
        sipPassword: lineForm.sipPassword.trim() || undefined,
        sipDomain: lineForm.sipDomain.trim() || 'sbc.soho66.co.uk',
        enabled: lineForm.enabled,
        connectionType: 'soho66',
      });
      setLine(saved);
      setLineForm((f) => ({ ...f, sipPassword: '', did: saved.did }));
      setForm((f) => ({ ...f, demoPhone: saved.did }));
      toast.success('Sally phone credentials saved on the platform');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Sally line');
    } finally {
      setSavingLine(false);
    }
  };

  const testLine = async () => {
    if (!line) {
      toast.error('Save Sally’s line first');
      return;
    }
    try {
      const result = await testPlatformPhoneLine(line.id, line.orgId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Platform</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-s2d-teal-deep sm:text-3xl">
          <BadgePoundSterling className="h-7 w-7" />
          Sally (platform owner)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sally sells Sync2Dine for you. Restaurant Judie numbers and SIP passwords belong on each
          client under Platform clients — not here.
        </p>
        {updatedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Offer last saved {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5" />
            Sally phone credentials
          </CardTitle>
          {line ? (
            <Badge variant="secondary">{line.enabled ? line.status : 'disabled'}</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Platform sales line only. Save DID + SIP username/password here; restaurant diner lines
            stay on each customer.
          </p>
          <div className="space-y-2 sm:col-span-2">
            <Label>Label</Label>
            <Input
              disabled={loading}
              value={lineForm.label}
              onChange={(e) => setLineForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Sally phone number (DID)</Label>
            <Input
              disabled={loading}
              placeholder="0208…"
              value={lineForm.did}
              onChange={(e) => setLineForm((f) => ({ ...f, did: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>SIP username</Label>
            <Input
              disabled={loading}
              autoComplete="off"
              value={lineForm.sipUsername}
              onChange={(e) => setLineForm((f) => ({ ...f, sipUsername: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>SIP password {line ? '(leave blank to keep)' : ''}</Label>
            <Input
              type="password"
              disabled={loading}
              autoComplete="new-password"
              value={lineForm.sipPassword}
              onChange={(e) => setLineForm((f) => ({ ...f, sipPassword: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>SIP domain</Label>
            <Input
              disabled={loading}
              value={lineForm.sipDomain}
              onChange={(e) => setLineForm((f) => ({ ...f, sipDomain: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={loading || savingLine}
              onClick={() => void saveLine()}
              className="min-h-11 rounded-xl bg-s2d-teal font-bold text-white hover:bg-s2d-teal-deep"
            >
              <Save className="mr-2 h-4 w-4" />
              {savingLine ? 'Saving…' : 'Save Sally phone'}
            </Button>
            <Button type="button" variant="outline" disabled={!line || loading} onClick={() => void testLine()}>
              <Plug className="mr-2 h-4 w-4" />
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Commercial terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="monthly">Monthly price (£)</Label>
            <Input
              id="monthly"
              type="number"
              min={1}
              step={1}
              disabled={loading}
              value={form.monthlyPriceGbp}
              onChange={(e) => setForm((f) => ({ ...f, monthlyPriceGbp: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup">Setup fee (£)</Label>
            <Input
              id="setup"
              type="number"
              min={0}
              step={1}
              disabled={loading}
              value={form.setupFeeGbp}
              onChange={(e) => setForm((f) => ({ ...f, setupFeeGbp: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="term">Minimum term</Label>
            <Input
              id="term"
              disabled={loading}
              value={form.minimumTerm}
              onChange={(e) => setForm((f) => ({ ...f, minimumTerm: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cancel">Cancel policy</Label>
            <Textarea
              id="cancel"
              rows={3}
              disabled={loading}
              value={form.cancelPolicy}
              onChange={(e) => setForm((f) => ({ ...f, cancelPolicy: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Demo assets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="demoPhone">Demo phone (spoken in sales)</Label>
            <Input
              id="demoPhone"
              disabled={loading}
              placeholder="+44…"
              value={form.demoPhone}
              onChange={(e) => setForm((f) => ({ ...f, demoPhone: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Auto-updates when you save Sally phone credentials above.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demoVideo">Demo video URL</Label>
            <Input
              id="demoVideo"
              disabled={loading}
              placeholder="https://…"
              value={form.demoVideoUrl}
              onChange={(e) => setForm((f) => ({ ...f, demoVideoUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salesPdf">Sales PDF URL</Label>
            <Input
              id="salesPdf"
              disabled={loading}
              placeholder="https://…"
              value={form.salesPdfUrl}
              onChange={(e) => setForm((f) => ({ ...f, salesPdfUrl: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving}
          className="min-h-11 rounded-xl bg-s2d-teal font-bold text-white hover:bg-s2d-teal-deep"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving…' : 'Save offer'}
        </Button>
        <Button type="button" variant="outline" disabled={loading || saving} onClick={() => void reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
