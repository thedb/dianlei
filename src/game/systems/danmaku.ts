/**
 * Shared bullet-pattern library (design §5.8).
 *
 * A pattern is a small set of orthogonal parameters: shape (aimed / fan /
 * ring / parallel), count, spread, aim, bullet look, speed, homing, burst.
 * The named kinds the wave table uses (`fan3`, `ring16`, …) are rows in
 * `FIRE_PRESETS`; a new named kind is a new row. Wave data may also carry a
 * one-off `{ kind: 'pattern', pattern: {...} }` with no preset at all.
 *
 * Also here: the gun clock every shooter uses (`pullShots`) and the sweeping
 * laser state machine (`stepLaserSweep`), so enemies and bosses share them.
 */

import {
  AIMED_BURST_COUNT,
  AIMED_BURST_GAP,
  AIMED_MIN_DIST,
  EB_SPEED_BIG,
  EB_SPEED_FAST,
  EB_SPEED_MISSILE,
  EB_SPEED_SMALL,
  ENEMY_BULLET_CAP,
  ENEMY_BULLET_SPEED_SCALE,
  FIXED2_SEPARATION,
  MISSILE_HOMING_TIME,
} from '@/game/config';
import type { Fire } from '@/game/levels/types';
import type { BulletSpawner, EnemyBulletType } from '@/game/entities/enemyBullet';
import { segmentCircleCollision } from './collision';

export interface PatternSpec {
  shape: 'aimed' | 'fan' | 'ring' | 'parallel';
  /** Bullets per volley (fan, ring, parallel). Spiral takes it from `arms`. */
  count?: number;
  /** Fan: total spread in degrees, first to last bullet. */
  spreadDeg?: number;
  /** Fan / parallel heading. `barrel` uses the shooter's aim angle, else the player. */
  aim?: 'player' | 'down' | 'barrel';
  /** Parallel: distance between the outer lanes, pixels. */
  gap?: number;
  /** Sprite and hit radius. */
  bullet: EnemyBulletType;
  /** Default speed comes from this class's base speed. Defaults to `bullet`. */
  speedClass?: EnemyBulletType;
  /** Explicit flight speed, px/s. `Fire.speed` overrides it. */
  speed?: number;
  /** Seconds the shot steers toward the player. */
  homing?: number;
  /** Skip the volley when the player is closer than AIMED_MIN_DIST. */
  minDist?: boolean;
  /** Repeat the volley this many times, AIMED_BURST_GAP apart. */
  burst?: number;
}

/**
 * Which `Fire` fields a preset reads:
 * shot = timing only, fan = `spread`, ring = `rotStep`, spiral = `arms` + `rotStep`.
 */
export type FireFamily = 'shot' | 'fan' | 'ring' | 'spiral';

export interface FirePreset extends PatternSpec {
  family: FireFamily;
}

export const FIRE_PRESETS = {
  aimed1: { family: 'shot', shape: 'aimed', bullet: 'small', minDist: true },
  aimed3burst: {
    family: 'shot',
    shape: 'aimed',
    bullet: 'small',
    minDist: true,
    burst: AIMED_BURST_COUNT,
  },
  aimed_fast3: {
    family: 'shot',
    shape: 'fan',
    count: 3,
    spreadDeg: 30,
    aim: 'player',
    bullet: 'small',
    speedClass: 'fast',
    minDist: true,
  },
  fixed2: {
    family: 'shot',
    shape: 'parallel',
    count: 2,
    gap: FIXED2_SEPARATION,
    aim: 'barrel',
    bullet: 'small',
  },
  missile: { family: 'shot', shape: 'aimed', bullet: 'missile', homing: MISSILE_HOMING_TIME },
  fan3: { family: 'fan', shape: 'fan', count: 3, aim: 'player', bullet: 'small', minDist: true },
  fan5: { family: 'fan', shape: 'fan', count: 5, aim: 'player', bullet: 'small', minDist: true },
  fan7wide: { family: 'fan', shape: 'fan', count: 7, aim: 'down', bullet: 'large' },
  ring8: { family: 'ring', shape: 'ring', count: 8, bullet: 'large' },
  ring16: { family: 'ring', shape: 'ring', count: 16, bullet: 'large' },
  spiral: { family: 'spiral', shape: 'ring', bullet: 'small' },
} as const satisfies Record<string, FirePreset>;

