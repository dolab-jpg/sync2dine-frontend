import { NavLink, useNavigate } from 'react-router';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ChefHat, LogOut, Radio, Settings as SettingsIcon, Truck, UtensilsCrossed, Users,
  Phone, Wallet, PanelLeftClose, PanelLeftOpen, CalendarDays,
} from 'lucide-react';
import { AppContext } from '../../App';
import { BrandLogo } from '../BrandLogo';
import { OnlineStatusBanner } from '../OnlineStatusBanner';
import { Toaster } from '../ui/sonner';
import { getNavBadgeCounts, subscribeNavBadges } from '../../engine/restaurant/navBadgeStore';

/**
 * Tablet-first shell for restaurant tenant staff.
 * Portrait: bottom tab bar. Landscape/desktop: collapsible left rail.
 */

type TabDef = {
  to: string;
  icon: typeof Radio;
  label: string;
  end: boolean;
  railOnly?: boolean;
  roles?: string[];
  badge?: 'kitchen' | 'delivery' | 'bookings' | 'calls';
};

const SIDEBAR_KEY = 's2d.restaurant.sidebarCollapsed';

const TABS: TabDef[] = [
  { to: '/', icon: Radio, label: 'Live', end: true },
  { to: '/orders/kitchen', icon: ChefHat, label: 'Kitchen', end: false, badge: 'kitchen' },
  { to: '/orders/delivery', icon: Truck, label: 'Delivery', end: false, badge: 'delivery' },
  { to: '/bookings', icon: CalendarDays, label: 'Bookings', end: false, badge: 'bookings' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', end: false },
  { to: '/calls', icon: Phone, label: 'Calls', end: false, roles: ['super_admin', 'manager', 'staff'], railOnly: true, badge: 'calls' },
  { to: '/customers', icon: Users, label: 'Customers', end: false, railOnly: true, roles: ['super_admin', 'manager', 'staff'] },
  { to: '/accounts', icon: Wallet, label: 'Accounts', end: false, railOnly: true, roles: ['super_admin', 'manager'] },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', end: false },
];

export interface AgentLiveState {
  reachable: boolean;
  isActive: boolean;
  activeCallCount: number;
  ringingCount: number;
  inProgressCount: number;
}

export type ActiveCallSnapshot = {
  id: string;
  from?: string;
  to?: string;
  contactName?: string;
  customerId?: string | null;
  status?: string;
  direction?: string;
  elapsedSec?: number;
  listenUrl?: string;
  isGuest?: boolean;
  lineLabel?: string;
};

export function useAgentLive(pollMs = 10_000): AgentLiveState & { activeCalls: ActiveCallSnapshot[] } {
  const [state, setState] = useState<AgentLiveState & { activeCalls: ActiveCallSnapshot[] }>({
    reachable: false,
    isActive: false,
    activeCallCount: 0,
    ringingCount: 0,
    inProgressCount: 0,
    activeCalls: [],
  });
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/agent/status');
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json() as {
          isActive?: boolean;
          activeCall?: ActiveCallSnapshot | null;
          activeCalls?: ActiveCallSnapshot[];
          ringingCount?: number;
          inProgressCount?: number;
        };
        if (cancelled) return;
        const activeCalls = Array.isArray(data.activeCalls)
          ? data.activeCalls
          : data.activeCall ? [data.activeCall] : [];
        const ringingCount = typeof data.ringingCount === 'number'
          ? data.ringingCount
          : activeCalls.filter((c) => c.status === 'ringing').length;
        const inProgressCount = typeof data.inProgressCount === 'number'
          ? data.inProgressCount
          : activeCalls.filter((c) => c.status === 'in_progress').length;
        setState({
          reachable: true,
          isActive: data.isActive !== false,
          activeCallCount: activeCalls.length,
          ringingCount,
          inProgressCount,
          activeCalls,
        });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, reachable: false }));
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollMs]);
  return state;
}

