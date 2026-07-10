import { Check } from 'lucide-react';
import type { Customer, Product } from '../../App';
import type { TradeConfig, WizardAnswers } from '../../config/types';
import { computeDerivedFields } from '../../engine/quoteCalculator';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface DynamicStageProps {
  trade: TradeConfig;
  stageIndex: number;
  answers: WizardAnswers;
  onChange: (answers: WizardAnswers) => void;
  customers: Customer[];
  products: Product[];
}

function OptionCard({ selected, onClick, children, price }: { selected: boolean; onClick: () => void; children: React.ReactNode; price?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-6 rounded-2xl border-3 transition-all text-left ${
        selected ? 'border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg scale-[1.02]' : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">{children}</div>
        {selected && (
          <div className="ml-4 bg-amber-500 text-white rounded-full p-2">
            <Check className="w-6 h-6" />
          </div>
        )}
      </div>
      {price !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <span className="text-2xl font-bold text-amber-700">£{price.toFixed(0)}</span>
        </div>
      )}
    </button>
  );
}

export function DynamicStage({ trade, stageIndex, answers, onChange, customers, products }: DynamicStageProps) {
  const stage = trade.wizardStages[stageIndex];
  if (!stage) return null;

  const set = (key: string, value: unknown) => {
    let next = { ...answers, [key]: value };
    if (key === 'length' || key === 'width') {
      next = computeDerivedFields(next, trade);
    }
    onChange(next);
  };

  const area = Number(answers.area) || 0;
  const tradeProducts = products.filter(p => !p.tradeId || p.tradeId === trade.id);

  return (
    <div className="space-y-6">
      {stage.description && (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border-2 border-blue-200">
          <h3 className="text-xl font-bold text-blue-900 mb-2">{stage.title}</h3>
          <p className="text-blue-700">{stage.description}</p>
        </div>
      )}

      {stage.fields.map(field => {
        const val = answers[field.key];

        if (field.type === 'customer-select') {
          return (
            <div key={field.key} className="space-y-4">
              <Label className="text-2xl font-bold text-slate-800">{field.label}</Label>
              <Select value={String(val ?? '')} onValueChange={v => {
                const customer = customers.find(c => c.id === v);
                onChange({ ...answers, customerId: v, customerName: customer?.name ?? '' });
              }}>
                <SelectTrigger className="text-xl p-6 border-2 rounded-2xl">
                  <SelectValue placeholder="Choose a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-lg py-4">
                      <div>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-sm text-gray-600">{c.address}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.type === 'number' && !field.computeFrom) {
          return (
            <div key={field.key}>
              <Label className="text-xl font-bold mb-3 block">{field.label}</Label>
              <Input
                type="number"
                step={field.key.includes('length') || field.key.includes('width') ? '0.1' : '1'}
                value={val != null ? String(val) : ''}
                onChange={e => set(field.key, e.target.value)}
                className="text-3xl p-6 border-2 rounded-2xl text-center font-bold"
                placeholder={field.placeholder}
              />
            </div>
          );
        }

        if (field.key === 'area' && area > 0) {
          return (
            <div key={field.key} className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 rounded-3xl text-white text-center shadow-2xl">
              <p className="text-xl mb-2 opacity-90">Total Area</p>
              <p className="text-6xl font-bold">{area.toFixed(1)} m²</p>
              {answers.labourDays != null && (
                <p className="text-lg mt-4 opacity-90">Estimated {String(answers.labourDays)} days labour</p>
              )}
            </div>
          );
        }

        if (field.computeFrom) return null;

        if (field.type === 'finish-picker' || (field.type === 'select' && field.options && field.options.length > 3)) {
          return (
            <div key={field.key} className="grid grid-cols-1 gap-4">
              {field.options?.map(opt => (
                <OptionCard
                  key={opt.value}
                  selected={val === opt.value}
                  onClick={() => set(field.key, opt.value)}
                >
                  <div className="text-2xl font-bold text-slate-800">{opt.label}</div>
                  {opt.price != null && (
                    <div className="text-lg text-slate-600 mt-1">
                      £{opt.price}/{field.key === 'finish' ? 'm²' : 'unit'}
                      {area > 0 && field.key === 'finish' && ` • Total: £${(opt.price * area).toFixed(0)}`}
                    </div>
                  )}
                  {opt.description && <div className="text-sm text-gray-500 mt-1">{opt.description}</div>}
                </OptionCard>
              ))}
            </div>
          );
        }

        if (field.type === 'select' && field.options) {
          return (
            <div key={field.key}>
              <Label className="text-xl font-bold mb-4 block">{field.label}</Label>
              <div className="grid grid-cols-1 gap-4">
                {field.options.map(opt => (
                  <OptionCard key={opt.value} selected={val === opt.value} onClick={() => set(field.key, opt.value)}>
                    <div className="text-2xl font-bold">{opt.label}</div>
                    {opt.priceAdjustment ? (
                      <div className="text-lg text-amber-600 mt-1">+£{opt.priceAdjustment}</div>
                    ) : opt.price != null && opt.price > 0 ? (
                      <div className="text-lg text-amber-600 mt-1">£{opt.price}</div>
                    ) : (
                      <div className="text-lg text-gray-600 mt-1">{opt.description ?? 'Included'}</div>
                    )}
                  </OptionCard>
                ))}
              </div>
            </div>
          );
        }

        if (field.type === 'multi-select' && field.options) {
          const selected = (val as string[]) ?? [];
          return (
            <div key={field.key} className="grid grid-cols-1 gap-4">
              {field.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = selected.includes(opt.value)
                      ? selected.filter(x => x !== opt.value)
                      : [...selected, opt.value];
                    set(field.key, next);
                  }}
                  className={`p-6 rounded-2xl border-3 transition-all text-left ${
                    selected.includes(opt.value) ? 'border-indigo-500 bg-indigo-50 shadow-lg' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xl font-bold">{opt.label}</div>
                      {opt.price != null && <div className="text-lg text-amber-600 font-bold mt-1">+£{opt.price}</div>}
                    </div>
                    {selected.includes(opt.value) && <Check className="w-6 h-6 text-indigo-500" />}
                  </div>
                </button>
              ))}
            </div>
          );
        }

        if (field.type === 'product-picker' && field.productCategory) {
          const categoryProducts = tradeProducts.filter(p => p.category === field.productCategory);
          return (
            <div key={field.key}>
              <Label className="text-xl font-bold mb-4 block">{field.label}</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryProducts.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => set(field.key, product.id)}
                    className={`relative p-4 rounded-2xl border-2 transition-all text-left ${
                      val === product.id ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-gray-200 bg-white'
                    }`}
                  >
                    {product.image && (
                      <img src={product.image} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                    )}
                    <h4 className="font-semibold mb-1">{product.name}</h4>
                    <p className="text-lg font-bold text-amber-600">£{product.sellPrice.toFixed(0)}</p>
                  </button>
                ))}
                {categoryProducts.length === 0 && (
                  <p className="text-gray-500 col-span-2">No products in catalog for {field.productCategory}. Add via Products admin.</p>
                )}
              </div>
            </div>
          );
        }

        if (field.type === 'date') {
          return (
            <div key={field.key}>
              <Label className="text-xl font-bold mb-3 block">{field.label}</Label>
              <Input
                type="date"
                value={String(val ?? '')}
                onChange={e => set(field.key, e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="text-2xl p-6 border-2 rounded-2xl"
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
