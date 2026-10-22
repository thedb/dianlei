/**
 * Run difficulty (P10.1). Easy is the authored wave table.
 *
 * Each difficulty is a profile with several knobs. Today only `hpScale` and
 * `bossGates` differ; bullet speed, fire rate, and drop rules are wired slots
 * that every profile leaves at the authored values.
 *
 * The HP scale is one multiply, applied to enemies, buildings, and boss parts.
 * It is not rounded, so a 3 HP fighter becomes 3.45 on Medium.
 * Hard also opens the boss's `hard` gate (third phase). The choice lives on the
 * scene context for that run (retry included) and is not written to settings.
 */

import { DIFFICULTY_HP_EASY, DIFFICULTY_HP_HARD, DIFFICULTY_HP_MEDIUM } from '@/game/config';
import type { BossDef } from '@/game/levels/types';
import type { DropRule } from '@/game/systems/dropRules';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Boss phases gated on this run only on Hard (stage 1 phase 3). */
export const HARD_PHASE_GATE = 'hard';

export interface DifficultyProfile {
  /** Multiplier on every enemy, building, and boss part HP. */
  hpScale: number;
  /** Multiplier on enemy bullet flight speed. */
  bulletSpeedScale: number;
  /** Multiplier on enemy fire rate (fire clocks run this much faster). */
  fireRateScale: number;
  /** Boss phases with these gates run (`BossPhaseDef.gate`). */
  bossGates: readonly string[];
  /** Replaces the stage's building drop rules when set. */
  buildingDrops?: readonly DropRule[];
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = {
  easy: { hpScale: DIFFICULTY_HP_EASY, bulletSpeedScale: 1, fireRateScale: 1, bossGates: [] },
  medium: { hpScale: DIFFICULTY_HP_MEDIUM, bulletSpeedScale: 1, fireRateScale: 1, bossGates: [] },
  hard: {
    hpScale: DIFFICULTY_HP_HARD,
    bulletSpeedScale: 1,
    fireRateScale: 1,
    bossGates: [HARD_PHASE_GATE],
  },
};

export function difficultyProfile(difficulty: Difficulty): DifficultyProfile {
  return DIFFICULTY_PROFILES[difficulty];
}

export const DIFFICULTY_HP_SCALE: Record<Difficulty, number> = {
  easy: DIFFICULTY_PROFILES.easy.hpScale,
  medium: DIFFICULTY_PROFILES.medium.hpScale,
  hard: DIFFICULTY_PROFILES.hard.hpScale,
};

export function difficultyHpScale(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].hpScale;
}

/** `baseHp * scale`. Easy returns the authored value unchanged. */
export function scaleHp(baseHp: number, difficulty: Difficulty): number {
  return baseHp * difficultyHpScale(difficulty);
}

/** Only Hard fights the third HP segment (ring and laser after the swap). */
export function bossUsesPhase3(difficulty: Difficulty): boolean {
  return DIFFICULTY_PROFILES[difficulty].bossGates.includes(HARD_PHASE_GATE);
}

/**
 * Copy of the stage boss with part HP and every phase segment scaled for this
 * run. Gated phases stay on the copy; `createBoss` drops the ones the run's
 * profile does not open.
 */
export function prepareBossConfig(def: BossDef, difficulty: Difficulty): BossDef {
  return {
    ...def,
    parts: def.parts.map((part) => ({ ...part, hp: scaleHp(part.hp, difficulty) })),
    phases: def.phases.map((phase) =>
      phase.segmentHp === undefined
        ? phase
        : { ...phase, segmentHp: scaleHp(phase.segmentHp, difficulty) }
    ),
  };
}
