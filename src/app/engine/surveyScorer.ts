import type { TradeConfig } from '../config/types';
import type { WizardAnswers } from '../config/types';

export interface SurveyRecord {
  id: string;
  customerId: string;
  tradeId: string;
  answers: WizardAnswers;
  riskScore: number;
  suggestedAdjustments: Record<string, unknown>;
  createdAt: string;
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
      if (!val || !field.costAdjustment) continue;
      const adjustment = field.costAdjustment[String(val)];
      if (adjustment) {
        riskScore += field.riskWeight ?? 10;
        risks.push(`${field.label}: may add ~£${adjustment}`);
        suggestedAdjustments[`${field.key}Cost`] = adjustment;
      }
    }
  }

  if (answers.floorLocation === 'loft') {
    suggestedAdjustments.floorLocation = 'loft';
    riskScore += 15;
    risks.push('Loft location — access constraints');
  }
  if (answers.parking === 'difficult' || answers.access === 'difficult') {
    suggestedAdjustments.access = 'difficult';
    riskScore += 10;
  }

  return { riskScore: Math.min(100, riskScore), suggestedAdjustments, risks };
}

export function loadSurveys(): SurveyRecord[] {
  try {
    const saved = localStorage.getItem('surveys');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveSurvey(record: Omit<SurveyRecord, 'id' | 'createdAt'>): SurveyRecord {
  const surveys = loadSurveys();
  const newRecord: SurveyRecord = {
    ...record,
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
