/**
 * Run difficulty (P10.1). Easy is the authored wave table.
 * The HP scale is one multiply, applied to enemies, buildings, and boss parts.
 * It is not rounded, so a 3 HP fighter becomes 3.45 on Medium.
 * Hard also arms the boss third phase. The choice lives on the scene context
 * for that run (retry included) and is not written to settings.
 */

import { DIFFICULTY_HP_EASY, DIFFICULTY_HP_HARD, DIFFICULTY_HP_MEDIUM } from '@/game/config';
import type { BossConfig } from '@/game/levels/types';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_HP_SCALE: Record<Difficulty, number> = {
  easy: DIFFICULTY_HP_EASY,
  medium: DIFFICULTY_HP_MEDIUM,
  hard: DIFFICULTY_HP_HARD,
};

export function difficultyHpScale(difficulty: Difficulty): number {
  return DIFFICULTY_HP_SCALE[difficulty];
}

/** `baseHp * scale`. Easy returns the authored value unchanged. */
export function scaleHp(baseHp: number, difficulty: Difficulty): number {
  return baseHp * difficultyHpScale(difficulty);
}

/** Only Hard fights the third HP segment (ring and laser after the swap). */
export function bossUsesPhase3(difficulty: Difficulty): boolean {
  return difficulty === 'hard';
}

/**
 * Copy of the stage boss with HP scaled for this run.
 * Phase-3 data stays on the copy so a hard fight can arm it; Easy and Medium
 * still pass `phase3: false` into `createBoss`.
 */
export function prepareBossConfig(config: BossConfig, difficulty: Difficulty): BossConfig {
  const next: BossConfig = {
    ...config,
    parts: config.parts.map((part) => ({ ...part, hp: scaleHp(part.hp, difficulty) })),
  };
  if (config.phase3) {
    next.phase3 = {
      ...config.phase3,
      hp: scaleHp(config.phase3.hp, difficulty),
      spiral: { ...config.phase3.spiral },
      aimed: { ...config.phase3.aimed },
    };
  }
  return next;
}
