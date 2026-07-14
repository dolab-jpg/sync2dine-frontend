import { Link, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { AuthLayout } from '../AuthLayout';

const MOCK_INVITE = {
  orgName: 'Acme Bathrooms',
  role: 'staff',
  inviter: 'Jane Smith',
  expiresLabel: 'in 7 days',
};

export default function InviteAcceptPage() {
  const { token = '' } = useParams<{ token: string }>();
  const isInvalid = !token || token === 'invalid';

  return (
    <AuthLayout>
      <Card className="shadow-2xl rounded-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <CardTitle className="text-center text-2xl">
            {isInvalid ? 'Invite not found' : "You're invited"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {isInvalid ? (
            <div className="space-y-4">
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-4">
                This invite link is invalid or has expired. Ask your administrator for a new invite.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Sign in instead</Link>
              </Button>
              <p className="text-xs text-center text-slate-400">
                UI preview: try <Link to="/invite/demo" className="underline">/invite/demo</Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 text-center">
                <strong>{MOCK_INVITE.inviter}</strong> invited you to join TradePro.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    {MOCK_INVITE.orgName}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 capitalize">
                    Role: {MOCK_INVITE.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Expires {MOCK_INVITE.expiresLabel} (mock UI data)</p>
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
