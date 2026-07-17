/**
 * Shared kitchen alert state across Live / Kitchen / Delivery mounts.
 * Persists seen order IDs in sessionStorage so remounts do not re-beep everything.
 */

const SEEN_KEY = 's2d.kitchen.seenOrderIds';
const AUDIO_KEY = 's2d.kitchen.audioUnlocked';
const FLASH_MS = 45_000;

let audioUnlocked = false;
try {
  audioUnlocked = sessionStorage.getItem(AUDIO_KEY) === '1';
} catch {
  /* ignore */
}

const flashUntil = new Map<string, number>();
const listeners = new Set<() => void>();

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

function saveSeen(seen: Set<string>) {
  try {
    const arr = [...seen].slice(-500);
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
  if (!audioUnlocked) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
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
  for (const id of newOrderIds) {
    flashUntil.set(id, now + FLASH_MS);
  }
  for (const id of orderIds) seen.add(id);
  saveSeen(seen);
  if (newOrderIds.length) {
    playKitchenBeep();
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
  notify();
}

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeKitchenAlerts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
