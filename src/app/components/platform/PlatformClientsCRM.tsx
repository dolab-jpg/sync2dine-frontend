import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import {
  Building2, Mail, Phone, MapPin, Calendar, TrendingUp, Plus, CreditCard,
  Zap, Crown, Rocket, AlertTriangle, PauseCircle,
} from 'lucide-react';
import { AddressMapLink } from '../ui/AddressMapLink';
import { toast } from 'sonner';
import {
  createOrganization,
  createStripeCheckout,
  deleteOrganization,
  fetchOrganizations,
  fetchPlatformStats,
  formatTokens,
  PLAN_LABELS,
  tokenUsageColor,
  updateOrganization,
  type OrgPlan,
  type OrgStatus,
  type PlatformOrganization,
  type PlatformStats,
} from '../../engine/platform/platformApi';
import { setActiveOrgId, buildPublicKioskUrl } from '../../engine/platform/orgContext';
import { useNavigate } from 'react-router';

type ClientTab = 'all' | OrgStatus;

function planIcon(plan: OrgPlan) {
  switch (plan) {
    case 'enterprise': return Crown;
    case 'pro': return Rocket;
    default: return Zap;
  }
}

function statusBadgeVariant(status: OrgStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'past_due' || status === 'suspended') return 'destructive';
  return 'secondary';
}

