import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext, type Customer } from '../App';
import { useNavigate, useLocation } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ClipboardCheck, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getAllTrades, getTrade } from '../config/trades';
import type { SurveyField, SurveySection, TradeId, WizardAnswers } from '../config/types';
import {
  isHighSurveyRisk,
  saveSurvey,
  scoreMultiTradeSurvey,
  storeSurveyPrefill,
} from '../engine/surveyScorer';

type StepKind = 'setup' | 'section' | 'summary';

interface FlatStep {
  kind: StepKind;
  tradeId?: TradeId;
  section?: SurveySection;
  label: string;
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: SurveyField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'number') {
    return (
      <Input
        type="number"
        min={field.min}
        max={field.max}
        step={field.unit === 'm' ? '0.1' : '1'}
        value={value != null && value !== '' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="text-lg p-4 border-2 rounded-xl"
        placeholder={field.unit ? `${field.unit}` : undefined}
      />
    );
  }

  if (field.type === 'textarea' || field.type === 'text') {
    const Comp = field.type === 'textarea' ? Textarea : Input;
    return (
      <Comp
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value)}
        className="text-base p-4 border-2 rounded-xl min-h-[100px]"
        placeholder={field.description}
      />
    );
  }

  if (field.type === 'toggle') {
    const on = value === true || value === 'yes';
    return (
      <div className="flex gap-3">
        {(['yes', 'no'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 p-4 rounded-xl border-2 font-semibold capitalize ${
              (on && opt === 'yes') || (!on && value === 'no' && opt === 'no')
                ? 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  const options = field.options ?? [];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = String(value ?? '') === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selected
                ? 'border-amber-500 bg-amber-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-amber-300'
            }`}
          >
            <span className="font-semibold text-slate-800">{opt.label}</span>
            {opt.description && (
              <p className="text-xs text-slate-500 mt-1">{opt.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function SiteSurvey() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  if (!context) return null;

  const { customers, updateCustomer } = context;

  const stateCustomer = (location.state as { customer?: Customer } | null)?.customer;

  const [customerId, setCustomerId] = useState(stateCustomer?.id ?? '');
  const [selectedTrades, setSelectedTrades] = useState<TradeId[]>(() => {
    const interested = stateCustomer?.interestedTrades ?? [];
    return interested.length > 0 ? [...interested] : [];
  });
  const [answersByTrade, setAnswersByTrade] = useState<Record<string, WizardAnswers>>({});
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stateCustomer?.id) {
      setCustomerId(stateCustomer.id);
      if (stateCustomer.interestedTrades?.length) {
        setSelectedTrades((prev) => (prev.length ? prev : [...stateCustomer.interestedTrades!]));
      }
    }
  }, [stateCustomer]);

  const trades = getAllTrades();

  const flatSteps: FlatStep[] = useMemo(() => {
    const steps: FlatStep[] = [{ kind: 'setup', label: 'Customer & trades' }];
    for (const tid of selectedTrades) {
      const trade = getTrade(tid);
      for (const section of trade.surveySections) {
        steps.push({
          kind: 'section',
          tradeId: tid,
          section,
          label: `${trade.name}: ${section.title}`,
        });
      }
    }
    if (selectedTrades.length > 0) {
      steps.push({ kind: 'summary', label: 'Risk & continue' });
    }
    return steps;
  }, [selectedTrades]);

  const current = flatSteps[Math.min(stepIndex, flatSteps.length - 1)];

  const scored = useMemo(
    () => scoreMultiTradeSurvey(selectedTrades, answersByTrade),
    [selectedTrades, answersByTrade],
  );

  const toggleTrade = (tid: TradeId) => {
    setSelectedTrades((prev) => {
      if (prev.includes(tid)) {
        const next = prev.filter((t) => t !== tid);
        setAnswersByTrade((a) => {
          const copy = { ...a };
          delete copy[tid];
          return copy;
        });
        return next;
      }
      return [...prev, tid];
    });
  };

  const setField = (tradeId: TradeId, key: string, value: unknown) => {
    setAnswersByTrade((prev) => {
      const currentAnswers = { ...(prev[tradeId] ?? {}), [key]: value };
      if (key === 'length' || key === 'width') {
        const L = Number(key === 'length' ? value : currentAnswers.length) || 0;
        const W = Number(key === 'width' ? value : currentAnswers.width) || 0;
        if (L > 0 && W > 0) currentAnswers.area = Math.round(L * W * 10) / 10;
      }
      return { ...prev, [tradeId]: currentAnswers };
    });
  };

  const canAdvanceSetup = Boolean(customerId) && selectedTrades.length > 0;

  const handleComplete = () => {
    if (!customerId || selectedTrades.length === 0) {
      toast.error('Select a customer and at least one trade');
      return;
    }

    const customer = customers.find((c) => c.id === customerId);
    const jobGroupId = `jg-${Date.now()}`;
    const primaryTrade = selectedTrades[0];
    const mergedAnswers = selectedTrades.reduce<WizardAnswers>((acc, tid) => {
      Object.assign(acc, answersByTrade[tid] ?? {});
      return acc;
    }, { customerId, customerName: customer?.name ?? '' });

    const record = saveSurvey({
      customerId,
      tradeId: primaryTrade,
      tradeIds: selectedTrades,
      answers: mergedAnswers,
      answersByTrade,
      riskScore: scored.riskScore,
      suggestedAdjustments: scored.suggestedAdjustments,
      risks: scored.risks,
      jobGroupId,
    });

    storeSurveyPrefill({
      surveyId: record.id,
      customerId,
      tradeIds: selectedTrades,
      jobGroupId,
      answersByTrade,
      riskScore: scored.riskScore,
      suggestedAdjustments: scored.suggestedAdjustments,
      risks: scored.risks,
    });

    const nextTrades = Array.from(
      new Set([...(customer?.interestedTrades ?? []), ...selectedTrades]),
    );
    if (customer && nextTrades.length !== (customer.interestedTrades?.length ?? 0)) {
      updateCustomer(customerId, { interestedTrades: nextTrades });
    }

    toast.success(
      selectedTrades.length > 1
        ? `Survey saved for ${selectedTrades.length} trades — opening first quote`
        : 'Survey saved — opening quote',
    );
    navigate(`/quote/${primaryTrade}/${customerId}?prefill=survey`);
  };

  const goNext = () => {
    if (current.kind === 'setup' && !canAdvanceSetup) {
      toast.error('Choose a customer and one or more trades');
      return;
    }
    if (stepIndex < flatSteps.length - 1) setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const progressPct =
    flatSteps.length <= 1 ? 0 : Math.round((stepIndex / (flatSteps.length - 1)) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-8 h-8 text-amber-600" />
            Site survey
          </h1>
          <p className="text-slate-600 mt-1">
            Multi-trade on-site discovery — then price and send to the customer
          </p>
        </div>
        {selectedTrades.length > 0 && (
          <div className="text-right text-sm text-slate-500">
            <div className="font-semibold text-slate-800">
              {selectedTrades.map((t) => getTrade(t).name).join(' · ')}
            </div>
            {selectedCustomer && <div>{selectedCustomer.name}</div>}
          </div>
        )}
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Step {stepIndex + 1} of {flatSteps.length}: {current?.label}
      </p>

      {current?.kind === 'setup' && (
        <Card>
          <CardHeader>
            <CardTitle>Customer & trades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="text-base p-5 border-2 rounded-xl">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.name}</span>
                      {c.address ? (
                        <span className="text-slate-500 text-sm"> — {c.address}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">
                Trades to survey (select all that apply)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {trades.map((t) => {
                  const on = selectedTrades.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTrade(t.id)}
                      className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all ${
                        on
                          ? 'border-amber-500 bg-amber-50 text-amber-950'
                          : 'border-slate-200 bg-white hover:border-amber-300'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
              {selectedTrades.length > 1 && (
                <p className="text-sm text-slate-600">
                  You will walk through each trade in order, then open quotes under one job group.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {current?.kind === 'section' && current.tradeId && current.section && (
        <Card>
          <CardHeader>
            <CardTitle>{current.label}</CardTitle>
            {current.section.description && (
              <p className="text-sm text-slate-600">{current.section.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {current.section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="text-base font-semibold">
                  {field.label}
                  {field.required ? <span className="text-red-500"> *</span> : null}
                </Label>
                {field.description && (
                  <p className="text-xs text-slate-500">{field.description}</p>
                )}
                <FieldControl
                  field={field}
                  value={answersByTrade[current.tradeId!]?.[field.key]}
                  onChange={(v) => setField(current.tradeId!, field.key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {current?.kind === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isHighSurveyRisk(scored.riskScore) ? (
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              ) : (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              )}
              Survey summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`p-4 rounded-xl border-2 ${
                isHighSurveyRisk(scored.riskScore)
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-emerald-300 bg-emerald-50'
              }`}
            >
              <p className="text-sm font-medium text-slate-700">Risk score</p>
              <p className="text-4xl font-bold text-slate-900">{scored.riskScore}</p>
              <p className="text-sm text-slate-600 mt-1">
                {isHighSurveyRisk(scored.riskScore)
                  ? 'High risk — quote will likely need senior approval before sending'
                  : 'Within normal range — you can price and send when ready'}
              </p>
            </div>
            {scored.risks.length > 0 && (
              <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">
                {scored.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <p className="text-sm text-slate-600">
              Next: open the quote wizard for{' '}
              <strong>{getTrade(selectedTrades[0]).name}</strong>
              {selectedTrades.length > 1
                ? ` (then ${selectedTrades.length - 1} more trade${selectedTrades.length > 2 ? 's' : ''})`
                : ''}
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur p-4 z-20">
        <div className="max-w-3xl mx-auto flex justify-between gap-3">
          <Button variant="outline" onClick={goBack} disabled={stepIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {current?.kind === 'summary' ? (
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleComplete}
            >
              Continue to quote <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={goNext}
              disabled={current?.kind === 'setup' && !canAdvanceSetup}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
