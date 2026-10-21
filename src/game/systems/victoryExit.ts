/**
 * Scripted fly-off after the boss death animation.
 * defeat (boss phase `clear`) → wait → return to the battle spawn → fly off
 * the top → victory, which is when the result screen may open.
 * The machine ignores input. The battle scene freezes the ship while it runs.
 */

import {
  VICTORY_EXIT_WAIT,
  VICTORY_FLYOFF_ACCEL,
  VICTORY_FLYOFF_MARGIN,
  VICTORY_FLYOFF_SPEED,
  VICTORY_RETURN_ARRIVE,
  VICTORY_RETURN_SPEED,
} from '@/game/config';
import type { BossPhase } from '@/game/systems/boss';

export type VictoryExitPhase = 'idle' | 'wait' | 'return' | 'flyoff' | 'done';

export type VictoryCue = 'none' | 'cinematic' | 'victory';

export interface VictoryExit {
  phase: VictoryExitPhase;
  /** Time already spent in the current phase, seconds. */
  t: number;
  x: number;
  y: number;
  /** Climb velocity. Negative y is up. */
  vy: number;
}

export function createVictoryExit(): VictoryExit {
  return { phase: 'idle', t: 0, x: 0, y: 0, vy: 0 };
}

export function resetVictoryExit(exit: VictoryExit): void {
  exit.phase = 'idle';
  exit.t = 0;
  exit.x = 0;
  exit.y = 0;
  exit.vy = 0;
}

/** Wait, return, and climb ignore the stick, fire, and bomb. */
export function victoryExitBlocksInput(phase: VictoryExitPhase): boolean {
  return phase === 'wait' || phase === 'return' || phase === 'flyoff';
}

/**
 * Advance the exit. Starts only once the boss death animation has finished
 * (`clear`). Returns `victory` on the step the ship leaves the top, then
 * `none` afterwards so the result screen opens once.
 */
export function stepVictoryExit(
  exit: VictoryExit,
  bossPhase: BossPhase,
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
  }
  return stepMotion(exit, dt, spawnX, spawnY) ? 'victory' : 'cinematic';
}

/** Returns true on the step the ship leaves the top. */
function stepMotion(exit: VictoryExit, dt: number, spawnX: number, spawnY: number): boolean {
  let left = Math.max(0, dt);
  for (let guard = 0; guard < 4 && left > 1e-9; guard++) {
    if (exit.phase === 'wait') {
      const need = VICTORY_EXIT_WAIT - exit.t;
      if (left + 1e-9 < need) {
        exit.t += left;
        return false;
      }
      left -= Math.max(0, need);
      exit.t = 0;
      exit.phase = 'return';
      exit.vy = 0;
      continue;
    }

    if (exit.phase === 'return') {
      const dx = spawnX - exit.x;
      const dy = spawnY - exit.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= VICTORY_RETURN_ARRIVE) {
        exit.x = spawnX;
        exit.y = spawnY;
        exit.t = 0;
        exit.phase = 'flyoff';
        exit.vy = -VICTORY_FLYOFF_SPEED;
        continue;
      }
      const step = VICTORY_RETURN_SPEED * left;
      const arrive = dist - VICTORY_RETURN_ARRIVE;
      if (step >= arrive) {
        const used = arrive / VICTORY_RETURN_SPEED;
        exit.x = spawnX;
        exit.y = spawnY;
        left -= Math.max(0, used);
        exit.t = 0;
        exit.phase = 'flyoff';
        exit.vy = -VICTORY_FLYOFF_SPEED;
        continue;
      }
      exit.x += (dx / dist) * step;
      exit.y += (dy / dist) * step;
      exit.t += left;
      return false;
    }

    if (exit.phase === 'flyoff') {
      const vy0 = exit.vy;
      exit.vy = vy0 - VICTORY_FLYOFF_ACCEL * left;
      exit.y += ((vy0 + exit.vy) / 2) * left;
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
