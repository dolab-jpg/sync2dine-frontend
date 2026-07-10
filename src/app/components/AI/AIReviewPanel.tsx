import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AIConfidenceBadge } from './AIConfidenceBadge';
import type { EstimationResult } from '../../engine/aiEstimationService';
import { clampSuggestion } from '../../engine/aiEstimationService';
import type { TradeId } from '../../config/types';
import { getTrade } from '../../config/trades';

interface AIReviewPanelProps {
  tradeId: TradeId;
  result: EstimationResult;
  onAccept: (accepted: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function AIReviewPanel({ tradeId, result, onAccept, onCancel }: AIReviewPanelProps) {
  const confidenceThreshold = getTrade(tradeId).aiExtraction?.lowConfidenceThreshold ?? 0.8;

  const [fields, setFields] = useState<Record<string, { value: string; accepted: boolean }>>(() => {
    const init: Record<string, { value: string; accepted: boolean }> = {};
    Object.entries(result.suggestions).forEach(([k, v]) => {
      init[k] = { value: String(v.value), accepted: v.confidence >= confidenceThreshold };
    });
    return init;
  });

  const acceptAllHigh = () => {
    const next = { ...fields };
    Object.entries(result.suggestions).forEach(([k, v]) => {
      if (v.confidence >= confidenceThreshold) next[k] = { value: String(v.value), accepted: true };
    });
    setFields(next);
  };

  const handleApply = () => {
    const accepted: Record<string, unknown> = {};
    Object.entries(fields).forEach(([k, f]) => {
      if (f.accepted) accepted[k] = clampSuggestion(tradeId, k, f.value);
    });
    onAccept(accepted);
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border">
      <p className="text-sm font-medium text-slate-800">{result.summary}</p>
      {result.risks.length > 0 && (
        <ul className="text-xs text-amber-700 list-disc pl-4">
          {result.risks.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {Object.entries(result.suggestions).map(([key, sug]) => (
          <div key={key} className="flex items-center gap-2 p-2 bg-white rounded-lg border">
            <input
              type="checkbox"
              checked={fields[key]?.accepted ?? false}
              onChange={e => setFields(prev => ({ ...prev, [key]: { ...prev[key], accepted: e.target.checked } }))}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">{key}</span>
                <AIConfidenceBadge confidence={sug.confidence} />
              </div>
              <Input
                value={fields[key]?.value ?? ''}
                onChange={e => setFields(prev => ({ ...prev, [key]: { ...prev[key], value: e.target.value } }))}
                className="mt-1 h-8 text-sm"
              />
              {sug.reason && <p className="text-xs text-gray-500 mt-1">{sug.reason}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={acceptAllHigh}>
          Accept ≥{Math.round(confidenceThreshold * 100)}% confidence
        </Button>
        <Button type="button" size="sm" onClick={handleApply}>Apply to quote</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
