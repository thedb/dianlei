/**
 * Player settings (design doc §8) persisted through the platform storage hook
 * (localStorage on H5, wx storage on WeChat).
 */

import {
  BGM_VOLUME_DEFAULT,
  CONTROL_OPACITY_DEFAULT,
  CONTROL_SCALE_MIN,
  CONTROL_SCALE_MAX,
} from '@/game/config';

export type JoystickMode = 'fixed' | 'floating';

/** `aLow` = A low / B high (design default), `aHigh` = A high / B low */
export type ButtonLayout = 'aLow' | 'aHigh';

export interface Settings {
  joystickMode: JoystickMode;
  buttonLayout: ButtonLayout;
  /** Control overlay opacity, 0.2–1 */
  controlOpacity: number;
  /** Control size scale, CONTROL_SCALE_MIN–CONTROL_SCALE_MAX */
  controlScale: number;
  muted: boolean;
  /** Looping chiptune. Default off; mute still silences it when this is on. */
  bgmEnabled: boolean;
  /** 0–1 music bus. Ignored while BGM is off or the master mute is on. */
  bgmVolume: number;
}

export const CONTROL_OPACITY_MIN = 0.2;
export const CONTROL_OPACITY_MAX = 1;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  joystickMode: 'floating',
  buttonLayout: 'aLow',
  controlOpacity: CONTROL_OPACITY_DEFAULT,
  controlScale: 1,
  muted: false,
  bgmEnabled: false,
  bgmVolume: BGM_VOLUME_DEFAULT,
};

export const SETTINGS_STORAGE_KEY = 'dianlei.settings.v1';

/** Minimal storage surface; PlatformAdapter satisfies it */
export interface SettingsStorage {
  getStorage<T>(key: string): T | null;
  setStorage<T>(key: string, value: T): void;
}

export interface SettingsStore {
  get(): Readonly<Settings>;
  update(patch: Partial<Settings>): Readonly<Settings>;
  reset(): Readonly<Settings>;
  subscribe(listener: (settings: Readonly<Settings>) => void): () => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Coerce arbitrary stored data into valid settings, falling back per field */
export function sanitizeSettings(raw: unknown): Settings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback;

  return {
    joystickMode:
      src['joystickMode'] === 'fixed' || src['joystickMode'] === 'floating'
        ? src['joystickMode']
        : DEFAULT_SETTINGS.joystickMode,
    buttonLayout:
      src['buttonLayout'] === 'aLow' || src['buttonLayout'] === 'aHigh'
        ? src['buttonLayout']
        : DEFAULT_SETTINGS.buttonLayout,
    controlOpacity: num(
      src['controlOpacity'],
      DEFAULT_SETTINGS.controlOpacity,
      CONTROL_OPACITY_MIN,
      CONTROL_OPACITY_MAX
    ),
    controlScale: num(
      src['controlScale'],
      DEFAULT_SETTINGS.controlScale,
      CONTROL_SCALE_MIN,
      CONTROL_SCALE_MAX
    ),
    muted: typeof src['muted'] === 'boolean' ? src['muted'] : DEFAULT_SETTINGS.muted,
    bgmEnabled:
      typeof src['bgmEnabled'] === 'boolean' ? src['bgmEnabled'] : DEFAULT_SETTINGS.bgmEnabled,
    bgmVolume: num(src['bgmVolume'], DEFAULT_SETTINGS.bgmVolume, 0, 1),
  };
}

export function createSettingsStore(storage: SettingsStorage): SettingsStore {
  let current: Settings = sanitizeSettings(storage.getStorage<unknown>(SETTINGS_STORAGE_KEY));
  const listeners = new Set<(s: Readonly<Settings>) => void>();

  function commit(next: Settings): Readonly<Settings> {
    current = next;
    storage.setStorage(SETTINGS_STORAGE_KEY, current);
    for (const l of listeners) l(current);
    return current;
  }

  return {
    get: () => current,
    update: (patch) => commit(sanitizeSettings({ ...current, ...patch })),
    reset: () => commit({ ...DEFAULT_SETTINGS }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** In-memory storage for tests and environments without persistence */
export function createMemoryStorage(initial: Record<string, unknown> = {}): SettingsStorage {
  const data = new Map<string, string>(
    Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)])
  );
  return {
    getStorage<T>(key: string): T | null {
      const v = data.get(key);
      return v === undefined ? null : (JSON.parse(v) as T);
    },
    setStorage<T>(key: string, value: T): void {
      data.set(key, JSON.stringify(value));
    },
  };
}
