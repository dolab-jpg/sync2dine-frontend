import type { ProjectNotification } from './notificationStore';

/** Routes that are list shells only — prefer projectId deep-link when present. */
const LIST_ONLY_ROUTES = new Set(['/projects', '/portal', '/builder-projects']);

function isListOnlyRoute(route: string): boolean {
  const path = route.split('?')[0]?.replace(/\/$/, '') || route;
  return LIST_ONLY_ROUTES.has(path);
}

/**
 * Resolve where a notification click should navigate.
 * Prefer project deep-link (messages tab) over stale list routes like `/projects`.
 */
export function resolveNotificationRoute(notification: ProjectNotification): string {
  const data = notification.data ?? {};
  const projectId =
    typeof data.projectId === 'string' && data.projectId.trim()
      ? data.projectId.trim()
      : '';
  const route =
    typeof data.route === 'string' && data.route.trim()
      ? data.route.trim()
      : '';

  if (projectId) {
    if (route && !isListOnlyRoute(route) && route.includes(projectId)) {
      return route;
    }
    return `/projects/${encodeURIComponent(projectId)}?tab=messages`;
  }

  if (route && !isListOnlyRoute(route)) {
    return route;
  }

  return '/projects';
}
