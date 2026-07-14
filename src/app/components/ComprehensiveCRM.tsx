import { useState, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AppContext, Customer } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Facebook, Instagram, Search as GoogleIcon, Phone, Mail, User, MapPin, Calendar, TrendingUp, Filter, Plus, MessageSquare, Video, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AddressMapLink } from './ui/AddressMapLink';
import { getAllTrades } from '../config/trades';
import type { TradeId } from '../config/types';
import { getDueFollowUps, isLeadCustomer } from '../engine/leads/leadService';
import { findPlanningApplicationsByCustomerId } from '../engine/planning/planningStore';
import { stageLabel } from '../engine/planning/types';

type Lead = Customer & {
  source: NonNullable<Customer['source']>;
  leadScore: number;
  tags: string[];
};

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

function inferTradeFromTags(tags: string[]): TradeId {
  const map: Record<string, TradeId> = {
    kitchen: 'kitchen', wetroom: 'bathroom', microcement: 'bathroom', rewire: 'electrical',
    loft: 'loft', roofing: 'roofing', extension: 'extensions',
  };
  for (const tag of tags) {
    const t = map[tag.toLowerCase()];
    if (t) return t;
  }
  return 'bathroom';
}

export default function ComprehensiveCRM() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  if (!context) return null;

  const { user, customers, updateCustomer, addCustomer } = context;
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'platform_owner';

  const leads = useMemo(
    () => customers.map(toLead).filter((l): l is Lead => l !== null),
    [customers],
  );

  const dueFollowUps = useMemo(() => getDueFollowUps(customers), [customers]);

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
    updateCustomer(selectedLead.id, { status: 'lost', lastContact: new Date().toISOString() });
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
  const [activeTab, setActiveTab] = useState('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const customerPlanningApps = useMemo(
    () => (selectedLead ? findPlanningApplicationsByCustomerId(selectedLead.id) : []),
    [selectedLead?.id],
  );

  const [metaSettings, setMetaSettings] = useState({
    accessToken: '',
    pageId: '',
    formId: '',
    webhookUrl: '',
    autoSync: true
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

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = activeTab === 'all' || lead.status === activeTab;
    const matchesSource = filterSource === 'all' || lead.source === filterSource;
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          lead.phone.includes(searchTerm);
    return matchesStatus && matchesSource && matchesSearch;
  });

  const stats = {
    total: leads.length,
    facebook: leads.filter(l => l.source === 'facebook').length,
    instagram: leads.filter(l => l.source === 'instagram').length,
    google: leads.filter(l => l.source === 'google').length,
    conversionRate: leads.length ? ((leads.filter(l => l.status === 'won').length / leads.length) * 100).toFixed(1) : '0',
    avgLeadScore: leads.length ? (leads.reduce((sum, l) => sum + l.leadScore, 0) / leads.length).toFixed(0) : '0',
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
                <p className="text-amber-100 mt-1 text-sm sm:text-lg">Track leads from social media & all sources</p>
              </div>
            </div>

            {isSuperAdmin && (
              <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg py-4 sm:py-6 px-6 sm:px-8 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 min-h-11">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Add New Lead</DialogTitle>
                  </DialogHeader>
                  <p className="text-gray-600">Manual lead entry form would go here</p>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Follow-ups due */}
        {dueFollowUps.length > 0 && (
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="shadow-lg rounded-2xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Total Leads</p>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-900">Facebook</p>
                <Facebook className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-900">{stats.facebook}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-pink-50 to-pink-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-pink-900">Instagram</p>
                <Instagram className="w-4 h-4 text-pink-600" />
              </div>
              <p className="text-3xl font-bold text-pink-900">{stats.instagram}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-red-900">Google Ads</p>
                <GoogleIcon className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-3xl font-bold text-red-900">{stats.google}</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-green-900">Conversion</p>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900">{stats.conversionRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Tabs */}
        <Card className="shadow-xl rounded-3xl border-0 mb-6">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full mb-4 sm:mb-6 bg-slate-100 p-1.5 sm:p-2 rounded-2xl h-auto">
                <TabsTrigger value="all" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">All</TabsTrigger>
                <TabsTrigger value="lead" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Leads</TabsTrigger>
                <TabsTrigger value="quoted" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Quoted</TabsTrigger>
                <TabsTrigger value="won" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11">Won</TabsTrigger>
                <TabsTrigger value="lost" className="text-sm sm:text-base py-3 sm:py-4 rounded-xl min-h-11 col-span-2 sm:col-span-1">Lost</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
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
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads List */}
        <div className="space-y-4">
          {filteredLeads.length === 0 ? (
            <Card className="shadow-lg rounded-2xl border-0">
              <CardContent className="text-center py-12">
                <TrendingUp className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No leads match your filters</p>
                <p className="text-sm text-gray-400 mt-1">Try a different tab, search term, or source</p>
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
          ) : filteredLeads.map(lead => (
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
                        <span>{lead.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{lead.phone}</span>
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

                    {lead.campaign && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {lead.campaign}
                        </Badge>
                        {lead.adSet && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {lead.adSet}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {lead.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {lead.notes && (
                      <p className="mt-3 text-gray-700 text-sm line-clamp-2">{lead.notes}</p>
                    )}
                  </div>

                  <div className="text-left sm:text-right sm:ml-6 shrink-0">
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white px-4 py-2 rounded-full font-bold mb-2">
                      Score: {lead.leadScore}
                    </div>
                    {lead.budget && (
                      <div className="text-sm text-gray-600 mb-1">
                        <strong>Budget:</strong> {lead.budget}
                      </div>
                    )}
                    {lead.timeline && (
                      <div className="text-sm text-gray-600">
                        <strong>Timeline:</strong> {lead.timeline}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Meta Integration Settings (Super Admin Only) */}
        {isSuperAdmin && (
          <Card className="shadow-xl rounded-3xl border-0 mt-6">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-3xl">
              <CardTitle className="text-2xl">Meta Lead Integration</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">📱 Connect Facebook & Instagram Leads</h3>
                <p className="text-blue-800 text-sm mb-3">
                  Automatically sync leads from Facebook & Instagram ad campaigns directly into your CRM.
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Auto-import leads from Facebook Lead Forms</li>
                  <li>• Track Instagram DMs and comment leads</li>
                  <li>• Real-time webhook notifications</li>
                  <li>• Campaign & ad set attribution</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-lg font-bold mb-2 block">Access Token</Label>
                  <Input
                    type="password"
                    value={metaSettings.accessToken}
                    onChange={e => setMetaSettings({ ...metaSettings, accessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxxxxxx"
                    className="text-base p-4"
                  />
                </div>
                <div>
                  <Label className="text-lg font-bold mb-2 block">Page ID</Label>
                  <Input
                    value={metaSettings.pageId}
                    onChange={e => setMetaSettings({ ...metaSettings, pageId: e.target.value })}
                    placeholder="123456789012345"
                    className="text-base p-4"
                  />
                </div>
                <div>
                  <Label className="text-lg font-bold mb-2 block">Form ID</Label>
                  <Input
                    value={metaSettings.formId}
                    onChange={e => setMetaSettings({ ...metaSettings, formId: e.target.value })}
                    placeholder="Lead form ID"
                    className="text-base p-4"
                  />
                </div>
                <div>
                  <Label className="text-lg font-bold mb-2 block">Webhook URL</Label>
                  <Input
                    value={metaSettings.webhookUrl}
                    onChange={e => setMetaSettings({ ...metaSettings, webhookUrl: e.target.value })}
                    placeholder="https://your-api.com/webhooks/meta"
                    className="text-base p-4"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                <input
                  type="checkbox"
                  checked={metaSettings.autoSync}
                  onChange={e => setMetaSettings({ ...metaSettings, autoSync: e.target.checked })}
                  className="w-6 h-6"
                  id="autoSync"
                />
                <Label htmlFor="autoSync" className="text-lg">Auto-sync leads every 5 minutes</Label>
              </div>

              <Button
                onClick={() => toast.success('Meta integration settings saved!')}
                size="lg"
                className="w-full text-xl py-8 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700"
              >
                Save Meta Integration
              </Button>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-200">
                <h4 className="font-bold text-amber-900 mb-3">Setup Guide</h4>
                <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
                  <li>Create a Facebook App in Meta Business Suite</li>
                  <li>Get your Access Token from Graph API Explorer</li>
                  <li>Subscribe to 'leadgen' webhook events</li>
                  <li>Configure your webhook endpoint URL</li>
                  <li>Test the connection and verify leads are syncing</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lead Detail Modal */}
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
                    <Label className="font-bold">Budget</Label>
                    <p className="mt-1">{selectedLead.budget || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="font-bold">Timeline</Label>
                    <p className="mt-1">{selectedLead.timeline || 'Not specified'}</p>
                  </div>
                </div>

                {selectedLead.campaign && (
                  <div>
                    <Label className="font-bold">Campaign Details</Label>
                    <div className="mt-2 space-y-2">
                      <p><strong>Campaign:</strong> {selectedLead.campaign}</p>
                      {selectedLead.adSet && <p><strong>Ad Set:</strong> {selectedLead.adSet}</p>}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="font-bold">Notes</Label>
                  <p className="mt-2 bg-gray-50 p-4 rounded-lg">{selectedLead.notes}</p>
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
                  <Button className="flex-1 min-w-[140px]" onClick={handleStartQuote}>
                    Start Quote
                  </Button>
                  <Button variant="outline" className="flex-1 min-w-[140px]" onClick={handleScheduleVisit}>
                    Schedule Survey
                  </Button>
                  <Button variant="outline" className="flex-1 min-w-[140px]" onClick={handleLogFollowUp}>
                    Log Follow-up
                  </Button>
                  <Button variant="destructive" className="flex-1 min-w-[140px]" onClick={handleMarkLost}>
                    Mark Lost
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