export type FirePresetKind = keyof typeof FIRE_PRESETS;

type ActiveFire = Exclude<Fire, { kind: 'none' }>;

/** Pattern parameters behind a fire entry. */
export function firePattern(fire: ActiveFire): PatternSpec {
  return fire.kind === 'pattern' ? fire.pattern : FIRE_PRESETS[fire.kind];
}

function fireFamily(fire: ActiveFire): FireFamily {
  if (fire.kind !== 'pattern') return FIRE_PRESETS[fire.kind].family;
  return fire.pattern.shape === 'ring' ? 'ring' : 'shot';
}

/** Seconds between volleys. Fires without an interval default to 2s. */
export function fireInterval(fire: Fire): number {
  if (fire.kind === 'none') return 2;
  return fire.interval ?? 2;
}

/** First volley delay. Rings and spirals have none and wait one interval. */
export function fireFirstDelay(fire: Fire, interval: number): number {
  if (fire.kind === 'none') return interval;
  return ('firstDelay' in fire ? fire.firstDelay : undefined) ?? interval;
}

/** Volleys per trigger (aimed3burst = 3). */
export function fireBurst(fire: Fire): number {
  if (fire.kind === 'none') return 1;
  return firePattern(fire).burst ?? 1;
}

/** Ring rotation step in degrees per volley, or 0 for patterns that do not turn. */
export function fireRotStep(fire: Fire): number {
  if (fire.kind === 'none') return 0;
  return 'rotStep' in fire ? (fire.rotStep ?? 0) : 0;
}

/** True when the volley follows the shooter's barrel instead of the player. */
export function fireUsesBarrel(fire: Fire): boolean {
  if (fire.kind === 'none') return false;
  return firePattern(fire).aim === 'barrel';
}

/** True when the volley points straight down and ignores the player and the barrel. */
export function fireAimsDown(fire: Fire): boolean {
  if (fire.kind === 'none') return false;
  return firePattern(fire).aim === 'down';
}

/** Offset a ship's first shot so a formation doesn't fire on one frame. Rings keep their clock. */
export function withFireStagger(fire: Fire, extra: number): Fire {
  if (extra === 0 || fire.kind === 'none') return fire;
  const family = fireFamily(fire);
  if (family === 'ring' || family === 'spiral') return fire;
  const timed = fire as Extract<Fire, { firstDelay?: number }>;
  const base = timed.firstDelay ?? timed.interval ?? 0;
  return { ...timed, firstDelay: base + extra };
}

