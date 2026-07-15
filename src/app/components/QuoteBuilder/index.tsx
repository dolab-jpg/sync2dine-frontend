import { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../../App';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, Check, Sparkles, Send, ClipboardCheck, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { getTrade, isValidTradeId } from '../../config/trades';
import type { TradeId, WizardAnswers, WizardField, WizardStage } from '../../config/types';
import { calculateQuote } from '../../engine/quoteCalculator';
import { StageProgress } from './StageProgress';
import { DynamicStage } from './DynamicStage';
import { SummaryStep } from './SummaryStep';
import { TradeSelectorStep } from './TradeSelectorStep';
import { useAIAssistant } from '../../context/AIAssistantContext';
import { useResolvedTrade } from '../../hooks/useResolvedTrade';
import {
  clearSurveyPrefill,
  loadSurveyPrefill,
  type SurveyQuotePrefill,
} from '../../engine/surveyScorer';
import {
  needsManagerApproval,
  resolveBookingDeposit,
  sendPricePack,
} from '../../engine/salesCloseFlow';

function isFieldFilled(field: WizardField, answers: WizardAnswers): boolean {
  if (field.computeFrom) return true;
  const raw = answers[field.key];
  if (field.type === 'number') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return false;
    if (field.min != null && n < field.min) return false;
    if (field.max != null && n > field.max) return false;
    return true;
  }
  if (field.type === 'multi-select' || Array.isArray(raw)) {
    return Array.isArray(raw) && raw.length > 0;
  }
  if (raw === undefined || raw === null) return false;
  return String(raw).trim().length > 0;
}

