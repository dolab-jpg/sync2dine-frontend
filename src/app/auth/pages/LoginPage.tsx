import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { User, Briefcase, Wrench, Users, UserCheck, Building2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { parseDemoRoleFromUrl } from '../../engine/auth/sessionStore';
import { syncActiveOrgFromProfile } from '../../engine/platform/orgContext';
import { integrationService } from '../../engine/integrations/integrationService';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { AuthLayout } from '../AuthLayout';
import { AuthFormError } from '../components/AuthFormError';
import { PasswordField } from '../components/PasswordField';
import { SeedAccountsPanel, SEED_PASSWORD, SEED_ACCOUNTS, type SeedAccount } from '../components/SeedAccountsPanel';
import { homePathForRole, resolveUsername } from '../lib/authApi';

interface LoginProps {
  onLogin: (user: {
    id: string;
    name: string;
    email: string;
    role: 'platform_owner' | 'super_admin' | 'manager' | 'staff' | 'builder' | 'recruitment' | 'customer';
  }) => void;
}

type DemoRole = LoginProps['onLogin'] extends (u: infer U) => void ? U['role'] : never;

const DEMO_LOGIN_ENABLED = import.meta.env.VITE_DEMO_LOGIN === 'true';

export default function LoginPage({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<DemoRole>(() => parseDemoRoleFromUrl() ?? 'staff');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const urlRole = parseDemoRoleFromUrl();
    if (urlRole) setSelectedRole(urlRole);
  }, []);

  // OAuth / existing Supabase session return
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (cancelled || !data.session?.user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, name, email, role, org_id, username')
          .eq('id', data.session.user.id)
          .maybeSingle();
        if (!profile) {
          navigate('/signup', { replace: true });
          return;
        }
        if (!profile.org_id && profile.role !== 'platform_owner') {
          navigate('/signup', { replace: true });
          return;
        }
        const role = (profile.role ?? 'staff') as DemoRole;
        await syncActiveOrgFromProfile();
        await integrationService.initOrgOpenAIKey(role);
        onLogin({
          id: profile.id,
          name: profile.name || data.session.user.email?.split('@')[0] || 'User',
          email: profile.email || data.session.user.email || '',
          role,
        });
        // App remounts BrowserRouter on login — use full navigation
        if (!profile.username) {
          window.location.assign('/profile?complete=1');
          return;
        }
        const dest =
          next && next.startsWith('/') && !next.startsWith('//')
            ? next
            : homePathForRole(role);
        window.location.assign(dest);
      } catch {
        /* stay on login */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = [
    { value: 'platform_owner' as const, label: 'Super Admin (controlling)', icon: Building2, color: 'from-indigo-500 to-violet-600', description: 'Same full CRM + create/control client companies' },
    { value: 'super_admin' as const, label: 'Super Admin', icon: Shield, color: 'from-red-500 to-red-600', description: 'Full CRM for one company — pricing, team & settings' },
    { value: 'manager' as const, label: 'Manager', icon: Briefcase, color: 'from-blue-500 to-blue-600', description: 'View all jobs, manage customers & quotes' },
    { value: 'staff' as const, label: 'Sales Representative', icon: User, color: 'from-green-500 to-green-600', description: 'On-site surveys, quotes & customer visits' },
    { value: 'builder' as const, label: 'Builder', icon: Wrench, color: 'from-purple-500 to-purple-600', description: 'Job updates, task management & project progress' },
    { value: 'recruitment' as const, label: 'Recruitment', icon: Users, color: 'from-indigo-500 to-indigo-600', description: 'Hiring, candidate tracking & onboarding' },
    { value: 'customer' as const, label: 'Customer', icon: UserCheck, color: 'from-pink-500 to-pink-600', description: 'View project progress & add requests' },
  ];

  const demoUsers: Record<DemoRole, { id: string; name: string; email: string; role: DemoRole }> = {
    platform_owner: { id: '0', name: 'Super Admin', email: 'owner@tradepro.com', role: 'platform_owner' },
    super_admin: { id: '1', name: 'John Smith', email: 'john@bathroompro.com', role: 'super_admin' },
    manager: { id: '2', name: 'Sarah Johnson', email: 'sarah@bathroompro.com', role: 'manager' },
    staff: { id: '3', name: 'Mike Davis', email: 'mike@bathroompro.com', role: 'staff' },
    builder: { id: '4', name: 'Mike Wilson', email: 'mike.wilson@bathroompro.com', role: 'builder' },
    recruitment: { id: '5', name: 'Emma Thompson', email: 'emma@bathroompro.com', role: 'recruitment' },
    customer: { id: '6', name: 'Amanda Peterson', email: 'amanda.peterson@email.com', role: 'customer' },
  };

  const finishLogin = async (user: {
    id: string;
    name: string;
    email: string;
    role: DemoRole;
  }) => {
    await syncActiveOrgFromProfile();
    await integrationService.initOrgOpenAIKey(user.role);
    onLogin(user);
    // App remounts a new BrowserRouter on login — use full navigation, not react-router navigate
    const dest =
      next && next.startsWith('/') && !next.startsWith('//')
        ? next
        : homePathForRole(user.role);
    window.location.assign(dest);
  };

  const handleCredentialSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) {
      setError('Email or username is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setIsLoading(true);
    try {
      let email = identifier.trim();
      if (!email.includes('@')) {
        try {
          email = await resolveUsername(email);
        } catch (resolveErr) {
          // Seed/dev fallback when API is down — map known usernames to emails
          const seed = SEED_ACCOUNTS.find((a) => a.username === email.toLowerCase());
          if (seed) {
            email = seed.email;
          } else {
            setError(
              resolveErr instanceof Error
                ? `${resolveErr.message} (Tip: use the email from Test accounts, or start the API on port 3001.)`
                : 'Could not resolve username. Use the email from Test accounts.',
            );
            return;
          }
        }
      }
      const supabase = getSupabase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !data.user) {
        setError(authError?.message || 'Invalid email/username or password.');
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, role, org_id, username')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileError) {
        setError(profileError.message);
        return;
      }
      const role = (profile?.role ?? 'staff') as DemoRole;
      await finishLogin({
        id: profile?.id ?? data.user.id,
        name: profile?.name ?? data.user.email?.split('@')[0] ?? 'User',
        email: profile?.email ?? data.user.email ?? email,
        role,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }
    setError('');
    const supabase = getSupabase();
    const redirectTo = `${window.location.origin}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleDemoLogin = () => {
    if (isLoading || !DEMO_LOGIN_ENABLED) return;
    setIsLoading(true);
    setError('');
    setTimeout(() => {
      void finishLogin(demoUsers[selectedRole]).finally(() => setIsLoading(false));
    }, 300);
  };

  const fillSeedAccount = (account: SeedAccount) => {
    setIdentifier(account.email);
    setPassword(SEED_PASSWORD);
    setError('');
  };

  return (
    <AuthLayout wide>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <CardTitle className="text-center text-2xl">Sign in to TradePro</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <form onSubmit={(e) => void handleCredentialSubmit(e)} className="space-y-4">
            <div>
              <Label htmlFor="login-identifier">Email or username</Label>
              <Input
                id="login-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@company.com or jane.smith"
                className="mt-1"
              />
            </div>
            <PasswordField
              id="login-password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <AuthFormError message={error} />
            <Button type="submit" className="w-full py-6 text-lg" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => void handleOAuth('google')}>
              Continue with Google
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleOAuth('github')}>
              Continue with GitHub
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Link to="/forgot-password" className="text-amber-700 hover:text-amber-900 font-medium">
              Forgot password?
            </Link>
            <Link to="/signup" className="text-slate-700 hover:text-slate-900 font-medium">
              Create an account
            </Link>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Have an invite?</p>
            <div className="flex gap-2">
              <Input
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Paste invite token"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!inviteToken.trim()}
                onClick={() => {
                  const token = inviteToken.trim();
                  if (token) navigate(`/invite/${encodeURIComponent(token)}`);
                }}
              >
                Open
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SeedAccountsPanel onFill={fillSeedAccount} />

      {DEMO_LOGIN_ENABLED && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setDemoOpen((o) => !o)}
            className="w-full flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white hover:bg-white/15"
          >
            <span className="font-semibold">Developer demo</span>
            {demoOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {demoOpen && (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.value;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value)}
                      className={`p-4 rounded-2xl border-4 transition-all text-left ${
                        isSelected ? 'border-amber-500 bg-white shadow-xl' : 'border-white/20 bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <div className={`inline-block bg-gradient-to-br ${role.color} p-3 rounded-xl mb-2`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className={`font-bold ${isSelected ? 'text-slate-900' : 'text-white'}`}>{role.label}</h3>
                      <p className={`text-xs mt-1 ${isSelected ? 'text-slate-600' : 'text-amber-100'}`}>{role.description}</p>
                    </button>
                  );
                })}
              </div>
              <Button onClick={handleDemoLogin} disabled={isLoading} className="w-full py-6 text-lg">
                {isLoading
                  ? 'Signing in...'
                  : `Demo as ${roles.find((r) => r.value === selectedRole)?.label}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