/** Base speed for a bullet class (already scaled). */
export function bulletClassSpeed(type: EnemyBulletType): number {
  const base =
    type === 'large'
      ? EB_SPEED_BIG
      : type === 'fast'
        ? EB_SPEED_FAST
        : type === 'missile'
          ? EB_SPEED_MISSILE
          : EB_SPEED_SMALL;
  return base * ENEMY_BULLET_SPEED_SCALE;
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

export interface FirePatternOptions {
  /** Ring rotation offset in degrees. */
  rotation?: number;
  /** Barrel angle in radians for barrel-aimed patterns. Omit to aim at the player. */
  aimAngle?: number;
}

/** Spawn one volley of `fire` from (x, y). Respects the enemy bullet cap. */
export function executeFirePattern(
  fire: Fire,
  x: number,
  y: number,
  playerX: number,
  playerY: number,
  spawner: BulletSpawner,
  rotationOffset: number | FirePatternOptions = 0
): void {
  const options: FirePatternOptions =
    typeof rotationOffset === 'number' ? { rotation: rotationOffset } : rotationOffset;
  if (fire.kind === 'none') return;
  if (spawner.getBulletCount() >= ENEMY_BULLET_CAP) return;

  const spec = firePattern(fire);
  const dx = playerX - x;
  const dy = playerY - y;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy);
  if (spec.minDist && distToPlayer < AIMED_MIN_DIST) return;

  const speed =
    ('speed' in fire ? fire.speed : undefined) ??
    spec.speed ??
    bulletClassSpeed(spec.speedClass ?? spec.bullet);
  const bullet = spec.bullet;
  const homing = spec.homing ?? 0;

  switch (spec.shape) {
    case 'aimed': {
      const v = getAimedVelocity(x, y, playerX, playerY, speed);
      spawner.spawnBullet(x, y, v.vx, v.vy, bullet, homing);
      return;
    }

    case 'fan': {
      const count = spec.count ?? 1;
      const spreadDeg = ('spread' in fire ? fire.spread : undefined) ?? spec.spreadDeg ?? 0;
      const spreadRad = (spreadDeg * Math.PI) / 180;
      const base = spec.aim === 'down' ? Math.PI / 2 : Math.atan2(playerY - y, playerX - x);
      const step = count > 1 ? spreadRad / (count - 1) : 0;
      for (let i = 0; i < count; i++) {
        const angle = base + (i - (count - 1) / 2) * step;
        spawner.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, bullet, homing);
      }
      return;
    }

    case 'ring': {
      const count = Math.max(1, ('arms' in fire ? fire.arms : undefined) ?? spec.count ?? 1);
      const rotRad = ((options.rotation ?? 0) * Math.PI) / 180;
      for (let i = 0; i < count; i++) {
        const angle = rotRad + (i * Math.PI * 2) / count;
        spawner.spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, bullet, homing);
      }
      return;
    }

    case 'parallel': {
      const count = spec.count ?? 2;
      const angle =
        spec.aim === 'down'
          ? Math.PI / 2
          : spec.aim === 'barrel' && options.aimAngle !== undefined
            ? options.aimAngle
            : Math.atan2(playerY - y, playerX - x);
      const lane = count > 1 ? (spec.gap ?? 0) / (count - 1) : 0;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      // Lanes from the +perpendicular side to the − side, so a pair fires + first.
      for (let i = count - 1; i >= 0; i--) {
        const offset = (i - (count - 1) / 2) * lane;
        const px = Math.cos(angle + Math.PI / 2) * Math.abs(offset);
        const py = Math.sin(angle + Math.PI / 2) * Math.abs(offset);
        const side = offset < 0 ? -1 : 1;
        spawner.spawnBullet(
          side > 0 ? x + px : x - px,
          side > 0 ? y + py : y - py,
          vx,
          vy,
          bullet,
          homing
        );
      }
      return;
    }
  }
}

/** Fire clock for one gun: first-shot delay, interval, and a queued burst. */
export interface GunClock {
  timer: number;
  shots: number;
  burstLeft: number;
  burstTimer: number;
  /** Accumulated ring rotation in degrees. */
  rot: number;
}

export function createGunClock(): GunClock {
  return { timer: 0, shots: 0, burstLeft: 0, burstTimer: 0, rot: 0 };
}

export function resetGunClock(gun: GunClock): void {
  gun.timer = 0;
  gun.shots = 0;
  gun.burstLeft = 0;
  gun.burstTimer = 0;
  gun.rot = 0;
}

/**
 * Advance a gun by `dt` and return how many volleys fire in that span.
 * Carries leftover time, so a large step still fires every due volley.
 */
export function pullShots(
  gun: GunClock,
  dt: number,
  interval: number,
  firstDelay: number,
  burst: number
): number {
  const step = Math.max(0.01, interval);
  const first = Math.max(0, firstDelay);
  let left = dt;
  let fired = 0;

  for (let guard = 0; guard < 8 && left > 1e-8; guard++) {
    if (gun.burstLeft > 0) {
      const need = AIMED_BURST_GAP - gun.burstTimer;
      if (left + 1e-9 < need) {
        gun.burstTimer += left;
        return fired;
      }
      left -= need;
      gun.burstTimer = 0;
      gun.burstLeft--;
      fired++;
      continue;
    }

    const threshold = gun.shots === 0 ? first : step;
    const need = threshold - gun.timer;
    if (left + 1e-9 < need) {
      gun.timer += left;
      return fired;
    }
    left -= Math.max(0, need);
    gun.timer = 0;
    gun.shots++;
    fired++;
    if (burst > 1) {
      gun.burstLeft = burst - 1;
      gun.burstTimer = 0;
    }
  }
  return fired;
}

/** Sweeping beam: idle cooldown → blinking telegraph → sweep between two angles. */
export interface LaserSweepSpec {
  /** Seconds of idle between beams. */
  every: number;
  telegraph: number;
  sweep: number;
  /** Degrees off straight down. */
  fromDeg: number;
  toDeg: number;
  /** Drawn width. */
  width: number;
  /** Lethal width. */
  hitWidth: number;
}

