/**
 * Lightweight nav badge counts for Kitchen / Delivery / Bookings tabs.
 */

export type NavBadgeCounts = {
  kitchenNew: number;
  kitchenOverdue: number;
  deliveryNew: number;
  deliveryOverdue: number;
  bookingsToday: number;
};

const EMPTY: NavBadgeCounts = {
  kitchenNew: 0,
  kitchenOverdue: 0,
  deliveryNew: 0,
  deliveryOverdue: 0,
  bookingsToday: 0,
};

let counts: NavBadgeCounts = { ...EMPTY };
const listeners = new Set<() => void>();

export function getNavBadgeCounts(): NavBadgeCounts {
  return { ...counts };
}

export function setNavBadgeCounts(patch: Partial<NavBadgeCounts>): void {
  counts = { ...counts, ...patch };
  for (const fn of listeners) fn();
}

export function subscribeNavBadges(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
