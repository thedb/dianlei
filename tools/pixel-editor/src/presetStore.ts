import {
  parseUserPresets,
  serializeUserPresets,
  type PixelizePreset,
} from '@/game/art/pixelizePreset';

const STORAGE_KEY = 'dianlei.pixel-editor.presets.v1';

let users: PixelizePreset[] = [];

export function userPresets(): readonly PixelizePreset[] {
  return users;
}

export function loadUserPresets(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    users = raw ? parseUserPresets(raw).presets : [];
  } catch {
    users = [];
  }
}

export function saveUserPresets(next: readonly PixelizePreset[]): void {
  users = next.filter((item) => !item.builtin);
  localStorage.setItem(STORAGE_KEY, serializeUserPresets(users));
}
