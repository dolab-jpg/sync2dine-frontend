import { Button } from '../ui/button';
import { getTrade } from '../../config/trades';
import type { StaffAIAction } from '../../engine/staffAiService';
import type { TradeId } from '../../config/types';
import { UserPlus, FileText } from 'lucide-react';

interface StaffAIActionCardsProps {
  actions: StaffAIAction[];
  onApplyLinkCustomer: (output: Record<string, unknown>) => void;
  onApplyStartQuote: (output: Record<string, unknown>) => void;
  onApplyQuoteFields?: (output: Record<string, unknown>) => void;
  onDismiss: () => void;
  embedded?: boolean;
}

export function StaffAIActionCards({
  actions,
  onApplyLinkCustomer,
  onApplyStartQuote,
  onApplyQuoteFields,
  onDismiss,
  embedded = false,
}: StaffAIActionCardsProps) {
  const linkAction = actions.find(a => a.action === 'linkCustomer');
  const startAction = actions.find(a => a.action === 'startQuote');
  const fieldsAction = actions.find(a => a.action === 'proposeQuoteFields');

  if (!linkAction && !startAction && !fieldsAction) return null;

  const tradeId = (startAction?.output.tradeId ?? fieldsAction?.output.tradeId) as TradeId | undefined;
  const trade = tradeId ? getTrade(tradeId) : null;

  return (
    <div className={embedded ? 'space-y-2' : 'space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200'}>
      {!embedded && (
        <p className="text-xs font-medium text-slate-700">Suggested next step</p>
      )}

      {(fieldsAction || startAction) && (
        <div className="flex items-center justify-between gap-2 bg-white rounded-lg p-2 border text-xs">
          <div>
            <FileText className="w-3 h-3 inline mr-1 text-amber-600" />
            <span className="font-medium">{trade?.name ?? 'Quote'}</span>
            <span className="text-slate-500 block mt-0.5">Quote draft ready — fancy a look?</span>
          </div>
          <div className="flex gap-1 shrink-0">
            {fieldsAction && onApplyQuoteFields && (
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onApplyQuoteFields(fieldsAction.output)}>
                Stage fields
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onApplyStartQuote(startAction?.output ?? fieldsAction!.output)}
            >
              Open quote
            </Button>
          </div>
        </div>
      )}

      {linkAction && (
        <div className="flex items-center justify-between gap-2 bg-white rounded-lg p-2 border text-xs">
          <div className="min-w-0">
            <UserPlus className="w-3 h-3 inline mr-1 text-amber-600" />
            {linkAction.output.isNew ? 'Save new customer: ' : 'Link customer: '}
            <span className="font-medium">{String(linkAction.output.name || '—')}</span>
          </div>
          <Button type="button" size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => onApplyLinkCustomer(linkAction.output)}>
            Continue
          </Button>
        </div>
      )}

      {!embedded && (
        <Button type="button" size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
