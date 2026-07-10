import type { Quote, QuoteLine, QuoteItem, LabourItem, ExtraItem } from '../../App';

export type QuoteLineUnit = QuoteLine['unit'];

export function calcLineTotal(quantity: number, rate: number, unit: QuoteLineUnit): number {
  if (unit === 'fixed') return rate;
  return Math.round(quantity * rate * 100) / 100;
}

export function createQuoteLine(partial: Partial<QuoteLine> & Pick<QuoteLine, 'description'>): QuoteLine {
  const quantity = partial.quantity ?? 1;
  const rate = partial.rate ?? 0;
  const unit = partial.unit ?? 'item';
  return {
    id: partial.id ?? `L${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: partial.description,
    quantity,
    unit,
    rate,
    total: partial.total ?? calcLineTotal(quantity, rate, unit),
    category: partial.category,
  };
}

export function migrateQuoteToLines(quote: Quote): QuoteLine[] {
  if (quote.lines?.length) return quote.lines;

  const lines: QuoteLine[] = [];

  for (const item of quote.items ?? []) {
    lines.push(
      createQuoteLine({
        description: item.name,
        quantity: item.quantity,
        unit: 'item',
        rate: item.price,
        total: item.total,
        category: 'product',
      }),
    );
  }

  for (const labour of quote.labour ?? []) {
    const unit = labour.rateType === 'per_sqm' ? 'sqm' : labour.rateType === 'per_day' ? 'day' : labour.rateType === 'per_item' ? 'item' : 'fixed';
    const qty =
      labour.rateType === 'per_sqm'
        ? labour.area ?? 1
        : labour.rateType === 'per_day'
          ? labour.days ?? 1
          : labour.rateType === 'per_item'
            ? labour.quantity ?? 1
            : 1;
    lines.push(
      createQuoteLine({
        description: labour.description,
        quantity: qty,
        unit,
        rate: labour.rate,
        total: labour.total,
        category: 'labour',
      }),
    );
  }

  for (const extra of quote.extras ?? []) {
    lines.push(
      createQuoteLine({
        description: extra.description,
        quantity: 1,
        unit: 'fixed',
        rate: extra.price,
        total: extra.price,
        category: 'extra',
      }),
    );
  }

  return lines;
}

export function calcQuoteTotals(lines: QuoteLine[], discount = 0) {
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const afterDiscount = subtotal - discountAmount;
  const vat = Math.round(afterDiscount * 0.2 * 100) / 100;
  const total = Math.round((afterDiscount + vat) * 100) / 100;
  return { subtotal, discountAmount, vat, total };
}

export function linesToLegacy(quote: Quote): Pick<Quote, 'items' | 'labour' | 'extras'> {
  const items: QuoteItem[] = [];
  const labour: LabourItem[] = [];
  const extras: ExtraItem[] = [];

  for (const line of quote.lines ?? []) {
    if (line.category === 'product' || line.unit === 'item') {
      items.push({
        productId: line.id,
        name: line.description,
        quantity: line.quantity,
        price: line.rate,
        total: line.total,
      });
    } else if (line.category === 'labour' || ['sqm', 'linear_m', 'cubic_m', 'day', 'hour'].includes(line.unit)) {
      labour.push({
        description: line.description,
        rateType:
          line.unit === 'sqm'
            ? 'per_sqm'
            : line.unit === 'day'
              ? 'per_day'
              : line.unit === 'item'
                ? 'per_item'
                : 'fixed',
        rate: line.rate,
        total: line.total,
        area: line.unit === 'sqm' ? line.quantity : undefined,
        days: line.unit === 'day' ? line.quantity : undefined,
        quantity: line.unit === 'item' ? line.quantity : undefined,
      });
    } else {
      extras.push({ description: line.description, price: line.total });
    }
  }

  return { items, labour, extras };
}
