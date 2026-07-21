import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Phone, Plus, Save, Trash2, RefreshCw, Plug } from 'lucide-react';
import {
  createPlatformPhoneLine,
  deletePlatformPhoneLine,
  fetchOrganizations,
  fetchPlatformPhoneLines,
  testPlatformPhoneLine,
  updatePlatformPhoneLine,
  type PlatformOrganization,
  type PlatformPhoneLine,
  type PlatformPhoneLineConnectionType,
  type PlatformPhoneLinePurpose,
} from '../../engine/platform/platformApi';

type LineForm = {
  orgId: string;
  label: string;
  did: string;
  sipUsername: string;
  sipPassword: string;
  sipDomain: string;
  purpose: PlatformPhoneLinePurpose;
  connectionType: PlatformPhoneLineConnectionType;
  enabled: boolean;
};

const emptyForm = (): LineForm => ({
  orgId: '',
  label: '',
  did: '',
  sipUsername: '',
  sipPassword: '',
  sipDomain: 'sbc.soho66.co.uk',
  purpose: 'aria',
  connectionType: 'soho66',
  enabled: true,
});

export default function PlatformPhoneLines() {
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [lines, setLines] = useState<PlatformPhoneLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LineForm>(emptyForm());
  const [filterOrgId, setFilterOrgId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [orgList, lineList] = await Promise.all([
        fetchOrganizations(),
        fetchPlatformPhoneLines(),
      ]);
      setOrgs(orgList);
      setLines(lineList);
      setForm((f) => (f.orgId ? f : { ...f, orgId: orgList[0]?.id ?? '' }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load phone lines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(
    () => (filterOrgId ? lines.filter((l) => l.orgId === filterOrgId) : lines),
    [lines, filterOrgId],
  );

  const startEdit = (line: PlatformPhoneLine) => {
    setEditingId(line.id);
    setForm({
      orgId: line.orgId,
      label: line.label,
      did: line.did,
      sipUsername: line.sipUsername,
      sipPassword: '',
      sipDomain: line.sipDomain || 'sbc.soho66.co.uk',
      purpose: line.purpose ?? 'aria',
      connectionType: line.connectionType ?? 'soho66',
      enabled: line.enabled !== false,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm((f) => ({ ...emptyForm(), orgId: f.orgId || orgs[0]?.id || '' }));
  };

  const save = async () => {
    if (!form.orgId || !form.label.trim() || !form.sipUsername.trim() || !form.did.trim()) {
      toast.error('Restaurant, label, SIP username, and phone number are required');
      return;
    }
    if (!editingId && !form.sipPassword.trim()) {
      toast.error('SIP / connection password is required for new lines');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const patch: Parameters<typeof updatePlatformPhoneLine>[1] = {
          orgId: form.orgId,
          label: form.label.trim(),
          sipUsername: form.sipUsername.trim(),
          sipDomain: form.sipDomain.trim() || 'sbc.soho66.co.uk',
          did: form.did.trim(),
          purpose: form.purpose,
          connectionType: form.connectionType,
          enabled: form.enabled,
        };
        if (form.sipPassword.trim()) patch.sipPassword = form.sipPassword.trim();
        await updatePlatformPhoneLine(editingId, patch);
        toast.success('Phone line updated');
      } else {
        await createPlatformPhoneLine({
          orgId: form.orgId,
          label: form.label.trim(),
          sipUsername: form.sipUsername.trim(),
          sipPassword: form.sipPassword.trim(),
          sipDomain: form.sipDomain.trim() || 'sbc.soho66.co.uk',
          did: form.did.trim(),
          purpose: form.purpose,
          connectionType: form.connectionType,
          enabled: form.enabled,
        });
        toast.success('Phone line connected to restaurant');
      }
      resetForm();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save line');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (line: PlatformPhoneLine) => {
    if (!confirm(`Remove line "${line.label}" (${line.did})?`)) return;
    try {
      await deletePlatformPhoneLine(line.id, line.orgId);
      toast.success('Line removed');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const test = async (line: PlatformPhoneLine) => {
    try {
      const result = await testPlatformPhoneLine(line.id, line.orgId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Platform</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-s2d-teal-deep sm:text-3xl">
          <Phone className="h-7 w-7" />
          Phone lines
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of all lines. Prefer Platform clients → open a restaurant for Judie SIP credentials,
          and Sally offer for the platform sales line.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">{editingId ? 'Edit line' : 'Connect a line'}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Restaurant</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.orgId}
              disabled={Boolean(editingId)}
              onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
            >
              <option value="">Select restaurant…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.phoneDid ? ` · ${o.phoneDid}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Judie main / Staff softphone"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone number (DID)</Label>
            <Input
              value={form.did}
              onChange={(e) => setForm((f) => ({ ...f, did: e.target.value }))}
              placeholder="0203…"
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.purpose}
              onChange={(e) =>
                setForm((f) => ({ ...f, purpose: e.target.value as PlatformPhoneLinePurpose }))
              }
            >
              <option value="aria">Judie (restaurant diner)</option>
              <option value="sally">Sally (platform sales)</option>
              <option value="staff">Staff softphone</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Connection</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.connectionType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  connectionType: e.target.value as PlatformPhoneLineConnectionType,
                }))
              }
            >
              <option value="soho66">Soho66 SIP</option>
              <option value="sip">Generic SIP</option>
              <option value="twilio">Twilio</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>SIP username</Label>
            <Input
              value={form.sipUsername}
              onChange={(e) => setForm((f) => ({ ...f, sipUsername: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>SIP / connection password {editingId ? '(leave blank to keep)' : ''}</Label>
            <Input
              type="password"
              value={form.sipPassword}
              onChange={(e) => setForm((f) => ({ ...f, sipPassword: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>SIP domain</Label>
            <Input
              value={form.sipDomain}
              onChange={(e) => setForm((f) => ({ ...f, sipDomain: e.target.value }))}
              placeholder="sbc.soho66.co.uk"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <div className="ml-auto flex gap-2">
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
              <Button type="button" onClick={() => void save()} disabled={saving || loading}>
                {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? 'Save line' : 'Add line'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">Connected lines</CardTitle>
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={filterOrgId}
            onChange={(e) => setFilterOrgId(e.target.value)}
          >
            <option value="">All restaurants</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground">No phone lines yet — add one above.</p>
          )}
          {visible.map((line) => (
            <div
              key={`${line.orgId}:${line.id}`}
              className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-s2d-teal-deep">{line.label}</p>
                  <Badge variant="secondary">
                    {line.purpose === 'staff' ? 'Staff' : line.purpose === 'sally' ? 'Sally' : 'Judie'}
                  </Badge>
                  <Badge variant="outline">{line.connectionType ?? 'soho66'}</Badge>
                  <Badge variant={line.enabled ? 'default' : 'secondary'}>
                    {line.enabled ? line.status : 'disabled'}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {line.orgName || line.orgId} · {line.did} · {line.sipUsername}@
                  {line.sipDomain}
                </p>
                {line.lastError && (
                  <p className="text-xs text-red-600">{line.lastError}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(line)}>
                  Edit
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void test(line)}>
                  <Plug className="mr-1 h-3.5 w-3.5" />
                  Test
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => void remove(line)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
