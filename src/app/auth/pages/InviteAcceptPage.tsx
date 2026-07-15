import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { AuthLayout } from '../AuthLayout';
import { fetchInvite } from '../lib/authApi';

export default function InviteAcceptPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{
    orgName: string;
    role: string;
    email: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    if (!token || token === 'invalid') {
      setLoading(false);
      setError('Invite not found');
      return;
    }
    let cancelled = false;
    void fetchInvite(token)
      .then((inv) => {
        if (cancelled) return;
        setInvite({
          orgName: inv.orgName,
          role: inv.role,
          email: inv.email,
          expiresAt: inv.expiresAt,
        });
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Invite not found');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isInvalid = Boolean(error) || (!loading && !invite);

  return (
    <AuthLayout>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <CardTitle className="text-center text-2xl">
            {isInvalid ? 'Invite not found' : "You're invited"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-600 text-center">Loading invite…</p>
          ) : isInvalid ? (
            <div className="space-y-4">
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-4">
                {error || 'This invite link is invalid or has expired. Ask your administrator for a new invite.'}
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Sign in instead</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 text-center">
                You&apos;ve been invited to join Builder Diddies as <strong>{invite!.email}</strong>.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {invite!.orgName}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 capitalize">
                    Role: {invite!.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Expires {new Date(invite!.expiresAt).toLocaleString()}
                </p>
              </div>
              <Button asChild className="w-full py-6 text-lg">
                <Link to={`/signup?invite=${encodeURIComponent(token)}`}>Accept invite</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Sign in instead</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
