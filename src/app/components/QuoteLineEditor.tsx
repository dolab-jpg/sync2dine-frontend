import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import type { QuoteLine } from '../App';
import { calcLineTotal, calcQuoteTotals, createQuoteLine } from '../engine/quotes/quoteLineUtils';
import { useAIAssistant } from '../context/AIAssistantContext';

const UNITS: QuoteLine['unit'][] = ['sqm', 'linear_m', 'cubic_m', 'item', 'day', 'hour', 'fixed'];

interface Props {
  lines: QuoteLine[];
  discount: number;
  onChange: (lines: QuoteLine[], discount: number) => void;
}

export default function QuoteLineEditor({ lines, discount, onChange }: Props) {
  const { setIsOpen } = useAIAssistant();
  const totals = calcQuoteTotals(lines, discount);

  const updateLine = (id: string, patch: Partial<QuoteLine>) => {
    const next = lines.map((l) => {
      if (l.id !== id) return l;
      const merged = { ...l, ...patch };
      merged.total = calcLineTotal(merged.quantity, merged.rate, merged.unit);
      return merged;
    });
    onChange(next, discount);
  };

  const addLine = () => {
    onChange([...lines, createQuoteLine({ description: '', quantity: 1, unit: 'item', rate: 0 })], discount);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((l) => l.id !== id), discount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Line items</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          <Sparkles className="w-4 h-4 mr-1" /> AI
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-2 min-w-[180px]">Description</th>
              <th className="p-2 w-20">Qty</th>
              <th className="p-2 w-28">Unit</th>
              <th className="p-2 w-24">Rate</th>
              <th className="p-2 w-24">Total</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="p-1">
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: e.target.value })}
                    placeholder="Type item description..."
                    className="h-9"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) || 0 })}
                    className="h-9"
                  />
                </td>
                <td className="p-1">
                  <Select value={line.unit} onValueChange={(v) => updateLine(line.id, { unit: v as QuoteLine['unit'] })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.rate}
                    onChange={(e) => updateLine(line.id, { rate: Number(e.target.value) || 0 })}
                    className="h-9"
                  />
                </td>
                <td className="p-2 font-medium">£{line.total.toFixed(2)}</td>
                <td className="p-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" onClick={addLine} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Add line
      </Button>

      <div className="grid grid-cols-2 gap-3 max-w-sm ml-auto text-sm">
        <span className="text-slate-600">Subtotal</span>
        <span className="text-right font-medium">£{totals.subtotal.toFixed(2)}</span>
        <span className="text-slate-600">Discount %</span>
        <Input
          type="number"
          min={0}
          max={100}
          value={discount}
          onChange={(e) => onChange(lines, Number(e.target.value) || 0)}
          className="h-8"
        />
        <span className="text-slate-600">VAT (20%)</span>
        <span className="text-right">£{totals.vat.toFixed(2)}</span>
        <span className="font-semibold">Total</span>
        <span className="text-right font-bold text-lg">£{totals.total.toFixed(2)}</span>
      </div>
    </div>
  );
}

export { calcQuoteTotals };
