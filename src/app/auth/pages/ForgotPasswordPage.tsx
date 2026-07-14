import { FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { AuthLayout } from '../AuthLayout';
import { AuthFormError } from '../components/AuthFormError';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <CardTitle className="text-center text-2xl">Forgot password</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 bg-green-50 border border-green-200 rounded-lg p-4">
                If an account exists for <strong>{email}</strong>, we sent a reset link.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter your account email and we&apos;ll send a link to reset your password.
              </p>
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1"
                  autoComplete="email"
                />
              </div>
              <AuthFormError message={error} />
              <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
              <p className="text-sm text-center">
                <Link to="/login" className="text-amber-700 font-medium hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
