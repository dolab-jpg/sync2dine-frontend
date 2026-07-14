import type { TradeId } from '../config/types';
import { integrationService } from './integrations/integrationService';

export interface DetectedTrade {
  tradeId: TradeId;
  confidence: number;
  reason?: string;
}

export interface StaffAIAction {
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface StaffAIResult {
  content: string;
  proposedActions?: StaffAIAction[];
  detectedTrades?: DetectedTrade[];
}

export interface StaffAIContext {
  route?: string;
  tradeId?: string | null;
  customerId?: string | null;
  customers?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    interestedTrades?: TradeId[];
  }>;
}

export async function sendStaffAIMessage(
  messages: { role: string; content: string }[],
  staffContext: StaffAIContext,
  model?: string
): Promise<StaffAIResult> {
  const openaiConfig = integrationService.getConfig('openai');

  try {
    const res = await fetch('/api/ai/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        staffContext,
        model,
        apiKey: integrationService.getLiveOpenAIApiKey(),
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fall through to client mock
  }

  const last = messages[messages.length - 1]?.content ?? '';
  const { mockStaffAIClient } = await import('./staffAiMock');
  return mockStaffAIClient(last, staffContext);
}

export function extractDetectedTrades(result: StaffAIResult): DetectedTrade[] {
  if (result.detectedTrades?.length) return result.detectedTrades;
  const detectAction = result.proposedActions?.find(a => a.action === 'detectTrades');
  if (detectAction?.output.trades) {
    return detectAction.output.trades as DetectedTrade[];
  }
  return [];
}

export function extractStartQuoteAction(result: StaffAIResult): StaffAIAction | undefined {
  return result.proposedActions?.find(a => a.action === 'startQuote');
}

export function extractLinkCustomerAction(result: StaffAIResult): StaffAIAction | undefined {
  return result.proposedActions?.find(a => a.action === 'linkCustomer');
}

export function extractProposeFieldsAction(result: StaffAIResult, tradeId?: string): StaffAIAction | undefined {
  const actions = result.proposedActions?.filter(a => a.action === 'proposeQuoteFields') ?? [];
  if (tradeId) return actions.find(a => a.output.tradeId === tradeId);
  return actions[0];
}
