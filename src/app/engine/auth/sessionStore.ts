const SESSION_KEY = 'tradepro_session_user';

export type StoredUserRole =
  | 'platform_owner'
  | 'super_admin'
  | 'manager'
  | 'staff'
  | 'builder'
  | 'recruitment'
  | 'customer';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: StoredUserRole;
}

export function saveSessionUser(user: StoredUser): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // quota / private mode
  }
}

export function loadSessionUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionUser(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function parseDemoRoleFromUrl(): StoredUserRole | null {
  if (typeof window === 'undefined') return null;
  const role = new URLSearchParams(window.location.search).get('demoRole');
  const allowed: StoredUserRole[] = [
    'platform_owner', 'super_admin', 'manager', 'staff', 'builder', 'recruitment', 'customer',
  ];
  return allowed.includes(role as StoredUserRole) ? (role as StoredUserRole) : null;
}
