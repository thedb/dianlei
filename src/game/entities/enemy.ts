/**
 * Enemy entity system
 * Design doc §6.1: Small fighter (24x24, 3HP), Medium fighter (36x36, 24HP)
 */

import type { Poolable } from '@/engine/pool';
import type { EnemyType, Move, Fire } from '@/game/levels/types';
import {
  LOGICAL_W,
  LOGICAL_H,
  SCORE_SMALL_FIGHTER,
  SCORE_MEDIUM_FIGHTER,
  HIT_FLASH_TIME,
} from '@/game/config';

/** Enemy stats by type */
export const ENEMY_STATS: Record<
  EnemyType,
  { hp: number; score: number; width: number; height: number; hitRadius: number }
> = {
  small: { hp: 3, score: SCORE_SMALL_FIGHTER, width: 24, height: 24, hitRadius: 10 },
  medium: { hp: 24, score: SCORE_MEDIUM_FIGHTER, width: 36, height: 36, hitRadius: 15 },
  interceptor: { hp: 6, score: 200, width: 28, height: 28, hitRadius: 12 },
  bomber: { hp: 60, score: 2000, width: 56, height: 48, hitRadius: 24 },
  drone: { hp: 4, score: 300, width: 20, height: 20, hitRadius: 8 },
  tank: { hp: 8, score: 200, width: 24, height: 24, hitRadius: 10 },
  turret2: { hp: 30, score: 1000, width: 32, height: 32, hitRadius: 14 },
  missile_car: { hp: 12, score: 300, width: 24, height: 32, hitRadius: 12 },
};

export interface Enemy extends Poolable {
  type: EnemyType;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hp: number;
  maxHp: number;
  score: number;
  width: number;
  height: number;
  hitRadius: number;

  // Movement state
  move: Move;
  moveTimer: number;
  startX: number;
  startY: number;
  phase: 'enter' | 'hold' | 'exit';

  // Fire state
  fire: Fire;
  fireTimer: number;
  shotsFired: number;
  canFire: boolean;

  // Visual state
  hitFlashTimer: number;

  // Drop info
  drop: 'P' | 'B' | null;
}

/** Create enemy factory for pool */
export function createEnemy(): Enemy {
  return {
    active: false,
    type: 'small',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    hp: 3,
    maxHp: 3,
    score: 100,
    width: 24,
    height: 24,
    hitRadius: 10,
    move: { kind: 'straight', speed: 150 },
    moveTimer: 0,
    startX: 0,
    startY: 0,
    phase: 'enter',
    fire: { kind: 'none' },
    fireTimer: 0,
    shotsFired: 0,
    canFire: true,
    hitFlashTimer: 0,
    drop: null,

    reset() {
      this.type = 'small';
      this.x = 0;
      this.y = -30;
      this.prevX = 0;
      this.prevY = -30;
      this.hp = 3;
      this.maxHp = 3;
      this.score = 100;
      this.width = 24;
      this.height = 24;
      this.hitRadius = 10;
      this.move = { kind: 'straight', speed: 150 };
      this.moveTimer = 0;
      this.startX = 0;
      this.startY = -30;
      this.phase = 'enter';
      this.fire = { kind: 'none' };
      this.fireTimer = 0;
      this.shotsFired = 0;
      this.canFire = true;
      this.hitFlashTimer = 0;
      this.drop = null;
    },
  };
}

/** Spawn enemy with configuration */
export function spawnEnemy(
  enemy: Enemy,
  type: EnemyType,
  x: number,
  y: number,
  move: Move,
  fire: Fire,
  drop: 'P' | 'B' | null = null,
  hpOverride?: number,
  scoreOverride?: number
): void {
  const stats = ENEMY_STATS[type];

  enemy.type = type;
  enemy.x = x;
  enemy.y = y;
  enemy.prevX = x;
  enemy.prevY = y;
  enemy.hp = hpOverride ?? stats.hp;
  enemy.maxHp = enemy.hp;
  enemy.score = scoreOverride ?? stats.score;
  enemy.width = stats.width;
  enemy.height = stats.height;
  enemy.hitRadius = stats.hitRadius;
  enemy.move = move;
  enemy.moveTimer = 0;
  enemy.startX = x;
  enemy.startY = y;
  enemy.phase = 'enter';
  enemy.fire = fire;
  enemy.fireTimer = 0;
  enemy.shotsFired = 0;
  enemy.canFire = true;
  enemy.hitFlashTimer = 0;
  enemy.drop = drop;
}

/** Update enemy and return true if should be culled */
export function updateEnemy(enemy: Enemy, dt: number, _playerX: number, _playerY: number): boolean {
  enemy.prevX = enemy.x;
  enemy.prevY = enemy.y;
  enemy.moveTimer += dt;

  // Update hit flash
  if (enemy.hitFlashTimer > 0) {
    enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
  }

  // Update movement based on pattern
  updateEnemyMovement(enemy, dt);

  // Check if off screen (cull)
  if (enemy.y > LOGICAL_H + 50 || enemy.y < -100 || enemy.x < -100 || enemy.x > LOGICAL_W + 100) {
    return true;
  }

  return false;
}

