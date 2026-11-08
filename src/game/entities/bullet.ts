/**
 * Player bullet entity for object pooling.
 * Straight shots (Eagle, Mandy P1/P2, Jason P1 and the P3 axis) integrate vx/vy.
 * Jason's helix replaces x with a sine about the spawn x. Mandy P3 shells
 * travel MANDY_SPLIT_RANGE, then either pay impactMul and die on a hit or
 * burst into MANDY_SPLIT_ARMS shards.
 */

import type { Poolable } from '@/engine/pool';
import {
  MANDY_SHARD_H,
  MANDY_SHARD_W,
  MANDY_SPLIT_ARMS,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
} from '@/game/config';
import type { PlayerBulletPattern, WeaponEmitter } from '@/game/systems/playerWeapons';

export interface Bullet extends Poolable {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  width: number;
  height: number;
  speed: number;
  damage: number;
  age: number;
  traveled: number;
  pendingSplit: boolean;
  align: boolean;
  vx?: number;
  vy?: number;
  helixAmp?: number;
  helixOmega?: number;
  helixPhase?: number;
  helixOriginX?: number;
  splitRange?: number;
  /** Set on a Mandy P3 shell. A hit deals damage × this and does not split. */
  impactMul?: number;
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
    damage: PLAYER_BULLET_DAMAGE,
    age: 0,
    traveled: 0,
    pendingSplit: false,
    align: false,

    reset(): void {
      this.damage = PLAYER_BULLET_DAMAGE;
      this.width = 4;
      this.height = 12;
      this.speed = PLAYER_BULLET_SPEED;
      this.x = 0;
      this.y = 0;
      this.prevX = 0;
      this.prevY = 0;
      this.age = 0;
      this.traveled = 0;
      this.pendingSplit = false;
      this.align = false;
      delete this.vx;
      delete this.vy;
      delete this.helixAmp;
      delete this.helixOmega;
      delete this.helixPhase;
      delete this.helixOriginX;
      delete this.splitRange;
      delete this.impactMul;
    },
  };
}

/** Stamp a volley shot onto a pooled bullet. Caller has already acquired it. */
export function armPlayerBullet(
  bullet: Bullet,
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  width?: number,
  height?: number,
  pattern?: PlayerBulletPattern
): void {
  bullet.x = x;
  bullet.y = y;
  bullet.prevX = x;
  bullet.prevY = y;
  bullet.vx = vx;
  bullet.vy = vy;
  bullet.damage = damage;
  if (width !== undefined) bullet.width = width;
  if (height !== undefined) bullet.height = height;
  if (pattern?.helixAmp !== undefined) {
    bullet.helixAmp = pattern.helixAmp;
    bullet.helixOmega = pattern.helixOmega ?? 0;
    bullet.helixPhase = pattern.helixPhase ?? 0;
    bullet.helixOriginX = x;
    bullet.age = 0;
    bullet.align = true;
  }
  if (pattern?.splitRange !== undefined) {
    bullet.splitRange = pattern.splitRange;
    bullet.traveled = 0;
    bullet.pendingSplit = false;
    bullet.impactMul = MANDY_SPLIT_ARMS;
  }
  if (pattern?.align) bullet.align = true;
  if (pattern) {
    const mag = Math.hypot(vx, vy);
    if (mag > 0) bullet.speed = mag;
  }
}

/**
 * Unit axes of a pointy hexagram, index 0 straight up, then clockwise
 * on the screen (upper-right, lower-right, down, lower-left, upper-left).
 */
export function splitAxes(arms: number): ReadonlyArray<{ x: number; y: number }> {
  const axes: { x: number; y: number }[] = [];
  for (let i = 0; i < arms; i++) {
    const angle = (i * 2 * Math.PI) / arms;
    axes.push({ x: Math.sin(angle), y: -Math.cos(angle) });
  }
  return axes;
}

/** Damage this projectile deals on contact. Splitter shells pay the whole burst. */
export function playerBulletImpactDamage(shot: { damage: number; impactMul?: number }): number {
  return shot.damage * (shot.impactMul ?? 1);
}

/** Replace a due P3 shell with weaker shards. Does not release the parent. */
export function spawnSplitShards(parent: Bullet, emit: WeaponEmitter): void {
  const speed = parent.speed;
  for (const axis of splitAxes(MANDY_SPLIT_ARMS)) {
    emit.bullet(
      parent.x,
      parent.y,
      axis.x * speed,
      axis.y * speed,
      parent.damage,
      MANDY_SHARD_W,
      MANDY_SHARD_H,
      { align: true }
    );
  }
}

export function stepPlayerBullet(bullet: Bullet, dt: number): void {
  bullet.prevX = bullet.x;
  bullet.prevY = bullet.y;
  if (bullet.helixAmp !== undefined) {
    const age = bullet.age + dt;
    bullet.age = age;
    const omega = bullet.helixOmega ?? 0;
    const phase = bullet.helixPhase ?? 0;
    const amp = bullet.helixAmp;
    bullet.vx = amp * omega * Math.cos(omega * age + phase);
    bullet.x = (bullet.helixOriginX ?? bullet.x) + amp * Math.sin(omega * age + phase);
    bullet.y += (bullet.vy ?? -bullet.speed) * dt;
    return;
  }

  const vx = bullet.vx ?? 0;
  const vy = bullet.vy ?? -bullet.speed;
  if (bullet.splitRange !== undefined && !bullet.pendingSplit) {
    const speed = bullet.speed || Math.hypot(vx, vy);
    const step = speed * dt;
    if (bullet.traveled + step >= bullet.splitRange) {
      const remain = bullet.splitRange - bullet.traveled;
      const along = speed > 0 ? remain / speed : 0;
      bullet.x += vx * along;
      bullet.y += vy * along;
      bullet.traveled = bullet.splitRange;
      bullet.pendingSplit = true;
      return;
    }
    bullet.traveled += step;
  }
  bullet.x += vx * dt;
  bullet.y += vy * dt;
}

export function updateBullet(bullet: Bullet, dt: number): boolean {
  stepPlayerBullet(bullet, dt);
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
