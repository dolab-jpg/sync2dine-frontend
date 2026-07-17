import { useContext, useState } from 'react';
import { AppContext, PricingRule } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Switch } from './ui/switch';
import { Plus, Edit, Trash2, Settings as SettingsIcon, DollarSign, Sparkles, Plug, Upload, Phone } from 'lucide-react';
import ImportExportPanel from './settings/ImportExportPanel';
import IntegrationsHub from './integrations/IntegrationsHub';
import { MailboxConnectPanel } from './mailbox/MailboxConnectPanel';
import { AIStudioPanel } from './aiStudio/AIStudioPanel';
import { integrationService } from '../engine/integrations/integrationService';
import { toast } from 'sonner';
import { getAllTrades } from '../config/trades';
import { useAIAssistant } from '../context/AIAssistantContext';
import { StaffPhoneRegistration } from './settings/StaffPhoneRegistration';
import { StaffSoftphones } from './settings/StaffSoftphones';
import { PhoneSohoSettings } from './settings/PhoneSohoSettings';
import { canManageCompanySettings } from '../engine/ai/rolePermissions';
import type { AgentRole } from '../engine/ai/agentContext';
import { getActiveOrgId } from '../engine/platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../engine/platform/homeOrg';

export default function Settings() {
  const context = useContext(AppContext);
  const { settings: aiSettings, updateSettings: updateAiSettings } = useAIAssistant();
  const trades = getAllTrades();

  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    type: 'per_sqm' as PricingRule['type'],
    basePrice: 0,
    category: 'labour',
    tradeId: null as string | null,
  });

  if (!context) return null;

  const { pricingRules, addPricingRule, updatePricingRule, deletePricingRule, user } = context;
  const mailboxOrgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;

  if (!canManageCompanySettings(user.role as AgentRole)) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Company settings are managed by your administrator. If you need a change to business info,
          pricing, or margins, please contact the office.
        </p>
      </div>
    );
  }

  const categories = [
    { value: 'labour', label: 'Labour' },
    { value: 'finish', label: 'Finishes' },
    { value: 'prep', label: 'Preparation' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'feature', label: 'Features' },
    { value: 'other', label: 'Other' }
  ];

  const resetForm = () => {
    setRuleForm({
      name: '',
      type: 'per_sqm',
      basePrice: 0,
      category: 'labour',
      tradeId: null,
    });
    setEditingRule(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updatePricingRule(editingRule.id, ruleForm);
      toast.success('Pricing rule updated');
    } else {
      addPricingRule(ruleForm);
      toast.success('Pricing rule added');
    }
    setIsAddRuleDialogOpen(false);
    resetForm();
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      type: rule.type,
      basePrice: rule.basePrice,
      category: rule.category,
      tradeId: rule.tradeId ?? null,
    });
    setIsAddRuleDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this pricing rule?')) {
      deletePricingRule(id);
      toast.success('Pricing rule deleted');
    }
  };

  const filteredRules = pricingRules.filter(r => {
    if (filterTrade === 'all') return true;
    if (filterTrade === 'global') return !r.tradeId;
    return r.tradeId === filterTrade;
  });

  const groupedRules = categories.map(cat => ({
    category: cat,
    rules: filteredRules.filter(r => r.category === cat.value)
  })).filter(g => g.rules.length > 0);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">Configure pricing rules, margins, and business settings</p>
      </div>

      <Tabs defaultValue={user.role === 'super_admin' || user.role === 'platform_owner' ? "pricing" : "business"} className="w-full">
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <TabsList className="w-max min-w-full sm:w-full flex-nowrap sm:flex-wrap h-auto gap-1">
          {(user.role === 'super_admin' || user.role === 'platform_owner') && (
            <>
              <TabsTrigger value="pricing" className="min-h-10 shrink-0">Pricing</TabsTrigger>
              <TabsTrigger value="quote-stages" className="min-h-10 shrink-0">Stages</TabsTrigger>
              <TabsTrigger value="ai" className="min-h-10 shrink-0">AI</TabsTrigger>
              <TabsTrigger value="integrations" className="min-h-10 shrink-0">API</TabsTrigger>
              <TabsTrigger value="phone-soho" className="min-h-10 shrink-0">
                <Phone className="w-3.5 h-3.5 mr-1.5 inline" />
                Phone &amp; Soho66
              </TabsTrigger>
              <TabsTrigger value="email-inbox" className="min-h-10 shrink-0">Email &amp; Inbox</TabsTrigger>
              <TabsTrigger value="import-export" className="min-h-10 shrink-0">
                <Upload className="w-3.5 h-3.5 mr-1.5 inline" />
                Import / Export
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="business" className="min-h-10 shrink-0">Business</TabsTrigger>
          <TabsTrigger value="team" className="min-h-10 shrink-0">Team & Roles</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="pricing" className="space-y-6">
          <div className="flex gap-2 flex-wrap">
            <Select value={filterTrade} onValueChange={setFilterTrade}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by trade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rules</SelectItem>
                <SelectItem value="global">Global (all trades)</SelectItem>
                {trades.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pricing Rules</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Define your pricing for materials, labour, and services
                </p>
              </div>

              <Dialog open={isAddRuleDialogOpen} onOpenChange={(open) => {
                setIsAddRuleDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingRule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Rule Name</Label>
                      <Input
                        id="name"
                        value={ruleForm.name}
                        onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                        placeholder="e.g., Microcement Application"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type">Pricing Type</Label>
                        <Select value={ruleForm.type} onValueChange={(value: PricingRule['type']) => setRuleForm({ ...ruleForm, type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_sqm">Per m²</SelectItem>
                            <SelectItem value="per_day">Per Day</SelectItem>
                            <SelectItem value="per_item">Per Item</SelectItem>
                            <SelectItem value="fixed">Fixed Price</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select value={ruleForm.category} onValueChange={(value) => setRuleForm({ ...ruleForm, category: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="basePrice">Base Price (£)</Label>
                      <Input
                        id="basePrice"
                        type="number"
                        step="0.01"
                        value={ruleForm.basePrice}
                        onChange={e => setRuleForm({ ...ruleForm, basePrice: parseFloat(e.target.value) })}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {ruleForm.type === 'per_sqm' && 'Price per square metre'}
                        {ruleForm.type === 'per_day' && 'Price per day'}
                        {ruleForm.type === 'per_item' && 'Price per item/unit'}
                        {ruleForm.type === 'fixed' && 'Fixed total price'}
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => {
                        setIsAddRuleDialogOpen(false);
                        resetForm();
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingRule ? 'Update' : 'Add'} Rule
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {pricingRules.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No pricing rules yet</p>
                  <Button onClick={() => setIsAddRuleDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedRules.map(group => (
                    <div key={group.category.value}>
                      <h3 className="font-medium text-gray-900 mb-3">{group.category.label}</h3>
                      <div className="space-y-2">
                        {group.rules.map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{rule.name}</p>
                              <p className="text-sm text-gray-600">
                                £{rule.basePrice.toFixed(2)} {rule.type.replace('_', ' ')}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 text-white p-3 rounded-lg">
                  <SettingsIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">Smart Pricing Protection</h3>
                  <p className="text-gray-700 mb-3">
                    Your pricing rules ensure consistent, profitable quotes every time. Update these
                    values as your costs change to maintain healthy margins.
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ No more guessing on-site</li>
                    <li>✓ Consistent pricing across team</li>
                    <li>✓ Protects your profit margins</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quote-stages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quote Builder Stages</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Configure the stages customers go through when creating a quote
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <SettingsIcon className="w-6 h-6 text-blue-600" />
                    <h3 className="font-bold text-blue-900">Current Quote Stages</h3>
                  </div>
                  <p className="text-sm text-blue-800 mb-4">
                    These stages guide your team through the quote creation process:
                  </p>
                  <ol className="space-y-2">
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full">1</span>
                      <div>
                        <p className="font-semibold">Customer Selection</p>
                        <p className="text-xs text-gray-600">Choose or create customer record</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full">2</span>
                      <div>
                        <p className="font-semibold">Measurements</p>
                        <p className="text-xs text-gray-600">Enter bathroom dimensions and labour days</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full">3</span>
                      <div>
                        <p className="font-semibold">Finish Selection</p>
                        <p className="text-xs text-gray-600">Choose wall finish (microcement, tiles, paint)</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full">4</span>
                      <div>
                        <p className="font-semibold">Second Fix Products</p>
                        <p className="text-xs text-gray-600">Select toilet, basin, shower, and taps</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full">5</span>
                      <div>
                        <p className="font-semibold">Additions</p>
                        <p className="text-xs text-gray-600">Add extras and optional items</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white font-bold rounded-full">6</span>
                      <div>
                        <p className="font-semibold">Site Details</p>
                        <p className="text-xs text-gray-600">Capture access and special requirements</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <span className="flex items-center justify-center w-8 h-8 bg-emerald-600 text-white font-bold rounded-full">7</span>
                      <div>
                        <p className="font-semibold">Summary & Review</p>
                        <p className="text-xs text-gray-600">Final review before creating quote</p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                  <div className="flex items-center gap-3 mb-3">
                    <SettingsIcon className="w-6 h-6 text-amber-600" />
                    <h3 className="font-bold text-amber-900">Advanced Configuration</h3>
                  </div>
                  <p className="text-sm text-amber-800">
                    Stages are defined per trade in trade config files. Each of the 12 trades has its own wizard flow.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsHub />
          <p className="text-sm text-gray-500">
            For Soho66 trunk, outbound minute rates, and phone usage, use the{' '}
            <strong>Phone &amp; Soho66</strong> tab.
          </p>
        </TabsContent>

        <TabsContent value="phone-soho" className="space-y-6">
          <PhoneSohoSettings />
        </TabsContent>

        <TabsContent value="email-inbox" className="space-y-6">
          <MailboxConnectPanel userId={user.id} orgId={mailboxOrgId} />
        </TabsContent>

        <TabsContent value="import-export" className="space-y-6">
          <ImportExportPanel />
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center gap-3 text-sm text-amber-900">
              <Plug className="w-5 h-5 shrink-0" />
              <span>
                OpenAI API key is in the <strong>API</strong> tab.
                Status: <strong>{integrationService.getStatus('openai')}</strong>
                {integrationService.isMasterMockMode() && ' (mock mode)'}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                OpenAI Assistant
              </CardTitle>
              <p className="text-sm text-gray-600">Staff AI preferences — API key in Integrations tab</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label>Enable AI Assistant</Label>
                <Switch checked={aiSettings.enabled} onCheckedChange={v => updateAiSettings({ enabled: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show AI panel</Label>
                <Switch checked={aiSettings.showOverlay} onCheckedChange={v => updateAiSettings({ showOverlay: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Open panel by default</Label>
                <Switch
                  checked={aiSettings.defaultPanelOpen ?? true}
                  onCheckedChange={v => updateAiSettings({ defaultPanelOpen: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Dock panel to sidebar (desktop)</Label>
                <Switch
                  checked={aiSettings.panelDocked ?? true}
                  onCheckedChange={v => updateAiSettings({ panelDocked: v })}
                />
              </div>
              <div>
                <Label>Model</Label>
                <Select value={aiSettings.model} onValueChange={v => updateAiSettings({ model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">gpt-4o (best quality)</SelectItem>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini (lower cost)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Voice input</Label>
                <Select value={aiSettings.voiceInput} onValueChange={(v: 'browser' | 'whisper' | 'auto') => updateAiSettings({ voiceInput: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (browser, Whisper fallback)</SelectItem>
                    <SelectItem value="browser">Browser only</SelectItem>
                    <SelectItem value="whisper">Whisper (high accuracy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Voice output</Label>
                <Select value={aiSettings.voiceOutput} onValueChange={(v: 'openai' | 'browser' | 'off') => updateAiSettings({ voiceOutput: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="browser">Browser TTS</SelectItem>
                    <SelectItem value="openai">OpenAI TTS</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-gray-500">Without an API key, the app uses mock AI responses for development.</p>
            </CardContent>
          </Card>

          <AIStudioPanel />
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input defaultValue="Sync2Dine" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" defaultValue="info@sync2dine.io" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input type="tel" defaultValue="020 1234 5678" />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input defaultValue="123 High Street, London, SW1A 1AA" />
              </div>
              <div>
                <Label>Default Margin (%)</Label>
                <Input type="number" defaultValue="30" />
                <p className="text-xs text-gray-500 mt-1">Applied to products when importing</p>
              </div>
              <Button>Save Business Info</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <StaffSoftphones />
          <StaffPhoneRegistration />
          <Card>
            <CardHeader>
              <CardTitle>Current User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {user.role.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Super Admin</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Full system access</li>
                    <li>✓ Manage pricing rules & margins</li>
                    <li>✓ View all quotes and customers</li>
                    <li>✓ Manage team members</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Manager</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ View all jobs</li>
                    <li>✓ Create and send quotes</li>
                    <li>✓ Manage customers</li>
                    <li>✗ Cannot edit pricing rules</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Staff / Surveyor</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>✓ Create quotes</li>
                    <li>✓ Take photos & use designer</li>
                    <li>✓ View own customers</li>
                    <li>✗ Cannot see other staff's work</li>
                  </ul>
                </div>
              </div>

              <p className="text-sm text-gray-500 mt-4 p-3 bg-slate-50 rounded border">
                Staff phones registered above are used for WhatsApp and inbound call routing. Role gates apply on all channels.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
