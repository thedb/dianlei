/**
 * Enemy bullet system
 * Design doc §5.8: 20% slower than arcade, cap at 150
 */

import type { Poolable } from '@/engine/pool';
import type { Fire } from '@/game/levels/types';
import {
  LOGICAL_H,
  LOGICAL_W,
  ENEMY_BULLET_SPEED_SCALE,
  ENEMY_BULLET_CAP,
  EB_SPEED_SMALL,
  EB_SPEED_BIG,
  EB_SPEED_FAST,
  EB_SPEED_MISSILE,
  AIMED_MIN_DIST,
  EB_HIT_RADIUS_SMALL,
  EB_HIT_RADIUS_LARGE,
  FIXED2_SEPARATION,
  MISSILE_HOMING_TIME,
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
  homing = 0
): void {
  bullet.x = x;
  bullet.y = y;
  bullet.prevX = x;
  bullet.prevY = y;
  bullet.vx = vx;
  bullet.vy = vy;
  bullet.type = type;
  bullet.hitRadius = type === 'large' ? EB_HIT_RADIUS_LARGE : EB_HIT_RADIUS_SMALL;
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

/** Get base speed for bullet type (already scaled) */
function getScaledSpeed(type: EnemyBulletType): number {
  const baseSpeed =
    type === 'large' ? EB_SPEED_BIG : type === 'fast' ? EB_SPEED_FAST : EB_SPEED_SMALL;
  return baseSpeed * ENEMY_BULLET_SPEED_SCALE;
}

/** Calculate aimed shot velocity toward player */
export function getAimedVelocity(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number
): { vx: number; vy: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    return { vx: 0, vy: speed };
  }

  return {
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
  };
}

/** Interface for bullet spawning callback */
export interface BulletSpawner {
  spawnBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    type: EnemyBulletType,
    homing?: number
  ): void;
  getBulletCount(): number;
}

export interface FirePatternOptions {
  /** Ring rotation offset in degrees. */
  rotation?: number;
  /** Barrel angle in radians for fixed2. Omit to aim straight at the player. */
  aimAngle?: number;
}

/**
 * Fire pattern based on Fire config
 * Returns array of bullets to spawn
 */
export function executeFirePattern(
  fire: Fire,
  enemyX: number,
  enemyY: number,
  playerX: number,
  playerY: number,
  spawner: BulletSpawner,
  rotationOffset: number | FirePatternOptions = 0
): void {
  const options: FirePatternOptions =
    typeof rotationOffset === 'number' ? { rotation: rotationOffset } : rotationOffset;
  const rotation = options.rotation ?? 0;
  if (fire.kind === 'none') return;

  // Check bullet cap
  if (spawner.getBulletCount() >= ENEMY_BULLET_CAP) {
    return;
  }

  // Check minimum distance for aimed shots
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy);
  const isAimed =
    fire.kind === 'aimed1' ||
    fire.kind === 'aimed3burst' ||
    fire.kind === 'aimed_fast3' ||
    fire.kind === 'fan3' ||
    fire.kind === 'fan5';

  if (isAimed && distToPlayer < AIMED_MIN_DIST) {
    return;
  }

  switch (fire.kind) {
    case 'aimed1': {
      const speed = getScaledSpeed('small');
      const { vx, vy } = getAimedVelocity(enemyX, enemyY, playerX, playerY, speed);
      spawner.spawnBullet(enemyX, enemyY, vx, vy, 'small');
      break;
    }

    case 'aimed3burst': {
      // 3 shots in quick succession - handled by caller with timing
      const speed = getScaledSpeed('small');
      const { vx, vy } = getAimedVelocity(enemyX, enemyY, playerX, playerY, speed);
      spawner.spawnBullet(enemyX, enemyY, vx, vy, 'small');
      break;
    }

    case 'aimed_fast3': {
      // 3-way fast spread aimed at player. Boss phase 2 passes its own speed.
      const speed = fire.speed ?? getScaledSpeed('fast');
      const baseAngle = Math.atan2(playerY - enemyY, playerX - enemyX);
      const spreadRad = (15 * Math.PI) / 180;

      for (let i = -1; i <= 1; i++) {
        const angle = baseAngle + i * spreadRad;
        spawner.spawnBullet(
          enemyX,
          enemyY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'small'
        );
      }
      break;
    }

    case 'fan3':
    case 'fan5': {
      const count = fire.kind === 'fan3' ? 3 : 5;
      const spreadRad = (fire.spread * Math.PI) / 180;
      const speed = getScaledSpeed('small');
      const baseAngle = Math.atan2(playerY - enemyY, playerX - enemyX);

      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * (spreadRad / (count - 1));
        const angle = baseAngle + offset;
        spawner.spawnBullet(
          enemyX,
          enemyY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'small'
        );
      }
      break;
    }

    case 'fan7wide': {
      // 7-way wide spread, aimed downward
      const spreadRad = (fire.spread * Math.PI) / 180;
      const speed = getScaledSpeed('large');
      const baseAngle = Math.PI / 2; // Downward

      for (let i = 0; i < 7; i++) {
        const offset = (i - 3) * (spreadRad / 6);
        const angle = baseAngle + offset;
        spawner.spawnBullet(
          enemyX,
          enemyY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'large'
        );
      }
      break;
    }

    case 'spiral': {
      const arms = Math.max(1, fire.arms);
      const speed = fire.speed ?? getScaledSpeed('small');
      const rotRad = (rotation * Math.PI) / 180;
      for (let i = 0; i < arms; i++) {
        const angle = rotRad + (i * Math.PI * 2) / arms;
        spawner.spawnBullet(
          enemyX,
          enemyY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'small'
        );
      }
      break;
    }

    case 'ring8':
    case 'ring16': {
      const count = fire.kind === 'ring8' ? 8 : 16;
      const speed = getScaledSpeed('large');
      const rotRad = (rotation * Math.PI) / 180;

      for (let i = 0; i < count; i++) {
        const angle = rotRad + (i * Math.PI * 2) / count;
        spawner.spawnBullet(
          enemyX,
          enemyY,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          'large'
        );
      }
      break;
    }

    case 'fixed2': {
      const speed = getScaledSpeed('small');
      const angle = options.aimAngle ?? Math.atan2(playerY - enemyY, playerX - enemyX);
      const gap = FIXED2_SEPARATION / 2;
      const perpX = Math.cos(angle + Math.PI / 2) * gap;
      const perpY = Math.sin(angle + Math.PI / 2) * gap;

      spawner.spawnBullet(
        enemyX + perpX,
        enemyY + perpY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        'small'
      );
      spawner.spawnBullet(
        enemyX - perpX,
        enemyY - perpY,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        'small'
      );
      break;
    }

    case 'missile': {
      const speed = EB_SPEED_MISSILE * ENEMY_BULLET_SPEED_SCALE;
      const { vx, vy } = getAimedVelocity(enemyX, enemyY, playerX, playerY, speed);
      spawner.spawnBullet(enemyX, enemyY, vx, vy, 'missile', MISSILE_HOMING_TIME);
      break;
    }
  }
}
