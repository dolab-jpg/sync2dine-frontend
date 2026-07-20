import { scanAllOrgsForUsageAlerts } from './usage-alerts';

const POLL_MS = Number(process.env.USAGE_ALERTS_POLL_MS ?? 5 * 60_000);

export function startUsageAlertsWorker(): void {
  if (process.env.DISABLE_USAGE_ALERTS_WORKER === '1') return;
  // First pass after boot (don't block listen)
  setTimeout(() => {
    void scanAllOrgsForUsageAlerts().then((r) => {
      if (r.notifications > 0) {
        console.log(`[usage-alerts] boot scan: ${r.notifications} notify(s) across ${r.orgsScanned} orgs`);
      }
    });
  }, 20_000);

  setInterval(() => {
    void scanAllOrgsForUsageAlerts().catch((err) => {
      console.error('[usage-alerts] worker error:', err);
    });
  }, POLL_MS);
}
