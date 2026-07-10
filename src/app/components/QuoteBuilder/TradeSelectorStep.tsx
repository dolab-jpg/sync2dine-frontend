import { getAllTrades } from '../../config/trades';
import type { TradeId } from '../../config/types';
import { Bath, ChefHat, Zap, Flame, Home, Layers, Paintbrush, Square, Building2, DoorOpen, ArrowUp, TreePine } from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Bath, ChefHat, Zap, Flame, Home, Layers, Paintbrush, Square, Building2, DoorOpen, ArrowUp, TreePine,
};

interface TradeSelectorStepProps {
  selected?: TradeId;
  onSelect: (tradeId: TradeId) => void;
}

export function TradeSelectorStep({ selected, onSelect }: TradeSelectorStepProps) {
  const trades = getAllTrades();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-2xl border-2 border-slate-200">
        <h3 className="text-xl font-bold text-slate-900 mb-2">Select Trade</h3>
        <p className="text-slate-600">Choose the type of construction work for this quote</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trades.map(trade => {
          const Icon = ICONS[trade.icon] ?? Home;
          const isSelected = selected === trade.id;
          return (
            <button
              key={trade.id}
              type="button"
              onClick={() => onSelect(trade.id)}
              className={`p-6 rounded-2xl border-2 text-left transition-all ${
                isSelected ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-gray-200 bg-white hover:border-amber-300'
              }`}
            >
              <Icon className={`w-10 h-10 mb-3 ${isSelected ? 'text-amber-600' : 'text-slate-500'}`} />
              <div className="font-bold text-lg text-slate-900">{trade.name}</div>
              <div className="text-sm text-slate-600 mt-1">{trade.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
