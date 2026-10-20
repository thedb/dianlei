/**
 * Player bullet entity for object pooling
 */

import type { Poolable } from '@/engine/pool';
import { PLAYER_BULLET_SPEED } from '@/game/config';

export interface Bullet extends Poolable {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  width: number;
  height: number;
  speed: number;
  vx?: number;
  vy?: number;
}

export function createBullet(): Bullet {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    width: 4,
    height: 12,
    speed: PLAYER_BULLET_SPEED,

    reset(): void {
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      delete this.vx;
      delete this.vy;
    },
  };
}

export function updateBullet(bullet: Bullet, dt: number): boolean {
  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;

  // Move upward
  bullet.y -= bullet.speed * dt;

  // Return true if bullet should be culled (off-screen)
  return bullet.y < -bullet.height;
}

export function spawnBullet(bullet: Bullet, x: number, y: number): void {
  bullet.x = x;
  bullet.y = y;
  bullet.prevX = x;
  bullet.prevY = y;
}

/**
 * Calculate expected bullets fired in a given duration at a rate
 * Used for testing fire rate timing
 */
export function expectedBulletCount(durationSeconds: number, fireRate: number): number {
  return Math.floor(durationSeconds * fireRate);
}

/**
 * Calculate time between shots
 */
export function shotInterval(fireRate: number): number {
  return 1 / fireRate;
}
