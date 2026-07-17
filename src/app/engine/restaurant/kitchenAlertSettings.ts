/**
 * Staff-only kitchen alert preferences (sound / flash / browser notifications).
 * Never used for customer WhatsApp/SMS/email.
 */

const KEY = 's2d.kitchen.alertSettings';

export type KitchenAlertSettings = {
  soundEnabled: boolean;
  /** 0–1 gain for beep */
  volume: number;
  /** Seconds between repeat beeps for overdue/unacked; 0 = no repeat */
  repeatIntervalSec: number;
  /** Flash ring duration for new orders (ms) */
  flashMs: number;
  browserNotifications: boolean;
  /** Quiet hours local HH:MM — empty = off */
  quietStart: string;
  quietEnd: string;
};

export const DEFAULT_ALERT_SETTINGS: KitchenAlertSettings = {
  soundEnabled: true,
  volume: 0.08,
  repeatIntervalSec: 30,
  flashMs: 45_000,
  browserNotifications: false,
  quietStart: '',
  quietEnd: '',
};

const listeners = new Set<() => void>();

function load(): KitchenAlertSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_ALERT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<KitchenAlertSettings>;
    return { ...DEFAULT_ALERT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

let settings = load();

export function getKitchenAlertSettings(): KitchenAlertSettings {
  return { ...settings };
}

export function setKitchenAlertSettings(patch: Partial<KitchenAlertSettings>): KitchenAlertSettings {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn();
  return { ...settings };
}

export function subscribeKitchenAlertSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True when current local time falls inside quiet hours window. */
export function isInQuietHours(now = new Date(), s = settings): boolean {
  if (!s.quietStart || !s.quietEnd) return false;
  const toMins = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((n) => Number(n));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const start = toMins(s.quietStart);
  const end = toMins(s.quietEnd);
  if (start == null || end == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showKitchenBrowserNotification(title: string, body?: string): void {
  if (!settings.browserNotifications) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (isInQuietHours()) return;
  try {
    new Notification(title, { body, tag: 's2d-kitchen-order' });
  } catch {
    /* ignore */
  }
}
