import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { fetchMembers, type OrgMember } from '../../auth/lib/authApi';

export interface StaffPerformance {
  leads: number;
  quotes: number;
  won: number;
  lost: number;
  pending: number;
  revenue: number;
  conversionRate: number;
  avgDealSize: number;
}

export interface OfficeTeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'manager' | 'staff';
  department: string;
  performance: StaffPerformance;
}

const EMPTY_PERFORMANCE: StaffPerformance = {
  leads: 0,
  quotes: 0,
  won: 0,
  lost: 0,
  pending: 0,
  revenue: 0,
  conversionRate: 0,
  avgDealSize: 0,
};

// Real org members, loaded from the API (Supabase profiles). Cached so the
// existing synchronous callers (AI context, tools) can keep working.
let cachedRoster: OfficeTeamMember[] = [];
let loadPromise: Promise<OfficeTeamMember[]> | null = null;

function toOfficeMember(m: OrgMember): OfficeTeamMember | null {
  if (m.role !== 'manager' && m.role !== 'staff') return null;
  return {
    id: m.id,
    name: m.name || m.email,
    email: m.email,
    phone: '',
    role: m.role,
    department: m.role === 'manager' ? 'Management' : 'Sales',
    performance: { ...EMPTY_PERFORMANCE },
  };
}

/** Load real org members (managers + staff) and cache them. Safe to call repeatedly. */
export async function loadOfficeTeam(): Promise<OfficeTeamMember[]> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (!isSupabaseConfigured()) return cachedRoster;
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return cachedRoster;
      const members = await fetchMembers(token);
      cachedRoster = members
        .map(toOfficeMember)
        .filter((m): m is OfficeTeamMember => m !== null);
      return cachedRoster;
    } catch {
      return cachedRoster;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

export function getOfficeTeamCounts() {
  const managerCount = cachedRoster.filter((m) => m.role === 'manager').length;
  const salesStaffCount = cachedRoster.filter((m) => m.role === 'staff').length;
  return {
    managerCount,
    salesStaffCount,
    officeStaffCount: managerCount + salesStaffCount,
  };
}

export function getOfficeTeamRoster(): OfficeTeamMember[] {
  return cachedRoster;
}

export function getTopPerformer(): OfficeTeamMember | undefined {
  return [...cachedRoster].sort((a, b) => b.performance.revenue - a.performance.revenue)[0];
}
