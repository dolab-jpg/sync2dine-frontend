import type { ReactElement } from 'react';

export type UserRole = 'platform_owner' | 'super_admin' | 'manager' | 'staff' | 'builder' | 'recruitment' | 'customer' | 'kiosk';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface RecruitmentAccess {
  staff: boolean;
  manager: boolean;
}

export interface AccountsAccess {
  staff: boolean;
  manager: boolean;
}

/** Controlling Super Admin (platform_owner) has the same product access as company super_admin. */
export function hasSuperAdminAccess(role: UserRole): boolean {
  return role === 'super_admin' || role === 'platform_owner';
}

export function canAccessRecruitment(role: UserRole, access: RecruitmentAccess): boolean {
  if (hasSuperAdminAccess(role) || role === 'recruitment') return true;
  if (role === 'staff') return access.staff;
  if (role === 'manager') return access.manager;
  return false;
}

export function canAccessAccounts(role: UserRole, access: AccountsAccess): boolean {
  if (hasSuperAdminAccess(role)) return true;
  if (role === 'staff') return access.staff;
  if (role === 'manager') return access.manager;
  return false;
}

export function roleAllowed(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (allowedRoles.includes(userRole)) return true;
  if (userRole === 'platform_owner' && allowedRoles.includes('super_admin')) return true;
  return false;
}
