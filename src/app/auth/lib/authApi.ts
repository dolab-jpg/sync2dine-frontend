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

export function homePathForRole(role: string): string {
  switch (role) {
    case 'builder':
      return '/builder';
    case 'recruitment':
      return '/recruitment';
    case 'customer':
      return '/projects';
    case 'platform_owner':
      return '/platform/clients';
    default:
      return '/';
  }
}
