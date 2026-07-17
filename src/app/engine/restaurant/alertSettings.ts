/**
 * Staff-only kitchen/delivery alert preferences (local to device).
 * No customer WhatsApp/SMS/email notifications.
 */

export type AlertSettings = {
  soundEnabled: boolean;
  soundVolume: number; // 0–1
  repeatUntilAck: boolean;
  repeatIntervalSec: number;
  flashEnabled: boolean;
  flashDurationSec: number;
  browserNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string;
  autoHideCompletedMin: number;
  showHistory: boolean;
};

const KEY = 's2d.restaurant.alertSettings';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  soundEnabled: true,
  soundVolume: 0.08,
  repeatUntilAck: true,
  repeatIntervalSec: 24,
  flashEnabled: true,
  flashDurationSec: 45,
  browserNotifications: false,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  autoHideCompletedMin: 15,
  showHistory: false,
};

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_ALERT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AlertSettings>;
    return { ...DEFAULT_ALERT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

export function saveAlertSettings(next: AlertSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('s2d-alert-settings', { detail: next }));
}

export function subscribeAlertSettings(fn: (s: AlertSettings) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<AlertSettings>).detail;
    fn(detail ?? loadAlertSettings());
  };
  const storage = (e: StorageEvent) => {
    if (e.key === KEY) fn(loadAlertSettings());
  };
  window.addEventListener('s2d-alert-settings', handler);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener('s2d-alert-settings', handler);
    window.removeEventListener('storage', storage);
  };
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function isInQuietHours(settings: AlertSettings, now = new Date()): boolean {
  if (!settings.quietHoursEnabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = minutesOfDay(settings.quietHoursStart);
  const end = minutesOfDay(settings.quietHoursEnd);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function notifyBrowserNewOrder(title: string, body?: string): void {
  const settings = loadAlertSettings();
  if (!settings.browserNotifications) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (isInQuietHours(settings)) return;
  try {
    new Notification(title, { body, tag: 's2d-kitchen-order' });
  } catch {
    /* ignore */
  }
}
