import { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppContext, type QuoteItem, type LabourItem, type ExtraItem, type PricingResearch, canApproveQuotes } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Calculator, Sparkles, ListChecks, Camera, Loader2, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { migrateQuoteToLines } from '../../engine/quotes/quoteLineUtils';
import { VoiceInputButton } from '../AI/VoiceInputButton';
import { PhotoCapture } from '../AI/PhotoCapture';
import { getAllTrades, getTrade } from '../../config/trades';
import type { TradeId } from '../../config/types';
import { priceSmallJob } from '../../engine/pricing/smallJobsService';
import { researchPrices, pickHigherEnd } from '../../engine/pricing/priceResearchService';
import { estimateFromPhotos } from '../../engine/aiEstimationService';
import { suggestionsToAnswers, buildIndicativeEstimate } from '../../engine/ai/indicativeEstimate';
import { calculateQuote } from '../../engine/quoteCalculator';

interface PricedDraft {
  items: QuoteItem[];
  labour: LabourItem[];
  extras: ExtraItem[];
  total: number;
  tradeId?: TradeId;
  tradeName: string;
  pricingResearch?: PricingResearch;
  summary?: string;
  risks?: string[];
}

const fmt = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export default function JobPricing() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const trades = useMemo(() => getAllTrades(), []);

  const [customerId, setCustomerId] = useState('');
  const [taskText, setTaskText] = useState('');
  const [tradeId, setTradeId] = useState<TradeId>('bathroom');
  const [photos, setPhotos] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<PricedDraft | null>(null);

  if (!context) return null;
  const { customers, addQuote, user } = context;
  const customer = customers.find((c) => c.id === customerId);

  const updateItemPrice = (index: number, price: number) => {
    if (!draft) return;
    const items = draft.items.map((it, i) => (i === index ? { ...it, price, total: price * it.quantity } : it));
    const total = items.reduce((s, i) => s + i.total, 0)
      + draft.labour.reduce((s, l) => s + l.total, 0)
      + draft.extras.reduce((s, e) => s + e.price, 0);
    setDraft({ ...draft, items, total });
  };

  const handlePriceSmallJob = async () => {
    if (!taskText.trim()) {
      toast.error('Add at least one task');
      return;
    }
    setLoading(true);
    try {
      const result = await priceSmallJob(taskText, {
        tradeName: 'Small Jobs',
        postcode: customer?.address,
      });
      setDraft({
        items: result.items,
        labour: [],
        extras: result.extras,
        total: result.total,
        tradeName: 'Small Jobs',
        pricingResearch: result.pricingResearch,
        summary: `${result.taskList.length} task(s) priced at the higher end of local rates.`,
      });
      toast.success('Job priced — review and submit for approval');
    } catch {
      toast.error('Pricing failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePricePhotos = async () => {
    setLoading(true);
    try {
      const estimation = await estimateFromPhotos(tradeId, photos, { details });
      const answers = suggestionsToAnswers(estimation.suggestions);
      const calc = calculateQuote(tradeId, answers, context.products, context.pricingRules);
      const indicative = buildIndicativeEstimate(tradeId, answers, context.products, context.pricingRules);
      const research = await researchPrices({
        tasks: [`${getTrade(tradeId).name} full installation`],
        tradeName: getTrade(tradeId).name,
        postcode: customer?.address,
      });
      const researchedHigh = research.lines.length ? pickHigherEnd(research.lines[0]) : 0;
      const total = Math.max(indicative.high, researchedHigh);
      setDraft({
        items: calc.items,
        labour: calc.labour,
        extras: calc.extras,
        total,
        tradeId,
        tradeName: getTrade(tradeId).name,
        pricingResearch: research.lines.length ? research : undefined,
        summary: estimation.summary,
        risks: estimation.risks,
      });
      toast.success('Estimated — review and submit for approval');
    } catch {
      toast.error('Estimation failed');
    } finally {
      setLoading(false);
    }
  };

  const submitForApproval = () => {
    if (!draft) return;
    if (!customer) {
      toast.error('Select a customer first');
      return;
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    const quoteBase = {
      customerId: customer.id,
      customerName: customer.name,
      tradeId: draft.tradeId,
      tradeName: draft.tradeName,
      expiresAt: expiresAt.toISOString(),
      items: draft.items,
      labour: draft.labour,
      extras: draft.extras,
      discount: 0,
      total: draft.total,
      status: 'awaiting_approval' as const,
      pricingResearch: draft.pricingResearch,
      approval: { state: 'pending' as const, originalTotal: draft.total },
    };
    addQuote({ ...quoteBase, lines: migrateQuoteToLines(quoteBase as never) });
    toast.success('Submitted to the approval queue');
    navigate(canApproveQuotes(user.role) ? '/approvals' : '/quotes');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-3 rounded-2xl">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Job Pricing</h1>
          <p className="text-gray-600 text-sm">Price small job lists or full jobs from photos — biased to the higher end of local rates. Goes to a manager for approval.</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <Label className="mb-2 block">Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} — {c.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="small" onValueChange={() => setDraft(null)}>
        <TabsList className="mb-4">
          <TabsTrigger value="small"><ListChecks className="w-4 h-4 mr-2" />Small Jobs / List</TabsTrigger>
          <TabsTrigger value="photos"><Camera className="w-4 h-4 mr-2" />Photos + Details</TabsTrigger>
        </TabsList>

        <TabsContent value="small">
          <Card>
            <CardHeader><CardTitle className="text-lg">List the tasks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">One task per line (or speak them). E.g. "Re-seal the bath", "Replace 2 sockets", "Hang a bathroom mirror".</p>
              <div className="flex gap-2 items-start">
                <Textarea
                  rows={6}
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  placeholder={'Re-seal the bath\nReplace kitchen tap\nFill and paint hallway wall'}
                />
                <VoiceInputButton onTranscript={(t) => t && setTaskText((prev) => (prev ? `${prev}\n${t}` : t))} />
              </div>
              <Button onClick={handlePriceSmallJob} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Price with AI
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader><CardTitle className="text-lg">Photos & details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Trade</Label>
                <Select value={tradeId} onValueChange={(v) => setTradeId(v as TradeId)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {trades.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PhotoCapture photos={photos} onChange={setPhotos} />
              <div>
                <Label className="mb-2 block">Details</Label>
                <Textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything the photos don't show — access, finishes, timescales..." />
              </div>
              <Button onClick={handlePricePhotos} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Price with AI
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {draft && (
        <Card className="mt-6 border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Draft price</span>
              <Badge variant="outline">{draft.pricingResearch?.provider ?? 'estimate'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.summary && <p className="text-sm text-gray-700">{draft.summary}</p>}
            {draft.risks && draft.risks.length > 0 && (
              <ul className="text-xs text-amber-700 list-disc pl-4">
                {draft.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}

            {draft.items.length > 0 && (
              <div className="space-y-2">
                {draft.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{it.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">£</span>
                      <Input
                        type="number"
                        className="w-28"
                        value={it.price}
                        onChange={(e) => updateItemPrice(i, Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {draft.labour.map((l, i) => (
              <div key={`l-${i}`} className="flex justify-between text-sm text-gray-600">
                <span>{l.description}</span><span>{fmt(l.total)}</span>
              </div>
            ))}
            {draft.extras.map((e, i) => (
              <div key={`e-${i}`} className="flex justify-between text-sm text-gray-600">
                <span>{e.description}</span><span>{fmt(e.price)}</span>
              </div>
            ))}

            {draft.pricingResearch && draft.pricingResearch.lines.some((l) => l.sources.length > 0) && (
              <div className="text-xs text-gray-500">
                <p className="font-medium mb-1">Local price sources</p>
                <ul className="space-y-0.5">
                  {draft.pricingResearch.lines.flatMap((l) => l.sources).slice(0, 6).map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />{s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-lg font-bold">Total {fmt(draft.total)}</span>
              <Button onClick={submitForApproval} className="bg-amber-600 hover:bg-amber-700">
                Submit for approval <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