export interface LaserSweepState {
  mode: 'idle' | 'telegraph' | 'sweep';
  elapsed: number;
  /** Alternates every sweep: 1 sweeps from → to, −1 back. */
  dir: 1 | -1;
  /** Degrees off straight down. */
  angleDeg: number;
  sweepDuration: number;
  /** Idle time banked toward the next telegraph. */
  cooldown: number;
}

export function createLaserSweep(sweep = 0): LaserSweepState {
  return { mode: 'idle', elapsed: 0, dir: 1, angleDeg: 0, sweepDuration: sweep, cooldown: 0 };
}

/** Back to idle with a fresh cooldown. The sweep direction is kept. */
export function resetLaserSweep(laser: LaserSweepState): void {
  laser.mode = 'idle';
  laser.elapsed = 0;
  laser.angleDeg = 0;
  laser.cooldown = 0;
}

/** Cancel an active beam and restart its cooldown. An idle laser keeps its timer. */
export function interruptLaserSweep(laser: LaserSweepState): void {
  if (laser.mode === 'idle') return;
  resetLaserSweep(laser);
}

/**
 * Advance the beam. `every` and `sweep` are the live values, so an enraged
 * shooter can pass shorter ones without touching the spec.
 */
export function stepLaserSweep(
  laser: LaserSweepState,
  dt: number,
  spec: LaserSweepSpec,
  every: number,
  sweep: number
): void {
  let left = dt;
  for (let guard = 0; guard < 6 && left > 1e-8; guard++) {
    if (laser.mode === 'idle') {
      const need = every - laser.cooldown;
      if (need > left) {
        laser.cooldown += left;
        return;
      }
      left -= Math.max(0, need);
      laser.cooldown = every;
      laser.mode = 'telegraph';
      laser.elapsed = 0;
      laser.angleDeg = 0;
    } else if (laser.mode === 'telegraph') {
      const need = spec.telegraph - laser.elapsed;
      if (need > left) {
        laser.elapsed += left;
        laser.angleDeg = 0;
        return;
      }
      left -= Math.max(0, need);
      laser.mode = 'sweep';
      laser.elapsed = 0;
      laser.sweepDuration = sweep;
      laser.angleDeg = sweepFrom(laser, spec);
    } else {
      const need = laser.sweepDuration - laser.elapsed;
      if (need > left) {
        laser.elapsed += left;
        laser.angleDeg = sweepAngle(laser, spec);
        return;
      }
      left -= Math.max(0, need);
      laser.elapsed = laser.sweepDuration;
      laser.angleDeg = sweepAngle(laser, spec);
      laser.mode = 'idle';
      laser.elapsed = 0;
      laser.cooldown = 0;
      laser.dir = laser.dir === 1 ? -1 : 1;
    }
  }
}

function sweepFrom(laser: LaserSweepState, spec: LaserSweepSpec): number {
  return laser.dir > 0 ? spec.fromDeg : spec.toDeg;
}

function sweepAngle(laser: LaserSweepState, spec: LaserSweepSpec): number {
  const from = sweepFrom(laser, spec);
  const to = laser.dir > 0 ? spec.toDeg : spec.fromDeg;
  const dur = Math.max(0.0001, laser.sweepDuration);
  const u = Math.max(0, Math.min(1, laser.elapsed / dur));
  return from + (to - from) * u;
}

/** Beam heading in radians (0 = right, +y down). */
export function laserSweepRadians(laser: LaserSweepState): number {
  return Math.PI / 2 + (laser.angleDeg * Math.PI) / 180;
}

/** Only the sweeping beam kills. The telegraph line does not. */
export function laserSweepHits(
  laser: LaserSweepState,
  spec: LaserSweepSpec,
  originX: number,
  originY: number,
  length: number,
  px: number,
  py: number,
  radius: number
): boolean {
  if (laser.mode !== 'sweep') return false;
  const ang = laserSweepRadians(laser);
  const x2 = originX + Math.cos(ang) * length;
  const y2 = originY + Math.sin(ang) * length;
  return segmentCircleCollision(originX, originY, x2, y2, px, py, spec.hitWidth / 2 + radius);
}
