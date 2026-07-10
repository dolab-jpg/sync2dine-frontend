import { NavLink } from 'react-router';
import {
  Home, Calendar, ClipboardCheck, ClipboardList, Mail, Image, Settings, TrendingUp,
  Sparkles, Users, BarChart3, Wrench, FolderKanban, UserPlus, UserCircle, LogOut,
  ChevronDown, MessageCircle, PenLine, GitBranch, ShieldCheck, DollarSign, Menu, Phone,
  Landmark, Calculator, BadgeCheck, FileSignature, ScrollText, Building2,
} from 'lucide-react';
import OrgActingAsPicker from './platform/OrgActingAsPicker';
import { AppContext, canAccessAccounts } from '../App';
import NotificationSystem from './NotificationSystem';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useAIAssistant } from '../context/AIAssistantContext';
import { AIAssistantPanel } from './AI/AIAssistantOverlay';
import { useGestureToggle } from '../hooks/useGestureToggle';
import { GestureEdgeHint } from './ui/GestureHint';
import { useIsMobile } from './ui/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import {
  loadNotifications,
  subscribe as subscribeNotifications,
} from '../engine/notifications/notificationStore';
import { BrandLogo } from './BrandLogo';

interface AppShellProps {
  children: ReactNode;
}

const RAIL_WIDTH = '4.25rem';
const EXPANDED_WIDTH = '13.5rem';
const AI_DOCK_MIN_WIDTH = 1024;

