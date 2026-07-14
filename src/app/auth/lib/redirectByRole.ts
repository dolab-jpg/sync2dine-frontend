import { homePathForRole } from './authApi';

export { homePathForRole };

export function navigateAfterLogin(role: string, next?: string | null) {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    window.location.assign(next);
    return;
  }
  window.location.assign(homePathForRole(role));
}
