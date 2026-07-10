import type { Contract, ContractStatus } from './types';

const STORAGE_KEY = 'contracts';

const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['sent'],
  sent: ['signed'],
  signed: [],
};

export function canTransitionContractStatus(from: ContractStatus, to: ContractStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function generateSignToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `ct_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `ct_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function signTokenExpiry(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function loadContracts(): Contract[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Contract[]) : [];
  } catch {
    return [];
  }
}

function saveAll(contracts: Contract[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts.slice(0, 500)));
}

export function saveContract(contract: Omit<Contract, 'id' | 'createdAt'> & { id?: string }): Contract {
  const contracts = loadContracts();
  if (contract.id) {
    const existing = contracts.find((c) => c.id === contract.id);
    if (existing?.status === 'signed') {
      throw new Error('Signed contracts cannot be edited.');
    }
    if (contract.status && existing && !canTransitionContractStatus(existing.status, contract.status)) {
      throw new Error(`Cannot change contract status from ${existing.status} to ${contract.status}.`);
    }
    const updated: Contract = {
      ...(existing as Contract),
      ...contract,
      id: contract.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    } as Contract;
    saveAll(contracts.map((c) => (c.id === contract.id ? updated : c)));
    return updated;
  }
  const created: Contract = {
    ...contract,
    id: `con-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  saveAll([created, ...contracts]);
  return created;
}

export function updateContract(id: string, patch: Partial<Contract>): Contract | undefined {
  const contracts = loadContracts();
  const existing = contracts.find((c) => c.id === id);
  if (!existing) return undefined;
  if (existing.status === 'signed' && patch.status !== 'signed') {
    return undefined;
  }
  if (patch.status && !canTransitionContractStatus(existing.status, patch.status)) {
    return undefined;
  }
  const updated = { ...existing, ...patch };
  saveAll(contracts.map((c) => (c.id === id ? updated : c)));
  return updated;
}

export function upsertContractFromServer(remote: Contract): Contract {
  const contracts = loadContracts();
  const idx = contracts.findIndex((c) => c.id === remote.id);
  if (idx >= 0) {
    const local = contracts[idx];
    const merged: Contract = {
      ...local,
      ...remote,
      // Prefer server signed state when newer
      status: remote.signedAt && (!local.signedAt || remote.signedAt > local.signedAt) ? remote.status : local.status,
      signedAt: remote.signedAt ?? local.signedAt,
      signedByName: remote.signedByName ?? local.signedByName,
      signatureDataUrl: remote.signatureDataUrl ?? local.signatureDataUrl,
      depositDue: remote.depositDue ?? local.depositDue,
      events: remote.events ?? local.events,
    };
    if (remote.signedAt) {
      merged.status = 'signed';
      merged.signedAt = remote.signedAt;
      merged.signedByName = remote.signedByName;
      merged.signatureDataUrl = remote.signatureDataUrl;
    }
    contracts[idx] = merged;
    saveAll(contracts);
    return merged;
  }
  saveAll([remote, ...contracts]);
  return remote;
}

export function mergeContractsFromServer(remotes: Contract[]): void {
  for (const r of remotes) upsertContractFromServer(r);
}

export function deleteContract(id: string): void {
  saveAll(loadContracts().filter((c) => c.id !== id));
}

export function getContract(id: string): Contract | undefined {
  return loadContracts().find((c) => c.id === id);
}

export function getContractBySignToken(token: string): Contract | undefined {
  return loadContracts().find((c) => c.signToken === token);
}
