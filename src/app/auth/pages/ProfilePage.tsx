import { FormEvent, useContext, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppContext } from '../../App';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { AuthFormError } from '../components/AuthFormError';
import { UsernameField, validateUsername, normalizeUsername } from '../components/UsernameField';
import { detectBrowserLang, LANG_OPTIONS, normalizeLang, type SupportedLang } from '../../i18n/languages';
import { applyDocumentLanguage, changeAppLanguage } from '../../i18n';

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ');
}

export default function ProfilePage() {
  const context = useContext(AppContext);
  const user = context?.user;
  const [searchParams] = useSearchParams();
  const needsComplete = searchParams.get('complete') === '1';

  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLang>(detectBrowserLang());
  const [orgName, setOrgName] = useState('your company');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    void (async () => {
      const supabase = getSupabase();
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, username, org_id, preferred_language')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        setName(profile.name || user.name);
        setUsername(profile.username || '');
        const lang = normalizeLang(profile.preferred_language ?? detectBrowserLang());
        setPreferredLanguage(lang);
        await changeAppLanguage(lang);
        applyDocumentLanguage(lang);
        if (profile.org_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', profile.org_id)
            .maybeSingle();
          if (org?.name) setOrgName(org.name);
        }
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Unable to load profile. Please sign in again.</p>
      </div>
    );
  }

  const handleSave = async (e: FormEvent) => {
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
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: normalizeUsername(username),
          preferred_language: preferredLanguage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (updateError) throw updateError;
      await changeAppLanguage(preferredLanguage);
      applyDocumentLanguage(preferredLanguage);
      try {
        localStorage.setItem('tradepro.preferredLanguage', preferredLanguage);
      } catch {
        /* ignore */
      }
      setInfo('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account</h1>
        <p className="text-sm text-slate-600 mt-1">Your personal profile for TradePro.</p>
        {needsComplete && (
          <p className="mt-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Finish signing up: choose a username so you can sign in with it next time.
          </p>
        )}
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
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
              <Label htmlFor="profile-language">App language</Label>
              <Select
                value={preferredLanguage}
                onValueChange={(v) => setPreferredLanguage(normalizeLang(v))}
              >
                <SelectTrigger id="profile-language" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANG_OPTIONS.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Translates the app and AI chat for you. Customer messages, contracts, and documents stay in English.
              </p>
            </div>
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
                Org: {orgName}
              </span>
            </div>
            <AuthFormError message={error} />
            {info && (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">{info}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save profile'}
              </Button>
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
