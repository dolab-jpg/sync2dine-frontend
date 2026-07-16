const apiBase = () =>
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data;
}

export async function resolveUsername(username: string): Promise<string> {
  const res = await fetch(`${apiBase()}/api/auth/resolve-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Could not resolve username (${res.status})`);
  }
  const data = (await res.json()) as { email: string };
  return data.email;
}

export async function registerOrg(input: {
  companyName: string;
  name: string;
  username: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${apiBase()}/api/auth/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<{
    organization: { id: string; name: string };
    user: { id: string; email: string; name: string; username: string; role: string; org_id: string };
  }>(res);
}

export async function fetchInvite(token: string) {
  const res = await fetch(`${apiBase()}/api/auth/invites/${encodeURIComponent(token)}`);
  return parseJson<{
    token: string;
    email: string;
    role: string;
    orgId: string;
    orgName: string;
    expiresAt: string;
  }>(res);
}

export async function acceptInvite(input: {
  token: string;
  name: string;
  username: string;
  password: string;
}) {
  const res = await fetch(`${apiBase()}/api/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<{
    user: { id: string; email: string; name: string; username: string; role: string; org_id: string };
  }>(res);
}

export async function createInvite(
  input: { email: string; role: string; orgId?: string },
  accessToken: string,
) {
  const res = await fetch(`${apiBase()}/api/auth/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  return parseJson<{
    invite: { id: string; token: string; email: string; role: string; expiresAt: string; acceptUrl: string };
  }>(res);
}

export async function createCustomerLogin(
  input: { name: string; email: string; password: string; username?: string; orgId?: string },
  accessToken: string,
) {
  const res = await fetch(`${apiBase()}/api/auth/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  return parseJson<{
    user: { id: string; email: string; name: string; username: string; role: string; org_id: string };
  }>(res);
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  preferred_language?: string | null;
  created_at: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptUrl: string;
}

export async function fetchMembers(accessToken: string, orgId?: string): Promise<OrgMember[]> {
  const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
  const res = await fetch(`${apiBase()}/api/auth/members${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseJson<{ members: OrgMember[] }>(res);
  return data.members;
}

export async function removeMember(memberId: string, accessToken: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/auth/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await parseJson<{ removed: boolean }>(res);
}

export async function updateMember(
  memberId: string,
  input: { preferredLanguage?: string; preferred_language?: string; name?: string },
  accessToken: string,
): Promise<OrgMember> {
  const res = await fetch(`${apiBase()}/api/auth/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ member: OrgMember }>(res);
  return data.member;
}

export async function fetchPendingInvites(accessToken: string, orgId?: string): Promise<PendingInvite[]> {
  const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
  const res = await fetch(`${apiBase()}/api/auth/invites${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await parseJson<{ invites: PendingInvite[] }>(res);
  return data.invites;
}

export function homePathForRole(role: string): string {
  switch (role) {
    case 'kiosk':
      return '/front';
    case 'recruitment':
      return '/recruitment';
    case 'platform_owner':
      return '/platform/clients';
    default:
      // Restaurant staff land on the Live board, sales staff on the dashboard —
      // both are '/' and the experience gate picks the right shell.
      return '/';
  }
}
