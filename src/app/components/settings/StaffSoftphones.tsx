'use client';

import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import type { PhoneLine } from '../CallCenter/CallCenter';

interface TeamMemberRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  role: string;
}

interface SoftphoneForm {
  label: string;
  sipUsername: string;
  sipPassword: string;
  sipDomain: string;
  did: string;
  assignedUserId: string;
  enabled: boolean;
}

const emptyForm = (): SoftphoneForm => ({
  label: '',
  sipUsername: '',
  sipPassword: '',
  sipDomain: 'sip.soho66.co.uk',
  did: '',
  assignedUserId: '',
  enabled: true,
});

export function StaffSoftphones() {
  const app = useContext(AppContext);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [lines, setLines] = useState<PhoneLine[]>([]);
  const [form, setForm] = useState<SoftphoneForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const staffLines = lines.filter((l) => (l.purpose ?? 'staff') === 'staff');

  const load = async () => {
    try {
      const [staffRes, linesRes] = await Promise.all([
        fetch('/api/org/staff/list'),
        fetch('/api/agent/lines'),
      ]);
      const staffData = await staffRes.json().catch(() => ({}));
      const linesData = await linesRes.json().catch(() => ({}));
      setMembers(staffData.members ?? []);
      setLines(linesData.lines ?? []);
    } catch {
      toast.error('Failed to load staff softphones');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const assignToMe = () => {
    if (!app?.user?.id) return;
    setForm((f) => ({
      ...f,
      assignedUserId: app.user.id,
      label: f.label || `${app.user.name || 'Admin'} Softphone`,
    }));
  };

  const startEdit = (line: PhoneLine) => {
    setEditingId(line.id);
    setForm({
      label: line.label,
      sipUsername: line.sipUsername,
      sipPassword: '',
      sipDomain: line.sipDomain || 'sip.soho66.co.uk',
      did: line.did,
      assignedUserId: line.assignedUserId ?? '',
      enabled: line.enabled !== false,
    });
  };

  const save = async () => {
    if (!form.label.trim() || !form.sipUsername.trim() || !form.did.trim() || !form.assignedUserId.trim()) {
      toast.error('Label, SIP username, DID, and assigned user are required');
      return;
    }
    if (!editingId && !form.sipPassword.trim()) {
      toast.error('SIP password is required for new softphones');
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/agent/lines/${editingId}` : '/api/agent/lines';
      const method = editingId ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        label: form.label.trim(),
        sipUsername: form.sipUsername.trim(),
        sipDomain: form.sipDomain.trim() || 'sip.soho66.co.uk',
        did: form.did.trim(),
        assignedUserId: form.assignedUserId.trim(),
        purpose: 'staff',
        enabled: form.enabled,
      };
      if (form.sipPassword.trim()) body.sipPassword = form.sipPassword.trim();
      else if (!editingId) body.sipPassword = form.sipPassword;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to save softphone');
      toast.success(editingId ? 'Softphone updated' : 'Softphone assigned');
      setForm(emptyForm());
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save softphone');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (lineId: string) => {
    try {
      const res = await fetch(`/api/agent/lines/${lineId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Softphone removed');
      await load();
    } catch {
      toast.error('Failed to remove softphone');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff Softphones (Soho66)</CardTitle>
        <CardDescription>
          Assign one SIP extension per person. Each staff member registers their own softphone under Calls → Soft Phone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Label</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="INMconstruction" />
          </div>
          <div>
            <Label>DID</Label>
            <Input value={form.did} onChange={(e) => setForm((f) => ({ ...f, did: e.target.value }))} placeholder="02037453233" />
          </div>
          <div>
            <Label>SIP Username</Label>
            <Input value={form.sipUsername} onChange={(e) => setForm((f) => ({ ...f, sipUsername: e.target.value }))} />
          </div>
          <div>
            <Label>SIP Password {editingId ? '(leave blank to keep)' : ''}</Label>
            <Input
              type="password"
              value={form.sipPassword}
              onChange={(e) => setForm((f) => ({ ...f, sipPassword: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label>SIP Domain</Label>
            <Input value={form.sipDomain} onChange={(e) => setForm((f) => ({ ...f, sipDomain: e.target.value }))} placeholder="sip.soho66.co.uk" />
          </div>
          <div>
            <Label>Assigned user ID</Label>
            <div className="flex gap-2">
              <Input
                value={form.assignedUserId}
                onChange={(e) => setForm((f) => ({ ...f, assignedUserId: e.target.value }))}
                placeholder="User / profile id"
              />
              <Button type="button" variant="outline" onClick={assignToMe}>Me</Button>
            </div>
          </div>
        </div>

        {members.length > 0 && (
          <div>
            <Label>Quick-assign from team</Label>
            <select
              className="mt-1 w-full border rounded-md h-10 px-3 text-sm"
              value=""
              onChange={(e) => {
                const m = members.find((x) => x.userId === e.target.value);
                if (!m) return;
                setForm((f) => ({
                  ...f,
                  assignedUserId: m.userId,
                  label: f.label || `${m.name} Softphone`,
                }));
              }}
            >
              <option value="">Select team member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.userId}>{m.name} ({m.role}) — {m.userId}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {editingId ? 'Update assignment' : 'Assign softphone'}
          </Button>
          {editingId && (
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm());
              }}
            >
              Cancel
            </Button>
          )}
        </div>

        <ul className="text-sm space-y-2 border-t pt-3">
          {staffLines.length === 0 && (
            <li className="text-slate-500">No staff softphones yet.</li>
          )}
          {staffLines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div>
                <p className="font-medium">{line.label}</p>
                <p className="text-slate-600">{line.sipUsername}@{line.sipDomain} · {line.did}</p>
                <p className="text-slate-500">User: {line.assignedUserId || 'unassigned'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{line.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => startEdit(line)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => void remove(line.id)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
