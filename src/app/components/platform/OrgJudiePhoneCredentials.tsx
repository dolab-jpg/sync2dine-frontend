import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Phone, Save, Plug, RefreshCw, Radio } from 'lucide-react';
import {
  fetchJudiePhoneLine,
  registerPlatformPhoneLine,
  saveJudiePhoneLine,
  syncAsteriskBridge,
  testPlatformPhoneLine,
  type PlatformPhoneLine,
} from '../../engine/platform/platformApi';

type Props = {
  orgId: string;
  orgName?: string;
  onSaved?: (line: PlatformPhoneLine) => void;
};

/**
 * Platform owner: attach this restaurant's Judie number + SIP credentials.
 * Sally sales credentials live separately under Platform ? Sally offer.
 */
export default function OrgJudiePhoneCredentials({ orgId, orgName, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [line, setLine] = useState<PlatformPhoneLine | null>(null);
  const [form, setForm] = useState({
    label: '',
    did: '',
    sipUsername: '',
    sipPassword: '',
    sipDomain: 'sbc.soho66.co.uk',
    enabled: true,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await fetchJudiePhoneLine(orgId);
      setLine(existing);
      setForm({
        label: existing?.label || (orgName ? `${orgName} Judie` : 'Judie'),
        did: existing?.did || '',
        sipUsername: existing?.sipUsername || '',
        sipPassword: '',
        sipDomain: existing?.sipDomain || 'sbc.soho66.co.uk',
        enabled: existing?.enabled !== false,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Judie line');
    } finally {
      setLoading(false);
    }
  }, [orgId, orgName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!form.did.trim() || !form.sipUsername.trim()) {
      toast.error('Phone number and SIP username are required');
      return;
    }
    if (!line && !form.sipPassword.trim()) {
      toast.error('SIP password is required for a new line');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveJudiePhoneLine(orgId, {
        label: form.label.trim() || `${orgName || 'Restaurant'} Judie`,
        did: form.did.trim(),
        sipUsername: form.sipUsername.trim(),
        sipPassword: form.sipPassword.trim() || undefined,
        sipDomain: form.sipDomain.trim() || 'sbc.soho66.co.uk',
        enabled: form.enabled,
        connectionType: 'soho66',
      });
      setLine(saved);
      setForm((f) => ({ ...f, sipPassword: '' }));
      toast.success('Saved. Click Register (or confirm VPS Asterisk REGISTER) before dialing.');
      onSaved?.(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!line) {
      toast.error('Save the line first');
      return;
    }
    try {
      const result = await testPlatformPhoneLine(line.id, orgId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  };

  const goLive = async () => {
    setGoingLive(true);
    try {
      const result = await syncAsteriskBridge(true);
      const summary = `${result.count} line(s) published${
        result.apply.ran ? (result.apply.ok ? ' + bridge reloaded' : ' ù bridge reload FAILED') : ''
      }`;
      if (result.ok) toast.success(`Live: ${summary}`);
      else toast.error(result.message || `Publish incomplete: ${summary}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Go live failed');
    } finally {
      setGoingLive(false);
    }
  };

  const register = async () => {
    if (!line) {
      toast.error('Save the line first');
      return;
    }
    setRegistering(true);
    try {
      const result = await registerPlatformPhoneLine(line.id, orgId);
      if (result.line) setLine(result.line);
      if (result.ok) toast.success(result.message || 'Line registered');
      else toast.error(result.message || 'Register failed');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Register failed');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Phone className="h-4 w-4 text-s2d-teal" />
        <p className="font-semibold text-s2d-teal-deep">Judie phone (this restaurant)</p>
        {line ? (
          <Badge variant="secondary">{line.enabled ? line.status : 'disabled'}</Badge>
        ) : (
          <Badge variant="outline">Not connected</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Unique number + SIP username/password for this client only. Diners call this line for Judie,
        not Sally. <strong>Save</strong> stores this client's credentials. <strong>Go live</strong>{' '}
        publishes every customer Judie line + Sally to the VPS Asterisk bridge as N concurrent
        REGISTERs ù editing one client never drops another client or Sally. Keep VOIS logged out of
        each AI SIP username so calls reach Judie, not voicemail.
      </p>
      {line?.lastError ? (
        <p className="text-xs text-destructive">{line.lastError}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Label</Label>
          <Input
            disabled={loading}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone number (DID)</Label>
          <Input
            disabled={loading}
            placeholder="0203ù"
            value={form.did}
            onChange={(e) => setForm((f) => ({ ...f, did: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>SIP username</Label>
          <Input
            disabled={loading}
            autoComplete="off"
            value={form.sipUsername}
            onChange={(e) => setForm((f) => ({ ...f, sipUsername: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>SIP password {line ? '(leave blank to keep)' : ''}</Label>
          <Input
            type="password"
            disabled={loading}
            autoComplete="new-password"
            value={form.sipPassword}
            onChange={(e) => setForm((f) => ({ ...f, sipPassword: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>SIP domain</Label>
          <Input
            disabled={loading}
            value={form.sipDomain}
            onChange={(e) => setForm((f) => ({ ...f, sipDomain: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={loading || saving} onClick={() => void save()}>
          <Save className="mr-1 h-3.5 w-3.5" />
          {saving ? 'SavingÖ' : 'Save credentials'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!line || loading} onClick={() => void test()}>
          <Plug className="mr-1 h-3.5 w-3.5" />
          Test
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!line || loading || registering}
          onClick={() => void register()}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${registering ? 'animate-spin' : ''}`} />
          {registering ? 'Registeringù' : 'Register'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={loading || goingLive}
          onClick={() => void goLive()}
        >
          <Radio className={`mr-1 h-3.5 w-3.5 ${goingLive ? 'animate-pulse' : ''}`} />
          {goingLive ? 'Publishing all linesù' : 'Go live (all lines)'}
        </Button>
      </div>
    </div>
  );
}
