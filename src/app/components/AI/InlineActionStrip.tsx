import { Button } from '../ui/button';
import { FileText, X } from 'lucide-react';
import type { CopilotAction } from '../../engine/ai/orchestratorService';
import { getHumanActionLabel } from '../../engine/ai/actionPolicy';

interface InlineActionStripProps {
  actions: CopilotAction[];
  onOpenQuote: (output: Record<string, unknown>) => void;
  onDismiss: () => void;
}

function describeStrip(actions: CopilotAction[]): string {
  const hasQuote = actions.some((a) =>
    ['proposeQuoteFields', 'startQuote'].includes(a.action)
  );
  const hasLink = actions.some((a) => a.action === 'linkCustomer');
  if (hasQuote && hasLink) return 'Quote draft and customer details ready.';
  const first = actions[0];
  if (!first) return 'Review suggested action.';
  return getHumanActionLabel(first.action);
}

export function InlineActionStrip({ actions, onOpenQuote, onDismiss }: InlineActionStripProps) {
  if (actions.length === 0) return null;

  const quoteAction = actions.find((a) => a.action === 'startQuote' || a.action === 'proposeQuoteFields');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">
      <p className="flex-1 text-slate-700 text-xs">{describeStrip(actions)}</p>
      <div className="flex gap-2 shrink-0">
        {quoteAction && (
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenQuote(quoteAction.output)}
          >
            <FileText className="w-3 h-3 mr-1" /> Open quote
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onDismiss}>
          <X className="w-3 h-3 mr-1" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
