export const NOTIFICATIONS_STORAGE_KEY = 'tradepro_notifications';

export type NotificationType =
  | 'builder_brief_sent'
  | 'photo_requested'
  | 'payment_stage_due'
  | 'customer_action_required'
  | 'foreman_plan_sent'
  | 'builder_reply_received'
  | 'bc_update_detected';

export interface ProjectNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface NewNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface StoredNotification extends Omit<ProjectNotification, 'timestamp'> {
  timestamp: string;
}

type NotificationSubscriber = (notifications: ProjectNotification[]) => void;

const subscribers = new Set<NotificationSubscriber>();

let cache: ProjectNotification[] = readFromStorage();

function toStored(notification: ProjectNotification): StoredNotification {
  return {
    ...notification,
    timestamp: notification.timestamp.toISOString(),
  };
}

function isNotificationType(value: unknown): value is NotificationType {
  return value === 'builder_brief_sent'
    || value === 'photo_requested'
    || value === 'payment_stage_due'
    || value === 'customer_action_required'
    || value === 'foreman_plan_sent'
    || value === 'builder_reply_received'
    || value === 'bc_update_detected';
}

function normalize(raw: unknown): ProjectNotification | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.id !== 'string'
    || !isNotificationType(record.type)
    || typeof record.title !== 'string'
    || typeof record.message !== 'string'
    || typeof record.timestamp !== 'string'
    || typeof record.read !== 'boolean'
  ) {
    return null;
  }

  const parsedTime = new Date(record.timestamp);
  if (Number.isNaN(parsedTime.getTime())) return null;

  return {
    id: record.id,
    type: record.type,
    title: record.title,
    message: record.message,
    timestamp: parsedTime,
    read: record.read,
    data: record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : undefined,
  };
}

function readFromStorage(): ProjectNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalize(entry))
      .filter((entry): entry is ProjectNotification => Boolean(entry))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch {
    return [];
  }
}

function persist(): void {
  localStorage.setItem(
    NOTIFICATIONS_STORAGE_KEY,
    JSON.stringify(cache.map(toStored))
  );
}

function emit(): void {
  const snapshot = [...cache];
  subscribers.forEach((callback) => callback(snapshot));
}

function refreshCache(): void {
  cache = readFromStorage();
}

function nextId(): string {
  return `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadNotifications(): ProjectNotification[] {
  refreshCache();
  return [...cache];
}

export function addNotification(input: NewNotificationInput): ProjectNotification {
  const created: ProjectNotification = {
    id: nextId(),
    type: input.type,
    title: input.title,
    message: input.message,
    timestamp: new Date(),
    read: false,
    data: input.data,
  };

  refreshCache();
  cache = [created, ...cache].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  persist();
  emit();

  return created;
}

export function markRead(id: string): void {
  refreshCache();
  let updated = false;
  cache = cache.map((notification) => {
    if (notification.id !== id || notification.read) return notification;
    updated = true;
    return { ...notification, read: true };
  });

  if (!updated) return;

  persist();
  emit();
}

export function subscribe(callback: NotificationSubscriber): () => void {
  subscribers.add(callback);
  callback([...cache]);
  return () => {
    subscribers.delete(callback);
  };
}
