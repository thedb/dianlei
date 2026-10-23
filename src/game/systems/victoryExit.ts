/**
 * Shared stage-clear exit. Every stage and every player ship use this
 * machine: `stepBoss` calls it whenever the play mode has `victoryExit`,
 * and the exhaust boost is a 0–1 level on the exit, not a per-ship branch.
 * A later bomber or fighter draws through `drawEngineFlame` and reads the
 * same `flame` value.
 *
 * defeat (boss phase `clear`) → wait → ease back to the battle spawn →
 * swell the tail flame → accelerate off the top → victory, which is when
 * the result screen may open. The machine ignores input the whole way.
 */

import {
  VICTORY_EXIT_WAIT,
  VICTORY_FLAME_TIME,
  VICTORY_FLYOFF_ACCEL,
  VICTORY_FLYOFF_MARGIN,
  VICTORY_FLYOFF_SPEED,
  VICTORY_RETURN_TIME,
} from '@/game/config';

export type VictoryExitPhase = 'idle' | 'wait' | 'return' | 'flame' | 'flyoff' | 'done';

export type VictoryCue = 'none' | 'cinematic' | 'victory';

export interface VictoryExit {
  phase: VictoryExitPhase;
  /** Time already spent in the current phase, seconds. */
  t: number;
  x: number;
  y: number;
  /** Climb velocity. Negative y is up. */
  vy: number;
  /**
   * Tail-flame boost, 0 (cruise) to 1 (full). Stays 0 through the return,
   * eases to 1 while holding at the spawn, then stays 1 for the climb.
   * `drawEngineFlame` is the only consumer.
   */
  flame: number;
  /** Position where the return ease started. */
  fromX: number;
  fromY: number;
}

export function createVictoryExit(): VictoryExit {
  return { phase: 'idle', t: 0, x: 0, y: 0, vy: 0, flame: 0, fromX: 0, fromY: 0 };
}

export function resetVictoryExit(exit: VictoryExit): void {
  exit.phase = 'idle';
  exit.t = 0;
  exit.x = 0;
  exit.y = 0;
  exit.vy = 0;
  exit.flame = 0;
  exit.fromX = 0;
  exit.fromY = 0;
}

/** Wait, return, flame swell, and climb ignore the stick, fire, and bomb. */
export function victoryExitBlocksInput(phase: VictoryExitPhase): boolean {
  return phase === 'wait' || phase === 'return' || phase === 'flame' || phase === 'flyoff';
}

/** Zero slope at both ends. `u` is clamped to 0–1. */
export function smoothstep(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

/**
 * Advance the exit. Starts only once the boss death animation has finished
 * (`clear`). Returns `victory` on the step the ship leaves the top, then
 * `none` afterwards so the result screen opens once.
 */
export function stepVictoryExit(
  exit: VictoryExit,
  bossPhase: string,
  dt: number,
  playerX: number,
  playerY: number,
  spawnX: number,
  spawnY: number
): VictoryCue {
  if (exit.phase === 'done') return 'none';
  if (exit.phase === 'idle') {
    if (bossPhase !== 'clear') return 'none';
    exit.phase = 'wait';
    exit.t = 0;
    exit.x = playerX;
    exit.y = playerY;
    exit.vy = 0;
    exit.flame = 0;
  }
  return stepMotion(exit, dt, spawnX, spawnY) ? 'victory' : 'cinematic';
}

function beginFlame(exit: VictoryExit, spawnX: number, spawnY: number): void {
  exit.phase = 'flame';
  exit.t = 0;
  exit.x = spawnX;
  exit.y = spawnY;
  exit.vy = 0;
  exit.flame = 0;
}

function beginFlyoff(exit: VictoryExit): void {
  exit.phase = 'flyoff';
  exit.t = 0;
  exit.vy = -VICTORY_FLYOFF_SPEED;
  exit.flame = 1;
}

function placeReturn(exit: VictoryExit, spawnX: number, spawnY: number): void {
  const s = smoothstep(exit.t / VICTORY_RETURN_TIME);
  exit.x = exit.fromX + (spawnX - exit.fromX) * s;
  exit.y = exit.fromY + (spawnY - exit.fromY) * s;
  exit.vy = 0;
  exit.flame = 0;
}

/** Returns true on the step the ship leaves the top. */
function stepMotion(exit: VictoryExit, dt: number, spawnX: number, spawnY: number): boolean {
  let left = Math.max(0, dt);
  for (let guard = 0; guard < 8 && left > 1e-9; guard++) {
    if (exit.phase === 'wait') {
      const need = VICTORY_EXIT_WAIT - exit.t;
      if (left + 1e-9 < need) {
        exit.t += left;
        return false;
      }
      left -= Math.max(0, need);
      exit.t = 0;
      exit.fromX = exit.x;
      exit.fromY = exit.y;
      exit.vy = 0;
      exit.flame = 0;
      if (Math.hypot(spawnX - exit.x, spawnY - exit.y) <= 1) {
        beginFlame(exit, spawnX, spawnY);
      } else {
        exit.phase = 'return';
      }
      continue;
    }

    if (exit.phase === 'return') {
      const need = VICTORY_RETURN_TIME - exit.t;
      if (left + 1e-9 < need) {
        exit.t += left;
        placeReturn(exit, spawnX, spawnY);
        return false;
      }
      left -= Math.max(0, need);
      beginFlame(exit, spawnX, spawnY);
      continue;
    }

    if (exit.phase === 'flame') {
      const need = VICTORY_FLAME_TIME - exit.t;
      if (left + 1e-9 < need) {
        exit.t += left;
        exit.x = spawnX;
        exit.y = spawnY;
        exit.vy = 0;
        exit.flame = smoothstep(exit.t / VICTORY_FLAME_TIME);
        return false;
      }
      left -= Math.max(0, need);
      exit.x = spawnX;
      exit.y = spawnY;
      beginFlyoff(exit);
      continue;
    }

    if (exit.phase === 'flyoff') {
      const vy0 = exit.vy;
      exit.vy = vy0 - VICTORY_FLYOFF_ACCEL * left;
      exit.y += ((vy0 + exit.vy) / 2) * left;
      exit.flame = 1;
      exit.t += left;
      left = 0;
      if (exit.y < -VICTORY_FLYOFF_MARGIN) {
        exit.phase = 'done';
        return true;
      }
      return false;
    }
    return false;
  }
  return false;
}
