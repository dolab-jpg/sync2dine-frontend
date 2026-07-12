import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Banner shown when the device is offline or API calls fail.
 * Required for the Flutter WebView online-only model.
 */
export function OnlineStatusBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] flex items-center gap-2 bg-red-700 text-white px-4 py-2 text-sm safe-area-top"
      data-testid="online-status-banner"
    >
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
      <span>This app needs internet. Connect to Wi‑Fi or mobile data.</span>
    </div>
  );
}
