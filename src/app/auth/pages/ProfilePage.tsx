import { FormEvent, useContext, useState } from 'react';
import { Link } from 'react-router';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AuthFormError } from '../components/AuthFormError';
import { UsernameField, validateUsername } from '../components/UsernameField';

const STAGE_PLACEHOLDER = 'Profile save comes in the next stage. Changes stay on this screen only.';

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ');
}

export default function ProfilePage() {
  const context = useContext(AppContext);
  const user = context?.user;

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(
    user?.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user',
  );
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Unable to load profile. Please sign in again.</p>
      </div>
    );
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    setInfo(STAGE_PLACEHOLDER);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="text-sm text-slate-600 mt-1">Your personal profile for TradePro.</p>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <UsernameField value={username} onChange={setUsername} />
            <div>
              <Label>Email</Label>
              <Input value={user.email} readOnly className="mt-1 bg-slate-100 text-slate-600" />
              <p className="text-xs text-slate-500 mt-1">Contact an administrator to change your email.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 capitalize">
                Role: {roleLabel(user.role)}
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Org: your company
              </span>
            </div>
            <AuthFormError message={error} />
            {info && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">{info}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Save profile</Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/profile/password">Change password</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