/** Update enemy movement based on move pattern */
function updateEnemyMovement(enemy: Enemy, dt: number): void {
  const { move } = enemy;

  switch (move.kind) {
    case 'straight': {
      const angleRad = ((move.angle ?? 0) * Math.PI) / 180;
      enemy.x += Math.sin(angleRad) * move.speed * dt;
      enemy.y += Math.cos(angleRad) * move.speed * dt;
      break;
    }

    case 'sine': {
      enemy.y += move.vy * dt;
      const t = enemy.moveTimer / move.period;
      enemy.x = enemy.startX + Math.sin(t * Math.PI * 2) * move.amp;
      break;
    }

    case 'v_dive': {
      if (enemy.phase === 'enter') {
        enemy.y += move.speed * dt;
        if (enemy.y >= move.stopY) {
          enemy.y = move.stopY;
          enemy.phase = 'exit';
        }
      } else {
        // Exit at 45 degree angle based on which side of center
        const dir = enemy.startX < LOGICAL_W / 2 ? -1 : 1;
        enemy.x += dir * move.speed * dt * 0.7;
        enemy.y += move.speed * dt * 0.7;
      }
      break;
    }

    case 'cross': {
      const dir = move.from === 'topLeft' ? 1 : -1;
      enemy.x += dir * move.speed * dt * 0.7;
      enemy.y += move.speed * dt * 0.7;
      break;
    }

    case 'hover': {
      if (enemy.phase === 'enter') {
        // Descend at 120 px/s
        enemy.y += 120 * dt;
        if (enemy.y >= move.stopY) {
          enemy.y = move.stopY;
          enemy.phase = 'hold';
          enemy.moveTimer = 0;
        }
      } else if (enemy.phase === 'hold') {
        // Drift left/right slightly
        enemy.x = enemy.startX + Math.sin(enemy.moveTimer * 2) * 12;
        if (enemy.moveTimer >= move.hold) {
          enemy.phase = 'exit';
        }
      } else {
        // Exit upward at 100 px/s
        enemy.y -= 100 * dt;
      }
      break;
    }

    case 'side_arc': {
      // Simplified arc movement
      if (enemy.phase === 'enter') {
        const progress = Math.min(1, enemy.moveTimer / 1.5);
        const arcX = move.side === 'left' ? -140 : 140;
        enemy.x = enemy.startX + arcX * (1 - Math.cos((progress * Math.PI) / 2));
        enemy.y = move.y0 + 140 * Math.sin((progress * Math.PI) / 2);
        if (progress >= 1) {
          enemy.phase = 'exit';
          enemy.startX = enemy.x;
          enemy.startY = enemy.y;
        }
      } else {
        enemy.y += move.speed * dt;
      }
      break;
    }

    case 'orbit': {
      if (enemy.phase === 'enter') {
        // Move to anchor
        const dx = move.anchor.x - enemy.x;
        const dy = move.anchor.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          enemy.x += (dx / dist) * 120 * dt;
          enemy.y += (dy / dist) * 120 * dt;
        } else {
          enemy.phase = 'hold';
          enemy.moveTimer = 0;
        }
      } else if (enemy.phase === 'hold') {
        const angle = (enemy.moveTimer / move.period) * Math.PI * 2;
        enemy.x = move.anchor.x + Math.cos(angle) * move.r;
        enemy.y = move.anchor.y + Math.sin(angle) * move.r;
        if (enemy.moveTimer >= move.hold) {
          enemy.phase = 'exit';
        }
      } else {
        enemy.y += 90 * dt;
      }
      break;
    }

    case 'slow_push': {
      if (enemy.phase === 'enter') {
        enemy.y += 30 * dt;
        if (enemy.y >= move.stopY) {
          enemy.y = move.stopY;
          enemy.phase = 'hold';
          enemy.moveTimer = 0;
        }
      } else if (enemy.phase === 'hold') {
        enemy.x = enemy.startX + Math.sin(enemy.moveTimer * 1.5) * 20;
        if (enemy.moveTimer >= move.hold) {
          enemy.phase = 'exit';
        }
      } else {
        enemy.y += 60 * dt;
      }
      break;
    }

    case 'ground': {
      // Ground enemies scroll with background - handled elsewhere
      if (move.vx) {
        enemy.x += move.vx * dt;
      }
      break;
    }
  }
}

/** Deal damage to enemy, return true if killed */
export function damageEnemy(enemy: Enemy, damage: number): boolean {
  enemy.hp -= damage;
  enemy.hitFlashTimer = HIT_FLASH_TIME;

  return enemy.hp <= 0;
}

/** Check if enemy should fire this frame */
export function shouldEnemyFire(
  enemy: Enemy,
  dt: number,
  _playerX: number,
  _playerY: number
): { shouldFire: boolean; fireData: Fire } {
  if (enemy.fire.kind === 'none') {
    return { shouldFire: false, fireData: enemy.fire };
  }

  // Only fire when on screen
  if (enemy.y < 8) {
    return { shouldFire: false, fireData: enemy.fire };
  }

  // Check max shots
  const fireConfig = enemy.fire as {
    maxShots?: number;
    interval?: number;
    firstDelay?: number;
    atY?: number;
  };

  if (fireConfig.maxShots !== undefined && enemy.shotsFired >= fireConfig.maxShots) {
    return { shouldFire: false, fireData: enemy.fire };
  }

  // Check atY trigger (fire when reaching specific Y)
  if (fireConfig.atY !== undefined) {
    if (enemy.y >= fireConfig.atY && enemy.canFire) {
      enemy.canFire = false;
      enemy.shotsFired++;
      return { shouldFire: true, fireData: enemy.fire };
    }
    return { shouldFire: false, fireData: enemy.fire };
  }

  // Check fire interval
  const interval = fireConfig.interval ?? 2;
  const firstDelay = fireConfig.firstDelay ?? interval;

  enemy.fireTimer += dt;

  const nextFireTime = enemy.shotsFired === 0 ? firstDelay : interval;
  if (enemy.fireTimer >= nextFireTime) {
    enemy.fireTimer -= interval;
    enemy.shotsFired++;
    return { shouldFire: true, fireData: enemy.fire };
  }

  return { shouldFire: false, fireData: enemy.fire };
}