function validateStage(stage: WizardStage | undefined, answers: WizardAnswers): string | null {
  if (!stage) return null;
  for (const field of stage.fields) {
    if (!field.required) continue;
    if (!isFieldFilled(field, answers)) {
      if (field.type === 'customer-select' || field.key === 'customerId') {
        return 'Please select a customer before continuing';
      }
      return `Please complete “${field.label}” before continuing`;
    }
  }
  return null;
}
export default function QuoteBuilder() {
  const context = useContext(AppContext);
  const { tradeId: routeTradeId, customerId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ai = useAIAssistant();
  const { tradeId: resolvedTradeId } = useResolvedTrade();
  const autoNavigated = useRef(false);
  const surveyPrefillApplied = useRef(false);
  const pricingBarRef = useRef<HTMLDivElement>(null);
  const [showManualTradePicker, setShowManualTradePicker] = useState(false);
  const [surveyPrefill, setSurveyPrefill] = useState<SurveyQuotePrefill | null>(null);
  const [busy, setBusy] = useState(false);

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
  const { customers, products, pricingRules, addQuote, updateQuote, user } = context;

  const trade = tradeId ? getTrade(tradeId) : null;
  const showTradeSelector = !tradeId;
  const stages = trade?.wizardStages ?? [];
  const summaryIndex = stages.findIndex((s) => s.id === 'summary');
  const isSummary = trade && currentStage === summaryIndex;

  const totals = useMemo(() => {
    if (!trade) return null;
    return calculateQuote(trade.id, answers, products, pricingRules);
  }, [trade, answers, products, pricingRules]);

  const gateNeeded = useMemo(() => {
    if (!totals) return false;
    return needsManagerApproval({
      total: totals.total,
      discountPct: Number(answers.discount) || 0,
      surveyRiskScore: surveyPrefill?.riskScore,
    });
  }, [totals, answers.discount, surveyPrefill?.riskScore]);

  useEffect(() => {
    const el = pricingBarRef.current;
    if (!el || !totals || !trade) {
      document.documentElement.style.removeProperty('--bottom-bar-offset');
      return;
    }
    const publish = () => {
      document.documentElement.style.setProperty('--bottom-bar-offset', `${el.offsetHeight}px`);
    };
    publish();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--bottom-bar-offset');
    };
  }, [totals, trade]);

  useEffect(() => {
    if (customerId) {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        setAnswers((prev) => ({ ...prev, customerId, customerName: customer.name }));
      }
    }
  }, [customerId, customers]);

  useEffect(() => {
    const prefill = searchParams.get('prefill');
    if (prefill === 'ai' && ai.pendingQuoteFields) {
      setAnswers((prev) => ({ ...prev, ...ai.pendingQuoteFields }));
      ai.clearPendingQuoteFields();
    }
  }, [searchParams, ai]);

  useEffect(() => {
    if (surveyPrefillApplied.current) return;
    if (searchParams.get('prefill') !== 'survey') return;
    const data = loadSurveyPrefill();
    if (!data) return;
    surveyPrefillApplied.current = true;
    setSurveyPrefill(data);

    const activeTrade =
      (routeTradeId && isValidTradeId(routeTradeId) ? routeTradeId : null) ??
      data.tradeIds[0] ??
      null;
    const tradeAnswers = activeTrade ? (data.answersByTrade[activeTrade] ?? {}) : {};
    const parking = tradeAnswers.parking ?? tradeAnswers.access;

    setAnswers((prev) => ({
      ...prev,
      customerId: data.customerId || prev.customerId,
      ...tradeAnswers,
      access: parking ?? prev.access,
      floorLocation: tradeAnswers.floorLocation ?? prev.floorLocation,
      surveyRiskScore: data.riskScore,
    }));

    try {
      sessionStorage.setItem('pendingJobGroupId', data.jobGroupId);
      sessionStorage.setItem(
        'pendingSurveyTradeIds',
        JSON.stringify(data.tradeIds),
      );
    } catch {
      /* ignore */
    }
  }, [searchParams, routeTradeId]);

  useEffect(() => {
    if (routeTradeId && isValidTradeId(routeTradeId)) {
      setTradeId(routeTradeId);
      return;
    }
    if (routeTradeId && !isValidTradeId(routeTradeId)) {
      const legacyCustomer = customers.find((c) => c.id === routeTradeId);
      if (legacyCustomer) {
        const nextTrade = legacyCustomer.interestedTrades?.[0] ?? 'bathroom';
        navigate(`/quote/${nextTrade}/${legacyCustomer.id}`, { replace: true });
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
      setAnswers((prev) => ({ ...prev, labourRate: t.defaultLabourRate ?? 250 }));
    }
  }, [resolvedTradeId, tradeId, customerId, navigate]);

  /** When switching trade within a survey multi-trade loop, merge that trade's survey answers. */
  useEffect(() => {
    if (!tradeId || !surveyPrefill) return;
    const tradeAnswers = surveyPrefill.answersByTrade[tradeId];
    if (!tradeAnswers) return;
    setAnswers((prev) => ({
      ...prev,
      ...tradeAnswers,
      access: tradeAnswers.parking ?? tradeAnswers.access ?? prev.access,
      customerId: surveyPrefill.customerId || prev.customerId,
      labourRate: getTrade(tradeId).defaultLabourRate ?? prev.labourRate,
    }));
  }, [tradeId, surveyPrefill]);

  const resolveJobGroupId = (): string | undefined => {
    let groupId = ai.jobGroupId ?? surveyPrefill?.jobGroupId;
    if (!groupId) {
      try {
        groupId = sessionStorage.getItem('pendingJobGroupId') ?? undefined;
      } catch {
        /* ignore */
      }
    }
    return groupId ?? undefined;
  };

  const remainingSurveyTrades = (currentTrade: TradeId): TradeId[] => {
    let ids: TradeId[] = surveyPrefill?.tradeIds ?? [];
    if (!ids.length) {
      try {
        const raw = sessionStorage.getItem('pendingSurveyTradeIds');
        if (raw) ids = JSON.parse(raw) as TradeId[];
      } catch {
        /* ignore */
      }
    }
    const customer = customers.find((c) => c.id === String(answers.customerId));
    const interested = customer?.interestedTrades ?? [];
    const pool = ids.length ? ids : interested;
    return pool.filter((tid) => tid !== currentTrade);
  };

  const offerNextTrade = (customerIdForNav: string, currentTrade: TradeId) => {
    const remaining = remainingSurveyTrades(currentTrade);
    if (remaining.length === 0) {
      clearSurveyPrefill();
      try {
        sessionStorage.removeItem('pendingSurveyTradeIds');
        sessionStorage.removeItem('pendingJobGroupId');
      } catch {
        /* ignore */
      }
      return;
    }
    const next = remaining[0];
    const nextTrade = getTrade(next);
    toast(`Next trade quote: ${nextTrade.name}`, {
      action: {
        label: 'Open',
        onClick: () =>
          navigate(
            `/quote/${next}/${customerIdForNav}${surveyPrefill ? '?prefill=survey' : ''}`,
          ),
      },
      duration: 10000,
    });
  };

  const handleNext = () => {
    const error = validateStage(stages[currentStage], answers);
    if (error) {
      toast.error(error);
      return;
    }
    setCurrentStage(currentStage + 1);
  };

  const handleOpenAiAssistant = () => {
    if (!ai.settings.enabled || !ai.settings.showOverlay) {
      toast.error('AI assistant is disabled in Settings');
      return;
    }
    if (ai.settings.panelDocked) {
      ai.updateSettings({ panelDocked: false });
    }
    if (ai.isOpen) {
      ai.setIsOpen(false);
      window.setTimeout(() => ai.setIsOpen(true), 50);
    } else {
      ai.setIsOpen(true);
    }
  };

  const buildQuotePayload = (status: 'draft' | 'awaiting_approval' | 'sent' | 'approved') => {
    if (!trade || !totals) return null;
    if (status !== 'draft') {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        if (stage.id === 'summary') continue;
        const error = validateStage(stage, answers);
        if (error) {
          toast.error(error);
          setCurrentStage(i);
          return null;
        }
      }
    } else {
      const customerError = validateStage(
        stages.find((s) => s.id === 'customer') ?? stages[0],
        answers,
      );
      if (customerError) {
        toast.error(customerError);
        return null;
      }
    }
    const customer = customers.find((c) => c.id === String(answers.customerId));
    if (!customer) {
      toast.error('Please select a customer');
      return null;
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const deposit = resolveBookingDeposit(totals.total, {
      ...answers,
      bookingDeposit: Number(answers.bookingDeposit) || Math.round(totals.total * 0.25),
    });

    return {
      customer,
      deposit,
      payload: {
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
        status,
        wizardAnswers: { ...answers, bookingDeposit: deposit },
        aiAcceptedFields: ai.lastAcceptedFields,
        jobGroupId: resolveJobGroupId(),
        approval:
          status === 'awaiting_approval'
            ? { state: 'pending' as const, originalTotal: totals.total }
            : status === 'approved'
              ? {
                  state: 'approved' as const,
                  by: 'auto',
                  at: new Date().toISOString(),
                  originalTotal: totals.total,
                  note: 'Below approval threshold',
                }
              : undefined,
      },
    };
  };

  const handleSaveDraft = () => {
    const built = buildQuotePayload('draft');
    if (!built || !trade) return;
    addQuote(built.payload);
    toast.success('Quote saved as draft');
    offerNextTrade(built.customer.id, trade.id);
    navigate('/quotes');
  };

  const handleSubmitForApproval = () => {
    const built = buildQuotePayload('awaiting_approval');
    if (!built || !trade) return;
    addQuote(built.payload);
    toast.success('Submitted for senior manager approval');
    offerNextTrade(built.customer.id, trade.id);
    navigate('/approvals');
  };

  const handleSendPricePack = async () => {
    if (!trade || !totals) return;
    setBusy(true);
    try {
      const status = gateNeeded ? 'awaiting_approval' : 'approved';
      if (gateNeeded) {
        handleSubmitForApproval();
        return;
      }
      const built = buildQuotePayload(status);
      if (!built) return;
      const quote = addQuote({ ...built.payload, status: 'sent' });
      const result = await sendPricePack({
        quote,
        customer: built.customer,
        userName: user.name,
        depositAmount: built.deposit,
      });
      if (!result.success) {
        updateQuote(quote.id, { status: 'approved' });
        toast.error(result.error ?? 'Could not send to customer');
        return;
      }
      toast.success(
        result.mock
          ? 'Price pack ready (messaging in mock mode) — contract link created'
          : 'Price pack sent to customer for signature',
      );
      offerNextTrade(built.customer.id, trade.id);
      navigate('/quotes');
    } finally {
      setBusy(false);
    }
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
            {surveyPrefill && (
              <p className="text-amber-200 text-sm mt-2">
                Prefilling from site survey
                {surveyPrefill.tradeIds.length > 1
                  ? ` (${surveyPrefill.tradeIds.length} trades)`
                  : ''}
                {surveyPrefill.riskScore != null
                  ? ` · risk ${surveyPrefill.riskScore}`
                  : ''}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-8 min-h-[500px]">
            {showTradeSelector && !showManualTradePicker && (
              <div className="space-y-6 text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto text-amber-500" />
                <h3 className="text-xl font-bold text-slate-900">Describe the job in AI</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Open Cynthia and describe the work — she will detect the trade and prefill your quote.
                </p>
                <Button
                  size="lg"
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={handleOpenAiAssistant}
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
                onSelect={(id) => {
                  setTradeId(id);
                  setCurrentStage(0);
                  const t = getTrade(id);
                  navigate(`/quote/${id}/${customerId || ''}`.replace(/\/$/, ''), { replace: true });
                  setAnswers((prev) => ({ ...prev, labourRate: t.defaultLabourRate ?? 250 }));
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
              <SummaryStep
                answers={answers}
                totals={totals}
                onChange={setAnswers}
                needsApproval={gateNeeded}
                surveyRiskScore={surveyPrefill?.riskScore}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3 mt-6 mb-28">
          {!showTradeSelector && currentStage > 0 && (
            <Button
              onClick={() => setCurrentStage(currentStage - 1)}
              size="lg"
              className="flex-1 min-w-[140px] text-lg py-6 rounded-2xl bg-slate-700 hover:bg-slate-800"
            >
              <ChevronLeft className="w-5 h-5 mr-2" /> Previous
            </Button>
          )}
          {showTradeSelector ? null : currentStage < stages.length - 1 ? (
            <Button
              onClick={handleNext}
              size="lg"
              className="flex-1 min-w-[140px] text-lg py-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600"
            >
              Next <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSaveDraft}
                size="lg"
                variant="outline"
                className="flex-1 min-w-[140px] text-lg py-6 rounded-2xl bg-white"
                disabled={busy}
              >
                <Check className="w-5 h-5 mr-2" /> Save draft
              </Button>
              {gateNeeded ? (
                <Button
                  onClick={handleSubmitForApproval}
                  size="lg"
                  className="flex-1 min-w-[160px] text-lg py-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600"
                  disabled={busy}
                >
                  <ClipboardCheck className="w-5 h-5 mr-2" /> Submit for approval
                </Button>
              ) : (
                <Button
                  onClick={handleSendPricePack}
                  size="lg"
                  className="flex-1 min-w-[160px] text-lg py-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600"
                  disabled={busy}
                >
                  <Send className="w-5 h-5 mr-2" /> Send price pack
                </Button>
              )}
              <Button
                onClick={() =>
                  navigate(
                    `/quote-lines/${answers.customerId || ''}${tradeId ? `?tradeId=${tradeId}` : ''}`.replace(
                      /\/$/,
                      '',
                    ),
                  )
                }
                size="lg"
                variant="ghost"
                className="text-white/80"
              >
                <FileEdit className="w-4 h-4 mr-2" /> Line editor
              </Button>
            </>
          )}
        </div>

        {totals && trade && (
          <div
            ref={pricingBarRef}
            className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 shadow-2xl border-t-4 border-amber-500 z-40 safe-area-pb"
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm opacity-75">Current Total</p>
                <p className="text-3xl font-bold">£{totals.total.toFixed(0)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75">{trade.name}</p>
                <p className="text-lg font-bold text-amber-400">
                  {String(answers.customerName) || 'No customer'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
