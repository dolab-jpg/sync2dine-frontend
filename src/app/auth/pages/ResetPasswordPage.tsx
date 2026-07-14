import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { AuthLayout } from '../AuthLayout';
import { AuthFormError } from '../components/AuthFormError';
import { PasswordField } from '../components/PasswordField';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const expiredFlag = searchParams.get('expired') === '1';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [hasSession, setHasSession] = useState(!expiredFlag);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expiredFlag || !isSupabaseConfigured()) {
      setHasSession(false);
      return;
    }
    void getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(Boolean(data.session));
      });
  }, [expiredFlag]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      setInfo('Password updated. You can sign in with your new password.');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  const expired = expiredFlag || !hasSession;

  return (
    <AuthLayout>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <CardTitle className="text-center text-2xl">Reset password</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {expired && !info ? (
            <div className="space-y-4">
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-4">
                This reset link has expired or is invalid. Request a new one to continue.
              </p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request new link</Link>
              </Button>
              <p className="text-sm text-center">
                <Link to="/login" className="text-amber-700 font-medium hover:underline">
                  Back to sign in
                </Link>
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <p className="text-sm text-slate-600">Choose a new password for your TradePro account.</p>
              <PasswordField
                id="reset-password"
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                id="reset-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Confirm password"
              />
              <AuthFormError message={error} />
              {info && (
                <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">{info}</p>
              )}
              <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
