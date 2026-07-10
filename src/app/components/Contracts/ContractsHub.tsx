import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { FileSignature, Plus, Trash2, Sparkles, Send, Eye, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadContractTemplates,
  saveContractTemplate,
  deleteContractTemplate,
} from '../../engine/contracts/contractTemplateStore';
import { loadContracts, saveContract } from '../../engine/contracts/contractStore';
import { fetchContractsFromServer } from '../../engine/contracts/contractApi';
import { sendContractEmail } from '../../engine/contracts/contractSend';
import { applyContractSignedEffects } from '../../engine/contracts/contractSignEffects';
import { generatePaymentSchedule } from '../../engine/contracts/contractAiService';
import type { ContractTemplate, PaymentStage, Contract } from '../../engine/contracts/types';
import {
  renderTemplate,
  formatPaymentSchedule,
  formatJobLineItems,
} from '../../engine/messaging/templateRenderer';

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const emptyTemplate = (): ContractTemplate => ({
  id: '',
  name: '',
  bodyMarkdown: '',
  defaultDepositPct: 25,
  defaultStages: [{ label: 'Deposit', percent: 25, dueTrigger: 'On signing' }],
  createdAt: '',
});

export default function ContractsHub() {
  const context = useContext(AppContext);
  const [templates, setTemplates] = useState<ContractTemplate[]>(() => loadContractTemplates());
  const [contracts, setContracts] = useState<Contract[]>(() => loadContracts());

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // New contract state
  const [quoteId, setQuoteId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [stages, setStages] = useState<PaymentStage[]>([]);
  const [generating, setGenerating] = useState(false);

  // Preview state
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);

  const approvedQuotes = useMemo(
    () => (context?.quotes ?? []).filter((q) => q.status === 'approved'),
    [context?.quotes]
  );

  if (!context) return null;
  const { customers, quotes, user } = context;

  const selectedQuote = quotes.find((q) => q.id === quoteId);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const customer = selectedQuote ? customers.find((c) => c.id === selectedQuote.customerId) : undefined;

  const stagesTotalPct = stages.reduce((s, x) => s + x.percent, 0);

  const refreshTemplates = () => setTemplates(loadContractTemplates());
  const refreshContracts = () => setContracts(loadContracts());

  useEffect(() => {
    const pull = async () => {
      const remote = await fetchContractsFromServer();
      for (const c of remote) {
        if (c.status === 'signed' && c.signedAt) applyContractSignedEffects(c);
      }
      refreshContracts();
    };
    void pull();
    const id = window.setInterval(() => void pull(), 30000);
    return () => window.clearInterval(id);
  }, []);

  // ---- Templates ----
  const openTemplateEditor = (tpl?: ContractTemplate) => {
    setEditingTemplate(tpl ? { ...tpl } : emptyTemplate());
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate || !editingTemplate.name.trim()) {
      toast.error('Template needs a name');
      return;
    }
    saveContractTemplate({
      id: editingTemplate.id || undefined,
      name: editingTemplate.name,
      bodyMarkdown: editingTemplate.bodyMarkdown,
      defaultDepositPct: editingTemplate.defaultDepositPct,
      defaultStages: editingTemplate.defaultStages,
    });
    refreshTemplates();
    setTemplateDialogOpen(false);
    toast.success('Template saved');
  };

  const handleDeleteTemplate = (id: string) => {
    deleteContractTemplate(id);
    refreshTemplates();
    toast.message('Template deleted');
  };

  // ---- New contract ----
  const handleGenerate = async () => {
    if (!selectedQuote) {
      toast.error('Pick an approved quote');
      return;
    }
    setGenerating(true);
    try {
      const preferred = selectedTemplate?.defaultStages.map((s) => ({
        label: s.label,
        percent: s.percent,
        dueTrigger: s.dueTrigger,
      }));
      const result = await generatePaymentSchedule({
        total: selectedQuote.total,
        tradeName: selectedQuote.tradeName,
        context: selectedQuote.items.map((i) => i.name).join(', '),
        preferredStages: preferred,
      });
      setStages(result);
      toast.success('Stage schedule generated');
    } catch {
      toast.error('Could not generate schedule');
    } finally {
      setGenerating(false);
    }
  };

  const updateStage = (idx: number, patch: Partial<PaymentStage>) => {
    setStages((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const next = { ...s, ...patch };
        if (patch.percent !== undefined && selectedQuote) {
          next.amount = Math.round((selectedQuote.total * patch.percent) / 100);
        }
        return next;
      })
    );
  };

  const handleSaveContract = () => {
    if (!selectedQuote || !customer) {
      toast.error('Pick an approved quote');
      return;
    }
    if (stages.length === 0) {
      toast.error('Generate a payment schedule first');
      return;
    }
    const deposit = stages.find((s) => /deposit|booking/i.test(s.label))?.amount ?? stages[0]?.amount ?? 0;
    const bodyRendered = renderTemplate(selectedTemplate?.bodyMarkdown ?? '', {
      CUSTOMER_NAME: customer.name,
      CUSTOMER_EMAIL: customer.email,
      CUSTOMER_PHONE: customer.phone,
      CUSTOMER_ADDRESS: customer.address,
      USER_NAME: user.name,
      CONTRACT_TOTAL: selectedQuote.total.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
      DEPOSIT_AMOUNT: deposit.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
      PAYMENT_SCHEDULE: formatPaymentSchedule(stages),
      JOB_LINE_ITEMS: formatJobLineItems(selectedQuote.items, selectedQuote.labour, selectedQuote.extras),
    });
    saveContract({
      customerId: customer.id,
      customerName: customer.name,
      quoteId: selectedQuote.id,
      templateId: selectedTemplate?.id,
      tradeName: selectedQuote.tradeName,
      total: selectedQuote.total,
      depositAmount: deposit,
      stages,
      bodyRendered,
      status: 'draft',
    });
    refreshContracts();
    setQuoteId('');
    setStages([]);
    toast.success('Contract saved as draft');
  };

  // ---- Send ----
  const handleSend = async (contract: Contract) => {
    if (contract.status === 'signed') {
      toast.error('This contract is already signed');
      return;
    }
    const cust = customers.find((c) => c.id === contract.customerId);
    if (!cust?.email) {
      toast.error('Customer has no email address');
      return;
    }
    const result = await sendContractEmail(contract, cust, user.name);
    if (result.success) {
      refreshContracts();
      toast.success(result.mock ? 'Signing link sent (mock mode)' : 'Signing link emailed to customer');
    } else {
      toast.error(result.error ?? 'Failed to send');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 rounded-2xl">
          <FileSignature className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-gray-600 text-sm">Build contracts from approved quotes with AI stage payments and send them by email.</p>
        </div>
      </div>

      <Tabs defaultValue="new">
        <TabsList className="mb-4">
          <TabsTrigger value="new">New Contract</TabsTrigger>
          <TabsTrigger value="saved">Saved ({contracts.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        {/* New Contract */}
        <TabsContent value="new">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Approved quote</Label>
                  <Select value={quoteId} onValueChange={setQuoteId}>
                    <SelectTrigger><SelectValue placeholder="Select an approved quote" /></SelectTrigger>
                    <SelectContent>
                      {approvedQuotes.length === 0 && <SelectItem value="none" disabled>No approved quotes yet</SelectItem>}
                      {approvedQuotes.map((q) => (
                        <SelectItem key={q.id} value={q.id}>{q.customerName} — {q.tradeName ?? 'Job'} ({gbp(q.total)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Template</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={generating || !selectedQuote}>
                {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Generate stage payments with AI
              </Button>

              {stages.length > 0 && selectedQuote && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Payment schedule</span>
                    <Badge variant={stagesTotalPct === 100 ? 'default' : 'destructive'}>{stagesTotalPct}%</Badge>
                  </div>
                  {stages.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-3" value={s.label} onChange={(e) => updateStage(i, { label: e.target.value })} />
                      <Input className="col-span-5" value={s.dueTrigger} onChange={(e) => updateStage(i, { dueTrigger: e.target.value })} placeholder="When due" />
                      <div className="col-span-2 flex items-center gap-1">
                        <Input type="number" value={s.percent} onChange={(e) => updateStage(i, { percent: Number(e.target.value) || 0 })} />
                        <span className="text-gray-400">%</span>
                      </div>
                      <span className="col-span-2 text-right text-sm">{gbp(s.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-gray-500">Total {gbp(selectedQuote.total)}</span>
                    <Button onClick={handleSaveContract}><Save className="w-4 h-4 mr-2" />Save contract</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Contracts */}
        <TabsContent value="saved">
          {contracts.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-gray-500">No contracts yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{c.customerName} — {c.tradeName ?? 'Job'}</p>
                      <p className="text-sm text-gray-500">
                        {gbp(c.total)} • deposit {gbp(c.depositAmount)} • {c.stages.length} stages
                        {c.signedAt && ` • signed ${new Date(c.signedAt).toLocaleDateString('en-GB')}`}
                      </p>
                      {c.signedByName && (
                        <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Signed by {c.signedByName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={c.status === 'signed' ? 'default' : c.status === 'sent' ? 'secondary' : 'outline'}
                        className={c.status === 'signed' ? 'bg-green-600' : undefined}
                      >
                        {c.status}
                      </Badge>
                      {c.signatureDataUrl && (
                        <img src={c.signatureDataUrl} alt="Signature" className="h-8 border rounded bg-white" />
                      )}
                      <Button size="sm" variant="outline" onClick={() => setPreviewContract(c)}><Eye className="w-4 h-4 mr-1" />Preview</Button>
                      {c.status !== 'signed' && (
                        <Button size="sm" onClick={() => handleSend(c)}><Send className="w-4 h-4 mr-1" />{c.status === 'sent' ? 'Resend link' : 'Send'}</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates">
          <div className="flex justify-end mb-3">
            <Button onClick={() => openTemplateEditor()}><Plus className="w-4 h-4 mr-2" />New template</Button>
          </div>
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.defaultStages.map((s) => `${s.label} ${s.percent}%`).join(' • ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openTemplateEditor(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template editor dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTemplate?.id ? 'Edit template' : 'New template'}</DialogTitle></DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="mb-1 block">Name</Label>
                <Input value={editingTemplate.name} onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block">Default deposit %</Label>
                <Input type="number" className="w-32" value={editingTemplate.defaultDepositPct} onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultDepositPct: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Default stages</Label>
                  <Button size="sm" variant="outline" onClick={() => setEditingTemplate({ ...editingTemplate, defaultStages: [...editingTemplate.defaultStages, { label: 'Stage', percent: 0, dueTrigger: '' }] })}><Plus className="w-3 h-3 mr-1" />Add</Button>
                </div>
                <div className="space-y-2">
                  {editingTemplate.defaultStages.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <Input className="col-span-3" value={s.label} onChange={(e) => {
                        const ds = [...editingTemplate.defaultStages]; ds[i] = { ...ds[i], label: e.target.value };
                        setEditingTemplate({ ...editingTemplate, defaultStages: ds });
                      }} />
                      <Input className="col-span-6" value={s.dueTrigger} placeholder="When due" onChange={(e) => {
                        const ds = [...editingTemplate.defaultStages]; ds[i] = { ...ds[i], dueTrigger: e.target.value };
                        setEditingTemplate({ ...editingTemplate, defaultStages: ds });
                      }} />
                      <Input className="col-span-2" type="number" value={s.percent} onChange={(e) => {
                        const ds = [...editingTemplate.defaultStages]; ds[i] = { ...ds[i], percent: Number(e.target.value) || 0 };
                        setEditingTemplate({ ...editingTemplate, defaultStages: ds });
                      }} />
                      <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setEditingTemplate({ ...editingTemplate, defaultStages: editingTemplate.defaultStages.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Body</Label>
                <p className="text-xs text-gray-500 mb-1">Variables: {'{CUSTOMER_NAME} {CUSTOMER_ADDRESS} {CONTRACT_TOTAL} {DEPOSIT_AMOUNT} {PAYMENT_SCHEDULE} {JOB_LINE_ITEMS} {USER_NAME} {COMPANY_NAME}'}</p>
                <Textarea rows={12} value={editingTemplate.bodyMarkdown} onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyMarkdown: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate}><Save className="w-4 h-4 mr-2" />Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewContract} onOpenChange={(o) => !o && setPreviewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Contract preview</DialogTitle></DialogHeader>
          {previewContract && (
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{previewContract.bodyRendered}</pre>
          )}
          <DialogFooter>
            {previewContract && previewContract.status !== 'signed' && (
              <Button onClick={() => { handleSend(previewContract); setPreviewContract(null); }}><Send className="w-4 h-4 mr-2" />Send signing link</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
