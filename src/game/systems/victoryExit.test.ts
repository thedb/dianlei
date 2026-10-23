import { describe, expect, it } from 'vitest';
import {
  LOGICAL_W,
  PLAYER_SPAWN_Y,
  VICTORY_EXIT_WAIT,
  VICTORY_FLAME_TIME,
  VICTORY_FLYOFF_ACCEL,
  VICTORY_FLYOFF_MARGIN,
  VICTORY_FLYOFF_SPEED,
  VICTORY_RETURN_TIME,
} from '@/game/config';
import {
  createVictoryExit,
  smoothstep,
  stepVictoryExit,
  victoryExitBlocksInput,
  type VictoryExit,
} from './victoryExit';

const SPAWN_X = LOGICAL_W / 2;
const SPAWN_Y = PLAYER_SPAWN_Y;

function run(exit: VictoryExit, bossPhase: 'death' | 'clear', dt: number, x: number, y: number) {
  return stepVictoryExit(exit, bossPhase, dt, x, y, SPAWN_X, SPAWN_Y);
}

describe('victory exit', () => {
  it('freezes input through the flame swell', () => {
    expect(victoryExitBlocksInput('idle')).toBe(false);
    expect(victoryExitBlocksInput('wait')).toBe(true);
    expect(victoryExitBlocksInput('return')).toBe(true);
    expect(victoryExitBlocksInput('flame')).toBe(true);
    expect(victoryExitBlocksInput('flyoff')).toBe(true);
    expect(victoryExitBlocksInput('done')).toBe(false);
  });

  it('eases to the spawn, swells the flame, then climbs', () => {
    const exit = createVictoryExit();
    const start = { x: 40, y: 400 };

    expect(run(exit, 'death', 3, start.x, start.y)).toBe('none');
    expect(exit.phase).toBe('idle');

    expect(run(exit, 'clear', 0, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('wait');
    expect(exit.x).toBe(start.x);
    expect(exit.y).toBe(start.y);
    expect(exit.flame).toBe(0);

    expect(run(exit, 'clear', VICTORY_EXIT_WAIT - 0.05, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('wait');
    expect(exit.x).toBe(start.x);

    expect(run(exit, 'clear', 0.05, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('return');
    expect(exit.flame).toBe(0);
    expect(exit.x).toBeCloseTo(start.x);
    expect(exit.y).toBeCloseTo(start.y);

    const dist = Math.hypot(SPAWN_X - start.x, SPAWN_Y - start.y);
    expect(run(exit, 'clear', 1 / 60, start.x, start.y)).toBe('cinematic');
    const first = Math.hypot(exit.x - start.x, exit.y - start.y);
    const linear = dist * (1 / 60 / VICTORY_RETURN_TIME);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(linear * 0.5);

    expect(run(exit, 'clear', VICTORY_RETURN_TIME / 2 - 1 / 60 - 1e-6, start.x, start.y)).toBe(
      'cinematic'
    );
    expect(exit.phase).toBe('return');
    const mid = smoothstep(exit.t / VICTORY_RETURN_TIME);
    expect(exit.x).toBeCloseTo(start.x + (SPAWN_X - start.x) * mid);
    expect(exit.y).toBeCloseTo(start.y + (SPAWN_Y - start.y) * mid);
    expect(exit.flame).toBe(0);

    let guard = 0;
    while (exit.phase === 'return' && guard < 300) {
      expect(run(exit, 'clear', 1 / 60, start.x, start.y)).toBe('cinematic');
      guard++;
    }
    expect(exit.phase).toBe('flame');
    expect(exit.x).toBeCloseTo(SPAWN_X);
    expect(exit.y).toBeCloseTo(SPAWN_Y);
    expect(exit.vy).toBe(0);
    expect(exit.flame).toBeLessThan(0.05);

    const flameBefore = exit.flame;
    expect(run(exit, 'clear', VICTORY_FLAME_TIME / 2, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('flame');
    expect(exit.y).toBeCloseTo(SPAWN_Y);
    expect(exit.flame).toBeCloseTo(smoothstep(exit.t / VICTORY_FLAME_TIME));
    expect(exit.flame).toBeGreaterThan(flameBefore + 0.3);
    expect(exit.flame).toBeLessThan(1);
    expect(exit.vy).toBe(0);

    guard = 0;
    while (exit.phase === 'flame' && guard < 120) {
      expect(run(exit, 'clear', 1 / 60, start.x, start.y)).toBe('cinematic');
      guard++;
    }
    expect(exit.phase).toBe('flyoff');
    expect(exit.flame).toBe(1);
    expect(exit.x).toBeCloseTo(SPAWN_X);
    expect(exit.y).toBeLessThanOrEqual(SPAWN_Y + 0.01);
    expect(exit.y).toBeGreaterThan(SPAWN_Y - 4);
    expect(exit.vy).toBeLessThanOrEqual(-VICTORY_FLYOFF_SPEED + 0.01);

    const yAtClimb = exit.y;
    const vyAtClimb = exit.vy;
    expect(run(exit, 'clear', 1 / 60, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('flyoff');
    expect(exit.flame).toBe(1);
    expect(exit.y).toBeLessThan(yAtClimb);
    expect(exit.y).toBeGreaterThan(SPAWN_Y - 8);
    expect(exit.vy).toBeCloseTo(vyAtClimb - VICTORY_FLYOFF_ACCEL / 60);

    expect(run(exit, 'clear', 0.2, start.x, start.y)).toBe('cinematic');
    expect(exit.vy).toBeLessThan(vyAtClimb);

    let cue = 'cinematic' as ReturnType<typeof run>;
    guard = 0;
    while (cue !== 'victory' && guard < 400) {
      cue = run(exit, 'clear', 1 / 60, start.x, start.y);
      guard++;
    }
    expect(cue).toBe('victory');
    expect(exit.phase).toBe('done');
    expect(exit.y).toBeLessThan(-VICTORY_FLYOFF_MARGIN);
    expect(run(exit, 'clear', 1, start.x, start.y)).toBe('none');
  });

  it('swells the flame in place when the ship is already on the spawn point', () => {
    const exit = createVictoryExit();
    run(exit, 'clear', VICTORY_EXIT_WAIT, SPAWN_X, SPAWN_Y);
    expect(exit.phase).toBe('flame');
    expect(exit.x).toBe(SPAWN_X);
    expect(exit.y).toBe(SPAWN_Y);
    expect(exit.flame).toBe(0);
    expect(run(exit, 'clear', 1 / 60, SPAWN_X, SPAWN_Y)).toBe('cinematic');
    expect(exit.phase).toBe('flame');
    expect(exit.y).toBe(SPAWN_Y);
    expect(exit.flame).toBeGreaterThan(0);
    expect(exit.flame).toBeLessThan(1);
  });
});
