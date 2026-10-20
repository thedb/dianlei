import { describe, expect, it, vi } from 'vitest';
import {
  createSettingsStore,
  createMemoryStorage,
  sanitizeSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from './settings';
import { CONTROL_OPACITY_DEFAULT, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX } from './config';

describe('settings defaults', () => {
  it('match the design doc', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      joystickMode: 'floating',
      buttonLayout: 'aLow',
      controlOpacity: CONTROL_OPACITY_DEFAULT,
      controlScale: 1,
      muted: false,
    });
    expect(CONTROL_OPACITY_DEFAULT).toBe(0.6);
  });

  it('are used when nothing is stored', () => {
    const store = createSettingsStore(createMemoryStorage());
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('settings persistence', () => {
  it('saves on update and loads back in a new store', () => {
    const storage = createMemoryStorage();
    const a = createSettingsStore(storage);
    a.update({ joystickMode: 'fixed', buttonLayout: 'aHigh', controlOpacity: 0.8, muted: true });
    a.update({ controlScale: 1.2 });

    const b = createSettingsStore(storage);
    expect(b.get()).toEqual({
      joystickMode: 'fixed',
      buttonLayout: 'aHigh',
      controlOpacity: 0.8,
      controlScale: 1.2,
      muted: true,
    });
    expect(storage.getStorage(SETTINGS_STORAGE_KEY)).toEqual(b.get());
  });

  it('fills missing fields from defaults (older saves)', () => {
    const storage = createMemoryStorage({ [SETTINGS_STORAGE_KEY]: { muted: true } });
    expect(createSettingsStore(storage).get()).toEqual({ ...DEFAULT_SETTINGS, muted: true });
  });

  it('rejects invalid values and clamps ranges', () => {
    expect(
      sanitizeSettings({
        joystickMode: 'wobbly',
        buttonLayout: 3,
        controlOpacity: 5,
        controlScale: 0.1,
        muted: 'yes',
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      controlOpacity: 1,
      controlScale: CONTROL_SCALE_MIN,
    });
    expect(sanitizeSettings({ controlScale: 9 }).controlScale).toBe(CONTROL_SCALE_MAX);
    expect(sanitizeSettings({ controlOpacity: NaN }).controlOpacity).toBe(CONTROL_OPACITY_DEFAULT);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  });

  it('reset restores and persists defaults', () => {
    const storage = createMemoryStorage();
    const store = createSettingsStore(storage);
    store.update({ joystickMode: 'fixed', muted: true });
    store.reset();
    expect(createSettingsStore(storage).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies subscribers with the new settings', () => {
    const store = createSettingsStore(createMemoryStorage());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.update({ muted: true });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ muted: true }));
    off();
    store.update({ muted: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
