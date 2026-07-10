import type { Product, PricingRule } from '../App';
import type { TradeConfig, WizardAnswers, QuoteCalculationResult } from '../config/types';
import { getTrade } from '../config/trades';

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return v != null ? String(v) : '';
}

export function computeDerivedFields(answers: WizardAnswers, trade: TradeConfig): WizardAnswers {
  const result = { ...answers };
  const length = num(result.length);
  const width = num(result.width);
  const area = length > 0 && width > 0 ? length * width : num(result.area);
  if (area > 0) result.area = area;

  const rooms = num(result.rooms, 1);
  const radiators = num(result.radiators);
  const windows = num(result.windows);

  if (!result.labourDays || num(result.labourDays) === 0) {
    const labourRule = trade.labourRules.find(r => r.key === 'labourDays');
    if (labourRule?.formula) {
      if (labourRule.formula.includes('area/5')) result.labourDays = Math.ceil(area / 5) + 2;
      else if (labourRule.formula.includes('area/4')) result.labourDays = Math.ceil(area / 4) + 3;
      else if (labourRule.formula.includes('area/15')) result.labourDays = Math.ceil(area / 15) + 2;
      else if (labourRule.formula.includes('area/20')) result.labourDays = Math.ceil(area / 20) + 1;
      else if (labourRule.formula.includes('area/25')) result.labourDays = Math.ceil(area / 25) + rooms * 0.5;
      else if (labourRule.formula.includes('area/30')) result.labourDays = Math.ceil(area / 30) + 1;
      else if (labourRule.formula.includes('area/8')) result.labourDays = Math.ceil(area / 8) + 10;
      else if (labourRule.formula.includes('area/12')) result.labourDays = Math.ceil(area / 12) + 2;
      else if (labourRule.formula.includes('area/6')) result.labourDays = Math.ceil(area / 6) + 15;
      else if (labourRule.formula.includes('rooms*1.5')) result.labourDays = rooms * 1.5 + 1;
      else if (labourRule.formula.includes('radiators/3')) result.labourDays = Math.ceil(radiators / 3) + 2;
      else result.labourDays = Math.max(1, Math.ceil(area / 10));
    }
  }

  if (!result.labourRate) {
    const dayRule = pricingRulesFallback(trade);
    result.labourRate = trade.defaultLabourRate ?? dayRule;
  }

  return result;
}

function pricingRulesFallback(trade: TradeConfig): number {
  const rule = trade.labourRules.find(r => r.rateType === 'per_day');
  return rule?.baseRate ?? 250;
}

