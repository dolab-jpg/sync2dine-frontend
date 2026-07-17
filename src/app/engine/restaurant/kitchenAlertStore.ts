import {
  loadAlertSettings,
  isInQuietHours,
  notifyBrowserNewOrder,
} from './alertSettings';

/**
 * Shared kitchen alert state across Live / Kitchen / Delivery mounts.
 * Persists seen order IDs in sessionStorage so remounts do not re-beep everything.
 * Flash means unacknowledged only — never "any status===new forever".
 */

const SEEN_KEY = 's2d.kitchen.seenOrderIds';
const AUDIO_KEY = 's2d.kitchen.audioUnlocked';

let audioUnlocked = false;
try {
  audioUnlocked = sessionStorage.getItem(AUDIO_KEY) === '1';
} catch {
  /* ignore */
}

const flashUntil = new Map<string, number>();
const listeners = new Set<() => void>();
let repeatTimer: number | null = null;
let overdueBeepIds = new Set<string>();

function flashMs(): number {
  const s = loadAlertSettings();
  if (!s.flashEnabled) return 0;
  return (s.flashDurationSec || 45) * 1000;
}

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seenSet: Set<string>) {
  try {
    const arr = [...seenSet].slice(-500);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

let seen = loadSeen();

export function isKitchenAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function unlockKitchenAudio(): void {
  audioUnlocked = true;
  try {
    sessionStorage.setItem(AUDIO_KEY, '1');
  } catch {
    /* ignore */
  }
  playKitchenBeep();
  notify();
}

export function playKitchenBeep(): void {
  const settings = loadAlertSettings();
  if (!audioUnlocked || !settings.soundEnabled) return;
  if (isInQuietHours(settings)) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = Math.max(0.001, Math.min(1, settings.soundVolume));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    /* blocked */
  }
}

export function noteOrdersSeen(orderIds: string[], newOrderIds: string[]): void {
  const now = Date.now();
  const ms = flashMs();
  for (const id of newOrderIds) {
    if (ms > 0) flashUntil.set(id, now + ms);
  }
  for (const id of orderIds) seen.add(id);
  saveSeen(seen);
  if (newOrderIds.length) {
    playKitchenBeep();
    notifyBrowserNewOrder(
      `New order${newOrderIds.length > 1 ? `s (${newOrderIds.length})` : ''}`,
      'Open Kitchen or Delivery board',
    );
    notify();
  }
}

export function bootstrapSeenIfEmpty(orderIds: string[]): boolean {
  if (seen.size > 0) return false;
  for (const id of orderIds) seen.add(id);
  saveSeen(seen);
  return true;
}

export function getUnseenNewOrders(
  orders: Array<{ id: string; status: string }>,
): string[] {
  return orders.filter((o) => o.status === 'new' && !seen.has(o.id)).map((o) => o.id);
}

export function isOrderFlashing(id: string): boolean {
  const until = flashUntil.get(id);
  if (!until) return false;
  if (Date.now() > until) {
    flashUntil.delete(id);
    return false;
  }
  return true;
}

export function acknowledgeOrderFlash(id: string): void {
  flashUntil.delete(id);
  overdueBeepIds.delete(id);
  notify();
}

/** Register overdue order ids for optional repeat beep until acknowledged. */
export function setOverdueAlertIds(ids: string[]): void {
  overdueBeepIds = new Set(ids);
  const settings = loadAlertSettings();
  const interval = settings.repeatUntilAck ? settings.repeatIntervalSec : 0;
  if (repeatTimer != null) {
    window.clearInterval(repeatTimer);
    repeatTimer = null;
  }
  if (interval > 0 && overdueBeepIds.size > 0) {
    repeatTimer = window.setInterval(() => {
      if (overdueBeepIds.size === 0) return;
      playKitchenBeep();
    }, interval * 1000);
  }
}

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeKitchenAlerts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Nav badge counts shared across Kitchen / Delivery / Bookings. */
export type BoardBadgeCounts = {
  kitchenNew: number;
  kitchenOverdue: number;
  deliveryNew: number;
  deliveryOverdue: number;
  bookingsToday: number;
};

let boardBadges: BoardBadgeCounts = {
  kitchenNew: 0,
  kitchenOverdue: 0,
  deliveryNew: 0,
  deliveryOverdue: 0,
  bookingsToday: 0,
};

export function getBoardBadgeCounts(): BoardBadgeCounts {
  return { ...boardBadges };
}

export function setBoardBadgeCounts(patch: Partial<BoardBadgeCounts>): void {
  boardBadges = { ...boardBadges, ...patch };
  notify();
}
