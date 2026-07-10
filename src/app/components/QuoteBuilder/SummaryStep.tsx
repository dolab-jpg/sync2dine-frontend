import type { QuoteCalculationResult } from '../../config/types';
import type { WizardAnswers } from '../../config/types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface SummaryStepProps {
  answers: WizardAnswers;
  totals: QuoteCalculationResult;
  onChange: (answers: WizardAnswers) => void;
}

export function SummaryStep({ answers, totals, onChange }: SummaryStepProps) {
  const area = Number(answers.area) || 0;
  const labourDays = Number(answers.labourDays) || 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 rounded-3xl text-white text-center shadow-2xl">
        <p className="text-2xl mb-2 opacity-90">Total Project Cost</p>
        <p className="text-7xl font-bold">£{totals.total.toFixed(0)}</p>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-2xl space-y-4">
        <h3 className="text-2xl font-bold text-slate-800 mb-4">Breakdown</h3>
        {totals.breakdown.finishCost > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Finish ({area.toFixed(1)}m²)</span>
            <span className="font-bold">£{totals.breakdown.finishCost.toFixed(0)}</span>
          </div>
        )}
        {totals.breakdown.productsCost > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Products</span>
            <span className="font-bold">£{totals.breakdown.productsCost.toFixed(0)}</span>
          </div>
        )}
        {totals.breakdown.additionsCost > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Additions</span>
            <span className="font-bold">£{totals.breakdown.additionsCost.toFixed(0)}</span>
          </div>
        )}
        {totals.breakdown.labourCost > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Labour ({labourDays} days)</span>
            <span className="font-bold">£{totals.breakdown.labourCost.toFixed(0)}</span>
          </div>
        )}
        {totals.breakdown.materialsCost > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Materials</span>
            <span className="font-bold">£{totals.breakdown.materialsCost.toFixed(0)}</span>
          </div>
        )}
        {totals.breakdown.removalCost > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Removal</span>
            <span className="font-bold">£{totals.breakdown.removalCost.toFixed(0)}</span>
          </div>
        )}
        {totals.breakdown.accessAdjustment > 0 && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Access & Location</span>
            <span className="font-bold text-amber-600">+£{totals.breakdown.accessAdjustment.toFixed(0)}</span>
          </div>
        )}
        {(totals.breakdown.scopeCost > 0 || totals.breakdown.conversionCost > 0 || totals.breakdown.surfaceCost > 0 || totals.breakdown.prepCost > 0) && (
          <div className="flex justify-between text-lg py-3 border-b">
            <span className="text-slate-600">Scope & extras</span>
            <span className="font-bold">£{(totals.breakdown.scopeCost + totals.breakdown.conversionCost + totals.breakdown.surfaceCost + totals.breakdown.prepCost).toFixed(0)}</span>
          </div>
        )}
        <div className="flex justify-between text-xl py-4 border-t-2 border-slate-300">
          <span className="font-bold">Subtotal</span>
          <span className="font-bold">£{totals.subtotal.toFixed(0)}</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl border-2 border-amber-300">
        <Label className="text-xl font-bold mb-3 block">Apply Discount (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={Number(answers.discount) || 0}
          onChange={e => onChange({ ...answers, discount: parseFloat(e.target.value) || 0 })}
          className="text-3xl p-6 border-2 rounded-2xl text-center font-bold"
        />
        {Number(answers.discount) > 0 && (
          <p className="text-center text-amber-800 mt-3">Save £{totals.discountAmount.toFixed(0)}</p>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-300">
        <Label className="text-xl font-bold mb-3 block">Booking Deposit (£)</Label>
        <Input
          type="number"
          value={Number(answers.bookingDeposit) || 500}
          onChange={e => onChange({ ...answers, bookingDeposit: parseFloat(e.target.value) || 0 })}
          className="text-3xl p-6 border-2 rounded-2xl text-center font-bold"
        />
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border-2 border-purple-300">
        <Label className="text-xl font-bold mb-3 block">Preferred Start Date</Label>
        <Input
          type="date"
          value={String(answers.bookingDate ?? '')}
          onChange={e => onChange({ ...answers, bookingDate: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          className="text-2xl p-6 border-2 rounded-2xl"
        />
      </div>
    </div>
  );
}