export function LiveIndicator({ live }: { live: AgentLiveState }) {
  const connected = live.reachable && live.isActive;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
        connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
      }`}
      title={connected ? 'Phone agent connected and answering' : 'Phone agent offline'}
    >
      <span className="relative flex h-2.5 w-2.5">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
      </span>
      {connected ? (live.activeCallCount > 0 ? `LIVE · ${live.activeCallCount} on call` : 'LIVE') : 'Offline'}
    </span>
  );
}

function tabClasses(isActive: boolean, layout: 'rail' | 'rail-collapsed' | 'bottom') {
  const base = 'flex items-center touch-manipulation font-bold transition-all duration-200';
  if (layout === 'rail-collapsed') {
    return `${base} justify-center rounded-xl min-h-12 w-full ${
      isActive ? 'bg-s2d-gold text-s2d-teal-deep shadow-md' : 'text-s2d-cream hover:bg-white/10'
    }`;
  }
  if (layout === 'rail') {
    return `${base} gap-3 rounded-xl px-4 min-h-14 text-base ${
      isActive ? 'bg-s2d-gold text-s2d-teal-deep shadow-md' : 'text-s2d-cream hover:bg-white/10'
    }`;
  }
  return `${base} flex-1 flex-col justify-center gap-1 min-h-16 text-xs ${
    isActive ? 'text-s2d-gold' : 'text-s2d-cream/80'
  }`;
}

function tabVisible(tab: TabDef, role: string): boolean {
  if (!tab.roles?.length) return true;
  return tab.roles.includes(role);
}

function NavBadge({ kind, compact, ringing }: { kind?: TabDef['badge']; compact?: boolean; ringing?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeNavBadges(() => setTick((n) => n + 1)), []);
  if (!kind) return null;
  if (kind === 'calls') {
    const n = ringing ?? 0;
    if (!n) return null;
    return (
      <span
        className={
          compact
            ? 'absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-s2d-gold px-1 text-[9px] font-black text-s2d-teal-deep animate-pulse'
            : 'ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-s2d-gold px-1.5 text-[10px] font-black text-s2d-teal-deep animate-pulse'
        }
      >
        {n > 99 ? '99+' : n}
      </span>
    );
  }
  const c = getNavBadgeCounts();
  const n =
    kind === 'kitchen' ? c.kitchenNew + c.kitchenOverdue
      : kind === 'delivery' ? c.deliveryNew + c.deliveryOverdue
        : c.bookingsToday;
  if (!n) return null;
  return (
    <span
      className={
        compact
          ? 'absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-s2d-gold px-1 text-[9px] font-black text-s2d-teal-deep'
          : 'ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-s2d-gold px-1.5 text-[10px] font-black text-s2d-teal-deep'
      }
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

export default function RestaurantShell({ children }: { children: ReactNode }) {
  const context = useContext(AppContext);
  const live = useAgentLive();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!context) return null;
  const { user, logout } = context;
  const railTabs = TABS.filter((t) => tabVisible(t, user.role));
  const bottomTabs = TABS.filter((t) => !t.railOnly && tabVisible(t, user.role));

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="native-shell flex min-h-dvh flex-col bg-s2d-cream lg:flex-row">
      <OnlineStatusBanner />

      <aside
        className={`hidden shrink-0 flex-col bg-gradient-to-b from-s2d-teal-deep via-s2d-teal to-s2d-teal-ink transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? 'w-[4.5rem]' : 'w-56'
        }`}
      >
        <div className={`border-b border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
          {collapsed ? (
            <BrandLogo size="sm" showWordmark={false} />
          ) : (
            <BrandLogo size="md" showWordmark subtitle="Restaurant Live" />
          )}
        </div>
        <div className="px-2 pt-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-s2d-cream/90 hover:bg-white/10 min-h-11 font-bold touch-manipulation"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Restaurant navigation">
          {railTabs.map(({ to, icon: Icon, label, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) => tabClasses(isActive, collapsed ? 'rail-collapsed' : 'rail')}
            >
              <span className="relative">
                <Icon
                  className={`h-6 w-6 shrink-0 ${
                    badge === 'calls' && live.ringingCount > 0 ? 'animate-pulse text-s2d-gold' : ''
                  }`}
                />
                {collapsed && <NavBadge kind={badge} compact ringing={live.ringingCount} />}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <NavBadge kind={badge} ringing={live.ringingCount} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={`space-y-2 border-t border-white/10 ${collapsed ? 'p-2' : 'p-3'}`}>
          {!collapsed && <LiveIndicator live={live} />}
          {collapsed && live.activeCallCount > 0 && (
            <button
              type="button"
              title={
                live.ringingCount > 0
                  ? `${live.ringingCount} ringing`
                  : `${live.activeCallCount} on call`
              }
              onClick={() => navigate('/calls')}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                live.ringingCount > 0
                  ? 'animate-pulse bg-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            title="Logout"
            className={`flex w-full items-center rounded-xl text-s2d-cream/80 transition hover:bg-red-500/15 hover:text-red-200 min-h-12 font-bold touch-manipulation ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-4'
            }`}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-s2d-teal-deep px-3 sm:px-4 lg:h-12 lg:bg-s2d-teal-ink/90">
          <div className="flex min-w-0 items-center gap-3">
            {collapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl text-s2d-cream hover:bg-white/10 lg:flex"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )}
            <span className="lg:hidden">
              <BrandLogo size="sm" showWordmark />
            </span>
            <p className="hidden truncate text-sm font-semibold text-s2d-cream/90 lg:block">
              {user.name} · Staff tablet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="lg:hidden">
              <LiveIndicator live={live} />
            </span>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-s2d-cream/80 hover:bg-white/10 hover:text-white touch-manipulation lg:hidden"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(4.5rem+var(--safe-area-bottom))] lg:pb-0">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-s2d-teal-ink bg-s2d-teal-deep safe-area-pb lg:hidden"
          aria-label="Restaurant navigation"
          data-testid="restaurant-bottom-nav"
        >
          {bottomTabs.map(({ to, icon: Icon, label, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => tabClasses(isActive, 'bottom')}>
              <span className="relative">
                <Icon className="h-6 w-6" />
                <NavBadge kind={badge} compact />
              </span>
              <span className="max-w-[4.5rem] truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <Toaster />
    </div>
  );
}