export function calculateQuote(
  tradeId: string,
  rawAnswers: WizardAnswers,
  products: Product[],
  _pricingRules: PricingRule[]
): QuoteCalculationResult {
  const trade = getTrade(tradeId as Parameters<typeof getTrade>[0]);
  const answers = computeDerivedFields(rawAnswers, trade);

  const area = num(answers.area);
  const labourDays = num(answers.labourDays);
  const labourRate = num(answers.labourRate, trade.defaultLabourRate ?? 250);
  const discount = num(answers.discount);
  const rooms = num(answers.rooms, 1);
  const windows = num(answers.windows);
  const radiators = num(answers.radiators);
  const linearMetres = num(answers.linearMetres);
  const coats = num(answers.coats, 2);
  const sockets = num(answers.sockets);
  const lights = num(answers.lights);

  const breakdown: Record<string, number> = {
    finishCost: 0,
    productsCost: 0,
    additionsCost: 0,
    labourCost: 0,
    materialsCost: 0,
    removalCost: 0,
    accessAdjustment: 0,
    scopeCost: 0,
    prepCost: 0,
    conversionCost: 0,
    surfaceCost: 0,
  };

  // Finish / surface / scope select fields with prices
  const finishKey = str(answers.finish) || str(answers.surfaceType) || str(answers.boilerType) || str(answers.conversionType) || str(answers.jobType);
  for (const stage of trade.wizardStages) {
    for (const field of stage.fields) {
      const val = str(answers[field.key]);
      if (!val) continue;
      if (field.type === 'finish-picker' || field.type === 'select') {
        const opt = field.options?.find(o => o.value === val);
        if (opt?.price) {
          if (field.key === 'finish' || field.key === 'surfaceType') {
            breakdown.finishCost = area * opt.price;
          } else if (field.key === 'conversionType' || field.key === 'jobType') {
            breakdown.conversionCost = opt.price;
          } else if (field.key === 'boilerType') {
            breakdown.scopeCost = opt.price;
          } else if (field.key === 'subfloor' || field.key === 'prepLevel') {
            breakdown.prepCost = area * opt.price * coats;
          } else if (field.key === 'storeys' || field.key === 'specLevel' || field.key === 'foundations') {
            breakdown.scopeCost += opt.price;
          }
        }
      }
    }
  }

  // Fallback finish from finish field options in bathroom-style
  if (breakdown.finishCost === 0 && finishKey && area > 0) {
    for (const stage of trade.wizardStages) {
      const finishField = stage.fields.find(f => f.key === 'finish');
      const opt = finishField?.options?.find(o => o.value === finishKey);
      if (opt?.price) breakdown.finishCost = area * opt.price;
    }
  }

  // Surface cost for landscaping
  if (trade.id === 'landscaping' && area > 0) {
    const surfaceField = trade.wizardStages.flatMap(s => s.fields).find(f => f.key === 'surfaceType');
    const opt = surfaceField?.options?.find(o => o.value === str(answers.surfaceType));
    if (opt?.price) breakdown.surfaceCost = area * opt.price;
  }

  // Product pickers
  const productKeys = trade.wizardStages.flatMap(s => s.fields).filter(f => f.type === 'product-picker').map(f => f.key);
  const tradeProducts = products.filter(p => !p.tradeId || p.tradeId === trade.id);
  let productsCost = 0;
  const items: QuoteCalculationResult['items'] = [];

  for (const key of productKeys) {
    const productId = str(answers[key]);
    if (!productId) continue;
    const product = tradeProducts.find(p => p.id === productId);
    if (product) {
      productsCost += product.sellPrice;
      items.push({
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellPrice,
        total: product.sellPrice,
      });
    }
  }

  // Fixed-price select items (consumer unit, cylinder, etc.)
  for (const stage of trade.wizardStages) {
    for (const field of stage.fields) {
      const val = str(answers[field.key]);
      if (!val || productKeys.includes(field.key)) continue;
      const opt = field.options?.find(o => o.value === val);
      if (opt?.price && ['consumerUnit', 'cylinder', 'bathroom', 'storeys', 'specLevel', 'foundations', 'layers', 'roofType'].includes(field.key)) {
        breakdown.scopeCost += opt.price;
      }
    }
  }

  breakdown.productsCost = productsCost;

  // Add finish line item
  if (breakdown.finishCost > 0 && finishKey) {
    const finishField = trade.wizardStages.flatMap(s => s.fields).find(f => f.key === 'finish');
    const opt = finishField?.options?.find(o => o.value === finishKey);
    items.unshift({
      productId: finishKey,
      name: `${opt?.label ?? 'Finish'} (${area.toFixed(1)}m²)`,
      quantity: area,
      price: opt?.price ?? 0,
      total: breakdown.finishCost,
    });
  }

  // Additions
  const additions = (answers.additions as string[]) ?? [];
  breakdown.additionsCost = additions.reduce((sum, id) => {
    const item = trade.additionsCatalog.find(a => a.id === id);
    return sum + (item?.price ?? 0);
  }, 0);

  // Labour
  const labourRule = trade.labourRules.find(r => r.key === 'labourDays');
  if (labourRule?.rateType === 'per_item' && windows > 0) {
    breakdown.labourCost = windows * labourRule.baseRate;
  } else {
    breakdown.labourCost = labourDays * labourRate;
  }

  // Materials
  const materialsRule = trade.labourRules.find(r => r.key === 'materials');
  if (materialsRule && area > 0) {
    breakdown.materialsCost = area * materialsRule.baseRate;
  } else if (trade.materialsRatePerSqm && area > 0) {
    breakdown.materialsCost = area * trade.materialsRatePerSqm;
  }

  // Electrical extras per point
  if (trade.id === 'electrical') {
    breakdown.scopeCost += sockets * 85 + lights * 65;
  }

  // Radiators
  if (radiators > 0 && trade.id === 'plumbing') {
    breakdown.scopeCost += radiators * 280;
  }

  // Linear metres fencing
  if (linearMetres > 0 && trade.id === 'landscaping') {
    breakdown.scopeCost += linearMetres * 95;
  }

  // Site uplifts
  const uplifts = trade.siteUplifts ?? {};
  const floorLocation = str(answers.floorLocation) || 'ground';
  const access = str(answers.access) || 'easy';
  const removal = str(answers.removal) || 'standard';

  breakdown.removalCost = uplifts.removal?.[removal] ?? (removal === 'heavy' ? 750 : removal === 'none' || removal === 'light' ? (removal === 'light' ? 250 : 0) : 450);
  breakdown.accessAdjustment =
    (uplifts.floorLocation?.[floorLocation] ?? 0) +
    (uplifts.access?.[access] ?? 0);

  const subtotal =
    breakdown.finishCost +
    breakdown.productsCost +
    breakdown.additionsCost +
    breakdown.labourCost +
    breakdown.materialsCost +
    breakdown.removalCost +
    breakdown.accessAdjustment +
    breakdown.scopeCost +
    breakdown.prepCost +
    breakdown.conversionCost +
    breakdown.surfaceCost;

  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  const labour: QuoteCalculationResult['labour'] = breakdown.labourCost > 0
    ? [{
        description: labourRule?.rateType === 'per_item'
          ? `Labour (${windows} windows @ £${labourRule?.baseRate}/each)`
          : `Labour (${labourDays} days @ £${labourRate}/day)`,
        days: labourDays,
        rateType: labourRule?.rateType === 'per_item' ? 'per_item' : 'per_day',
        rate: labourRule?.rateType === 'per_item' ? (labourRule?.baseRate ?? 180) : labourRate,
        total: breakdown.labourCost,
      }]
    : [];

  const extras: QuoteCalculationResult['extras'] = [];
  if (breakdown.materialsCost > 0) {
    extras.push({ description: `Materials & First Fix (${area.toFixed(1)}m²)`, price: breakdown.materialsCost });
  }
  if (breakdown.removalCost > 0) {
    extras.push({ description: 'Waste Removal / Strip-out', price: breakdown.removalCost });
  }
  if (breakdown.accessAdjustment > 0) {
    extras.push({ description: 'Access & Location', price: breakdown.accessAdjustment });
  }
  if (breakdown.prepCost > 0) {
    extras.push({ description: 'Surface Preparation', price: breakdown.prepCost });
  }
  if (breakdown.scopeCost > 0) {
    extras.push({ description: 'Scope & Components', price: breakdown.scopeCost });
  }
  if (breakdown.conversionCost > 0) {
    extras.push({ description: 'Conversion / Job Base', price: breakdown.conversionCost });
  }
  if (breakdown.surfaceCost > 0) {
    extras.push({ description: 'Hard Landscaping Surface', price: breakdown.surfaceCost });
  }
  additions.forEach(id => {
    const item = trade.additionsCatalog.find(a => a.id === id);
    if (item) extras.push({ description: item.name, price: item.price });
  });

  return {
    items,
    labour,
    extras,
    breakdown,
    subtotal,
    discountAmount,
    total,
  };
}
