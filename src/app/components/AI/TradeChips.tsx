import { useState } from 'react';
import { Link } from 'react-router';
import { getAllTrades, getTrade } from '../../config/trades';
import type { TradeId } from '../../config/types';
import type { DetectedTrade } from '../../engine/staffAiService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Sparkles } from 'lucide-react';

interface TradeChipsProps {
  detectedTrades: DetectedTrade[];
  activeTradeId: TradeId | null;
  aiDetected: boolean;
  onSelectTrade: (id: TradeId) => void;
  hidden?: boolean;
}

/** Collapsed by default — trade is inferred silently; manual override only when expanded */
export function TradeChips({ detectedTrades, activeTradeId, onSelectTrade, hidden = true }: TradeChipsProps) {
  const trades = getAllTrades();
  const [expanded, setExpanded] = useState(false);
  const activeTrade = activeTradeId ? getTrade(activeTradeId) : null;

  if (hidden && !expanded) {
    return (
      <div className="px-3 py-1 border-b bg-slate-50/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] text-slate-500"
          onClick={() => setExpanded(true)}
        >
          Change trade manually
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b bg-slate-50/80 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {detectedTrades.length > 0 ? (
          detectedTrades.map(d => (
            <button
              key={d.tradeId}
              type="button"
              onClick={() => onSelectTrade(d.tradeId)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                activeTradeId === d.tradeId
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
              }`}
              title={d.reason}
            >
              {getTrade(d.tradeId).name}
            </button>
          ))
        ) : activeTrade ? (
          <span className="text-xs text-slate-600">{activeTrade.name}</span>
        ) : (
          <span className="text-xs text-slate-500">Describe the job — AI will detect the trade</span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <Select
          value={activeTradeId ?? undefined}
          onValueChange={v => onSelectTrade(v as TradeId)}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Pick trade manually">
              {activeTrade?.name ?? 'Pick trade'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {trades.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeTradeId && (
          <Link
            to={`/ai-render/${activeTradeId}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-purple-200 text-purple-700 hover:bg-purple-50 shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            Design
          </Link>
        )}
        {hidden && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setExpanded(false)}>
            Hide
          </Button>
        )}
      </div>
    </div>
  );
}
