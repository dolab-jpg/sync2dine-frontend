import { useState, useContext, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AppContext, Customer } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Facebook, Instagram, Search as GoogleIcon, Phone, PhoneCall, Mail, User, MapPin, Calendar, TrendingUp, Plus, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AddressMapLink } from './ui/AddressMapLink';
import { getDueFollowUps, isCallQueueLead, isLeadCustomer } from '../engine/leads/leadService';
import {
  AIM_LABELS,
  LEAD_AIMS,
  createLeadActivity,
  normalizeLeadActivities,
  type LeadAim,
} from '../engine/leads/leadActivity';
import {
  CALL_QUEUE_STATUS_LABELS,
  DISPOSITION_LABELS,
  type CallQueueStatus,
  type LeadCallDisposition,
} from '../engine/leads/leadCallDisposition';
import { findPlanningApplicationsByCustomerId } from '../engine/planning/planningStore';
import { stageLabel } from '../engine/planning/types';
import { CallThisPersonDialog } from './crm/CallThisPersonDialog';
import { ScrapeLeadImportDialog } from './crm/ScrapeLeadImportDialog';
import { SalesCsvDialPanel } from './crm/SalesCsvDialPanel';

type Lead = Customer & {
  source: NonNullable<Customer['source']>;
  leadScore: number;
  tags: string[];
};

type LeadSource = NonNullable<Customer['source']>;

function toLead(c: Customer): Lead | null {
  if (!isLeadCustomer(c)) return null;
  return {
    ...c,
    source: c.source ?? 'website',
    leadScore: c.leadScore ?? 50,
    tags: c.tags ?? [],
    whatsappOptIn: c.whatsappOptIn ?? false,
    preferredChannel: c.preferredChannel ?? 'email',
    preferredLanguage: c.preferredLanguage ?? 'en',
  };
}

function inferTradeFromTags(tags: string[]): import('../config/types').TradeId {
  const map: Record<string, import('../config/types').TradeId> = {
    kitchen: 'kitchen', wetroom: 'bathroom', microcement: 'bathroom', rewire: 'electrical',
    loft: 'loft', roofing: 'roofing', extension: 'extensions',
  };
  for (const tag of tags) {
    const t = map[tag.toLowerCase()];
    if (t) return t;
  }
  return 'bathroom';
}

const EMPTY_LEAD_FORM = {
  name: '',
  phone: '',
  email: '',
  address: '',
  source: 'website' as LeadSource,
  tags: '',
  notes: '',
  nextFollowUp: '',
  budget: '',
  timeline: '',
};

