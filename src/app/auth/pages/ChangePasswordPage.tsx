import { FormEvent, useContext, useState } from 'react';
import { Link } from 'react-router';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { AuthFormError } from '../components/AuthFormError';
import { PasswordField } from '../components/PasswordField';

export default function ChangePasswordPage() {
  const context = useContext(AppContext);
  const email = context?.user?.email ?? '';

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!currentPassword) {
      setError('Current password is required.');
      return;
    }
    if (!password) {
      setError('New password is required.');
      return;
    }
    if (password.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password === currentPassword) {
      setError('New password must be different from the current password.');
      return;
    }
    if (!isSupabaseConfigured() || !email) {
      setError('Supabase session required.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        setError('Current password is incorrect.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setInfo('Password updated.');
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Change password</h1>
        <p className="text-sm text-slate-600 mt-1">Update the password you use to sign in.</p>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <PasswordField
              id="current-password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              id="new-password"
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Confirm password"
            />
            <AuthFormError message={error} />
            {info && (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">{info}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/profile">Back to profile</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
