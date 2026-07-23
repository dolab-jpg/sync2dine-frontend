/**
 * App route trees � keep URL changes here (and in routeMap.ts + APPLICATION_MASTER �24).
 * Auth/bootstrap/experience gate remain in App.tsx.
 */
import React, { type ReactElement } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router';
import LoginPage from './auth/pages/LoginPage';
import SignupPage from './auth/pages/SignupPage';
import ForgotPasswordPage from './auth/pages/ForgotPasswordPage';
import ResetPasswordPage from './auth/pages/ResetPasswordPage';
import InviteAcceptPage from './auth/pages/InviteAcceptPage';
import ProfilePage from './auth/pages/ProfilePage';
import ChangePasswordPage from './auth/pages/ChangePasswordPage';
import SalesDashboard from './components/SalesDashboard';
import CustomerManagement from './components/CustomerManagement';
import Settings from './components/Settings';
import CommunicationsHub from './components/CommunicationsHub';
import CyrusConversations from './components/CyrusConversations';
import CynthiaHome from './components/Cynthia/CynthiaHome';
import IntegrationsHub from './components/integrations/IntegrationsHub';
import CursorPastePage from './pages/CursorPastePage';
import ComprehensiveCRM from './components/ComprehensiveCRM';
import TeamManagement from './components/TeamManagement';
import SalesManagement from './components/SalesManagement';
import RecruitmentCRM from './components/RecruitmentCRM';
import AccountsHub from './components/accounts/AccountsHub';
import ConversationAudit from './components/aiStudio/ConversationAudit';
import CallCenter from './components/CallCenter/CallCenter';
import CallRegister from './components/CallCenter/CallRegister';
import AppShell from './components/AppShell';
import PlatformClientsCRM from './components/platform/PlatformClientsCRM';
import SallyOfferSettings from './components/platform/SallyOfferSettings';
import SallyKnowledgePanel from './components/platform/SallyKnowledgePanel';
import SalesBrainPanel from './components/platform/SalesBrainPanel';
import PricingPage from './components/PricingPage';
import StartCheckoutFlow from './components/StartCheckoutFlow';
import JudieLandingPage from './components/JudieLandingPage';
import AtmosphereLandingPage from './components/AtmosphereLandingPage';
import TermsPage from './components/legal/TermsPage';
import FairUseAndFaresPage from './components/legal/FairUseAndFaresPage';
import PrivacyPage from './components/legal/PrivacyPage';
import AcceptableUsePage from './components/legal/AcceptableUsePage';
import CookiesPage from './components/legal/CookiesPage';
import CancellationRefundsPage from './components/legal/CancellationRefundsPage';
import QuotesList from './components/QuotesList';
import SaasQuoteBuilder from './components/SaasQuoteBuilder';
import MenuPreview from './components/platform/MenuPreview';
import FrontKiosk from './components/FrontKiosk';
import RestaurantOrders from './components/RestaurantOrders';
import RestaurantShell from './components/restaurant/RestaurantShell';
import RestaurantAccounts from './components/restaurant/RestaurantAccounts';
import RestaurantLive from './components/restaurant/RestaurantLive';
import MenuManager from './components/restaurant/MenuManager';
import RestaurantTill from './components/restaurant/RestaurantTill';
import RestaurantSettings from './components/restaurant/RestaurantSettings';
import BookingsBoard from './components/restaurant/BookingsBoard';
import IntegrationsPublicPage from './components/restaurant/IntegrationsPublicPage';
import { OnlineStatusBanner } from './components/OnlineStatusBanner';
import { Toaster } from './components/ui/sonner';
import {
  type User,
  type UserRole,
  type RecruitmentAccess,
  type AccountsAccess,
  canAccessRecruitment,
  canAccessAccounts,
  roleAllowed,
} from './accessGates';

interface ProtectedRouteProps {
  element: ReactElement;
  allowedRoles: UserRole[];
  user: User;
}

function ProtectedRoute({ element, allowedRoles, user }: ProtectedRouteProps): ReactElement {
  if (!roleAllowed(user.role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }
  return element;
}

function RedirectToMarketing({ path = '/' }: { path?: string }) {
  if (typeof window !== 'undefined') {
    window.location.replace(`https://sync2dine.io${path}`);
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6efe0] px-6 text-center">
      <p className="text-lg font-semibold text-[#0f3d3e]">
        Taking you to Sync2Dine...
      </p>
    </div>
  );
}

