/**
 * JS bridge between the TradePro website and the Flutter mobile shell.
 * When running in a normal browser, all methods fall back to web APIs.
 */

export interface NativePhotoResult {
  ok: boolean;
  dataUrl?: string;
  mimeType?: string;
  fileName?: string;
  error?: string;
}

export interface NativeVoiceResult {
  ok: boolean;
  dataUrl?: string;
  mimeType?: string;
  fileName?: string;
  recording?: boolean;
  error?: string;
}

export interface TradeProNativeApi {
  __ready?: boolean;
  isAvailable: () => boolean;
  takePhoto: () => Promise<NativePhotoResult>;
  pickPhoto: () => Promise<NativePhotoResult>;
  startVoiceRecording: () => Promise<NativeVoiceResult>;
  stopVoiceRecording: () => Promise<NativeVoiceResult>;
  requestNotifications: () => Promise<{ ok: boolean; error?: string; dryRun?: boolean }>;
  navigate: (route: string) => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    TradeProNative?: TradeProNativeApi;
  }
}

export function isNativeBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.TradeProNative?.isAvailable?.();
}

export async function nativeTakePhoto(useCamera = true): Promise<NativePhotoResult | null> {
  if (!isNativeBridgeAvailable()) return null;
  try {
    return useCamera
      ? await window.TradeProNative!.takePhoto()
      : await window.TradeProNative!.pickPhoto();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Native photo failed' };
  }
}

export async function nativeStartVoice(): Promise<NativeVoiceResult | null> {
  if (!isNativeBridgeAvailable()) return null;
  try {
    return await window.TradeProNative!.startVoiceRecording();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Native voice start failed' };
  }
}

export async function nativeStopVoice(): Promise<NativeVoiceResult | null> {
  if (!isNativeBridgeAvailable()) return null;
  try {
    return await window.TradeProNative!.stopVoiceRecording();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Native voice stop failed' };
  }
}

export async function requestNativeNotifications(): Promise<void> {
  if (!isNativeBridgeAvailable()) return;
  try {
    await window.TradeProNative!.requestNotifications();
  } catch {
    // Permission denied or Firebase not configured — non-fatal
  }
}

/** Register push token with backend when native shell provides one. */
export async function registerDeviceTokenIfNative(userId?: string): Promise<void> {
  if (!isNativeBridgeAvailable()) return;
  const result = await window.TradeProNative!.requestNotifications();
  if (!result.ok || result.dryRun) return;
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (!apiBase) return;
  // Token registration is handled by Flutter → API directly when push is enabled.
  void userId;
}

/** Ask Flutter shell to navigate to Soft Phone (also used for incoming-call wake). */
export async function openNativeSoftPhone(): Promise<void> {
  if (!isNativeBridgeAvailable()) {
    if (typeof window !== 'undefined') {
      window.location.href = '/calls?tab=softphone';
    }
    return;
  }
  try {
    await window.TradeProNative!.navigate('/calls?tab=softphone');
  } catch {
    window.location.href = '/calls?tab=softphone';
  }
}
