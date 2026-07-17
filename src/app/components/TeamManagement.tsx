import { useState, useContext, useEffect, useCallback } from 'react';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Users, Plus, Trash2, Mail, AtSign, Shield, UserPlus, Landmark, Copy } from 'lucide-react';
import {
  createInvite,
  fetchMembers,
  fetchPendingInvites,
  removeMember,
  updateMember,
  type OrgMember,
  type PendingInvite,
} from '../auth/lib/authApi';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { getActiveOrgId } from '../engine/platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../engine/platform/homeOrg';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { LANG_OPTIONS, normalizeLang } from '../i18n/languages';

type InviteRole = 'manager' | 'staff' | 'builder' | 'recruitment';

const ROLE_BADGES: Record<string, string> = {
  platform_owner: 'bg-indigo-100 text-indigo-700',
  super_admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  staff: 'bg-green-100 text-green-700',
  builder: 'bg-purple-100 text-purple-700',
  recruitment: 'bg-amber-100 text-amber-700',
};

function roleLabel(role: string): string {
  return role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export default function TeamManagement() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, recruitmentAccess, setRecruitmentAccess, accountsAccess, setAccountsAccess } = context;

  // Real org members and pending invites from Supabase — no static data
  const [teamMembers, setTeamMembers] = useState<OrgMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'staff' as InviteRole,
    phone: '',
  });

  const refresh = useCallback(async () => {
    setLoadError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setLoadError('Sign in with a real account to manage your team.');
        setLoading(false);
        return;
      }
      const orgId =
        user.role === 'platform_owner'
          ? getActiveOrgId() || BDIDDIES_HOME_ORG_ID
          : undefined;
      const [members, invites] = await Promise.all([
        fetchMembers(token, orgId),
        fetchPendingInvites(token, orgId).catch(() => [] as PendingInvite[]),
      ]);
      setTeamMembers(members);
      setPendingInvites(invites);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load team members');
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (user.role !== 'super_admin' && user.role !== 'platform_owner') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Only super administrators can manage team members.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteUrl('');

    if (!isSupabaseConfigured()) {
      toast.error('Supabase is required to send invites');
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in with a real account to invite teammates');
        return;
      }
      const orgId =
        user.role === 'platform_owner'
          ? getActiveOrgId() || BDIDDIES_HOME_ORG_ID
          : undefined;
      const result = await createInvite(
        { email: formData.email.trim(), role: formData.role, orgId },
        token,
      );
      setInviteUrl(result.invite.acceptUrl);
      toast.success('Invite created — share the accept link with your teammate');
      setFormData({ name: '', email: '', role: 'staff', phone: '' });
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create invite');
    }
  };

  const handleDelete = async (member: OrgMember) => {
    if (member.id === user.id) {
      toast.error('You cannot remove your own account');
      return;
    }
    if (!confirm(`Remove ${member.name || member.email}? Their account will be deleted and they will no longer be able to sign in.`)) {
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error('Sign in with a real account first');
        return;
      }
      await removeMember(member.id, token);
      toast.success(`${member.name || member.email} removed`);
      setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove member');
    }
  };

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy — select and copy the link manually');
    }
  };

  const getRoleBadge = (role: string) => ROLE_BADGES[role] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Team Management
              </h1>
              <p className="text-amber-100 mt-2 text-lg">Manage your sales team and permissions</p>
            </div>
            <Button
              onClick={() => {
                setShowForm(!showForm);
                setFormData({ name: '', email: '', role: 'staff', phone: '' });
                setInviteUrl('');
              }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8 py-6 text-lg rounded-2xl shadow-lg"
            >
              <Plus className="w-6 h-6 mr-2" />
              Invite Team Member
            </Button>
          </div>
        </div>

        {showForm && (
          <Card className="mb-6 shadow-xl border-2 border-amber-500">
            <CardHeader>
              <CardTitle className="text-2xl">Invite Team Member</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-lg mb-2 block">Full Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Smith"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">Email Address</Label>
                    <Input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@bathroompo.com"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">Phone Number</Label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="07700 900000"
                      className="h-14 text-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-lg mb-2 block">Role</Label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as InviteRole })}
                      className="w-full h-14 px-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="builder">Builder</option>
                      <option value="recruitment">Recruitment</option>
                    </select>
                  </div>
                </div>

                <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  An invite link will be created. Your teammate sets their own username and password
                  when they accept — a real account, ready to sign in.
                </p>

                {inviteUrl && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm break-all">
                    <strong>Invite link:</strong> {inviteUrl}
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-6 text-lg rounded-xl"
                  >
                    Send Invite
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setInviteUrl('');
                      setFormData({ name: '', email: '', role: 'staff', phone: '' });
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-6 text-lg rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Users className="w-7 h-7" />
              Team Members ({teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-gray-500 py-4">Loading team members…</p>}
            {!loading && loadError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                {loadError}
              </div>
            )}
            {!loading && !loadError && teamMembers.length === 0 && (
              <p className="text-gray-500 py-4">
                No team members yet — send an invite to add your first teammate.
              </p>
            )}
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{member.name || member.email}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadge(member.role)}`}>
                          {roleLabel(member.role)}
                        </span>
                        {member.id === user.id && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-200 text-slate-700">
                            You
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span>{member.email}</span>
                        </div>
                        {member.username && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <AtSign className="w-4 h-4" />
                            <span>{member.username}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2 max-w-xs">
                          <Label className="text-xs text-gray-500 shrink-0">Language</Label>
                          <Select
                            value={normalizeLang(member.preferred_language)}
                            onValueChange={(v) => {
                              void (async () => {
                                try {
                                  const token = await getAccessToken();
                                  if (!token) {
                                    toast.error('Sign in with a real account first');
                                    return;
                                  }
                                  const updated = await updateMember(
                                    member.id,
                                    { preferredLanguage: normalizeLang(v) },
                                    token,
                                  );
                                  setTeamMembers((prev) =>
                                    prev.map((m) => (m.id === member.id ? { ...m, ...updated } : m)),
                                  );
                                  toast.success('Language updated');
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Could not update language');
                                }
                              })();
                            }}
                          >
                            <SelectTrigger className="h-8 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LANG_OPTIONS.map((opt) => (
                                <SelectItem key={opt.code} value={opt.code}>
                                  {opt.flag} {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    {member.id !== user.id && member.role !== 'platform_owner' && (
                      <Button
                        onClick={() => void handleDelete(member)}
                        className="bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-xl"
                        title="Remove member (deletes their account)"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {pendingInvites.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <UserPlus className="w-7 h-7" />
                Pending Invites ({pendingInvites.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{invite.email}</p>
                      <p className="text-sm text-gray-600">
                        {roleLabel(invite.role)} · expires {new Date(invite.expiresAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => void copyInviteLink(invite.acceptUrl)}
                      className="shrink-0"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy link
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <UserPlus className="w-7 h-7" />
              Recruitment Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              Grant sales/office staff and managers access to the Recruitment module so they can
              post jobs, track candidates and manage onboarding. Enabled users will see a
              <span className="font-medium"> Recruit</span> option in their sidebar.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-green-900">Sales / Office Staff</h3>
                  <p className="text-sm text-green-800">Allow staff members to access recruitment.</p>
                </div>
                <Switch
                  checked={recruitmentAccess.staff}
                  onCheckedChange={(checked) =>
                    setRecruitmentAccess({ ...recruitmentAccess, staff: checked })
                  }
                  className="scale-150"
                  aria-label="Allow staff to access recruitment"
                />
              </div>
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-blue-900">Managers</h3>
                  <p className="text-sm text-blue-800">Allow managers to access recruitment.</p>
                </div>
                <Switch
                  checked={recruitmentAccess.manager}
                  onCheckedChange={(checked) =>
                    setRecruitmentAccess({ ...recruitmentAccess, manager: checked })
                  }
                  className="scale-150"
                  aria-label="Allow managers to access recruitment"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-xl border-2 border-indigo-500">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <Landmark className="w-7 h-7" />
              Accounts Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              Grant managers and staff access to the Accounts module — bank feed, P&amp;L, job costing,
              and client payment receipts. This section is hidden from customers and builders.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gradient-to-r from-indigo-50 to-indigo-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">Managers</h3>
                  <p className="text-sm text-indigo-800">Allow managers to view accounts and financials.</p>
                </div>
                <Switch
                  checked={accountsAccess.manager}
                  onCheckedChange={(checked) =>
                    setAccountsAccess({ ...accountsAccess, manager: checked })
                  }
                  className="scale-150"
                  aria-label="Allow managers to access accounts"
                />
              </div>
              <div className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-violet-100 p-5 rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-violet-900">Sales / Office Staff</h3>
                  <p className="text-sm text-violet-800">Allow staff to view accounts when granted.</p>
                </div>
                <Switch
                  checked={accountsAccess.staff}
                  onCheckedChange={(checked) =>
                    setAccountsAccess({ ...accountsAccess, staff: checked })
                  }
                  className="scale-150"
                  aria-label="Allow staff to access accounts"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-2xl">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Manager
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    View all team quotes and customers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    Create and edit quotes
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    Manage leads and CRM
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    View sales reports
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-green-900 mb-3 flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Staff
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    View own quotes and customers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Create quotes
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Manage assigned leads
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    Limited reporting access
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