export default function PlatformClientsCRM() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<PlatformOrganization[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClientTab>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<PlatformOrganization | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [onceCreds, setOnceCreds] = useState<{
    orgName: string;
    mainEmail: string;
    orgId: string;
    kioskUrl: string;
  } | null>(null);

  const [form, setForm] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    plan: 'starter' as OrgPlan,
    openaiApiKey: '',
    monthlyTokenCap: '',
    notes: '',
    adminPassword: '',
    createStripe: false,
    sendInvite: true,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [orgs, s] = await Promise.all([fetchOrganizations(), fetchPlatformStats()]);
      setClients(orgs);
      setStats(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attentionItems = useMemo(() => {
    const now = Date.now();
    return clients.filter(c => {
      if (c.status === 'past_due' || c.status === 'suspended') return true;
      if (c.tokensUsedThisMonth >= c.monthlyTokenCap * 0.9) return true;
      if (c.trialEndsAt && new Date(c.trialEndsAt).getTime() - now < 3 * 86400000 && c.status === 'trial') return true;
      return false;
    });
  }, [clients]);

  const filtered = useMemo(() => clients.filter(c => {
    const matchesTab = activeTab === 'all' || c.status === activeTab;
    const matchesPlan = filterPlan === 'all' || c.plan === filterPlan;
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q
      || c.name.toLowerCase().includes(q)
      || c.contactEmail.toLowerCase().includes(q)
      || c.contactPhone.includes(q);
    return matchesTab && matchesPlan && matchesSearch;
  }), [clients, activeTab, filterPlan, searchTerm]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.contactEmail.trim()) {
      toast.error('Company name and contact email are required');
      return;
    }
    if (!form.adminPassword.trim() || form.adminPassword.trim().length < 8) {
      toast.error('Main user password is required (min 8 characters)');
      return;
    }
    setCreating(true);
    try {
      const result = await createOrganization({
        name: form.name,
        contactName: form.contactName || form.name,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        address: form.address,
        plan: form.plan,
        status: 'trial',
        openaiApiKey: form.openaiApiKey,
        monthlyTokenCap: form.monthlyTokenCap ? Number(form.monthlyTokenCap) : undefined,
        notes: form.notes,
        adminPassword: form.adminPassword,
        createStripeSubscription: form.createStripe,
        sendInviteEmail: form.sendInvite,
      });
      const org = result.organization;
      const mainEmail = result.mainUserEmail || form.contactEmail.trim().toLowerCase();
      toast.success(
        `${org.name} ready — main Super Admin login: ${mainEmail}`,
        { duration: 10_000 },
      );
      setOnceCreds({
        orgName: org.name,
        mainEmail,
        orgId: org.id,
        kioskUrl: result.kioskUrl || buildPublicKioskUrl(org.id),
      });
      if (result.stripeCheckoutUrl) {
        window.open(result.stripeCheckoutUrl, '_blank');
      } else if (result.stripeWarning) {
        toast.warning(`Client created, but Stripe needs attention: ${result.stripeWarning}`, { duration: 10_000 });
      }
      setIsAddOpen(false);
      setForm({
        name: '', contactName: '', contactEmail: '', contactPhone: '', address: '',
        plan: 'starter', openaiApiKey: '', monthlyTokenCap: '', notes: '',
        adminPassword: '', createStripe: false, sendInvite: true,
      });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setCreating(false);
    }
  };

  const handleSuspend = async (org: PlatformOrganization) => {
    try {
      await updateOrganization(org.id, { status: org.status === 'suspended' ? 'active' : 'suspended' });
      toast.success(org.status === 'suspended' ? 'Client reactivated' : 'Client suspended');
      setSelected(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleStripeCheckout = async (orgId: string) => {
    try {
      const url = await createStripeCheckout(orgId);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stripe checkout failed');
    }
  };

  const handleActAs = (org: PlatformOrganization) => {
    setActiveOrgId(org.id);
    toast.success(`Acting as ${org.name} — full CRM scoped to this company`);
    navigate('/');
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-indigo-950 to-slate-900 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-violet-300 to-indigo-200 bg-clip-text text-transparent">
                  Platform Clients
                </h1>
                <p className="text-indigo-100 mt-1 text-sm sm:text-lg">Manage companies you sell Builder Diddies to</p>
              </div>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-violet-500 to-indigo-600 min-h-11">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Provision new client</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label>Company name</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Contact name</Label>
                    <Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Contact email</Label>
                    <Input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v as OrgPlan })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PLAN_LABELS) as OrgPlan[]).map(p => (
                          <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>OpenAI API key (for this client)</Label>
                    <Input type="password" value={form.openaiApiKey} onChange={e => setForm({ ...form, openaiApiKey: e.target.value })} placeholder="sk-..." />
                  </div>
                  <div>
                    <Label>Monthly token cap (optional)</Label>
                    <Input value={form.monthlyTokenCap} onChange={e => setForm({ ...form, monthlyTokenCap: e.target.value })} placeholder="Auto from plan" />
                  </div>
                  <div>
                    <Label>Admin password (optional)</Label>
                    <Input type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.createStripe} onChange={e => setForm({ ...form, createStripe: e.target.checked })} />
                    Create Stripe subscription
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.sendInvite} onChange={e => setForm({ ...form, sendInvite: e.target.checked })} />
                    Send invite email
                  </label>
                </div>
                <Button className="w-full mt-4" disabled={creating} onClick={() => void handleCreate()}>
                  {creating ? 'Creating…' : 'Create client + main Super Admin'}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {attentionItems.length > 0 && (
          <Card className="shadow-lg rounded-2xl border-amber-200 bg-amber-50 mb-6">
            <CardContent className="p-4">
              <p className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {attentionItems.length} client{attentionItems.length > 1 ? 's' : ''} need attention
              </p>
              <div className="flex flex-wrap gap-2">
                {attentionItems.slice(0, 8).map(c => (
                  <Button key={c.id} variant="outline" size="sm" className="bg-white" onClick={() => setSelected(c)}>
                    {c.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Clients', value: stats?.total ?? '—', icon: Building2 },
            { label: 'Active', value: stats?.active ?? '—', icon: TrendingUp, tint: 'green' },
            { label: 'Trialing', value: stats?.trialing ?? '—', icon: Rocket, tint: 'blue' },
            { label: 'MRR', value: stats ? `£${stats.mrr}` : '—', icon: CreditCard, tint: 'violet' },
            { label: 'Tokens (month)', value: stats ? formatTokens(stats.tokensThisMonth) : '—', icon: Zap, tint: 'amber' },
          ].map(({ label, value, icon: Icon, tint }) => (
            <Card key={label} className={`shadow-lg rounded-2xl border-0 ${tint ? `bg-gradient-to-br from-${tint}-50 to-${tint}-100` : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">{label}</p>
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-3xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-xl rounded-3xl border-0 mb-6">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ClientTab)}>
              <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full mb-4 bg-slate-100 p-1.5 rounded-2xl h-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="trial">Trial</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="past_due">Past Due</TabsTrigger>
                <TabsTrigger value="suspended" className="col-span-2 sm:col-span-1">Suspended</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 min-h-11"
              />
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-full sm:w-64 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {(Object.keys(PLAN_LABELS) as OrgPlan[]).map(p => (
                    <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-center text-gray-500 py-12">Loading clients...</p>
        ) : filtered.length === 0 ? (
          <Card className="shadow-lg rounded-2xl">
            <CardContent className="text-center py-12">
              <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No clients match your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(client => {
              const PlanIcon = planIcon(client.plan);
              const pct = client.monthlyTokenCap > 0
                ? Math.round((client.tokensUsedThisMonth / client.monthlyTokenCap) * 100)
                : 0;
              return (
                <Card
                  key={client.id}
                  className="shadow-lg rounded-2xl border-0 hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => setSelected(client)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                          <PlanIcon className="w-5 h-5 text-indigo-600" />
                          <h3 className="text-xl sm:text-2xl font-bold truncate">{client.name}</h3>
                          <div
                            className={`w-3 h-3 rounded-full ${tokenUsageColor(client.tokensUsedThisMonth, client.monthlyTokenCap)}`}
                            title={`Tokens: ${pct}% of cap`}
                          />
                          <Badge variant={statusBadgeVariant(client.status)}>{client.status.replace('_', ' ').toUpperCase()}</Badge>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /><span>{client.contactEmail}</span></div>
                          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{client.contactPhone || '—'}</span></div>
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /><AddressMapLink address={client.address} className="truncate" /></div>
                          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /><span>{new Date(client.createdAt).toLocaleDateString('en-GB')}</span></div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{client.planLabel}</Badge>
                          {client.subscriptionStatus && (
                            <Badge variant="outline" className="bg-violet-50">{client.subscriptionStatus}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <div className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white px-4 py-2 rounded-full font-bold mb-2">
                          {formatTokens(client.tokensUsedThisMonth)} / {formatTokens(client.monthlyTokenCap)} tokens
                        </div>
                        <div className="text-sm text-gray-600">£{client.monthlyPriceGbp}/mo</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selected.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="font-bold">Plan</Label><p>{selected.planLabel}</p></div>
                  <div><Label className="font-bold">Status</Label><p className="capitalize">{selected.status.replace('_', ' ')}</p></div>
                  <div><Label className="font-bold">Tokens this month</Label><p>{formatTokens(selected.tokensUsedThisMonth)} / {formatTokens(selected.monthlyTokenCap)}</p></div>
                  <div><Label className="font-bold">Subscription</Label><p>{selected.subscriptionStatus ?? 'Not linked'}</p></div>
                </div>
                {selected.notes && (
                  <div><Label className="font-bold">Notes</Label><p className="bg-gray-50 p-3 rounded-lg">{selected.notes}</p></div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button className="flex-1 min-w-[120px]" onClick={() => handleActAs(selected)}>Act as client</Button>
                  <Button variant="outline" className="flex-1 min-w-[120px]" onClick={() => void handleStripeCheckout(selected.id)}>
                    <CreditCard className="w-4 h-4 mr-1" /> Stripe billing
                  </Button>
                  <Button variant="outline" className="flex-1 min-w-[120px]" onClick={() => void handleSuspend(selected)}>
                    <PauseCircle className="w-4 h-4 mr-1" />
                    {selected.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 min-w-[120px]"
                    onClick={async () => {
                      if (!confirm(`Delete ${selected.name}?`)) return;
                      await deleteOrganization(selected.id);
                      setSelected(null);
                      await reload();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Credentials after provisioning — staff login + public kiosk URL */}
      <Dialog open={Boolean(onceCreds)} onOpenChange={(open) => { if (!open) setOnceCreds(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access for {onceCreds?.orgName}</DialogTitle>
          </DialogHeader>
          {onceCreds && (
            <div className="space-y-4">
              <div>
                <Label className="font-bold">Staff login (Super Admin)</Label>
                <p className="rounded-lg bg-gray-50 p-3 font-mono text-sm">{onceCreds.mainEmail}</p>
                <p className="mt-1 text-xs text-gray-500">Password: the one you set on the form. Same /login as Sync2Dine staff.</p>
              </div>
              <div>
                <Label className="font-bold">Front kiosk (counter tablet — no login)</Label>
                <p className="rounded-lg bg-gray-50 p-3 font-mono text-sm break-all">{onceCreds.kioskUrl}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Open this URL on the counter tablet. Diners order without an account.
                </p>
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(onceCreds.kioskUrl);
                    toast.success('Kiosk URL copied');
                  }}
                >
                  Copy kiosk URL
                </Button>
              </div>
              <Button className="w-full" onClick={() => setOnceCreds(null)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