export default function AppShell({ children }: AppShellProps) {
  const context = useContext(AppContext);
  const { isOpen: aiOpen, setIsOpen: setAiOpen, settings: aiSettings, updateSettings: updateAiSettings } = useAIAssistant();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isWideViewport, setIsWideViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= AI_DOCK_MIN_WIDTH,
  );
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${AI_DOCK_MIN_WIDTH}px)`);
    const onChange = () => setIsWideViewport(mql.matches);
    mql.addEventListener('change', onChange);
    setIsWideViewport(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (aiSettings.defaultPanelOpen && aiSettings.enabled && isWideViewport) {
      setAiOpen(true);
    }
  }, [location.pathname, aiSettings.defaultPanelOpen, aiSettings.enabled, setAiOpen, isWideViewport]);

  const sidebar = useGestureToggle({
    defaultOpen: false,
    storageKey: 'navSidebarExpanded',
  });

  useEffect(() => {
    if ((isMobile || !isWideViewport) && sidebar.isOpen) {
      sidebar.close();
    }
  }, [isMobile, isWideViewport, sidebar.isOpen, sidebar.close]);
  const mainRef = useRef<HTMLElement>(null);
  const contentRowRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      const main = mainRef.current;
      const shell = shellRef.current;
      const aside = shell?.querySelector('aside[aria-label="Navigation"]') as HTMLElement | null;
      const aiPanel = shell?.querySelector('[aria-label="TradePro AI assistant"]') as HTMLElement | null;
      const viewportW = window.innerWidth;
      const sidebarW = aside?.offsetWidth ?? 0;
      const aiW = aiPanel?.offsetWidth ?? 0;
      const mainW = main?.clientWidth ?? 0;
      const dockedInline = aiOpen && aiSettings.panelDocked && isWideViewport;
      const mainPct = viewportW > 0 ? Math.round((mainW / viewportW) * 100) : 0;
      // #region agent log
      fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76f60a'},body:JSON.stringify({sessionId:'76f60a',location:'AppShell.tsx:layoutMeasure',message:'viewport layout metrics',data:{viewportW,sidebarW,sidebarExpanded:sidebar.isOpen,isMobile,isWideViewport,aiOpen,aiDocked:aiSettings.panelDocked,aiDockedInline:dockedInline,aiW,mainW,mainPct,path:location.pathname},timestamp:Date.now(),runId:'post-fix',hypothesisId:'A-B-C'})}).catch(()=>{});
      // #endregion
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [sidebar.isOpen, aiOpen, aiSettings.panelDocked, location.pathname, isMobile, isWideViewport]);

  useEffect(() => {
    loadNotifications();
    return subscribeNotifications(() => {
      // Keep notification listeners mounted with AppShell lifecycle.
    });
  }, []);

  if (!context) return null;
  const { user, logout, recruitmentAccess, accountsAccess } = context;

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      platform_owner: 'Platform Owner',
      super_admin: 'Super Admin',
      manager: 'Manager',
      staff: 'Staff',
      builder: 'Builder',
      recruitment: 'Recruitment',
      customer: 'Customer',
    };
    return roleMap[role] || role;
  };

  const getRoleCopilotPrompt = (role: string) => {
    if (role === 'builder') return 'Ask AI about schedules, building control, and site tasks';
    if (role === 'customer') return 'Ask AI for project updates and next steps';
    if (role === 'recruitment') return 'Ask AI to summarise candidates and actions';
    return 'Ask AI to detect trades, prefill quotes, and manage project actions';
  };

  const getNavItems = () => {
    if (user.role === 'builder') {
      return [
        { to: '/builder', icon: Home, label: 'Dashboard' },
        { to: '/projects', icon: FolderKanban, label: 'Projects' },
        { to: '/building-control', icon: ShieldCheck, label: 'BC' },
        { to: '/changes', icon: GitBranch, label: 'Changes' },
      ];
    }
    if (user.role === 'customer') {
      return [
        { to: '/projects', icon: FolderKanban, label: 'My Project' },
        { to: '/changes', icon: GitBranch, label: 'Changes' },
        { to: '/portfolio', icon: Image, label: 'Gallery' },
      ];
    }
    if (user.role === 'recruitment') {
      return [
        { to: '/recruitment', icon: UserPlus, label: 'Recruitment' },
      ];
    }
    return [
      { to: '/', icon: Home, label: 'Dashboard' },
      { to: '/crm', icon: TrendingUp, label: 'CRM' },
      { to: '/booking', icon: Calendar, label: 'Book' },
      { to: '/site-survey', icon: ClipboardCheck, label: 'Survey' },
      { to: '/ai-render', icon: Sparkles, label: 'AI Design' },
      { to: '/quote', icon: PenLine, label: 'New Quote' },
      { to: '/quotes', icon: ClipboardList, label: 'Quotes' },
      { to: '/price-job', icon: Calculator, label: 'Price Job' },
      ...(user.role === 'super_admin' || user.role === 'manager'
        ? [{ to: '/approvals', icon: BadgeCheck, label: 'Approvals' }]
        : []),
      { to: '/contracts', icon: FileSignature, label: 'Contracts' },
      { to: '/projects', icon: FolderKanban, label: 'Projects' },
      { to: '/planning', icon: ScrollText, label: 'Planning' },
      { to: '/building-control', icon: ShieldCheck, label: 'BC' },
      { to: '/changes', icon: GitBranch, label: 'Changes' },
      { to: '/communications', icon: Mail, label: 'Comms' },
      { to: '/cyrus', icon: MessageCircle, label: 'Cyrus' },
      { to: '/calls', icon: Phone, label: 'Calls' },
      { to: '/portfolio', icon: Image, label: 'Portfolio' },
      ...(user.role === 'super_admin'
        ? [
            { to: '/platform/clients', icon: Building2, label: 'Clients' },
            { to: '/builder-management', icon: Wrench, label: 'Builders' },
            { to: '/costing', icon: DollarSign, label: 'Costing' },
            { to: '/accounts', icon: Landmark, label: 'Accounts' },
            { to: '/sales', icon: BarChart3, label: 'Sales' },
            { to: '/team', icon: Users, label: 'Team' },
            { to: '/recruitment', icon: UserPlus, label: 'Recruit' },
            { to: '/settings', icon: Settings, label: 'Settings' },
          ]
        : []),
      ...((user.role === 'staff') && canAccessAccounts(user.role, accountsAccess)
        ? [{ to: '/accounts', icon: Landmark, label: 'Accounts' }]
        : []),
      ...(user.role === 'manager'
        ? [{ to: '/costing', icon: DollarSign, label: 'Costing' }]
        : []),
      ...(user.role === 'manager' && canAccessAccounts(user.role, accountsAccess)
        ? [{ to: '/accounts', icon: Landmark, label: 'Accounts' }]
        : []),
      ...((user.role === 'staff' || user.role === 'manager') && recruitmentAccess[user.role]
        ? [{ to: '/recruitment', icon: UserPlus, label: 'Recruit' }]
        : []),
    ];
  };

  const navItems = getNavItems();
  const expanded = sidebar.isOpen && !isMobile;
  const aiDockedInline = aiOpen && aiSettings.panelDocked && isWideViewport;

  const renderNavLinks = (showLabels: boolean, onNavigate?: () => void) =>
    navItems.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        title={label}
        onClick={() => {
          onNavigate?.();
          // #region agent log
          fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'76f60a'},body:JSON.stringify({sessionId:'76f60a',location:'AppShell.tsx:navClick',message:'sidebar nav clicked',data:{to,role:user.role,currentPath:location.pathname},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl transition-all duration-200 font-medium text-sm min-h-11 touch-manipulation ${
            showLabels ? 'px-3 justify-start' : 'px-0 justify-center'
          } ${
            isActive
              ? 'bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white shadow-md'
              : 'text-amber-100/90 hover:bg-white/8 hover:text-white'
          }`
        }
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span
          className={`truncate whitespace-nowrap transition-all duration-300 ${
            showLabels ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
          }`}
        >
          {label}
        </span>
      </NavLink>
    ));

  return (
    <div ref={shellRef} className="h-screen flex bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      <aside
        style={{ width: expanded ? EXPANDED_WIDTH : RAIL_WIDTH }}
        className="relative hidden md:flex shrink-0 flex-col bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-sm border-r border-white/10 shadow-xl transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] touch-manipulation select-none"
        aria-label="Navigation"
        aria-expanded={expanded}
        title="Double-tap or swipe to expand"
      >
        <GestureEdgeHint side="right" />

        <div
          {...sidebar.railGestureProps}
          className="p-3 border-b border-white/5 flex items-center gap-2 min-h-[3.5rem]"
          onDoubleClick={sidebar.onDoubleClick}
          title="Double-tap or swipe to expand"
        >
          <BrandLogo
            size={expanded ? 'md' : 'sm'}
            showWordmark={expanded}
            subtitle={expanded ? 'Construction Estimation' : undefined}
          />
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          {renderNavLinks(expanded)}
        </nav>

        <div className="p-2 border-t border-white/5">
          <button
            type="button"
            onClick={logout}
            className={`w-full flex items-center gap-3 rounded-xl text-amber-100/80 hover:bg-red-500/15 hover:text-red-200 transition-all duration-200 text-sm min-h-11 touch-manipulation ${
              expanded ? 'px-3' : 'justify-center'
            }`}
            title="Logout"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span
              className={`truncate transition-all duration-300 ${
                expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[min(18rem,85vw)] p-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-white/10 text-amber-100"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main app navigation</SheetDescription>
          </SheetHeader>
          <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <BrandLogo size="md" showWordmark subtitle="Construction Estimation" />
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {renderNavLinks(true, () => setMobileNavOpen(false))}
          </nav>
          <div className="p-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3 text-amber-100/80 hover:bg-red-500/15 hover:text-red-200 transition-all duration-200 text-sm min-h-11 touch-manipulation"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-sm border-b border-amber-500/30 shadow-sm z-30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-white/8 hover:bg-white/15 text-amber-100 transition-all touch-manipulation shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-amber-300/90 truncate">{getRoleDisplayName(user.role)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {aiSettings.enabled && aiSettings.showOverlay && (
              <button
                type="button"
                onClick={() => setAiOpen(!aiOpen)}
                title={getRoleCopilotPrompt(user.role)}
                className={`min-h-11 min-w-11 flex items-center justify-center rounded-xl transition-all duration-200 touch-manipulation ${
                  aiOpen
                    ? 'bg-amber-500/90 text-white shadow-md'
                    : 'bg-white/8 hover:bg-white/15 text-amber-100'
                }`}
                aria-label={aiOpen ? 'Hide AI assistant' : `Show AI assistant: ${getRoleCopilotPrompt(user.role)}`}
              >
                <Sparkles className="w-5 h-5" />
              </button>
            )}
            <NotificationSystem />
            <OrgActingAsPicker />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center justify-center gap-2 min-h-11 min-w-11 p-2 rounded-xl bg-white/8 hover:bg-white/15 text-amber-100 transition-all duration-200 touch-manipulation"
              >
                <UserCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                <ChevronDown className={`w-4 h-4 hidden sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur rounded-xl shadow-lg overflow-hidden z-50 border border-slate-200/80">
                    <div className="px-4 py-3 bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white">
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-amber-100">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-100/80"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="font-medium">Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div ref={contentRowRef} className="flex-1 flex min-h-0 overflow-hidden relative">
          <main ref={mainRef} className="flex-1 overflow-auto min-w-0 transition-[margin] duration-300">{children}</main>
          {aiSettings.enabled && aiSettings.showOverlay && aiOpen && (
            <>
              <div
                className={`${aiDockedInline ? 'hidden' : 'fixed'} z-50 flex flex-col min-h-0 overflow-hidden bg-white/98 backdrop-blur-sm shadow-2xl border-slate-200/80 inset-x-0 bottom-0 h-[min(85vh,100%)] rounded-t-2xl border-t sm:inset-x-auto sm:left-auto sm:top-14 sm:right-0 sm:bottom-0 sm:h-auto sm:w-96 sm:max-w-[min(24rem,100vw)] sm:rounded-none sm:rounded-l-2xl sm:border-t-0 sm:border-l`}
              >
                <AIAssistantPanel
                  onClose={() => setAiOpen(false)}
                  docked={false}
                  layout={isMobile ? 'sheet' : 'floating'}
                  onToggleDock={isWideViewport ? () => updateAiSettings({ panelDocked: !aiSettings.panelDocked }) : undefined}
                />
              </div>
              {aiDockedInline && (
                <div className="hidden lg:flex shrink-0 h-full min-h-0">
                  <AIAssistantPanel
                    onClose={() => setAiOpen(false)}
                    docked={aiSettings.panelDocked}
                    layout="inline"
                    onToggleDock={() => updateAiSettings({ panelDocked: !aiSettings.panelDocked })}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
