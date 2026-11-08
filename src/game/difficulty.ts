/**
 * Run difficulty (P10.1). Easy is the authored wave table.
 *
 * 菜鸟 (rookie) is a fourth run id with Easy's combat knobs and its own life
 * stock. It is not a fourth wave table: `table` points it at Easy, so ship
 * counts, fire overrides, buildings, and risk crates stay on the Easy rows.
 *
 * Each difficulty is a profile with several knobs. `hpScale`, `bossGates`,
 * `lives`, and `livesMax` differ. Bullet speed, fire rate, and drop rules are
 * wired slots that every profile leaves at the authored values. Stage 2's
 * extra ships and hotter patterns live on the wave table (`countByDifficulty`,
 * `fireByDifficulty`), not on `fireRateScale` or `bulletSpeedScale`.
 *
 * The HP scale is one multiply, applied to enemies, buildings, and boss parts.
 * It is not rounded, so a 3 HP fighter becomes 3.45 on Medium.
 * Hard also opens the boss's `hard` gate (third phase). The choice lives on the
 * scene context for that run (retry included) and is not written to settings.
 */

import {
  DIFFICULTY_HP_EASY,
  DIFFICULTY_HP_HARD,
  DIFFICULTY_HP_MEDIUM,
  LIVES_EASY,
  LIVES_MAX,
  LIVES_ROOKIE,
  LIVES_ROOKIE_MAX,
  LIVES_START,
} from '@/game/config';
import type { BossDef, WaveDifficulty } from '@/game/levels/types';
import type { DropRule } from '@/game/systems/dropRules';

export type Difficulty = 'rookie' | 'easy' | 'medium' | 'hard';

/** Boss phases gated on this run only on Hard (stage 1 phase 3). */
export const HARD_PHASE_GATE = 'hard';

export interface DifficultyProfile {
  /** Multiplier on every enemy, building, and boss part HP. */
  hpScale: number;
  /** Multiplier on enemy bullet flight speed. */
  bulletSpeedScale: number;
  /**
   * Multiplier on the enemy weapon clock (aircraft and ground units run their
   * gun timers this much faster). Buildings and the boss keep authored timing.
   */
  fireRateScale: number;
  /** Boss phases with these gates run (`BossPhaseDef.gate`). */
  bossGates: readonly string[];
  /** Replaces the stage's building drop rules when set. */
  buildingDrops?: readonly DropRule[];
  /** Lives on a fresh start. A carried handoff overwrites this. */
  lives: number;
  /** Extend stops here. 菜鸟 is not clamped to the Easy / Medium / Hard cap. */
  livesMax: number;
  /**
   * Wave, building, and risk-crate table. 菜鸟 reuses Easy's authored rows.
   * Hard does not inherit a medium override; that rule stays in `wavePlan`.
   */
  table: WaveDifficulty;
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = {
  rookie: {
    hpScale: DIFFICULTY_HP_EASY,
    bulletSpeedScale: 1,
    fireRateScale: 1,
    bossGates: [],
    lives: LIVES_ROOKIE,
    livesMax: LIVES_ROOKIE_MAX,
    table: 'easy',
  },
  easy: {
    hpScale: DIFFICULTY_HP_EASY,
    bulletSpeedScale: 1,
    fireRateScale: 1,
    bossGates: [],
    lives: LIVES_EASY,
    livesMax: LIVES_MAX,
    table: 'easy',
  },
  medium: {
    hpScale: DIFFICULTY_HP_MEDIUM,
    bulletSpeedScale: 1,
    fireRateScale: 1,
    bossGates: [],
    lives: LIVES_START,
    livesMax: LIVES_MAX,
    table: 'medium',
  },
  hard: {
    hpScale: DIFFICULTY_HP_HARD,
    bulletSpeedScale: 1,
    fireRateScale: 1,
    bossGates: [HARD_PHASE_GATE],
    lives: LIVES_START,
    livesMax: LIVES_MAX,
    table: 'hard',
  },
};

export function difficultyProfile(difficulty: Difficulty): DifficultyProfile {
  return DIFFICULTY_PROFILES[difficulty];
}

export const DIFFICULTY_HP_SCALE: Record<Difficulty, number> = {
  rookie: DIFFICULTY_PROFILES.rookie.hpScale,
  easy: DIFFICULTY_PROFILES.easy.hpScale,
  medium: DIFFICULTY_PROFILES.medium.hpScale,
  hard: DIFFICULTY_PROFILES.hard.hpScale,
};

export function difficultyHpScale(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].hpScale;
}

/** Lives for a fresh start of this difficulty. Carried runs do not use it. */
export function startingLives(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].lives;
}

/** Extend cap for this difficulty. 菜鸟 is not the Easy cap of `LIVES_MAX`. */
export function livesMax(difficulty: Difficulty): number {
  return DIFFICULTY_PROFILES[difficulty].livesMax;
}

/**
 * Wave-table id for this run. 菜鸟 reads Easy's rows; it is not listed on
 * `Wave.difficulties` or the per-difficulty overrides.
 */
export function waveTableOf(difficulty: Difficulty): WaveDifficulty {
  return DIFFICULTY_PROFILES[difficulty].table;
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