export default function ComprehensiveCRM() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  if (!context) return null;

  const { user, customers, updateCustomer, addCustomer } = context;
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'platform_owner';

  const leads = useMemo(
    () => customers.map(toLead).filter((l): l is Lead => l !== null),
    [customers],
  );

  const dueFollowUps = useMemo(() => getDueFollowUps(customers), [customers]);

  const pendingCallbacks = useMemo(() => {
    return leads
      .filter((l) => {
        const acts = normalizeLeadActivities(l.activities);
        const hasOpenCb = acts.some((a) => a.type === 'callback' && !a.outcome);
        const due = l.nextFollowUp && new Date(l.nextFollowUp).getTime() <= Date.now() + 7 * 86400000;
        return hasOpenCb || Boolean(due && l.phone);
      })
      .sort((a, b) => String(a.nextFollowUp ?? '').localeCompare(String(b.nextFollowUp ?? '')));
  }, [leads]);

  const [activeTab, setActiveTab] = useState('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM);
  const [savingLead, setSavingLead] = useState(false);
  const [noteDetail, setNoteDetail] = useState('');
  const [noteAim, setNoteAim] = useState<string>('other');
  const [callThisPersonOpen, setCallThisPersonOpen] = useState(false);
  const [defaultBrief, setDefaultBrief] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/agent/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data?.defaultOutboundBrief) setDefaultBrief(String(data.defaultOutboundBrief));
      })
      .catch(() => {});
  }, []);

  const customerPlanningApps = useMemo(
    () => (selectedLead ? findPlanningApplicationsByCustomerId(selectedLead.id) : []),
    [selectedLead?.id],
  );

  const selectedActivities = useMemo(
    () => (selectedLead ? normalizeLeadActivities(selectedLead.activities) : []),
    [selectedLead],
  );

  // Deep-link from lead inbox / Call Centre: /crm?lead=ID or /crm?customerId=ID or /crm?tab=queue
  useEffect(() => {
    const tab = searchParams.get('tab');
    const leadId = searchParams.get('lead') || searchParams.get('customerId');
    if (tab === 'queue' || tab === 'lead' || tab === 'quoted' || tab === 'won' || tab === 'lost' || tab === 'all') {
      setActiveTab(tab);
    }
    if (leadId) {
      const found = customers.find((c) => c.id === leadId);
      const lead = found ? toLead(found) : null;
      if (lead) setSelectedLead(lead);
    }
    if (tab || leadId) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, customers, setSearchParams]);

  // Keep selected lead in sync with store updates
  useEffect(() => {
    if (!selectedLead) return;
    const fresh = customers.find((c) => c.id === selectedLead.id);
    const lead = fresh ? toLead(fresh) : null;
    if (lead) setSelectedLead(lead);
  }, [customers, selectedLead?.id]);

  const handleScheduleVisit = () => {
    if (!selectedLead) return;
    updateCustomer(selectedLead.id, { lastContact: new Date().toISOString() });
    const full = customers.find((c) => c.id === selectedLead.id);
    navigate('/site-survey', {
      state: {
        customer: {
          id: selectedLead.id,
          name: selectedLead.name,
          email: selectedLead.email,
          phone: selectedLead.phone,
          address: selectedLead.address,
          interestedTrades: full?.interestedTrades ?? (selectedLead.tradeId ? [selectedLead.tradeId] : []),
        },
      },
    });
    setSelectedLead(null);
  };

  const handleStartQuote = () => {
    if (!selectedLead) return;
    const trade = selectedLead.tradeId ?? inferTradeFromTags(selectedLead.tags);
    updateCustomer(selectedLead.id, { lastContact: new Date().toISOString() });
    navigate(`/quote/${trade}/${selectedLead.id}`);
    setSelectedLead(null);
  };

  const handleMarkLost = () => {
    if (!selectedLead) return;
    const activity = createLeadActivity({
      type: 'status_change',
      detail: 'Marked as lost',
      createdBy: user.id || 'staff',
    });
    const prev = normalizeLeadActivities(selectedLead.activities);
    updateCustomer(selectedLead.id, {
      status: 'lost',
      lastContact: new Date().toISOString(),
      activities: [activity, ...prev].slice(0, 50),
    });
    toast.info(`${selectedLead.name} marked as lost`);
    setActiveTab('lost');
    setSelectedLead(null);
  };

  const handleLogFollowUp = () => {
    if (!selectedLead) return;
    const next = new Date();
    next.setDate(next.getDate() + 3);
    updateCustomer(selectedLead.id, {
      lastContact: new Date().toISOString(),
      nextFollowUp: next.toISOString(),
    });
    toast.success('Follow-up logged — next reminder in 3 days');
  };

  const handleCreateLead = () => {
    const name = leadForm.name.trim();
    const phone = leadForm.phone.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    if (!phone && !leadForm.email.trim()) {
      toast.error('Phone or email is required');
      return;
    }
    setSavingLead(true);
    try {
      const tags = leadForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const initialNotes = leadForm.notes.trim();
      const activities = initialNotes
        ? [createLeadActivity({ type: 'note', detail: initialNotes, aim: 'discovery', createdBy: user.id || 'staff' })]
        : [];
      const created = addCustomer({
        name,
        phone,
        email: leadForm.email.trim(),
        address: leadForm.address.trim(),
        status: 'lead',
        notes: initialNotes,
        photos: [],
        whatsappOptIn: false,
        preferredChannel: 'email',
        source: leadForm.source,
        tags,
        callQueueStatus: 'not_called',
        callAttemptCount: 0,
        leadScore: 50,
        budget: leadForm.budget.trim() || undefined,
        timeline: leadForm.timeline.trim() || undefined,
        nextFollowUp: leadForm.nextFollowUp
          ? new Date(leadForm.nextFollowUp).toISOString()
          : undefined,
        lastContact: new Date().toISOString(),
        activities,
      });
      toast.success(`Lead created: ${created.name}`);
      setIsAddLeadOpen(false);
      setLeadForm(EMPTY_LEAD_FORM);
      const lead = toLead(created);
      if (lead) {
        setSelectedLead(lead);
        setActiveTab('lead');
      }
    } finally {
      setSavingLead(false);
    }
  };

  const handleAddNote = () => {
    if (!selectedLead) return;
    const detail = noteDetail.trim();
    if (!detail) {
      toast.error('Enter conversation / note details');
      return;
    }
    const activity = createLeadActivity({
      type: 'note',
      detail,
      aim: noteAim as LeadAim,
      createdBy: user.id || user.name || 'staff',
    });
    const prev = normalizeLeadActivities(selectedLead.activities);
    const stamp = `[Note ${activity.createdAt.slice(0, 16).replace('T', ' ')}] ${detail}`;
    const prevNotes = selectedLead.notes?.trim() ?? '';
    updateCustomer(selectedLead.id, {
      activities: [activity, ...prev].slice(0, 50),
      notes: prevNotes ? `${stamp}\n${prevNotes}` : stamp,
      lastContact: new Date().toISOString(),
    });
    setNoteDetail('');
    toast.success('Note saved — Cynthia can see this on the next call');
  };

  const handleCallWithAim = (aim: string, leadOverride?: Lead) => {
    const lead = leadOverride ?? selectedLead;
    if (!lead?.phone) {
      toast.error('Lead has no phone number');
      return;
    }
    setSelectedLead(lead);
    setCallThisPersonOpen(true);
  };

  const handleCallThisPersonStarted = (payload: { callId?: string; brief: string }) => {
    if (!selectedLead) return;
    const activity = createLeadActivity({
      type: 'callback',
      detail: payload.brief,
      aim: 'callback',
      callSessionId: payload.callId,
      createdBy: user.id || 'staff',
    });
    const prev = normalizeLeadActivities(selectedLead.activities);
    updateCustomer(selectedLead.id, {
      activities: [activity, ...prev].slice(0, 50),
      lastContact: new Date().toISOString(),
      callQueueStatus: 'dialling',
      lastCallId: payload.callId,
    });
  };

  const handleImportScrapedLeads = async (incoming: Customer[]) => {
    for (const c of incoming) {
      const { id: _id, createdAt: _createdAt, ...rest } = c;
      addCustomer({
        ...rest,
        whatsappOptIn: rest.whatsappOptIn ?? false,
        preferredChannel: rest.preferredChannel ?? 'phone',
        preferredLanguage: rest.preferredLanguage ?? 'en',
        photos: rest.photos ?? [],
      });
    }
    setActiveTab('queue');
  };

  const handleMarkCallbackDone = (lead: Lead) => {
    const prev = normalizeLeadActivities(lead.activities);
    const updated = prev.map((a) =>
      a.type === 'callback' && !a.outcome ? { ...a, outcome: 'completed' } : a,
    );
    updateCustomer(lead.id, {
      activities: updated,
      lastContact: new Date().toISOString(),
      nextFollowUp: undefined,
    });
    toast.success(`Callback cleared for ${lead.name}`);
  };

  const [metaSettings, setMetaSettings] = useState({
    accessToken: '',
    pageId: '',
    formId: '',
    webhookUrl: '',
    autoSync: true,
  });

  const getSourceIcon = (source: Lead['source']) => {
    switch (source) {
      case 'facebook': return <Facebook className="w-5 h-5 text-blue-600" />;
      case 'instagram': return <Instagram className="w-5 h-5 text-pink-600" />;
      case 'google': return <GoogleIcon className="w-5 h-5 text-red-600" />;
      case 'phone': return <Phone className="w-5 h-5 text-green-600" />;
      case 'website': return <ExternalLink className="w-5 h-5 text-purple-600" />;
      case 'referral': return <User className="w-5 h-5 text-amber-600" />;
      default: return <Mail className="w-5 h-5 text-gray-600" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const filteredLeads = leads.filter((lead) => {
    if (activeTab === 'queue') {
      if (!isCallQueueLead(lead)) return false;
      const qs = lead.callQueueStatus ?? 'not_called';
      if (queueStatusFilter !== 'all' && qs !== queueStatusFilter) return false;
    } else {
      const matchesStatus = activeTab === 'all' || lead.status === activeTab;
      if (!matchesStatus) return false;
    }
    const matchesSource = filterSource === 'all' || lead.source === filterSource;
    const matchesSearch = String(lead.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      || String(lead.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      || String(lead.phone ?? '').includes(searchTerm)
      || String(lead.leadBatchId ?? '').includes(searchTerm);
    return matchesSource && matchesSearch;
  });

  const queueStats = useMemo(() => {
    const queue = leads.filter(isCallQueueLead);
    return {
      total: queue.length,
      notCalled: queue.filter((l) => (l.callQueueStatus ?? 'not_called') === 'not_called').length,
      dialling: queue.filter((l) => l.callQueueStatus === 'dialling' || l.callQueueStatus === 'queued').length,
      called: queue.filter((l) => l.callQueueStatus === 'called').length,
      needsRetry: queue.filter((l) => l.callQueueStatus === 'needs_retry').length,
    };
  }, [leads]);

  const stats = {
    total: leads.length,
    facebook: leads.filter((l) => l.source === 'facebook').length,
    instagram: leads.filter((l) => l.source === 'instagram').length,
    google: leads.filter((l) => l.source === 'google').length,
    conversionRate: leads.length ? ((leads.filter((l) => l.status === 'won').length / leads.length) * 100).toFixed(1) : '0',
    followUpsDue: dueFollowUps.length,
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-slate-900 to-slate-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                  Lead Management CRM
                </h1>
                <p className="text-amber-100 mt-1 text-sm sm:text-lg">Track leads, conversation notes & callbacks</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <ScrapeLeadImportDialog onImport={handleImportScrapedLeads} />
              <SalesCsvDialPanel onImport={handleImportScrapedLeads} />
              {isSuperAdmin && (
              <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg py-4 sm:py-6 px-6 sm:px-8 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 min-h-11">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Add New Lead</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-semibold">Name *</Label>
                        <Input
                          value={leadForm.name}
                          onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                          placeholder="Contact or company name"
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold">Phone *</Label>
                        <Input
                          value={leadForm.phone}
                          onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                          placeholder="+44…"
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold">Email</Label>
                        <Input
                          type="email"
                          value={leadForm.email}
                          onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                          placeholder="name@company.com"
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold">Source</Label>
                        <Select
                          value={leadForm.source}
                          onValueChange={(v) => setLeadForm({ ...leadForm, source: v as LeadSource })}
                        >
                          <SelectTrigger className="mt-1 min-h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="website">Website</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="referral">Referral</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="walk-in">Walk-in</SelectItem>
                            <SelectItem value="purchased">Purchased</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="font-semibold">Address</Label>
                      <Input
                        value={leadForm.address}
                        onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                        placeholder="Site or company address"
                        className="mt-1 min-h-11"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="font-semibold">Tags (comma-separated)</Label>
                        <Input
                          value={leadForm.tags}
                          onChange={(e) => setLeadForm({ ...leadForm, tags: e.target.value })}
                          placeholder="saas, builder-diddies"
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold">Next follow-up</Label>
                        <Input
                          type="date"
                          value={leadForm.nextFollowUp}
                          onChange={(e) => setLeadForm({ ...leadForm, nextFollowUp: e.target.value })}
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold">Budget</Label>
                        <Input
                          value={leadForm.budget}
                          onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })}
                          placeholder="e.g. £2k–5k / month"
                          className="mt-1 min-h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold">Timeline</Label>
                        <Input
                          value={leadForm.timeline}
                          onChange={(e) => setLeadForm({ ...leadForm, timeline: e.target.value })}
                          placeholder="e.g. This month"
                          className="mt-1 min-h-11"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="font-semibold">Initial conversation notes</Label>
                      <Textarea
                        value={leadForm.notes}
                        onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                        placeholder="What was discussed, aims, context Cynthia should know…"
                        className="mt-1 min-h-[100px]"
                      />
                    </div>
                    <Button
                      size="lg"
                      className="w-full min-h-11 bg-gradient-to-r from-amber-500 to-amber-600"
                      disabled={savingLead}
                      onClick={handleCreateLead}
                    >
                      {savingLead ? 'Saving…' : 'Create Lead'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* Callbacks walkthrough */}
        {pendingCallbacks.length > 0 && (
          <Card className="shadow-lg rounded-2xl border-indigo-200 bg-indigo-50 mb-6">
            <CardContent className="p-4">
              <p className="font-semibold text-indigo-900 mb-2">
                {pendingCallbacks.length} callback{pendingCallbacks.length > 1 ? 's' : ''} / follow-ups to work
              </p>
              <div className="space-y-2">
                {pendingCallbacks.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex flex-wrap gap-2 items-center bg-white/80 rounded-xl p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lead = toLead(c);
                        if (lead) setSelectedLead(lead);
                      }}
                    >
                      {c.name}
                    </Button>
                    <span className="text-xs text-indigo-700">
                      {c.nextFollowUp
                        ? `Due ${new Date(c.nextFollowUp).toLocaleString('en-GB')}`
                        : 'Callback queued'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleCallWithAim('callback', c)}
                      disabled={!c.phone}
                    >
                      <PhoneCall className="w-3 h-3 mr-1" />
                      Call next
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleMarkCallbackDone(c)}
                    >
                      Mark done
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {dueFollowUps.length > 0 && pendingCallbacks.length === 0 && (
          <Card className="shadow-lg rounded-2xl border-amber-200 bg-amber-50 mb-6">
            <CardContent className="p-4">
              <p className="font-semibold text-amber-900 mb-2">{dueFollowUps.length} follow-up{dueFollowUps.length > 1 ? 's' : ''} due</p>
              <div className="flex flex-wrap gap-2">
                {dueFollowUps.slice(0, 6).map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    size="sm"
                    className="bg-white"
                    onClick={() => {
                      const lead = toLead(c);
                      if (lead) setSelectedLead(lead);
                    }}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="shadow-lg rounded-2xl border-0">
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-2">Total Leads</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <p className="text-sm text-blue-900 mb-2">Facebook</p>
              <p className="text-3xl font-bold text-blue-900">{stats.facebook}</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-pink-50 to-pink-100">
            <CardContent className="p-6">
              <p className="text-sm text-pink-900 mb-2">Instagram</p>
              <p className="text-3xl font-bold text-pink-900">{stats.instagram}</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-6">
              <p className="text-sm text-red-900 mb-2">Google Ads</p>
              <p className="text-3xl font-bold text-red-900">{stats.google}</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <p className="text-sm text-green-900 mb-2">Conversion</p>
              <p className="text-3xl font-bold text-green-900">{stats.conversionRate}%</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xl rounded-3xl border-0 mb-6">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 sm:grid-cols-6 w-full mb-4 sm:mb-6 bg-slate-100 p-1.5 sm:p-2 rounded-2xl h-auto">
                <TabsTrigger value="all" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">All</TabsTrigger>
                <TabsTrigger value="queue" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Call Queue</TabsTrigger>
                <TabsTrigger value="lead" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Leads</TabsTrigger>
                <TabsTrigger value="quoted" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Quoted</TabsTrigger>
                <TabsTrigger value="won" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Won</TabsTrigger>
                <TabsTrigger value="lost" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Lost</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === 'queue' && (
              <div className="flex flex-wrap gap-2 mb-4 text-sm">
                <Badge variant="secondary">Queue: {queueStats.total}</Badge>
                <Badge variant="outline">Not called: {queueStats.notCalled}</Badge>
                <Badge variant="outline">Dialling: {queueStats.dialling}</Badge>
                <Badge variant="outline">Needs retry: {queueStats.needsRetry}</Badge>
                <Badge variant="outline">Called: {queueStats.called}</Badge>
                <Select value={queueStatusFilter} onValueChange={setQueueStatusFilter}>
                  <SelectTrigger className="w-44 min-h-9">
                    <SelectValue placeholder="Call status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All call statuses</SelectItem>
                    {(Object.keys(CALL_QUEUE_STATUS_LABELS) as CallQueueStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{CALL_QUEUE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-base sm:text-lg p-4 sm:p-6 border-2 rounded-2xl min-h-11"
              />
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-full sm:w-64 text-base sm:text-lg p-4 sm:p-6 border-2 rounded-2xl min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="purchased">Purchased / scraped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredLeads.length === 0 ? (
            <Card className="shadow-lg rounded-2xl border-0">
              <CardContent className="text-center py-12">
                <TrendingUp className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No leads match your filters</p>
                <p className="text-sm text-gray-400 mt-1">Try Add Lead, or clear filters</p>
                <Button
                  variant="outline"
                  className="mt-4 min-h-11"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterSource('all');
                    setActiveTab('all');
                  }}
                >
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : filteredLeads.map((lead) => (
            <Card key={lead.id} className="shadow-lg rounded-2xl border-0 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => setSelectedLead(lead)}>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      {getSourceIcon(lead.source)}
                      <h3 className="text-xl sm:text-2xl font-bold truncate">{lead.name}</h3>
                      <div className={`w-3 h-3 rounded-full ${getScoreColor(lead.leadScore)}`} title={`Lead Score: ${lead.leadScore}`} />
                      <Badge variant={lead.status === 'won' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                        {lead.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{lead.email || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{lead.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <AddressMapLink address={lead.address} className="truncate" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{new Date(lead.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lead.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                      {(activeTab === 'queue' || lead.callQueueStatus) && (
                        <Badge variant="outline" className="text-xs">
                          {CALL_QUEUE_STATUS_LABELS[(lead.callQueueStatus ?? 'not_called') as CallQueueStatus]
                            ?? lead.callQueueStatus
                            ?? 'Not called'}
                        </Badge>
                      )}
                      {lead.lastCallDisposition && (
                        <Badge className="text-xs bg-slate-800">
                          {DISPOSITION_LABELS[lead.lastCallDisposition as LeadCallDisposition]
                            ?? lead.lastCallDisposition}
                        </Badge>
                      )}
                    </div>
                    {lead.lastCallSummary && (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                        Last call: {lead.lastCallSummary}
                      </p>
                    )}
                    {lead.notes && (
                      <p className="mt-3 text-gray-700 text-sm line-clamp-2">{lead.notes}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right sm:ml-6 shrink-0">
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white px-4 py-2 rounded-full font-bold mb-2">
                      Score: {lead.leadScore}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isSuperAdmin && (
          <Card className="shadow-xl rounded-3xl border-0 mt-6">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-3xl">
              <CardTitle className="text-2xl">Meta Lead Integration</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-sm text-slate-600">
                Meta lead sync is not connected yet — settings below are for future setup only.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-lg font-bold mb-2 block">Access Token</Label>
                  <Input
                    type="password"
                    value={metaSettings.accessToken}
                    onChange={(e) => setMetaSettings({ ...metaSettings, accessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxxxxxx"
                    className="text-base p-4"
                  />
                </div>
                <div>
                  <Label className="text-lg font-bold mb-2 block">Page ID</Label>
                  <Input
                    value={metaSettings.pageId}
                    onChange={(e) => setMetaSettings({ ...metaSettings, pageId: e.target.value })}
                    placeholder="123456789012345"
                    className="text-base p-4"
                  />
                </div>
              </div>
              <Button
                onClick={() => toast.message('Meta integration is not wired yet — use Add Lead for now.')}
                size="lg"
                className="w-full text-xl py-8 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700"
              >
                Save Meta Integration
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="text-3xl">{selectedLead.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-bold">Source</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getSourceIcon(selectedLead.source)}
                      <span className="capitalize">{selectedLead.source}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="font-bold">Lead Score</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-4 h-4 rounded-full ${getScoreColor(selectedLead.leadScore)}`} />
                      <span className="text-2xl font-bold">{selectedLead.leadScore}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="font-bold">Phone</Label>
                    <p className="mt-1">{selectedLead.phone || '—'}</p>
                  </div>
                  <div>
                    <Label className="font-bold">Email</Label>
                    <p className="mt-1">{selectedLead.email || '—'}</p>
                  </div>
                  <div>
                    <Label className="font-bold">Call status</Label>
                    <p className="mt-1">
                      {CALL_QUEUE_STATUS_LABELS[(selectedLead.callQueueStatus ?? 'not_called') as CallQueueStatus]
                        ?? selectedLead.callQueueStatus
                        ?? 'Not called'}
                      {selectedLead.callAttemptCount ? ` · ${selectedLead.callAttemptCount} attempt(s)` : ''}
                    </p>
                  </div>
                  <div>
                    <Label className="font-bold">Last disposition</Label>
                    <p className="mt-1">
                      {selectedLead.lastCallDisposition
                        ? (DISPOSITION_LABELS[selectedLead.lastCallDisposition as LeadCallDisposition]
                          ?? selectedLead.lastCallDisposition)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <Label className="font-bold">Budget</Label>
                    <p className="mt-1">{selectedLead.budget || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="font-bold">Timeline</Label>
                    <p className="mt-1">{selectedLead.timeline || 'Not specified'}</p>
                  </div>
                </div>

                {(selectedLead.lastCallSummary || selectedLead.lastCallAt || selectedLead.lastCallId) && (
                  <div className="border rounded-2xl p-4 bg-amber-50 space-y-2">
                    <Label className="font-bold text-lg">Call details</Label>
                    {selectedLead.lastCallAt && (
                      <p className="text-sm text-slate-600">
                        {new Date(selectedLead.lastCallAt).toLocaleString('en-GB')}
                      </p>
                    )}
                    {selectedLead.lastCallSummary && (
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{selectedLead.lastCallSummary}</p>
                    )}
                    {selectedLead.lastCallId && (
                      <Button
                        variant="link"
                        className="px-0 h-auto text-sm"
                        onClick={() => {
                          const id = selectedLead.lastCallId;
                          setSelectedLead(null);
                          navigate(`/calls?callId=${id}`);
                        }}
                      >
                        Open call transcript
                      </Button>
                    )}
                  </div>
                )}

                {/* Conversation notes */}
                <div className="border rounded-2xl p-4 bg-slate-50 space-y-4">
                  <Label className="font-bold text-lg">Conversation notes</Label>
                  <p className="text-xs text-slate-500">
                    Cynthia reads these notes when speaking to this lead. Add aims and detail after every touch.
                  </p>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {selectedActivities.length === 0 ? (
                      <p className="text-sm text-slate-400">No conversation notes yet.</p>
                    ) : (
                      selectedActivities.map((a) => (
                        <div key={a.id} className="bg-white rounded-xl border p-3 text-sm">
                          <div className="flex flex-wrap gap-2 items-center mb-1">
                            <Badge variant="secondary" className="text-xs">{a.type}</Badge>
                            {a.aim && (
                              <Badge variant="outline" className="text-xs">
                                {AIM_LABELS[a.aim] ?? a.aim}
                              </Badge>
                            )}
                            <span className="text-xs text-slate-400">
                              {new Date(a.createdAt).toLocaleString('en-GB')} · {a.createdBy}
                            </span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-wrap">{a.detail}</p>
                          {a.disposition && (
                            <p className="text-xs text-amber-800 mt-1">
                              Disposition: {DISPOSITION_LABELS[a.disposition as LeadCallDisposition] ?? a.disposition}
                            </p>
                          )}
                          {a.outcome && <p className="text-xs text-slate-500 mt-1">Outcome: {a.outcome}</p>}
                          {a.callSessionId && (
                            <Button
                              variant="link"
                              className="px-0 h-auto text-xs"
                              onClick={() => {
                                const id = a.callSessionId;
                                setSelectedLead(null);
                                navigate(`/calls?callId=${id}`);
                              }}
                            >
                              View call
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
                    <Textarea
                      value={noteDetail}
                      onChange={(e) => setNoteDetail(e.target.value)}
                      placeholder="Conversation detail — what was said, objections, next step…"
                      className="min-h-[80px] bg-white"
                    />
                    <div className="space-y-2">
                      <Select value={noteAim} onValueChange={setNoteAim}>
                        <SelectTrigger className="min-h-11 bg-white">
                          <SelectValue placeholder="Aim" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_AIMS.map((aim) => (
                            <SelectItem key={aim} value={aim}>
                              {AIM_LABELS[aim] ?? aim}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button className="w-full min-h-11" onClick={handleAddNote}>
                        Add note
                      </Button>
                    </div>
                  </div>
                </div>

                {customerPlanningApps.length > 0 && (
                  <div>
                    <Label className="font-bold">Planning applications</Label>
                    <div className="mt-2 space-y-2">
                      {customerPlanningApps.map((app) => (
                        <button
                          key={app.id}
                          type="button"
                          className="block w-full text-left text-sm text-indigo-700 hover:underline"
                          onClick={() => {
                            setSelectedLead(null);
                            navigate(`/planning/${app.id}`);
                          }}
                        >
                          {app.title} · {stageLabel(app.stage)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="flex-1 min-w-[160px] bg-amber-600 hover:bg-amber-700"
                    onClick={() => setCallThisPersonOpen(true)}
                    disabled={!selectedLead.phone}
                  >
                    <PhoneCall className="w-4 h-4 mr-2" />
                    Call this person
                  </Button>
                  <Button className="flex-1 min-w-[140px]" onClick={handleStartQuote}>
                    Start Quote
                  </Button>
                  <Button variant="outline" className="flex-1 min-w-[140px]" onClick={handleScheduleVisit}>
                    Schedule Survey
                  </Button>
                  <Button variant="outline" className="flex-1 min-w-[140px]" onClick={handleLogFollowUp}>
                    Log Follow-up
                  </Button>
                  {selectedLead.sourceCallId && (
                    <Button
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => {
                        const callId = selectedLead.sourceCallId;
                        setSelectedLead(null);
                        navigate(`/calls?callId=${callId}`);
                      }}
                    >
                      <PhoneCall className="w-4 h-4 mr-2" />
                      View source call
                    </Button>
                  )}
                  <Button variant="destructive" className="flex-1 min-w-[140px]" onClick={handleMarkLost}>
                    Mark Lost
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {selectedLead && (
        <CallThisPersonDialog
          open={callThisPersonOpen}
          onOpenChange={setCallThisPersonOpen}
          leadName={selectedLead.name}
          leadPhone={selectedLead.phone}
          customerId={selectedLead.id}
          defaultBrief={defaultBrief}
          onDialStarted={handleCallThisPersonStarted}
        />
      )}
    </div>
  );
}
