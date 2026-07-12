import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isNativeBridgeAvailable,
  nativeTakePhoto,
  nativeStartVoice,
  nativeStopVoice,
} from '../../src/app/bridge/nativeBridge';

describe('nativeBridge', () => {
  beforeEach(() => {
    delete (window as { TradeProNative?: unknown }).TradeProNative;
  });

  it('returns false when bridge absent', () => {
    expect(isNativeBridgeAvailable()).toBe(false);
  });

  it('detects mock TradeProNative', () => {
    window.TradeProNative = {
      isAvailable: () => true,
      takePhoto: vi.fn().mockResolvedValue({ ok: true, dataUrl: 'data:image/jpeg;base64,abc' }),
      pickPhoto: vi.fn(),
      startVoiceRecording: vi.fn(),
      stopVoiceRecording: vi.fn(),
      requestNotifications: vi.fn(),
      navigate: vi.fn(),
    };
    expect(isNativeBridgeAvailable()).toBe(true);
  });

  it('nativeTakePhoto resolves from bridge', async () => {
    window.TradeProNative = {
      isAvailable: () => true,
      takePhoto: vi.fn().mockResolvedValue({ ok: true, dataUrl: 'data:image/jpeg;base64,xyz' }),
      pickPhoto: vi.fn(),
      startVoiceRecording: vi.fn(),
      stopVoiceRecording: vi.fn(),
      requestNotifications: vi.fn(),
      navigate: vi.fn(),
    };
    const result = await nativeTakePhoto(true);
    expect(result?.ok).toBe(true);
    expect(result?.dataUrl).toContain('base64');
  });

  it('nativeTakePhoto returns null without bridge', async () => {
    expect(await nativeTakePhoto(true)).toBeNull();
  });

  it('voice recording start/stop via bridge', async () => {
    window.TradeProNative = {
      isAvailable: () => true,
      takePhoto: vi.fn(),
      pickPhoto: vi.fn(),
      startVoiceRecording: vi.fn().mockResolvedValue({ ok: true, recording: true }),
      stopVoiceRecording: vi.fn().mockResolvedValue({ ok: true, dataUrl: 'data:audio/mp4;base64,abc' }),
      requestNotifications: vi.fn(),
      navigate: vi.fn(),
    };
    const start = await nativeStartVoice();
    expect(start?.recording).toBe(true);
    const stop = await nativeStopVoice();
    expect(stop?.dataUrl).toContain('audio');
  });
});
