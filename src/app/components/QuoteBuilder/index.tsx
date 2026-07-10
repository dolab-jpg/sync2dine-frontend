import { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../../App';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getTrade, isValidTradeId } from '../../config/trades';
import type { TradeId, WizardAnswers } from '../../config/types';
import { calculateQuote } from '../../engine/quoteCalculator';
import { StageProgress } from './StageProgress';
import { DynamicStage } from './DynamicStage';
import { SummaryStep } from './SummaryStep';
import { TradeSelectorStep } from './TradeSelectorStep';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { useResolvedTrade } from '../../hooks/useResolvedTrade';

export default function QuoteBuilder() {
  const context = useContext(AppContext);
  const { tradeId: routeTradeId, customerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ai = useAIAssistant();
  const { tradeId: resolvedTradeId } = useResolvedTrade();
  const autoNavigated = useRef(false);
  const [showManualTradePicker, setShowManualTradePicker] = useState(false);

  const [tradeId, setTradeId] = useState<TradeId | null>(
    routeTradeId && isValidTradeId(routeTradeId) ? routeTradeId : null
  );
  const [currentStage, setCurrentStage] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({
    customerId: customerId || '',
    customerName: '',
    floorLocation: 'ground',
    access: 'easy',
    removal: 'standard',
    labourRate: 250,
    discount: 0,
    bookingDeposit: 500,
    additions: [],
  });

  if (!context) return null;
  const { customers, products, pricingRules, addQuote } = context;

  const trade = tradeId ? getTrade(tradeId) : null;
  const showTradeSelector = !tradeId;
  const stages = trade?.wizardStages ?? [];
  const summaryIndex = stages.findIndex(s => s.id === 'summary');
  const isSummary = trade && currentStage === summaryIndex;

  const totals = useMemo(() => {
    if (!trade) return null;
    return calculateQuote(trade.id, answers, products, pricingRules);
  }, [trade, answers, products, pricingRules]);

  useEffect(() => {
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setAnswers(prev => ({ ...prev, customerId, customerName: customer.name }));
      }
    }
  }, [customerId, customers]);

  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill === 'ai' && ai.pendingQuoteFields) {
      setAnswers(prev => ({ ...prev, ...ai.pendingQuoteFields }));
      ai.clearPendingQuoteFields();
    }
  }, [searchParams, ai]);

  useEffect(() => {
    if (routeTradeId && isValidTradeId(routeTradeId)) {
      setTradeId(routeTradeId);
      return;
    }
    if (routeTradeId && !isValidTradeId(routeTradeId)) {
      const legacyCustomer = customers.find((c) => c.id === routeTradeId);
      if (legacyCustomer) {
        const trade = legacyCustomer.interestedTrades?.[0] ?? 'bathroom';
        navigate(`/quote/${trade}/${legacyCustomer.id}`, { replace: true });
      }
    }
  }, [routeTradeId, customers, navigate]);

  useEffect(() => {
    if (tradeId || autoNavigated.current) return;
    if (resolvedTradeId && isValidTradeId(resolvedTradeId)) {
      autoNavigated.current = true;
      setTradeId(resolvedTradeId);
      const t = getTrade(resolvedTradeId);
      navigate(`/quote/${resolvedTradeId}/${customerId || ''}`.replace(/\/$/, ''), { replace: true });
      setAnswers(prev => ({ ...prev, labourRate: t.defaultLabourRate ?? 250 }));
    }
  }, [resolvedTradeId, tradeId, customerId, navigate]);

  const handleComplete = () => {
    if (!trade || !totals) return;
    const customer = customers.find(c => c.id === String(answers.customerId));
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    let groupId = ai.jobGroupId;
    if (!groupId) {
      try {
        groupId = sessionStorage.getItem('pendingJobGroupId') ?? undefined;
        if (groupId) sessionStorage.removeItem('pendingJobGroupId');
      } catch {
        // ignore
      }
    }

    addQuote({
      tradeId: trade.id,
      tradeName: trade.name,
      customerId: customer.id,
      customerName: customer.name,
      expiresAt: expiresAt.toISOString(),
      items: totals.items,
      labour: totals.labour,
      extras: totals.extras,
      discount: Number(answers.discount) || 0,
      total: totals.total,
      status: 'draft',
      wizardAnswers: answers,
      aiAcceptedFields: ai.lastAcceptedFields,
      jobGroupId: groupId ?? undefined,
    });

    toast.success('Quote created successfully!');

    const interested = customer.interestedTrades ?? [];
    const remaining = interested.filter(tid => tid !== trade.id);
    if (remaining.length > 0) {
      const nextTrade = getTrade(remaining[0]);
      toast(`Start next quote: ${nextTrade.name}?`, {
        action: {
          label: 'Open',
          onClick: () => navigate(`/quote/${remaining[0]}/${customer.id}`),
        },
        duration: 8000,
      });
    }

    navigate('/quotes');
  };

  const totalStages = showTradeSelector ? 1 : stages.length;
  const displayStage = showTradeSelector ? 0 : currentStage;
  const stageTitle = showTradeSelector ? 'Select Trade' : stages[currentStage]?.title ?? '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <StageProgress currentStage={displayStage} totalStages={totalStages} title={stageTitle} />

      <div className="max-w-6xl mx-auto p-6">
        <Card className="bg-white/95 backdrop-blur shadow-2xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-8">
            <CardTitle className="text-3xl font-bold">
              {showTradeSelector ? 'New Quote' : `${trade?.name} Quote — ${stageTitle}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 min-h-[500px]">
            {showTradeSelector && !showManualTradePicker && (
              <div className="space-y-6 text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto text-amber-500" />
                <h3 className="text-xl font-bold text-slate-900">Describe the job in AI</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Open the TradePro AI assistant and describe the work — it will detect the trade and prefill your quote.
                </p>
                <Button
                  size="lg"
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={() => ai.setIsOpen(true)}
                >
                  Open AI Assistant
                </Button>
                <Button variant="ghost" onClick={() => setShowManualTradePicker(true)}>
                  Or pick trade manually
                </Button>
              </div>
            )}
            {showTradeSelector && showManualTradePicker && (
              <TradeSelectorStep
                selected={tradeId ?? undefined}
                onSelect={id => {
                  setTradeId(id);
                  setCurrentStage(0);
                  const t = getTrade(id);
                  navigate(`/quote/${id}/${customerId || ''}`.replace(/\/$/, ''), { replace: true });
                  setAnswers(prev => ({ ...prev, labourRate: t.defaultLabourRate ?? 250 }));
                }}
              />
            )}
            {trade && !isSummary && (
              <DynamicStage
                trade={trade}
                stageIndex={currentStage}
                answers={answers}
                onChange={setAnswers}
                customers={customers}
                products={products}
              />
            )}
            {trade && isSummary && totals && (
              <SummaryStep answers={answers} totals={totals} onChange={setAnswers} />
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6 mb-24">
          {!showTradeSelector && currentStage > 0 && (
            <Button onClick={() => setCurrentStage(currentStage - 1)} size="lg" className="flex-1 text-xl py-8 rounded-2xl bg-slate-700 hover:bg-slate-800">
              <ChevronLeft className="w-6 h-6 mr-2" /> Previous
            </Button>
          )}
          {showTradeSelector ? null : currentStage < stages.length - 1 ? (
            <Button onClick={() => setCurrentStage(currentStage + 1)} size="lg" className="flex-1 text-xl py-8 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600">
              Next <ChevronRight className="w-6 h-6 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} size="lg" className="flex-1 text-xl py-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600">
              <Check className="w-6 h-6 mr-2" /> Create Quote
            </Button>
          )}
        </div>

        {totals && trade && (
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 shadow-2xl border-t-4 border-amber-500 z-40">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm opacity-75">Current Total</p>
                <p className="text-3xl font-bold">£{totals.total.toFixed(0)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75">{trade.name}</p>
                <p className="text-lg font-bold text-amber-400">{String(answers.customerName) || 'No customer'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
