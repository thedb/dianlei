import { describe, expect, it } from 'vitest';
import { ObjectPool } from '@/engine/pool';
import { HOMING_LIFETIME, HOMING_SPEED, HOMING_TURN_RATE } from '@/game/config';
import {
  createHomingMissile,
  pickHomingTarget,
  spawnHomingMissile,
  updateHomingMissile,
} from './homingMissile';

const DT = 1 / 60;
const UP = -Math.PI / 2;

describe('homing missile', () => {
  it('flies straight up with no target', () => {
    const m = createHomingMissile();
    spawnHomingMissile(m, 180, 500, UP, 0.5);
    updateHomingMissile(m, DT, null);
    expect(m.x).toBeCloseTo(180);
    expect(m.y).toBeCloseTo(500 - HOMING_SPEED * DT);
  });

  it('turns back toward straight up once its target is gone', () => {
    const m = createHomingMissile();
    spawnHomingMissile(m, 180, 500, 0, 0.5);
    for (let i = 0; i < 60; i++) updateHomingMissile(m, DT, null);
    expect(m.angle).toBeCloseTo(UP);
  });

  it('turns toward the target no faster than HOMING_TURN_RATE', () => {
    const m = createHomingMissile();
    spawnHomingMissile(m, 180, 500, UP, 0.5);
    updateHomingMissile(m, DT, { x: 400, y: 500 });
    const step = (HOMING_TURN_RATE * Math.PI) / 180 / 60;
    expect(m.angle - UP).toBeCloseTo(step);
  });

  it('closes on a target to the side', () => {
    const m = createHomingMissile();
    spawnHomingMissile(m, 180, 560, UP, 0.5);
    const target = { x: 60, y: 300 };
    let best = Infinity;
    for (let i = 0; i < 90; i++) {
      updateHomingMissile(m, DT, target);
      best = Math.min(best, Math.hypot(m.x - target.x, m.y - target.y));
    }
    expect(best).toBeLessThan(8);
  });

  it('chases the nearest candidate', () => {
    const a = { x: 100, y: 100 };
    const b = { x: 200, y: 400 };
    expect(pickHomingTarget(180, 500, [a, b])).toBe(b);
    expect(pickHomingTarget(120, 120, [a, b])).toBe(a);
    expect(pickHomingTarget(0, 0, [])).toBeNull();
  });

  it('expires after its lifetime or once off screen', () => {
    const m = createHomingMissile();
    spawnHomingMissile(m, 180, 600, UP, 0.5);
    let culled = false;
    let t = 0;
    while (!culled && t < 5) {
      culled = updateHomingMissile(m, DT, null);
      t += DT;
    }
    expect(culled).toBe(true);
    expect(m.y).toBeLessThan(0);

    const circling = createHomingMissile();
    spawnHomingMissile(circling, 180, 320, UP, 0.5);
    let age = 0;
    let gone = false;
    while (!gone && age < 10) {
      gone = updateHomingMissile(circling, DT, { x: 180, y: 320 });
      age += DT;
    }
    expect(gone).toBe(true);
    expect(age).toBeLessThanOrEqual(HOMING_LIFETIME + DT * 2);
  });

  it('keeps a short trail and pools cleanly', () => {
    const pool = new ObjectPool(createHomingMissile, 2);
    const m = pool.acquire();
    spawnHomingMissile(m, 180, 500, UP, 0.5);
    for (let i = 0; i < 10; i++) updateHomingMissile(m, DT, null);
    expect(m.trailCount).toBe(m.trailX.length);
    pool.release(m);
    const again = pool.acquire();
    expect(again).toBe(m);
    expect(again.trailCount).toBe(0);
    expect(again.age).toBe(0);
  });
});
