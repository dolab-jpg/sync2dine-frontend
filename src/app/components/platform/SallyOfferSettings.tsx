import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { BadgePoundSterling, Save } from 'lucide-react';
import {
  fetchSallyOffer,
  saveSallyOffer,
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
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSallyOffer();
      setForm({ ...emptyForm, ...data.offer });
      setUpdatedAt(data.stored?.updatedAt || null);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Platform</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-s2d-teal-deep sm:text-3xl">
          <BadgePoundSterling className="h-7 w-7" />
          Sally offer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Price, terms, and demo materials Sally uses when selling Sync2Dine. Edit here after you check them — no env redeploy needed.
        </p>
        {updatedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last saved {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

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
            <Label htmlFor="demoPhone">Demo phone</Label>
            <Input
              id="demoPhone"
              disabled={loading}
              placeholder="+44…"
              value={form.demoPhone}
              onChange={(e) => setForm((f) => ({ ...f, demoPhone: e.target.value }))}
            />
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
