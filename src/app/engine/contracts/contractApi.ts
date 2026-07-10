import type { Contract, ContractPublicView } from './types';

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.APP_BASE_URL ?? 'http://localhost:5173';
}

export function buildContractSignUrl(signToken: string): string {
  return `${getAppBaseUrl()}/contract/${signToken}`;
}

export async function syncContractToServer(contract: Contract): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/contracts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error ?? 'Sync failed' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Sync failed' };
  }
}

export async function fetchContractsFromServer(): Promise<Contract[]> {
  try {
    const res = await fetch('/api/contracts');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.contracts) ? (data.contracts as Contract[]) : [];
  } catch {
    return [];
  }
}

export async function fetchContractPublicView(token: string): Promise<ContractPublicView | null> {
  try {
    const res = await fetch(`/api/contract/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    return (await res.json()) as ContractPublicView;
  } catch {
    return null;
  }
}

export async function signContractOnServer(
  token: string,
  payload: { signedByName: string; signatureDataUrl: string; agreed: boolean }
): Promise<{ success: boolean; error?: string; depositAmount?: number }> {
  try {
    const res = await fetch(`/api/contract/${encodeURIComponent(token)}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error ?? 'Signing failed' };
    return { success: true, depositAmount: data.depositAmount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Signing failed' };
  }
}
