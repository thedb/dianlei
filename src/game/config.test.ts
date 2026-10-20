import { describe, it, expect } from 'vitest';
import {
  LOGICAL_W,
  LOGICAL_H,
  FIXED_DT,
  PLAYER_SPEED,
  LIVES_START,
  LIVES_MAX,
  BOMBS_START,
  BOMBS_MAX,
  POWER_MAX,
  ENEMY_BULLET_CAP,
} from './config';

describe('Game Config', () => {
  it('should have correct logical resolution', () => {
    expect(LOGICAL_W).toBe(360);
    expect(LOGICAL_H).toBe(640);
  });

  it('should have 60Hz fixed timestep', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 60);
  });

  it('should have sensible player speed', () => {
    // Should be able to cross screen in ~1.2 seconds
    const crossTime = LOGICAL_W / PLAYER_SPEED;
    expect(crossTime).toBeGreaterThan(1);
    expect(crossTime).toBeLessThan(1.5);
  });

  it('should have valid lives configuration', () => {
    expect(LIVES_START).toBeGreaterThan(0);
    expect(LIVES_MAX).toBeGreaterThanOrEqual(LIVES_START);
  });

  it('should have valid bombs configuration', () => {
    expect(BOMBS_START).toBeGreaterThan(0);
    expect(BOMBS_MAX).toBeGreaterThanOrEqual(BOMBS_START);
  });

  it('should have 3 power levels', () => {
    expect(POWER_MAX).toBe(3);
  });

  it('should have enemy bullet cap at 150', () => {
    expect(ENEMY_BULLET_CAP).toBe(150);
  });
});
