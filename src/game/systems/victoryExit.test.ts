import { describe, expect, it } from 'vitest';
import {
  LOGICAL_W,
  PLAYER_SPAWN_Y,
  VICTORY_EXIT_WAIT,
  VICTORY_FLYOFF_ACCEL,
  VICTORY_FLYOFF_MARGIN,
  VICTORY_FLYOFF_SPEED,
} from '@/game/config';
import {
  createVictoryExit,
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
  it('freezes input only during the cinematic', () => {
    expect(victoryExitBlocksInput('idle')).toBe(false);
    expect(victoryExitBlocksInput('wait')).toBe(true);
    expect(victoryExitBlocksInput('return')).toBe(true);
    expect(victoryExitBlocksInput('flyoff')).toBe(true);
    expect(victoryExitBlocksInput('done')).toBe(false);
  });

  it('goes defeat → wait 2s → spawn → fly off → victory, and only then', () => {
    const exit = createVictoryExit();
    const start = { x: 40, y: 400 };

    expect(run(exit, 'death', 3, start.x, start.y)).toBe('none');
    expect(exit.phase).toBe('idle');

    expect(run(exit, 'clear', 0, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('wait');
    expect(exit.x).toBe(start.x);
    expect(exit.y).toBe(start.y);

    expect(run(exit, 'clear', VICTORY_EXIT_WAIT - 0.05, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('wait');
    expect(exit.x).toBe(start.x);
    expect(exit.y).toBe(start.y);

    expect(run(exit, 'clear', 0.05, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('return');

    let guard = 0;
    while (exit.phase === 'return' && guard < 300) {
      expect(run(exit, 'clear', 1 / 60, start.x, start.y)).toBe('cinematic');
      guard++;
    }
    expect(exit.phase).toBe('flyoff');
    expect(exit.x).toBeCloseTo(SPAWN_X);
    expect(exit.y).toBeLessThanOrEqual(SPAWN_Y + 0.01);
    expect(exit.vy).toBeLessThanOrEqual(-VICTORY_FLYOFF_SPEED + 0.01);

    const yAtClimb = exit.y;
    const vyAtClimb = exit.vy;
    expect(run(exit, 'clear', 0.2, start.x, start.y)).toBe('cinematic');
    expect(exit.phase).toBe('flyoff');
    expect(exit.y).toBeLessThan(yAtClimb);
    expect(exit.vy).toBeLessThan(vyAtClimb);
    expect(exit.vy).toBeCloseTo(vyAtClimb - VICTORY_FLYOFF_ACCEL * 0.2);

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

  it('climbs immediately when the ship is already on the spawn point', () => {
    const exit = createVictoryExit();
    run(exit, 'clear', VICTORY_EXIT_WAIT, SPAWN_X, SPAWN_Y);
    expect(exit.phase).toBe('return');
    expect(run(exit, 'clear', 1 / 60, SPAWN_X, SPAWN_Y)).toBe('cinematic');
    expect(exit.phase).toBe('flyoff');
    expect(exit.x).toBe(SPAWN_X);
    expect(exit.y).toBeLessThanOrEqual(SPAWN_Y);
  });
});
