/**
 * Enemy entity system
 * Stage-1 types. Ground units scroll with the tiles and do not body-kill.
 * A shield, when the def has one, is spent before body HP.
 */

import type { Poolable } from '@/engine/pool';
import type { EnemyType, Move, Fire } from '@/game/levels/types';
import { scaleHp, type Difficulty } from '@/game/difficulty';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { fireUsesBarrel } from '@/game/systems/danmaku';
import {
  LOGICAL_W,
  LOGICAL_H,
  HIT_FLASH_TIME,
  BG_SCROLL_SPEED,
  HOVER_ENTER_SPEED,
  HOVER_EXIT_SPEED,
  HOVER_DRIFT,
  SLOW_PUSH_ENTER_SPEED,
  SLOW_PUSH_EXIT_SPEED,
  SLOW_PUSH_DRIFT,
  ORBIT_APPROACH_SPEED,
  ORBIT_EXIT_SPEED,
  REAR_DIAG_FIRE_X_MAX,
  REAR_DIAG_FIRE_X_MIN,
  SIDE_ARC_RADIUS,
  V_DIVE_EXIT_DEG,
  TURRET_TURN_RATE,
  TANK_ENTRY_SPEED,
  TANK_DIAG_VX,
  TANK_DIAG_CLIMB,
} from '@/game/config';

/** Enemy stats by type. Sizes and HP match the wave table §2. */
export const ENEMY_STATS = ENEMY_DEFS;

/** Ground units scroll with the map and do not kill the player on contact. */
export function isGroundEnemy(type: EnemyType): boolean {
  return ENEMY_DEFS[type].category === 'ground';
}

/** Tile query used to keep tanks off river / shallow water. Off-map is not blocked. */
export interface TerrainQuery {
  blocksTank(x: number, y: number): boolean;
}

export interface Enemy extends Poolable {
  type: EnemyType;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  hp: number;
  maxHp: number;
  /** Remaining shield. Bullets and bombs spend this before `hp`. */
  shield: number;
  maxShield: number;
  score: number;
  width: number;
  height: number;
  hitRadius: number;

  move: Move;
  moveTimer: number;
  startX: number;
  startY: number;
  phase: 'enter' | 'hold' | 'exit';
  /** Orbit angle once the drone is on its circle. */
  orbitAngle: number;
  /** Turret / tank barrel angle in radians (0 = right, +y down). */
  aimAngle: number;
  /** Accumulated ring-pattern rotation in degrees. */
  patternRot: number;

  fire: Fire;
  fireTimer: number;
  shotsFired: number;
  canFire: boolean;
  /** Shots still queued inside an aimed3burst. */
  burstLeft: number;
  burstTimer: number;

  hitFlashTimer: number;
  drop: 'P' | 'B' | null;
  /** Seconds until the bomb shockwave reaches this enemy; negative when none is pending. */
  bombHitIn: number;
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
    shield: 0,
    maxShield: 0,
    score: 100,
    width: 24,
    height: 24,
    hitRadius: 10,
    move: { kind: 'straight', speed: 150 },
    moveTimer: 0,
    startX: 0,
    startY: 0,
    phase: 'enter',
    orbitAngle: -Math.PI / 2,
    aimAngle: Math.PI / 2,
    patternRot: 0,
    fire: { kind: 'none' },
    fireTimer: 0,
    shotsFired: 0,
    canFire: true,
    burstLeft: 0,
    burstTimer: 0,
    hitFlashTimer: 0,
    drop: null,
    bombHitIn: -1,

