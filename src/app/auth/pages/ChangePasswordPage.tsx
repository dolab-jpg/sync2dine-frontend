import { FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { AuthFormError } from '../components/AuthFormError';
import { PasswordField } from '../components/PasswordField';

const STAGE_PLACEHOLDER = 'Password change comes in the next stage. This form is UI-only for now.';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = (e: FormEvent) => {
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
    setInfo(STAGE_PLACEHOLDER);
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{info}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Update password</Button>
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
