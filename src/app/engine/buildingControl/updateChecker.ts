import { BUILDING_CONTROL_REGISTRY } from '../../config/buildingControl/registry';
import { addNotification } from '../notifications/notificationStore';

export interface DocUpdateResult {
  docId: string;
  title: string;
  sourceUrl: string;
  currentVersionDate: string;
  detectedChange: boolean;
  lastModified?: string;
  checkedAt: string;
  message: string;
}

const PENDING_KEY = 'tradepro_bc_pending_updates';

export interface PendingBCUpdate {
  docId: string;
  title: string;
  detectedAt: string;
  message: string;
}

export function loadPendingUpdates(): PendingBCUpdate[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingUpdates(updates: PendingBCUpdate[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(updates));
}

export async function checkForRegulationUpdates(): Promise<{
  results: DocUpdateResult[];
  pendingCount: number;
}> {
  try {
    const res = await fetch('/api/building-control/check-updates', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { results: DocUpdateResult[]; pendingCount: number };

    const changed = data.results.filter((r) => r.detectedChange);
    if (changed.length > 0) {
      const existing = loadPendingUpdates();
      const merged = [...existing];
      for (const item of changed) {
        if (!merged.some((p) => p.docId === item.docId)) {
          merged.push({
            docId: item.docId,
            title: item.title,
            detectedAt: item.checkedAt,
            message: item.message,
          });
          addNotification({
            type: 'bc_update_detected',
            title: `Building regs update: ${item.title}`,
            message: item.message,
            data: { docId: item.docId },
          });
        }
      }
      savePendingUpdates(merged);
    }

    return data;
  } catch {
    return mockLocalCheck();
  }
}

function mockLocalCheck(): { results: DocUpdateResult[]; pendingCount: number } {
  const checkedAt = new Date().toISOString();
  const results: DocUpdateResult[] = BUILDING_CONTROL_REGISTRY.map((doc) => ({
    docId: doc.id,
    title: doc.title,
    sourceUrl: doc.sourceUrl,
    currentVersionDate: doc.versionDate,
    detectedChange: false,
    checkedAt,
    message: 'Local check — server unavailable',
  }));
  return { results, pendingCount: 0 };
}

export function approvePendingUpdate(docId: string): void {
  const remaining = loadPendingUpdates().filter((p) => p.docId !== docId);
  savePendingUpdates(remaining);
}

export function dismissPendingUpdate(docId: string): void {
  approvePendingUpdate(docId);
}
