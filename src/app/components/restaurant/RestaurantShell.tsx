import { NavLink } from 'react-router';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ChefHat, LogOut, Radio, Settings as SettingsIcon, Truck, UtensilsCrossed, Users, UserPlus,
} from 'lucide-react';
import { AppContext } from '../../App';
import { BrandLogo } from '../BrandLogo';
import { OnlineStatusBanner } from '../OnlineStatusBanner';
import { Toaster } from '../ui/sonner';

/**
 * Tablet-first shell for restaurant tenant staff (Super Master B3/C9).
 * Portrait: bottom tab bar. Landscape/desktop: left rail. ≥48px touch targets.
 */

type TabDef = {
  to: string;
  icon: typeof Radio;
  label: string;
  end: boolean;
  /** Hide from cramped bottom bar; still on desktop rail */
  railOnly?: boolean;
  roles?: string[];
};

const TABS: TabDef[] = [
  { to: '/', icon: Radio, label: 'Live', end: true },
  { to: '/orders/kitchen', icon: ChefHat, label: 'Kitchen', end: false },
  { to: '/orders/delivery', icon: Truck, label: 'Delivery', end: false },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', end: false },
  { to: '/customers', icon: Users, label: 'Customers', end: false, railOnly: true, roles: ['super_admin', 'manager', 'staff'] },
  { to: '/team', icon: UserPlus, label: 'Team', end: false, railOnly: true, roles: ['super_admin', 'manager'] },
  { to: '/settings', icon: SettingsIcon, label: 'Settings', end: false },
];

export interface AgentLiveState {
  reachable: boolean;
  isActive: boolean;
  activeCallCount: number;
}

export function useAgentLive(pollMs = 10_000): AgentLiveState {
  const [state, setState] = useState<AgentLiveState>({ reachable: false, isActive: false, activeCallCount: 0 });
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/agent/status');
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json() as {
          isActive?: boolean;
          activeCall?: unknown;
          activeCalls?: unknown[];
        };
        if (cancelled) return;
        const count = Array.isArray(data.activeCalls)
          ? data.activeCalls.length
          : data.activeCall ? 1 : 0;
        setState({ reachable: true, isActive: data.isActive !== false, activeCallCount: count });
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

function tabClasses(isActive: boolean, layout: 'rail' | 'bottom') {
  const base = 'flex items-center touch-manipulation font-bold transition-all duration-200';
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

export default function RestaurantShell({ children }: { children: ReactNode }) {
  const context = useContext(AppContext);
  const live = useAgentLive();
  if (!context) return null;
  const { user, logout } = context;
  const railTabs = TABS.filter((t) => tabVisible(t, user.role));
  const bottomTabs = TABS.filter((t) => !t.railOnly && tabVisible(t, user.role));

  return (
    <div className="native-shell flex min-h-dvh flex-col bg-s2d-cream lg:flex-row">
      <OnlineStatusBanner />

      {/* Landscape / desktop: left rail */}
      <aside className="hidden w-56 shrink-0 flex-col bg-gradient-to-b from-s2d-teal-deep via-s2d-teal to-s2d-teal-ink lg:flex">
        <div className="border-b border-white/10 p-4">
          <BrandLogo size="md" showWordmark subtitle="Restaurant Live" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Restaurant navigation">
          {railTabs.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => tabClasses(isActive, 'rail')}>
              <Icon className="h-6 w-6 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-white/10 p-3">
          <LiveIndicator live={live} />
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 text-s2d-cream/80 transition hover:bg-red-500/15 hover:text-red-200 min-h-12 font-bold touch-manipulation"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact top bar (portrait shows brand + live here) */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-s2d-teal-deep px-3 sm:px-4 lg:h-12 lg:bg-s2d-teal-ink/90">
          <div className="flex min-w-0 items-center gap-3">
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

        {/* Portrait / narrow: bottom tab bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-s2d-teal-ink bg-s2d-teal-deep safe-area-pb lg:hidden"
          aria-label="Restaurant navigation"
          data-testid="restaurant-bottom-nav"
        >
          {bottomTabs.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => tabClasses(isActive, 'bottom')}>
              <Icon className="h-6 w-6" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Toaster />
    </div>
  );
}