    reset() {
      this.type = 'small';
      this.x = 0;
      this.y = -30;
      this.prevX = 0;
      this.prevY = -30;
      this.hp = 3;
      this.maxHp = 3;
      this.shield = 0;
      this.maxShield = 0;
      this.score = 100;
      this.width = 24;
      this.height = 24;
      this.hitRadius = 10;
      this.move = { kind: 'straight', speed: 150 };
      this.moveTimer = 0;
      this.startX = 0;
      this.startY = -30;
      this.phase = 'enter';
      this.orbitAngle = -Math.PI / 2;
      this.aimAngle = Math.PI / 2;
      this.patternRot = 0;
      this.fire = { kind: 'none' };
      this.fireTimer = 0;
      this.shotsFired = 0;
      this.canFire = true;
      this.burstLeft = 0;
      this.burstTimer = 0;
      this.hitFlashTimer = 0;
      this.drop = null;
      this.bombHitIn = -1;
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
  scoreOverride?: number,
  shieldOverride?: number
): void {
  const stats = ENEMY_STATS[type];

  enemy.type = type;
  enemy.x = x;
  enemy.y = y;
  enemy.prevX = x;
  enemy.prevY = y;
  enemy.hp = hpOverride ?? stats.hp;
  enemy.maxHp = enemy.hp;
  enemy.shield = shieldOverride ?? stats.shield ?? 0;
  enemy.maxShield = enemy.shield;
  enemy.score = scoreOverride ?? stats.score;
  enemy.width = stats.width;
  enemy.height = stats.height;
  enemy.hitRadius = stats.hitRadius;
  enemy.move = move;
  enemy.moveTimer = 0;
  enemy.startX = x;
  enemy.startY = y;
  enemy.phase = 'enter';
  enemy.orbitAngle = -Math.PI / 2;
  enemy.aimAngle = Math.PI / 2;
  enemy.patternRot = 0;
  enemy.fire = fire;
  enemy.fireTimer = 0;
  enemy.shotsFired = 0;
  enemy.canFire = true;
  enemy.burstLeft = 0;
  enemy.burstTimer = 0;
  enemy.hitFlashTimer = 0;
  enemy.drop = drop;
  enemy.bombHitIn = -1;
}

/** `straight` heading for a rear diagonal: 0 is down, 180 is straight up. */
export function rearDiagHeading(move: Extract<Move, { kind: 'rear_diag' }>): number {
  return move.side === 'left' ? 180 - move.bearing : 180 + move.bearing;
}

/**
 * Offset from the spawn point along a staircase.
 * `steps` down/side pairs, then the leftover distance keeps going down.
 * Heading is 0 down, 90 right, 270 left — the same degrees `straight` uses.
 */
export function stepSlidePose(
  move: Extract<Move, { kind: 'step_slide' }>,
  elapsed: number
): { dx: number; dy: number; heading: number } {
  let remain = Math.max(0, elapsed) * move.speed;
  let dx = 0;
  let dy = 0;
  const sign = move.run < 0 ? -1 : 1;
  const runLen = Math.abs(move.run);
  const sideHeading = sign < 0 ? 270 : 90;

  for (let i = 0; i < move.steps; i++) {
    const down = Math.min(remain, move.drop);
    dy += down;
    remain -= down;
    if (remain <= 0) return { dx, dy, heading: 0 };
    const side = Math.min(remain, runLen);
    dx += sign * side;
    remain -= side;
    if (remain <= 0) return { dx, dy, heading: sideHeading };
  }
  dy += remain;
  return { dx, dy, heading: 0 };
}

/** One committed dive. Positive `angle` drifts right; y always increases. */
export function diveOnceOffset(
  move: Extract<Move, { kind: 'dive_once' }>,
  elapsed: number
): { dx: number; dy: number; heading: number } {
  const rad = (move.angle * Math.PI) / 180;
  const dist = move.speed * Math.max(0, elapsed);
  return {
    dx: Math.sin(rad) * dist,
    dy: Math.cos(rad) * dist,
    heading: move.angle,
  };
}

/**
 * Heading for a nose-down sprite, or null when the sprite stays nose-down
 * in world space (`straight` angle 0, sine, hover, ground, …).
 */
export function enemyTravelHeading(enemy: Enemy): number | null {
  const { move } = enemy;
  if (move.kind === 'rear_diag') return rearDiagHeading(move);
  if (move.kind === 'step_slide') return stepSlidePose(move, enemy.moveTimer).heading;
  if (move.kind === 'dive_once') return diveOnceOffset(move, enemy.moveTimer).heading;
  return null;
}

/**
 * The fire clock does not advance off the field.
 * Every ship waits until y ≥ 8. `rear_diag`, `step_slide`, and `dive_once`
 * also wait until x is inside the field window. The two downward moves
 * stop the clock again once they pass the bottom edge, so a fast exit
 * cannot shoot from under the screen.
 */
export function enemyFireClockHeld(enemy: Enemy): boolean {
  if (enemy.y < 8) return true;
  const kind = enemy.move.kind;
  if (
    (kind === 'rear_diag' || kind === 'step_slide' || kind === 'dive_once') &&
    (enemy.x < REAR_DIAG_FIRE_X_MIN || enemy.x > REAR_DIAG_FIRE_X_MAX)
  ) {
    return true;
  }
  if ((kind === 'step_slide' || kind === 'dive_once') && enemy.y > LOGICAL_H) return true;
  return false;
}

/**
 * Canvas rotation that aims a nose-down sprite along a `straight` heading.
 * Zero keeps the nose pointing down. Negative headings turn it toward up.
 */
export function headingSpriteRotation(headingDeg: number): number {
  return (-headingDeg * Math.PI) / 180;
}

function wrapPi(rad: number): number {
  let d = rad;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function steerAim(
  enemy: Enemy,
  playerX: number,
  playerY: number,
  dt: number,
  degPerSec: number
): void {
  const desired = Math.atan2(playerY - enemy.y, playerX - enemy.x);
  const maxStep = ((degPerSec * Math.PI) / 180) * dt;
  const diff = wrapPi(desired - enemy.aimAngle);
  const step = Math.max(-maxStep, Math.min(maxStep, diff));
  enemy.aimAngle = wrapPi(enemy.aimAngle + step);
}

/**
 * Update enemy and return true if it should be culled.
 * `scrollDelta` is the integer pixel step of the tile map this frame.
 */
export function updateEnemy(
  enemy: Enemy,
  dt: number,
  playerX: number,
  playerY: number,
  scrollDelta: number = BG_SCROLL_SPEED * dt,
  terrain?: TerrainQuery
): boolean {
  enemy.prevX = enemy.x;
  enemy.prevY = enemy.y;
  enemy.moveTimer += dt;

  if (enemy.hitFlashTimer > 0) {
    enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
  }

  updateEnemyMovement(enemy, dt, scrollDelta, terrain);

  if (fireUsesBarrel(enemy.fire)) {
    steerAim(enemy, playerX, playerY, dt, TURRET_TURN_RATE);
  } else if (ENEMY_DEFS[enemy.type].snapAim) {
    enemy.aimAngle = Math.atan2(playerY - enemy.y, playerX - enemy.x);
  }

  if (enemy.y > LOGICAL_H + 60 || enemy.y < -120 || enemy.x < -120 || enemy.x > LOGICAL_W + 120) {
    return true;
  }

  return false;
}

function groundDrive(move: Extract<Move, { kind: 'ground' }>): { vx: number; climb: number } {
  const entry = move.entry ?? 'top';
  switch (entry) {
    case 'left':
      return { vx: move.vx ?? TANK_ENTRY_SPEED, climb: 0 };
    case 'right':
      return { vx: move.vx ?? -TANK_ENTRY_SPEED, climb: 0 };
    case 'bottomLeft':
      return { vx: move.vx ?? TANK_DIAG_VX, climb: TANK_DIAG_CLIMB };
    case 'bottomRight':
      return { vx: move.vx ?? -TANK_DIAG_VX, climb: TANK_DIAG_CLIMB };
    default:
      return { vx: move.vx ?? 0, climb: 0 };
  }
}

/** Step toward the nearer dry tile. Stage-1 water is a winding river, not a fixed side. */
function waterEscapeDir(x: number, y: number, terrain: TerrainQuery): number {
  let left = 0;
  let right = 0;
  for (let d = 8; d <= 220; d += 8) {
    if (left === 0 && !terrain.blocksTank(x - d, y)) left = d;
    if (right === 0 && !terrain.blocksTank(x + d, y)) right = d;
    if (left && right) break;
  }
  if (left === 0) return 1;
  if (right === 0) return -1;
  return left <= right ? -1 : 1;
}

function updateEnemyMovement(
  enemy: Enemy,
  dt: number,
  scrollDelta: number,
  terrain?: TerrainQuery
): void {
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
        const diag = move.speed * Math.cos((V_DIVE_EXIT_DEG * Math.PI) / 180);
        const mid = LOGICAL_W / 2;
        let dir = 0;
        if (enemy.startX < mid - 10) dir = -1;
        else if (enemy.startX > mid + 10) dir = 1;
        if (dir === 0) {
          enemy.y += move.speed * dt;
        } else {
          enemy.x += dir * diag * dt;
          enemy.y += diag * dt;
        }
      }
      break;
    }

