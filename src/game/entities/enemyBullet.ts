/**
 * Enemy bullet system
 * Design doc §5.8: 20% slower than arcade, cap at 150
 */

import type { Poolable } from '@/engine/pool';
import {
  LOGICAL_H,
  LOGICAL_W,
  EB_HIT_RADIUS_SMALL,
  EB_HIT_RADIUS_LARGE,
  MISSILE_TURN_RATE,
} from '@/game/config';

export type EnemyBulletType = 'small' | 'large' | 'fast' | 'missile';

export interface EnemyBullet extends Poolable {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  type: EnemyBulletType;
  hitRadius: number;
  /** Seconds of homing left. 0 means the shot flies straight. */
  homing: number;
}

/** Create enemy bullet factory for pool */
export function createEnemyBullet(): EnemyBullet {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    type: 'small',
    hitRadius: EB_HIT_RADIUS_SMALL,
    homing: 0,

    reset() {
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      this.vx = 0;
      this.vy = 0;
      this.type = 'small';
      this.hitRadius = EB_HIT_RADIUS_SMALL;
      this.homing = 0;
    },
  };
}

/** Spawn a single bullet with velocity */
export function spawnEnemyBullet(
  bullet: EnemyBullet,
  x: number,
  y: number,
  vx: number,
  vy: number,
  type: EnemyBulletType = 'small',
  homing = 0,
  hitRadius?: number
): void {
  bullet.x = x;
  bullet.y = y;
  bullet.prevX = x;
  bullet.prevY = y;
  bullet.vx = vx;
  bullet.vy = vy;
  bullet.type = type;
  bullet.hitRadius = hitRadius ?? (type === 'large' ? EB_HIT_RADIUS_LARGE : EB_HIT_RADIUS_SMALL);
  bullet.homing = homing;
}

function steerVelocity(
  vx: number,
  vy: number,
  desired: number,
  maxTurn: number
): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy) || 1;
  const current = Math.atan2(vy, vx);
  let diff = desired - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-maxTurn, Math.min(maxTurn, diff));
  const next = current + step;
  return { vx: Math.cos(next) * speed, vy: Math.sin(next) * speed };
}

/**
 * Update bullet and return true if it should be culled.
 * Pass the player position so missiles can steer while `homing` remains.
 */
export function updateEnemyBullet(
  bullet: EnemyBullet,
  dt: number,
  aimAt?: { x: number; y: number }
): boolean {
  if (bullet.homing > 0 && aimAt) {
    bullet.homing = Math.max(0, bullet.homing - dt);
    const desired = Math.atan2(aimAt.y - bullet.y, aimAt.x - bullet.x);
    const maxTurn = ((MISSILE_TURN_RATE * Math.PI) / 180) * dt;
    const steered = steerVelocity(bullet.vx, bullet.vy, desired, maxTurn);
    bullet.vx = steered.vx;
    bullet.vy = steered.vy;
  }

  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;

  return bullet.y > LOGICAL_H + 20 || bullet.y < -20 || bullet.x < -20 || bullet.x > LOGICAL_W + 20;
}

/** Interface for bullet spawning callback */
export interface BulletSpawner {
  spawnBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    type: EnemyBulletType,
    homing?: number,
    hitRadius?: number
  ): void;
  getBulletCount(): number;
}

export {
  executeFirePattern,
  getAimedVelocity,
  type FirePatternOptions,
} from '@/game/systems/danmaku';
