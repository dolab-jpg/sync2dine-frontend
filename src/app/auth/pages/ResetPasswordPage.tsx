import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { AuthLayout } from '../AuthLayout';
import { AuthFormError } from '../components/AuthFormError';
import { PasswordField } from '../components/PasswordField';

const STAGE_PLACEHOLDER = 'Password update comes in the next stage. This form is UI-only for now.';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const expired = searchParams.get('expired') === '1';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = (e: FormEvent) => {
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
    setInfo(STAGE_PLACEHOLDER);
  };

  return (
    <AuthLayout>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <CardTitle className="text-center text-2xl">Reset password</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {expired ? (
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
              <p className="text-xs text-center text-slate-400">
                UI preview: remove <code>?expired=1</code> to see the form.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {info && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{info}</p>}
              <Button type="submit" className="w-full py-6 text-lg">
                Update password
              </Button>
              <p className="text-sm text-center space-x-3">
                <Link to="/login" className="text-amber-700 font-medium hover:underline">
                  Back to sign in
                </Link>
                <Link to="/reset-password?expired=1" className="text-slate-500 hover:underline">
                  Preview expired state
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