function publicMarketingAndLegalRoutes(): ReactElement[] {
  return [
    <Route key="pricing" path="/pricing" element={<PricingPage />} />,
    <Route key="start" path="/start" element={<StartCheckoutFlow />} />,
    <Route key="judie" path="/judie" element={<JudieLandingPage />} />,
    <Route key="atmosphere" path="/atmosphere" element={<AtmosphereLandingPage />} />,
    <Route key="legal-terms" path="/legal/terms" element={<TermsPage />} />,
    <Route key="legal-fares" path="/legal/fair-use-and-fares" element={<FairUseAndFaresPage />} />,
    <Route key="legal-privacy" path="/legal/privacy" element={<PrivacyPage />} />,
    <Route key="legal-aup" path="/legal/acceptable-use" element={<AcceptableUsePage />} />,
    <Route key="legal-cookies" path="/legal/cookies" element={<CookiesPage />} />,
    <Route key="legal-cancel" path="/legal/cancellation-refunds" element={<CancellationRefundsPage />} />,
    <Route key="front" path="/front" element={<FrontKiosk />} />,
  ];
}

export function CursorPasteRoutes() {
  return (
    <Routes>
      <Route path="/cursor-paste" element={<CursorPastePage />} />
    </Routes>
  );
}

export function LoggedOutRoutes({ onLogin }: { onLogin: (user: User) => void }) {
  return (
    <>
      <OnlineStatusBanner />
      <Routes>
        <Route path="/cursor-paste" element={<CursorPastePage />} />
        <Route path="/front" element={<FrontKiosk />} />
        <Route path="/integrations" element={<IntegrationsPublicPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/pricing" element={<RedirectToMarketing path="/pricing/" />} />
        <Route path="/start" element={<RedirectToMarketing path="/inquiry/" />} />
        <Route path="/judie" element={<RedirectToMarketing path="/ai-phone-ordering/" />} />
        <Route path="/atmosphere" element={<RedirectToMarketing path="/" />} />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/fair-use-and-fares" element={<FairUseAndFaresPage />} />
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="/legal/cookies" element={<CookiesPage />} />
        <Route path="/legal/cancellation-refunds" element={<CancellationRefundsPage />} />
        <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export function RestaurantExperienceRoutes({ user }: { user: User }) {
  return (
    <Routes>
      {publicMarketingAndLegalRoutes()}
      <Route
        element={(
          <RestaurantShell>
            <Outlet />
          </RestaurantShell>
        )}
      >
        <Route path="/" element={<RestaurantLive />} />
        <Route path="/orders" element={<Navigate to="/orders/kitchen" replace />} />
        <Route
          path="/orders/kitchen"
          element={<ProtectedRoute element={<RestaurantOrders tab="kitchen" showTabs={false} />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/orders/till"
          element={<ProtectedRoute element={<RestaurantTill />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/orders/delivery"
          element={<ProtectedRoute element={<RestaurantOrders tab="delivery" showTabs={false} />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/bookings"
          element={<ProtectedRoute element={<BookingsBoard />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/menu"
          element={<ProtectedRoute element={<MenuManager />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route path="/products" element={<Navigate to="/menu" replace />} />
        <Route
          path="/customers"
          element={<ProtectedRoute element={<CustomerManagement />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/calls"
          element={<ProtectedRoute element={<CallCenter />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/call-register"
          element={<ProtectedRoute element={<CallRegister />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
        />
        <Route
          path="/accounts"
          element={<ProtectedRoute element={<RestaurantAccounts />} allowedRoles={['super_admin', 'manager']} user={user} />}
        />
        <Route path="/team" element={<Navigate to="/settings" replace />} />
        <Route
          path="/settings"
          element={<ProtectedRoute element={<RestaurantSettings />} allowedRoles={['super_admin', 'manager']} user={user} />}
        />
        <Route path="/integrations" element={<IntegrationsPublicPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function ConstructionExperienceRoutes({
  user,
  recruitmentAccess,
  accountsAccess,
}: {
  user: User;
  recruitmentAccess: RecruitmentAccess;
  accountsAccess: AccountsAccess;
}) {
  return (
    <>
      <Routes>
        {publicMarketingAndLegalRoutes()}
        <Route
          element={(
            <AppShell>
              <Outlet />
            </AppShell>
          )}
        >
          <Route path="/" element={<SalesDashboard />} />
          <Route
            path="/crm"
            element={<ProtectedRoute element={<ComprehensiveCRM />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/quotes"
            element={<ProtectedRoute element={<QuotesList />} allowedRoles={['super_admin', 'manager', 'staff', 'platform_owner']} user={user} />}
          />
          <Route
            path="/quote/saas"
            element={<ProtectedRoute element={<SaasQuoteBuilder />} allowedRoles={['super_admin', 'manager', 'staff', 'platform_owner']} user={user} />}
          />
          <Route
            path="/quote/saas/:customerId"
            element={<ProtectedRoute element={<SaasQuoteBuilder />} allowedRoles={['super_admin', 'manager', 'staff', 'platform_owner']} user={user} />}
          />
          <Route
            path="/customers"
            element={<ProtectedRoute element={<CustomerManagement />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/orders"
            element={<ProtectedRoute element={<RestaurantOrders />} allowedRoles={['platform_owner', 'super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route path="/products" element={<Navigate to="/platform/clients" replace />} />
          <Route
            path="/email"
            element={<ProtectedRoute element={<CommunicationsHub />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/communications"
            element={<ProtectedRoute element={<CommunicationsHub />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/cynthia"
            element={<ProtectedRoute element={<CynthiaHome />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/cynthia/ingest"
            element={<ProtectedRoute element={<CynthiaHome />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route path="/cyrus" element={<Navigate to="/cynthia" replace />} />
          <Route
            path="/cyrus/legacy"
            element={<ProtectedRoute element={<CyrusConversations />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/whatsapp"
            element={<ProtectedRoute element={<CyrusConversations />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/calls"
            element={<ProtectedRoute element={<CallCenter />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route
            path="/call-register"
            element={<ProtectedRoute element={<CallRegister />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
          />
          <Route path="/agent" element={<Navigate to="/calls" replace />} />
          <Route
            path="/integrations"
            element={<ProtectedRoute element={<IntegrationsHub />} allowedRoles={['super_admin']} user={user} />}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute element={<Settings />} allowedRoles={['super_admin']} user={user} />}
          />
          <Route
            path="/team"
            element={<ProtectedRoute element={<TeamManagement />} allowedRoles={['super_admin']} user={user} />}
          />
          <Route
            path="/sales"
            element={<ProtectedRoute element={<SalesManagement />} allowedRoles={['super_admin']} user={user} />}
          />
          <Route
            path="/recruitment"
            element={
              canAccessRecruitment(user.role, recruitmentAccess)
                ? <RecruitmentCRM />
                : <Navigate to="/" replace />
            }
          />
          <Route
            path="/accounts"
            element={
              canAccessAccounts(user.role, accountsAccess)
                ? <AccountsHub />
                : <Navigate to="/" replace />
            }
          />
          <Route
            path="/platform/clients"
            element={
              <ProtectedRoute
                element={<PlatformClientsCRM />}
                allowedRoles={['platform_owner']}
                user={user}
              />
            }
          />
          <Route
            path="/platform/sally-offer"
            element={
              <ProtectedRoute
                element={<SallyOfferSettings />}
                allowedRoles={['platform_owner']}
                user={user}
              />
            }
          />
          <Route
            path="/platform/sally-knowledge"
            element={
              <ProtectedRoute
                element={<SallyKnowledgePanel />}
                allowedRoles={['platform_owner']}
                user={user}
              />
            }
          />
          <Route
            path="/platform/sales-brain"
            element={
              <ProtectedRoute
                element={<SalesBrainPanel />}
                allowedRoles={['platform_owner']}
                user={user}
              />
            }
          />
          <Route
            path="/platform/clients/:orgId/menu"
            element={
              <ProtectedRoute
                element={<MenuPreview />}
                allowedRoles={['platform_owner']}
                user={user}
              />
            }
          />
          <Route
            path="/ai-audit"
            element={<ProtectedRoute element={<ConversationAudit />} allowedRoles={['super_admin', 'manager']} user={user} />}
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/password" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}

/** Re-export map for convenience */
export { ROUTE_MAP } from './routeMap';
