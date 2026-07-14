import type { TradeConfig, TradeId, WizardAnswers } from '../config/types';
import { getTrade } from '../config/trades';

export interface SurveyRecord {
  id: string;
  customerId: string;
  /** Primary / first trade (legacy + handoff) */
  tradeId: string;
  /** All trades surveyed in this visit */
  tradeIds: TradeId[];
  answers: WizardAnswers;
  /** Per-trade answer bags keyed by tradeId */
  answersByTrade: Record<string, WizardAnswers>;
  riskScore: number;
  suggestedAdjustments: Record<string, unknown>;
  risks: string[];
  jobGroupId?: string;
  createdAt: string;
}

export const SURVEY_PREFILL_KEY = 'surveyQuotePrefill';

export interface SurveyQuotePrefill {
  surveyId: string;
  customerId: string;
  tradeIds: TradeId[];
  jobGroupId: string;
  answersByTrade: Record<string, WizardAnswers>;
  riskScore: number;
  suggestedAdjustments: Record<string, unknown>;
  risks: string[];
}

export function scoreSurvey(trade: TradeConfig, answers: WizardAnswers): {
  riskScore: number;
  suggestedAdjustments: Record<string, unknown>;
  risks: string[];
} {
  let riskScore = 0;
  const risks: string[] = [];
  const suggestedAdjustments: Record<string, unknown> = {};

  for (const section of trade.surveySections) {
    for (const field of section.fields) {
      const val = answers[field.key];
      if (val === undefined || val === null || val === '' || !field.costAdjustment) continue;
      const adjustment = field.costAdjustment[String(val)];
      if (adjustment) {
        riskScore += field.riskWeight ?? 10;
        risks.push(`${trade.name} — ${field.label}: may add ~£${adjustment}`);
        suggestedAdjustments[`${trade.id}_${field.key}Cost`] = adjustment;
      }
    }
  }

  if (answers.floorLocation === 'loft') {
    suggestedAdjustments.floorLocation = 'loft';
    riskScore += 15;
    risks.push(`${trade.name} — loft / attic access`);
  }
  if (answers.parking === 'difficult' || answers.access === 'difficult') {
    suggestedAdjustments.access = 'difficult';
    riskScore += 10;
    risks.push(`${trade.name} — difficult access`);
  }

  return { riskScore: Math.min(100, riskScore), suggestedAdjustments, risks };
}

export function scoreMultiTradeSurvey(
  tradeIds: TradeId[],
  answersByTrade: Record<string, WizardAnswers>,
): {
  riskScore: number;
  suggestedAdjustments: Record<string, unknown>;
  risks: string[];
} {
  let riskScore = 0;
  const risks: string[] = [];
  const suggestedAdjustments: Record<string, unknown> = {};

  for (const tid of tradeIds) {
    const trade = getTrade(tid);
    const scored = scoreSurvey(trade, answersByTrade[tid] ?? {});
    riskScore += scored.riskScore;
    risks.push(...scored.risks);
    Object.assign(suggestedAdjustments, scored.suggestedAdjustments);
  }

  return {
    riskScore: Math.min(100, Math.round(riskScore / Math.max(1, tradeIds.length))),
    suggestedAdjustments,
    risks,
  };
}

export function loadSurveys(): SurveyRecord[] {
  try {
    const saved = localStorage.getItem('surveys');
    if (!saved) return [];
    const parsed = JSON.parse(saved) as SurveyRecord[];
    return parsed.map((s) => ({
      ...s,
      tradeIds: s.tradeIds?.length ? s.tradeIds : s.tradeId ? [s.tradeId as TradeId] : [],
      answersByTrade: s.answersByTrade ?? (s.tradeId ? { [s.tradeId]: s.answers ?? {} } : {}),
      risks: s.risks ?? [],
    }));
  } catch {
    return [];
  }
}

export function saveSurvey(
  record: Omit<SurveyRecord, 'id' | 'createdAt'>,
): SurveyRecord {
  const surveys = loadSurveys();
  const newRecord: SurveyRecord = {
    ...record,
    tradeIds: record.tradeIds?.length
      ? record.tradeIds
      : record.tradeId
        ? [record.tradeId as TradeId]
        : [],
    answersByTrade: record.answersByTrade ?? {},
    risks: record.risks ?? [],
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  surveys.push(newRecord);
  localStorage.setItem('surveys', JSON.stringify(surveys));
  return newRecord;
}

export function saveSurveys(surveys: SurveyRecord[]): void {
  localStorage.setItem('surveys', JSON.stringify(surveys));
}

export function storeSurveyPrefill(prefill: SurveyQuotePrefill): void {
  sessionStorage.setItem(SURVEY_PREFILL_KEY, JSON.stringify(prefill));
}

export function loadSurveyPrefill(): SurveyQuotePrefill | null {
  try {
    const raw = sessionStorage.getItem(SURVEY_PREFILL_KEY);
    return raw ? (JSON.parse(raw) as SurveyQuotePrefill) : null;
  } catch {
    return null;
  }
}

export function clearSurveyPrefill(): void {
  sessionStorage.removeItem(SURVEY_PREFILL_KEY);
}

/** High risk for manager gate (≥ 40 average). */
export function isHighSurveyRisk(riskScore: number): boolean {
  return riskScore >= 40;
}
