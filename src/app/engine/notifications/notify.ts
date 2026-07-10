import { addNotification, type NotificationType } from './notificationStore';

export function notifyProjectEvent(
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): void {
  addNotification({
    type,
    title,
    message,
    data,
  });
}
