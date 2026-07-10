import { useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { User, Briefcase, Wrench, Users, UserCheck, Building2, Shield } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { syncActiveOrgFromProfile } from '../engine/platform/orgContext';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client';

interface LoginProps {
  onLogin: (user: {
    id: string;
    name: string;
    email: string;
    role: 'platform_owner' | 'super_admin' | 'manager' | 'staff' | 'builder' | 'recruitment' | 'customer';
  }) => void;
}

type DemoRole = LoginProps['onLogin'] extends (u: infer U) => void ? U['role'] : never;

const DEMO_LOGIN_ENABLED = import.meta.env.VITE_DEMO_LOGIN !== 'false';

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<DemoRole>('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { value: 'platform_owner' as const, label: 'Platform Owner', icon: Building2, color: 'from-indigo-500 to-violet-600', description: 'Manage client companies, billing & tokens' },
    { value: 'super_admin' as const, label: 'Super Admin', icon: Shield, color: 'from-red-500 to-red-600', description: 'Full system access, manage pricing, team & settings' },
    { value: 'manager' as const, label: 'Manager', icon: Briefcase, color: 'from-blue-500 to-blue-600', description: 'View all jobs, manage customers & quotes' },
    { value: 'staff' as const, label: 'Sales Representative', icon: User, color: 'from-green-500 to-green-600', description: 'On-site surveys, quotes & customer visits' },
    { value: 'builder' as const, label: 'Builder', icon: Wrench, color: 'from-purple-500 to-purple-600', description: 'Job updates, task management & project progress' },
    { value: 'recruitment' as const, label: 'Recruitment', icon: Users, color: 'from-indigo-500 to-indigo-600', description: 'Hiring, candidate tracking & onboarding' },
    { value: 'customer' as const, label: 'Customer', icon: UserCheck, color: 'from-pink-500 to-pink-600', description: 'View project progress & add requests' },
  ];

  const demoUsers: Record<DemoRole, { id: string; name: string; email: string; role: DemoRole }> = {
    platform_owner: { id: '0', name: 'Platform Owner', email: 'owner@tradepro.com', role: 'platform_owner' },
    super_admin: { id: '1', name: 'John Smith', email: 'john@bathroompro.com', role: 'super_admin' },
    manager: { id: '2', name: 'Sarah Johnson', email: 'sarah@bathroompro.com', role: 'manager' },
    staff: { id: '3', name: 'Mike Davis', email: 'mike@bathroompro.com', role: 'staff' },
    builder: { id: '4', name: 'Mike Wilson', email: 'mike.wilson@bathroompro.com', role: 'builder' },
    recruitment: { id: '5', name: 'Emma Thompson', email: 'emma@bathroompro.com', role: 'recruitment' },
    customer: { id: '6', name: 'Amanda Peterson', email: 'amanda.peterson@email.com', role: 'customer' },
  };

  const trySupabaseLogin = async (): Promise<boolean> => {
    if (!isSupabaseConfigured() || !email.trim() || !password) return false;
    try {
      const supabase = getSupabase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !data.user) return false;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, role, org_id')
        .eq('id', data.user.id)
        .single();

      await syncActiveOrgFromProfile();

      onLogin({
        id: profile?.id ?? data.user.id,
        name: profile?.name ?? data.user.email?.split('@')[0] ?? 'User',
        email: profile?.email ?? data.user.email ?? email,
        role: (profile?.role ?? 'staff') as DemoRole,
      });
      return true;
    } catch {
      return false;
    }
  };

  const tryLegacyLogin = async (): Promise<boolean> => {
    if (!email.trim() || !password) return false;
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json() as { user: { id: string; name: string; email: string; role: DemoRole } };
      onLogin(data.user);
      return true;
    } catch {
      return false;
    }
  };

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    const loggedIn = (await trySupabaseLogin()) || (await tryLegacyLogin());
    if (loggedIn) {
      setIsLoading(false);
      return;
    }

    if (email.trim() && password) {
      setError('Invalid email or password.');
      setIsLoading(false);
      return;
    }

    if (!DEMO_LOGIN_ENABLED) {
      setError('Email and password are required.');
      setIsLoading(false);
      return;
    }

    setTimeout(() => {
      onLogin(demoUsers[selectedRole]);
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-6 sm:mb-8">
          <BrandLogo size="lg" showWordmark className="justify-center mb-3" />
          <p className="text-amber-100">Construction Estimation Platform</p>
          <Link to="/platform/clients" className="text-sm text-indigo-300 hover:underline mt-2 inline-block">
            Open Platform Clients CRM (no login required while testing)
          </Link>
        </div>

        {DEMO_LOGIN_ENABLED && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
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
        )}

        <Card className="shadow-2xl rounded-2xl border-0">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
            <CardTitle className="text-center text-2xl">Sign In</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@tradepro.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {DEMO_LOGIN_ENABLED && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-900">
                <strong>Testing mode:</strong> leave email/password blank and pick a role, or sign in with Supabase credentials.
              </div>
            )}
            <Button onClick={() => void handleLogin()} disabled={isLoading} className="w-full py-6 text-lg">
              {isLoading ? 'Signing in...' : email && password ? 'Sign In' : DEMO_LOGIN_ENABLED ? `Demo as ${roles.find(r => r.value === selectedRole)?.label}` : 'Sign In'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
