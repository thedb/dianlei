/**
 * Stage-end scoring (design §5.9) and the opening cards (design §6).
 */

import {
  BONUS_KILL_RATE_PER_PCT,
  BONUS_KILL_RATE_PERFECT,
  BONUS_NO_DEATH,
  INTRO_GO_UNTIL,
  INTRO_READY_UNTIL,
  INTRO_STAGE_UNTIL,
} from '@/game/config';

export interface RunReport {
  outcome: 'clear' | 'gameover';
  /** Score earned in the stage, before clear bonuses. */
  baseScore: number;
  kills: number;
  spawned: number;
  deaths: number;
  /** Seconds of gameplay. Clear time stops when STAGE CLEAR begins. */
  time: number;
}

export interface ClearBonus {
  /** Exact kill rate, 0–100. */
  killRate: number;
  /** Floored percentage used for the bonus. */
  killRatePct: number;
  killBonus: number;
  noDeath: boolean;
  noDeathBonus: number;
  total: number;
}

/** Kill-rate bonus is floor(rate) × 200, plus 10000 at 100% (max 30000). */
export function stageClearBonus(run: RunReport): ClearBonus {
  let killRate = 0;
  if (run.spawned > 0) {
    killRate = Math.min(100, (run.kills / run.spawned) * 100);
  }
  const killRatePct = Math.floor(killRate);
  let killBonus = killRatePct * BONUS_KILL_RATE_PER_PCT;
  if (killRatePct >= 100) killBonus += BONUS_KILL_RATE_PERFECT;

  const noDeath = run.deaths <= 0;
  const noDeathBonus = noDeath ? BONUS_NO_DEATH : 0;
  return {
    killRate,
    killRatePct,
    killBonus,
    noDeath,
    noDeathBonus,
    total: run.baseScore + killBonus + noDeathBonus,
  };
}

export function formatStageTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** STAGE 1 → READY → GO during the first five seconds. */
export function introBanner(t: number): 'STAGE 1' | 'READY' | 'GO' | null {
  if (t < INTRO_STAGE_UNTIL) return 'STAGE 1';
  if (t < INTRO_READY_UNTIL) return 'READY';
  if (t < INTRO_GO_UNTIL) return 'GO';
  return null;
}
