import type { QuoteItem, ExtraItem, PricingResearch } from '../../App';
import { researchPrices, pickHigherEnd } from './priceResearchService';

export interface SmallJobDraft {
  items: QuoteItem[];
  extras: ExtraItem[];
  total: number;
  pricingResearch: PricingResearch;
  taskList: string[];
}

/** Split a free-text / dictated list into discrete tasks. */
export function parseTaskList(raw: string): string[] {
  return raw
    .split(/\r?\n|;|\u2022|(?:^|\s)\d+[.)]\s|,(?=\s*[a-zA-Z])/g)
    .map((s) => s.replace(/^[-*\s]+/, '').trim())
    .filter((s) => s.length > 1);
}

/**
 * Price a list of small jobs: split into tasks, research local prices, and build
 * quote line items biased to the higher end. Used by the small-jobs intake mode
 * and the AI `priceSmallJob` tool.
 */
export async function priceSmallJob(
  rawTasks: string,
  opts?: { tradeName?: string; postcode?: string }
): Promise<SmallJobDraft> {
  const taskList = parseTaskList(rawTasks);
  const pricingResearch = await researchPrices({
    tasks: taskList,
    tradeName: opts?.tradeName ?? 'Small Jobs',
    postcode: opts?.postcode,
  });

  const lines = pricingResearch.lines.length
    ? pricingResearch.lines
    : taskList.map((task) => ({ task, low: 0, typical: 0, high: 0, unit: 'job', sources: [] }));

  const items: QuoteItem[] = lines.map((line, idx) => {
    const price = pickHigherEnd(line);
    return {
      productId: `task-${idx}`,
      name: line.task,
      quantity: 1,
      price,
      total: price,
    };
  });

  const total = items.reduce((sum, item) => sum + item.total, 0);
  return { items, extras: [], total, pricingResearch, taskList };
}
