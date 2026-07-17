import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  DEFAULT_ALERT_SETTINGS,
  loadAlertSettings,
  requestBrowserNotificationPermission,
  saveAlertSettings,
  type AlertSettings,
} from '../../engine/restaurant/alertSettings';

/** Staff-only board alert preferences — no customer SMS/WhatsApp/email. */
export default function AlertSettingsPanel() {
  const [settings, setSettings] = useState<AlertSettings>(() => loadAlertSettings());

  useEffect(() => {
    setSettings(loadAlertSettings());
  }, []);

  function update(patch: Partial<AlertSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAlertSettings(next);
  }

  async function enableBrowserNotifications() {
    const perm = await requestBrowserNotificationPermission();
    if (perm === 'granted') {
      update({ browserNotifications: true });
      toast.success('Browser notifications on');
    } else if (perm === 'unsupported') {
      toast.error('Notifications not supported in this browser');
    } else {
      update({ browserNotifications: false });
      toast.error('Notification permission denied');
    }
  }

  return (
    <div className="space-y-4" data-testid="alert-settings-panel">
      <div className="flex items-start gap-3">
        <Bell className="mt-1 h-6 w-6 text-s2d-teal" />
        <div>
          <h2 className="text-xl font-bold text-s2d-teal-deep">Kitchen alerts</h2>
          <p className="text-sm text-slate-600">
            Staff board only — sound, flash, and optional browser notifications. No customer WhatsApp, SMS, or email alerts.
          </p>
        </div>
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-s2d-teal/15 px-3">
        <span className="font-medium">Sound on new orders</span>
        <Switch checked={settings.soundEnabled} onCheckedChange={(c) => update({ soundEnabled: c })} />
      </label>

      <div>
        <Label htmlFor="alert-volume">Volume ({Math.round(settings.soundVolume * 100)}%)</Label>
        <Input
          id="alert-volume"
          type="range"
          min={1}
          max={25}
          value={Math.round(settings.soundVolume * 100)}
          onChange={(e) => update({ soundVolume: Number(e.target.value) / 100 })}
          className="mt-1 min-h-12"
        />
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-s2d-teal/15 px-3">
        <span className="font-medium">Repeat beep until acknowledged</span>
        <Switch checked={settings.repeatUntilAck} onCheckedChange={(c) => update({ repeatUntilAck: c })} />
      </label>

      <div>
        <Label htmlFor="alert-repeat">Repeat interval (seconds)</Label>
        <Input
          id="alert-repeat"
          type="number"
          min={5}
          max={120}
          className="mt-1 min-h-12"
          value={settings.repeatIntervalSec}
          onChange={(e) => update({ repeatIntervalSec: Math.max(5, Number(e.target.value) || 24) })}
        />
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-s2d-teal/15 px-3">
        <span className="font-medium">Flash new order cards</span>
        <Switch checked={settings.flashEnabled} onCheckedChange={(c) => update({ flashEnabled: c })} />
      </label>

      <div>
        <Label htmlFor="alert-flash">Flash duration (seconds)</Label>
        <Input
          id="alert-flash"
          type="number"
          min={5}
          max={180}
          className="mt-1 min-h-12"
          value={settings.flashDurationSec}
          onChange={(e) => update({ flashDurationSec: Math.max(5, Number(e.target.value) || 45) })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-s2d-teal/15 px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Browser notifications</p>
          <p className="text-xs text-slate-500">Optional desktop/tablet popups for new/late orders</p>
        </div>
        <Switch
          checked={settings.browserNotifications}
          onCheckedChange={(c) => {
            if (c) void enableBrowserNotifications();
            else update({ browserNotifications: false });
          }}
        />
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-s2d-teal/15 px-3">
        <span className="font-medium">Quiet hours</span>
        <Switch checked={settings.quietHoursEnabled} onCheckedChange={(c) => update({ quietHoursEnabled: c })} />
      </label>

      {settings.quietHoursEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="quiet-start">Start</Label>
            <Input
              id="quiet-start"
              type="time"
              className="mt-1 min-h-12"
              value={settings.quietHoursStart}
              onChange={(e) => update({ quietHoursStart: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quiet-end">End</Label>
            <Input
              id="quiet-end"
              type="time"
              className="mt-1 min-h-12"
              value={settings.quietHoursEnd}
              onChange={(e) => update({ quietHoursEnd: e.target.value })}
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="auto-hide">Auto-hide completed after (minutes)</Label>
        <Input
          id="auto-hide"
          type="number"
          min={1}
          max={240}
          className="mt-1 min-h-12"
          value={settings.autoHideCompletedMin}
          onChange={(e) => update({ autoHideCompletedMin: Math.max(1, Number(e.target.value) || 15) })}
        />
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-s2d-teal/15 px-3">
        <span className="font-medium">Show completed history on board</span>
        <Switch checked={settings.showHistory} onCheckedChange={(c) => update({ showHistory: c })} />
      </label>

      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        onClick={() => {
          setSettings(DEFAULT_ALERT_SETTINGS);
          saveAlertSettings(DEFAULT_ALERT_SETTINGS);
          toast.success('Alert settings reset');
        }}
      >
        Reset to defaults
      </Button>
    </div>
  );
}
