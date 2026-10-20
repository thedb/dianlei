/**
 * Local high score. Stored beside settings, through the platform storage hook.
 */

import type { SettingsStorage } from '@/game/settings';

export const HIGH_SCORE_KEY = 'dianlei.highscore.v1';

export function readHighScore(storage: SettingsStorage): number {
  const value = storage.getStorage<unknown>(HIGH_SCORE_KEY);
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Keep the best score. `isNew` is true only when this score beats the old one. */
export function commitHighScore(
  storage: SettingsStorage,
  score: number
): { best: number; isNew: boolean } {
  const prev = readHighScore(storage);
  const next = Math.max(0, Math.floor(score));
  if (next > prev) {
    storage.setStorage(HIGH_SCORE_KEY, next);
    return { best: next, isNew: true };
  }
  return { best: prev, isNew: false };
}
