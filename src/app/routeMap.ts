/**
 * Declarative route catalogue for agents and humans.
 * JSX trees live in `routes.tsx`; bootstrap/experience gate stay in `App.tsx`.
 *
 * Keep in sync when adding routes — also update docs/APPLICATION_MASTER.md §24.
 */

export type ExperienceScope = 'public' | 'logged_out' | 'restaurant' | 'construction' | 'both_authed';

export interface RouteMapEntry {
  path: string;
  experience: ExperienceScope;
  /** Screen / page module (relative to src/app) */
  component: string;
  notes?: string;
}

/** Primary URL ? screen map (not every redirect alias). */
export const ROUTE_MAP: RouteMapEntry[] = [
  // Public / logged-out
  { path: '/cursor-paste', experience: 'public', component: 'pages/CursorPastePage.tsx' },
  { path: '/login', experience: 'logged_out', component: 'auth/pages/LoginPage.tsx' },
  { path: '/signup', experience: 'logged_out', component: 'auth/pages/SignupPage.tsx' },
  { path: '/forgot-password', experience: 'logged_out', component: 'auth/pages/ForgotPasswordPage.tsx' },
  { path: '/reset-password', experience: 'logged_out', component: 'auth/pages/ResetPasswordPage.tsx' },
  { path: '/invite/:token', experience: 'logged_out', component: 'auth/pages/InviteAcceptPage.tsx' },
  { path: '/front', experience: 'public', component: 'components/FrontKiosk.tsx', notes: 'Diner kiosk' },
  { path: '/integrations', experience: 'public', component: 'components/restaurant/IntegrationsPublicPage.tsx' },
  { path: '/legal/*', experience: 'public', component: 'components/legal/*' },
  { path: '/pricing', experience: 'both_authed', component: 'components/PricingPage.tsx' },
  { path: '/start', experience: 'both_authed', component: 'components/StartCheckoutFlow.tsx' },
  { path: '/judie', experience: 'both_authed', component: 'components/JudieLandingPage.tsx' },
  { path: '/atmosphere', experience: 'both_authed', component: 'components/AtmosphereLandingPage.tsx' },

  // Restaurant experience
  { path: '/', experience: 'restaurant', component: 'components/restaurant/RestaurantLive.tsx' },
  { path: '/orders/kitchen', experience: 'restaurant', component: 'components/RestaurantOrders.tsx' },
  { path: '/orders/till', experience: 'restaurant', component: 'components/restaurant/RestaurantTill.tsx' },
  { path: '/orders/delivery', experience: 'restaurant', component: 'components/RestaurantOrders.tsx' },
  { path: '/bookings', experience: 'restaurant', component: 'components/restaurant/BookingsBoard.tsx' },
  { path: '/menu', experience: 'restaurant', component: 'components/restaurant/MenuManager.tsx' },
  { path: '/customers', experience: 'restaurant', component: 'components/CustomerManagement.tsx' },
  { path: '/calls', experience: 'restaurant', component: 'components/CallCenter/CallCenter.tsx' },
  { path: '/call-register', experience: 'restaurant', component: 'components/CallCenter/CallRegister.tsx' },
  { path: '/accounts', experience: 'restaurant', component: 'components/restaurant/RestaurantAccounts.tsx' },
  { path: '/settings', experience: 'restaurant', component: 'components/restaurant/RestaurantSettings.tsx' },
  { path: '/profile', experience: 'restaurant', component: 'auth/pages/ProfilePage.tsx' },

  // Construction / sales experience
  { path: '/', experience: 'construction', component: 'components/SalesDashboard.tsx' },
  { path: '/crm', experience: 'construction', component: 'components/ComprehensiveCRM.tsx' },
  { path: '/quotes', experience: 'construction', component: 'components/QuotesList.tsx' },
  { path: '/quote/saas', experience: 'construction', component: 'components/SaasQuoteBuilder.tsx' },
  { path: '/customers', experience: 'construction', component: 'components/CustomerManagement.tsx' },
  { path: '/projects', experience: 'construction', component: 'components/BuilderProjectManagement.tsx' },
  { path: '/projects/:projectId', experience: 'construction', component: 'components/BuilderProjectManagement.tsx', notes: 'Supports ?tab=messages for briefs' },
  { path: '/notifications', experience: 'construction', component: 'components/NotificationsPage.tsx' },
  { path: '/orders', experience: 'construction', component: 'components/RestaurantOrders.tsx', notes: 'Platform/owner order board' },
  { path: '/email', experience: 'construction', component: 'components/CommunicationsHub.tsx' },
  { path: '/communications', experience: 'construction', component: 'components/CommunicationsHub.tsx' },
  { path: '/cynthia', experience: 'construction', component: 'components/Cynthia/CynthiaHome.tsx' },
  { path: '/cynthia/ingest', experience: 'construction', component: 'components/Cynthia/CynthiaHome.tsx' },
  { path: '/cyrus', experience: 'construction', component: '? /cynthia', notes: 'Legacy redirect' },
  { path: '/cyrus/legacy', experience: 'construction', component: 'components/CyrusConversations.tsx' },
  { path: '/whatsapp', experience: 'construction', component: 'components/CyrusConversations.tsx' },
  { path: '/calls', experience: 'construction', component: 'components/CallCenter/CallCenter.tsx' },
  { path: '/call-register', experience: 'construction', component: 'components/CallCenter/CallRegister.tsx' },
  { path: '/integrations', experience: 'construction', component: 'components/integrations/IntegrationsHub.tsx' },
  { path: '/settings', experience: 'construction', component: 'components/Settings.tsx' },
  { path: '/team', experience: 'construction', component: 'components/TeamManagement.tsx' },
  { path: '/sales', experience: 'construction', component: 'components/SalesManagement.tsx' },
  { path: '/recruitment', experience: 'construction', component: 'components/RecruitmentCRM.tsx', notes: 'Flag-gated' },
  { path: '/accounts', experience: 'construction', component: 'components/accounts/AccountsHub.tsx', notes: 'Flag-gated' },
  { path: '/platform/clients', experience: 'construction', component: 'components/platform/PlatformClientsCRM.tsx' },
  { path: '/platform/sally-offer', experience: 'construction', component: 'components/platform/SallyOfferSettings.tsx' },
  { path: '/platform/sally-knowledge', experience: 'construction', component: 'components/platform/SallyKnowledgePanel.tsx' },
  { path: '/platform/sales-brain', experience: 'construction', component: 'components/platform/SalesBrainPanel.tsx' },
  { path: '/platform/clients/:orgId/menu', experience: 'construction', component: 'components/platform/MenuPreview.tsx' },
  { path: '/ai-audit', experience: 'construction', component: 'components/aiStudio/ConversationAudit.tsx' },
  { path: '/profile', experience: 'construction', component: 'auth/pages/ProfilePage.tsx' },
];