    case 'cross': {
      const targetX = move.from === 'topLeft' ? LOGICAL_W + 40 : -40;
      const targetY = LOGICAL_H + 40;
      const dx = targetX - enemy.startX;
      const dy = targetY - enemy.startY;
      const len = Math.hypot(dx, dy) || 1;
      enemy.x = enemy.startX + (dx / len) * move.speed * enemy.moveTimer;
      enemy.y = enemy.startY + (dy / len) * move.speed * enemy.moveTimer;
      break;
    }

    case 'hover': {
      if (enemy.phase === 'enter') {
        enemy.y += HOVER_ENTER_SPEED * dt;
        if (enemy.y >= move.stopY) {
          enemy.y = move.stopY;
          enemy.phase = 'hold';
          enemy.moveTimer = 0;
        }
      } else if (enemy.phase === 'hold') {
        enemy.x = enemy.startX + Math.sin(enemy.moveTimer * 2) * HOVER_DRIFT;
        if (enemy.moveTimer >= move.hold) {
          enemy.phase = 'exit';
        }
      } else {
        enemy.y -= HOVER_EXIT_SPEED * dt;
      }
      break;
    }

    case 'rear_diag': {
      const angleRad = (rearDiagHeading(move) * Math.PI) / 180;
      enemy.x += Math.sin(angleRad) * move.speed * dt;
      enemy.y += Math.cos(angleRad) * move.speed * dt;
      break;
    }

