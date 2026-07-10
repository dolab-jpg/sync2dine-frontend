import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CheckCircle2, AlertTriangle, Loader2, KeyRound, FolderPlus, RefreshCw } from 'lucide-react';

interface CredentialsStatus {
  ready: boolean;
  keys: string[];
  savedAt: string | null;
  localhost: boolean;
  masked: {
    supabaseAccessToken: string | null;
    supabaseProjectRef: string | null;
  };
}

interface SupabaseProject {
  id: string;
  ref: string;
  name: string;
  organizationId: string;
  region: string;
  status: string;
}

interface SupabaseOrganization {
  id: string;
  name: string;
}

export default function CursorPastePage() {
  const [accessToken, setAccessToken] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<CredentialsStatus | null>(null);
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([]);
  const [accountConnected, setAccountConnected] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('tradepro');
  const [newOrgId, setNewOrgId] = useState('');
  const [newDbPass, setNewDbPass] = useState('');

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/credentials/status');
      if (res.ok) {
        setStatus((await res.json()) as CredentialsStatus);
      }
    } catch {
      // dev server may not be running yet
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const loadAccount = async () => {
    setError('');
    if (!accessToken.trim()) {
      setError('Paste your Supabase access token first.');
      return;
    }

    setLoadingProjects(true);
    try {
      const tokenPayload = { supabaseAccessToken: accessToken.trim() };

      const [projRes, orgRes] = await Promise.all([
        fetch('/api/agent/credentials/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenPayload),
        }),
        fetch('/api/agent/credentials/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenPayload),
        }),
      ]);

      const projData = (await projRes.json()) as {
        success: boolean;
        message?: string;
        projects: SupabaseProject[];
      };
      const orgData = (await orgRes.json()) as {
        success: boolean;
        organizations: SupabaseOrganization[];
      };

      if (!projData.success) {
        setError(projData.message ?? 'Could not connect to your Supabase account');
        setAccountConnected(false);
        return;
      }

      setProjects(projData.projects);
      setOrganizations(orgData.organizations ?? []);
      setAccountConnected(true);

      if (projData.projects.length === 1) {
        setProjectRef(projData.projects[0].ref);
      }
      if (orgData.organizations?.length === 1) {
        setNewOrgId(orgData.organizations[0].id);
      }
      if (projData.projects.length === 0) {
        setShowCreate(true);
      }
    } catch {
      setError('Could not reach the local API. Is npm run dev running?');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSaved(false);

    if (!accessToken.trim()) {
      setError('Paste your Supabase access token first.');
      return;
    }

    setSaving(true);
    try {
      const payload: { supabaseAccessToken: string; supabaseProjectRef?: string } = {
        supabaseAccessToken: accessToken.trim(),
      };
      if (projectRef.trim()) {
        payload.supabaseProjectRef = projectRef.trim();
      }

      const res = await fetch('/api/agent/credentials/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        hasProjectRef?: boolean;
      };

      if (!res.ok) {
        setError(data.error ?? data.hint ?? 'Save failed');
        return;
      }

      setSaved(true);
      if (data.hasProjectRef) {
        setAccessToken('');
      }
      await loadStatus();
    } catch {
      setError('Could not reach the local API. Is npm run dev running?');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    setError('');
    if (!accessToken.trim() || !newOrgId || !newProjectName.trim() || !newDbPass.trim()) {
      setError('Fill in organization, project name, and database password.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/agent/credentials/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseAccessToken: accessToken.trim(),
          organizationId: newOrgId,
          name: newProjectName.trim(),
          region: 'eu-west-2',
          dbPass: newDbPass,
        }),
      });
      const data = (await res.json()) as {
        success: boolean;
        message?: string;
        project?: { ref: string; name: string };
      };

      if (!data.success) {
        setError(data.message ?? 'Failed to create project');
        return;
      }

      if (data.project) {
        setProjectRef(data.project.ref);
        setProjects((prev) => [
          ...prev,
          {
            id: data.project!.ref,
            ref: data.project!.ref,
            name: data.project!.name,
            organizationId: newOrgId,
            region: 'eu-west-2',
            status: 'ACTIVE_HEALTHY',
          },
        ]);
      }
      setSaved(true);
      setShowCreate(false);
      setNewDbPass('');
      await loadStatus();
    } catch {
      setError('Could not create project.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <KeyRound className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Cursor Agent Setup</CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                Paste your token — we load your Supabase projects
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLocalhost && (
            <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                Open this page on <strong>localhost:5174</strong> so credentials save to your PC for Cursor.
              </span>
            </div>
          )}

          {status?.ready && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
              Previously saved
              {status.masked.supabaseAccessToken && (
                <span className="block mt-1 font-mono text-xs text-green-300/80">
                  Token {status.masked.supabaseAccessToken}
                  {status.masked.supabaseProjectRef && ` · Ref ${status.masked.supabaseProjectRef}`}
                </span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="supabase-token" className="text-slate-300">
              Supabase Access Token
            </Label>
            <Input
              id="supabase-token"
              type="password"
              autoComplete="off"
              placeholder="sbp_..."
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setAccountConnected(false);
                setProjects([]);
              }}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              supabase.com/dashboard/account/tokens — only the token is required
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-600 text-slate-200 hover:bg-slate-800"
            onClick={() => void loadAccount()}
            disabled={loadingProjects || !accessToken.trim() || !isLocalhost}
          >
            {loadingProjects ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading your account…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Connect account &amp; load projects
              </>
            )}
          </Button>

          {accountConnected && projects.length > 0 && (
            <div className="space-y-2">
              <Label className="text-slate-300">Choose a project</Label>
              <Select value={projectRef} onValueChange={setProjectRef}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.ref} value={p.ref}>
                      {p.name} ({p.ref})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {accountConnected && projects.length === 0 && !showCreate && (
            <p className="text-sm text-slate-400">
              No projects yet on this account. Create one below.
            </p>
          )}

          {(showCreate || (accountConnected && projects.length === 0)) && (
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <FolderPlus className="w-4 h-4" />
                Create new Supabase project
              </div>
              {organizations.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Organization</Label>
                  <Select value={newOrgId} onValueChange={setNewOrgId}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Project name</Label>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="tradepro"
                  className="bg-slate-800 border-slate-600 text-white h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Database password (min 8 chars)</Label>
                <Input
                  type="password"
                  value={newDbPass}
                  onChange={(e) => setNewDbPass(e.target.value)}
                  placeholder="Choose a strong password"
                  className="bg-slate-800 border-slate-600 text-white h-9"
                />
              </div>
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                onClick={() => void handleCreateProject()}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating project…
                  </>
                ) : (
                  'Create project & save for Cursor'
                )}
              </Button>
            </div>
          )}

          {accountConnected && projects.length > 0 && (
            <button
              type="button"
              className="text-xs text-blue-400 hover:underline"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Hide create new project' : '+ Create another project instead'}
            </button>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {saved && (
            <div className="flex items-start gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Saved for Cursor</p>
                <p className="mt-1 text-green-300/90">
                  Tell Cursor: <strong>credentials saved</strong>
                </p>
              </div>
            </div>
          )}

          <Button
            className="w-full bg-blue-600 hover:bg-blue-500"
            onClick={() => void handleSave()}
            disabled={saving || !accessToken.trim() || !isLocalhost}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : projectRef ? (
              'Save token + project for Cursor'
            ) : (
              'Save token only for Cursor'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
