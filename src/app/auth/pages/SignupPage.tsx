import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { syncActiveOrgFromProfile } from '../../engine/platform/orgContext';
import { integrationService } from '../../engine/integrations/integrationService';
import { saveSessionUser } from '../../engine/auth/sessionStore';
import { AuthLayout } from '../AuthLayout';
import { AuthFormError } from '../components/AuthFormError';
import { PasswordField } from '../components/PasswordField';
import { SignupMode, SignupModeTabs } from '../components/SignupModeTabs';
import { UsernameField, validateUsername, normalizeUsername } from '../components/UsernameField';
import { acceptInvite, fetchInvite, homePathForRole, registerOrg } from '../lib/authApi';

function validatePasswordPair(password: string, confirm: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const inviteFromUrl = searchParams.get('invite')?.trim() ?? '';
  const navigate = useNavigate();

  const [mode, setMode] = useState<SignupMode>(inviteFromUrl ? 'invite' : 'company');
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pasteToken, setPasteToken] = useState(inviteFromUrl);
  const [inviteMeta, setInviteMeta] = useState<{
    orgName: string;
    role: string;
    email: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inviteToken = inviteFromUrl || (mode === 'invite' ? pasteToken.trim() : '');

  useEffect(() => {
    if (!inviteToken || inviteToken === 'invalid') {
      setInviteMeta(null);
      return;
    }
    let cancelled = false;
    void fetchInvite(inviteToken)
      .then((inv) => {
        if (cancelled) return;
        setInviteMeta({ orgName: inv.orgName, role: inv.role, email: inv.email });
        setEmail(inv.email);
        setMode('invite');
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setInviteMeta(null);
          setError(err.message || 'Invalid invite');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const title = useMemo(
    () => (mode === 'company' ? 'Create your company account' : 'Join your team'),
    [mode],
  );

  const signInAfterCreate = async (userEmail: string, userPassword: string) => {
    if (!isSupabaseConfigured()) {
      navigate('/login');
      return;
    }
    const supabase = getSupabase();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    if (authError || !data.user) {
      navigate('/login');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, role, org_id')
      .eq('id', data.user.id)
      .single();
    const role = (profile?.role ?? 'staff') as
      | 'platform_owner'
      | 'super_admin'
      | 'manager'
      | 'staff'
      | 'builder'
      | 'recruitment'
      | 'customer';
    saveSessionUser({
      id: profile?.id ?? data.user.id,
      name: profile?.name ?? name,
      email: profile?.email ?? userEmail,
      role,
    });
    await syncActiveOrgFromProfile();
    await integrationService.initOrgOpenAIKey(role);
    window.location.assign(homePathForRole(role));
  };

  const handleCompanySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid work email is required.');
      return;
    }
    const pwError = validatePasswordPair(password, confirm);
    if (pwError) {
      setError(pwError);
      return;
    }
    setLoading(true);
    try {
      await registerOrg({
        companyName: companyName.trim(),
        name: name.trim(),
        username: normalizeUsername(username),
        email: email.trim().toLowerCase(),
        password,
      });
      await signInAfterCreate(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!inviteToken || !inviteMeta) {
      setError('Paste a valid invite token to continue.');
      return;
    }
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    const pwError = validatePasswordPair(password, confirm);
    if (pwError) {
      setError(pwError);
      return;
    }
    setLoading(true);
    try {
      const result = await acceptInvite({
        token: inviteToken,
        name: name.trim(),
        username: normalizeUsername(username),
        password,
      });
      await signInAfterCreate(result.user.email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join team');
    } finally {
      setLoading(false);
    }
  };

  const applyPastedToken = () => {
    const token = pasteToken.trim();
    if (!token) {
      setError('Enter an invite token.');
      return;
    }
    navigate(`/signup?invite=${encodeURIComponent(token)}`);
    setMode('invite');
    setError('');
  };

  return (
    <AuthLayout>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white space-y-3">
          <CardTitle className="text-center text-2xl">{title}</CardTitle>
          <SignupModeTabs mode={mode} onChange={setMode} />
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {mode === 'company' ? (
            <form onSubmit={(e) => void handleCompanySubmit(e)} className="space-y-4">
              <div>
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Bathrooms Ltd"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="full-name">Your full name</Label>
                <Input
                  id="full-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="mt-1"
                />
              </div>
              <UsernameField
                value={username}
                onChange={setUsername}
                hint="3–30 characters: lowercase letters, numbers, . _ -"
              />
              <div>
                <Label htmlFor="work-email">Work email</Label>
                <Input
                  id="work-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1"
                />
              </div>
              <PasswordField
                id="signup-password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                id="signup-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Confirm password"
              />
              <AuthFormError message={error} />
              <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
                {loading ? 'Creating…' : 'Create company account'}
              </Button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleInviteSubmit(e)} className="space-y-4">
              {!inviteMeta ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-700">Paste your invite token to join an existing company.</p>
                  <div className="flex gap-2">
                    <Input
                      value={pasteToken}
                      onChange={(e) => setPasteToken(e.target.value)}
                      placeholder="Invite token"
                    />
                    <Button type="button" variant="outline" onClick={applyPastedToken}>
                      Apply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {inviteMeta.orgName}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 capitalize">
                    Role: {inviteMeta.role}
                  </span>
                </div>
              )}

              <div>
                <Label htmlFor="invite-name">Full name</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="mt-1"
                />
              </div>
              <UsernameField value={username} onChange={setUsername} />
              <div>
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteMeta?.email ?? email}
                  readOnly={Boolean(inviteMeta)}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`mt-1 ${inviteMeta ? 'bg-slate-100 text-slate-600' : ''}`}
                />
              </div>
              <PasswordField
                id="invite-password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                id="invite-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Confirm password"
              />
              <AuthFormError message={error} />
              <Button type="submit" className="w-full py-6 text-lg" disabled={!inviteMeta || loading}>
                {loading ? 'Joining…' : 'Join team'}
              </Button>
            </form>
          )}

          <p className="text-sm text-center text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-amber-700 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