    case 'step_slide': {
      const pose = stepSlidePose(move, enemy.moveTimer);
      enemy.x = enemy.startX + pose.dx;
      enemy.y = enemy.startY + pose.dy;
      break;
    }

    case 'dive_once': {
      const offset = diveOnceOffset(move, enemy.moveTimer);
      enemy.x = enemy.startX + offset.dx;
      enemy.y = enemy.startY + offset.dy;
      break;
    }

    case 'side_arc': {
      const radius = SIDE_ARC_RADIUS;
      const arcLen = (Math.PI / 2) * radius;
      const traveled = enemy.moveTimer * move.speed;
      const sign = move.side === 'left' ? 1 : -1;
      if (traveled < arcLen) {
        const angle = traveled / radius;
        enemy.x = enemy.startX + sign * radius * Math.sin(angle);
        enemy.y = enemy.startY + radius * (1 - Math.cos(angle));
        enemy.phase = 'enter';
      } else {
        const extra = traveled - arcLen;
        enemy.x = enemy.startX + sign * radius;
        enemy.y = enemy.startY + radius + extra;
        enemy.phase = 'exit';
      }
      break;
    }

    case 'orbit': {
      if (enemy.phase === 'enter') {
        const destX = move.anchor.x;
        const destY = move.anchor.y - move.r;
        const dx = destX - enemy.x;
        const dy = destY - enemy.y;
        const dist = Math.hypot(dx, dy);
        const step = ORBIT_APPROACH_SPEED * dt;
        if (dist <= step) {
          enemy.x = destX;
          enemy.y = destY;
          enemy.phase = 'hold';
          enemy.moveTimer = 0;
          enemy.orbitAngle = -Math.PI / 2;
        } else {
          enemy.x += (dx / dist) * step;
          enemy.y += (dy / dist) * step;
        }
      } else if (enemy.phase === 'hold') {
        enemy.orbitAngle += ((Math.PI * 2) / move.period) * dt;
        enemy.x = move.anchor.x + Math.cos(enemy.orbitAngle) * move.r;
        enemy.y = move.anchor.y + Math.sin(enemy.orbitAngle) * move.r;
        if (enemy.moveTimer >= move.hold) {
          enemy.phase = 'exit';
        }
      } else {
        enemy.y += ORBIT_EXIT_SPEED * dt;
      }
      break;
    }

