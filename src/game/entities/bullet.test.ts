import { describe, it, expect } from 'vitest';
import { ObjectPool } from '@/engine/pool';
import {
  createBullet,
  updateBullet,
  spawnBullet,
  expectedBulletCount,
  shotInterval,
} from './bullet';
import { FIRE_RATE, PLAYER_BULLET_SPEED, FIXED_DT } from '@/game/config';

describe('Bullet', () => {
  it('should create a bullet with correct initial state', () => {
    const bullet = createBullet();
    expect(bullet.active).toBe(false);
    expect(bullet.width).toBe(4);
    expect(bullet.height).toBe(12);
    expect(bullet.speed).toBe(PLAYER_BULLET_SPEED);
  });

  it('should reset bullet position on reset()', () => {
    const bullet = createBullet();
    bullet.x = 100;
    bullet.y = 200;
    bullet.reset();
    expect(bullet.x).toBe(0);
    expect(bullet.y).toBe(0);
  });

  it('should move upward on update', () => {
    const bullet = createBullet();
    spawnBullet(bullet, 180, 500);
    bullet.active = true;

    const initialY = bullet.y;
    updateBullet(bullet, FIXED_DT);

    expect(bullet.y).toBeLessThan(initialY);
    expect(bullet.y).toBeCloseTo(initialY - PLAYER_BULLET_SPEED * FIXED_DT);
  });

  it('should return true when off-screen', () => {
    const bullet = createBullet();
    spawnBullet(bullet, 180, 5);
    bullet.active = true;

    // Move until off-screen
    let shouldCull = false;
    for (let i = 0; i < 100 && !shouldCull; i++) {
      shouldCull = updateBullet(bullet, FIXED_DT);
    }

    expect(shouldCull).toBe(true);
  });

  it('should work with object pool', () => {
    const pool = new ObjectPool(createBullet, 10);

    const bullet = pool.acquire();
    spawnBullet(bullet, 100, 400);

    expect(bullet.active).toBe(true);
    expect(bullet.x).toBe(100);
    expect(bullet.y).toBe(400);

    pool.release(bullet);
    expect(bullet.active).toBe(false);
  });
});

describe('Fire Rate Timing', () => {
  it('should have correct shot interval', () => {
    const interval = shotInterval(FIRE_RATE);
    // FIRE_RATE = 5, so the interval is 0.2 seconds
    expect(FIRE_RATE).toBe(5);
    expect(interval).toBeCloseTo(0.2);
  });

  it('should calculate expected bullet count correctly', () => {
    // At 5 shots/second, 1 second = 5 bullets
    expect(expectedBulletCount(1, FIRE_RATE)).toBe(5);

    // 0.5 seconds floors to 2 bullets
    expect(expectedBulletCount(0.5, FIRE_RATE)).toBe(2);

    // 2 seconds = 10 bullets
    expect(expectedBulletCount(2, FIRE_RATE)).toBe(10);
  });

  it('should fire at correct rate over multiple frames', () => {
    const shotIntervalSec = shotInterval(FIRE_RATE);
    let timeSinceLastShot = shotIntervalSec; // Start ready to fire
    let bulletsFired = 0;
    const testDuration = 1.0; // 1 second
    let elapsed = 0;

    while (elapsed < testDuration) {
      timeSinceLastShot += FIXED_DT;

      // Simulate fire logic
      while (timeSinceLastShot >= shotIntervalSec) {
        bulletsFired++;
        timeSinceLastShot -= shotIntervalSec;
      }

      elapsed += FIXED_DT;
    }

    // Should fire approximately FIRE_RATE bullets per second
    // Allow small variance due to frame timing
    expect(bulletsFired).toBeGreaterThanOrEqual(FIRE_RATE - 1);
    expect(bulletsFired).toBeLessThanOrEqual(FIRE_RATE + 1);
  });
});
