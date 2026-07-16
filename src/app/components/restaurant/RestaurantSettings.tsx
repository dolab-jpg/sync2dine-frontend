import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, PhoneCall, Store } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

/**
 * Restaurant settings (Super Master B2): phone agent on/off, About us and
 * Say today — both feed the food phone AI (C10) greeting and answers.
 */
export default function RestaurantSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [aboutUs, setAboutUs] = useState('');
  const [sayToday, setSayToday] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/settings');
        const data = await res.json() as { isActive?: boolean; aboutUs?: string; sayToday?: string };
        if (cancelled) return;
        setIsActive(data.isActive !== false);
        setAboutUs(data.aboutUs ?? '');
        setSayToday(data.sayToday ?? '');
      } catch {
        toast.error('Could not load settings — API offline?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggleActive(checked: boolean) {
    setIsActive(checked);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      const data = await res.json();
      setIsActive(data.isActive !== false);
      toast.success(checked ? 'Phone agent answering' : 'Phone agent paused');
    } catch {
      toast.error('Could not update the phone agent');
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aboutUs, sayToday }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Saved — the phone agent will use this on the next call');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-s2d-cream p-3 sm:p-5">
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Settings</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Your restaurant & phone agent</h1>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <PhoneCall className="mt-1 h-6 w-6 text-s2d-teal" />
              <div>
                <h2 className="text-xl font-bold text-s2d-teal-deep">Phone agent</h2>
                <p className="text-sm text-slate-600">When on, Lizzie answers your calls and takes orders.</p>
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={(c) => void toggleActive(c)} disabled={loading} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Store className="mt-1 h-6 w-6 text-s2d-teal" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-s2d-teal-deep">About us</h2>
              <p className="mb-2 text-sm text-slate-600">
                Opening hours, address, parking, allergens — shared with callers when they ask.
              </p>
              <Textarea
                value={aboutUs}
                onChange={(e) => setAboutUs(e.target.value)}
                rows={5}
                disabled={loading}
                placeholder="Open Tue–Sun 5pm–11pm. Collection and delivery within 3 miles. Card and cash at the desk."
                className="min-h-28 rounded-xl text-base"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-1 h-6 w-6 text-s2d-teal" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-s2d-teal-deep">Say today</h2>
              <p className="mb-2 text-sm text-slate-600">
                A daily line the agent mentions on calls — today's special, closing early, etc.
              </p>
              <Textarea
                value={sayToday}
                onChange={(e) => setSayToday(e.target.value)}
                rows={2}
                disabled={loading}
                placeholder="Today's special: lamb karahi with free naan on orders over £25."
                className="rounded-xl text-base"
              />
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="min-h-[52px] w-full rounded-xl bg-s2d-teal-deep text-base font-bold text-white hover:bg-s2d-teal sm:w-auto sm:px-10"
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </section>
    </div>
  );
}