    case 'slow_push': {
      if (enemy.phase === 'enter') {
        enemy.y += SLOW_PUSH_ENTER_SPEED * dt;
        if (enemy.y >= move.stopY) {
          enemy.y = move.stopY;
          enemy.phase = 'hold';
          enemy.moveTimer = 0;
        }
      } else if (enemy.phase === 'hold') {
        enemy.x = enemy.startX + Math.sin(enemy.moveTimer * 1.5) * SLOW_PUSH_DRIFT;
        if (enemy.moveTimer >= move.hold) {
          enemy.phase = 'exit';
        }
      } else {
        enemy.y += SLOW_PUSH_EXIT_SPEED * dt;
      }
      break;
    }

    case 'ground': {
      const { vx, climb } = groundDrive(move);
      const scrolledY = enemy.y + scrollDelta;
      const avoidsWater = ENEMY_DEFS[enemy.type].avoidsWater === true;
      if (avoidsWater && terrain?.blocksTank(enemy.x, scrolledY)) {
        enemy.x += waterEscapeDir(enemy.x, scrolledY, terrain) * TANK_ENTRY_SPEED * dt;
        enemy.y = scrolledY;
        break;
      }
      const nextX = enemy.x + vx * dt;
      const nextY = scrolledY - climb * dt;
      if (avoidsWater && terrain) {
        enemy.x = terrain.blocksTank(nextX, scrolledY) ? enemy.x : nextX;
        enemy.y = terrain.blocksTank(enemy.x, nextY) ? scrolledY : nextY;
      } else {
        enemy.x = nextX;
        enemy.y = nextY;
      }
      break;
    }
  }
}

/**
 * Body HP and shield for a spawn. `hpOverride` replaces the def's body HP
 * before the difficulty scale. Shield always comes from the def, then the
 * same scale. Easy leaves both at the authored values.
 */
export function scaledEnemyVitals(
  type: EnemyType,
  difficulty: Difficulty,
  hpOverride?: number
): { hp: number; shield: number } {
  const stats = ENEMY_DEFS[type];
  return {
    hp: scaleHp(hpOverride ?? stats.hp, difficulty),
    shield: scaleHp(stats.shield ?? 0, difficulty),
  };
}

/** Deal damage. Shield absorbs first; the body dies at 0 HP. */
export function damageEnemy(enemy: Enemy, damage: number): boolean {
  let left = damage;
  if (enemy.shield > 0 && left > 0) {
    const taken = Math.min(enemy.shield, left);
    enemy.shield -= taken;
    left -= taken;
  }
  if (left > 0) enemy.hp -= left;
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

  // Time spent off the field does not count, same as the old y < 8 gate.
  if (enemyFireClockHeld(enemy)) {
    return { shouldFire: false, fireData: enemy.fire };
  }

  const fireConfig = enemy.fire as {
    maxShots?: number;
    interval?: number;
    firstDelay?: number;
    atY?: number;
  };

  if (fireConfig.maxShots !== undefined && enemy.shotsFired >= fireConfig.maxShots) {
    return { shouldFire: false, fireData: enemy.fire };
  }

  if (fireConfig.atY !== undefined) {
    if (enemy.y >= fireConfig.atY && enemy.canFire) {
      enemy.canFire = false;
      enemy.shotsFired++;
      return { shouldFire: true, fireData: enemy.fire };
    }
    return { shouldFire: false, fireData: enemy.fire };
  }

  const interval = fireConfig.interval ?? 2;
  const firstDelay = fireConfig.firstDelay ?? interval;

  enemy.fireTimer += dt;

  const nextFireTime = enemy.shotsFired === 0 ? firstDelay : interval;
  if (enemy.fireTimer >= nextFireTime) {
    enemy.fireTimer -= nextFireTime;
    enemy.shotsFired++;
    return { shouldFire: true, fireData: enemy.fire };
  }

  return { shouldFire: false, fireData: enemy.fire };
}
