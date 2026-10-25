/**
 * Battle FX: size-matched explosions, bullet hit sparks, and screen shake.
 * Both pools are fixed-size; a burst past the cap is dropped, never grown.
 */

import { ObjectPool } from '@/engine/pool';
import {
  EXPLOSION_FRAME_TIME,
  EXPLOSION_POOL_SIZE,
  HIT_SPARK_FRAME_COUNT,
  HIT_SPARK_FRAME_TIME,
  HIT_SPARK_POOL_SIZE,
  explosionFrameCount,
  type ExplosionKind,
} from '@/game/art';

/** `kind` picks the baked small / medium / large frame set. */
export interface Explosion {
  active: boolean;
  x: number;
  y: number;
  frame: number;
  timer: number;
  frameTime: number;
  frameCount: number;
  delay: number;
  kind: ExplosionKind;
  reset(): void;
}

export interface HitSpark {
  active: boolean;
  x: number;
  y: number;
  frame: number;
  timer: number;
  reset(): void;
}

export interface Fx {
  readonly explosions: ObjectPool<Explosion>;
  readonly sparks: ObjectPool<HitSpark>;
  shake: { left: number; mag: number; dur: number };
}

function createExplosion(): Explosion {
  return {
    active: false,
    x: 0,
    y: 0,
    frame: 0,
    timer: 0,
    frameTime: EXPLOSION_FRAME_TIME,
    frameCount: explosionFrameCount('small'),
    delay: 0,
    kind: 'small',
    reset() {
      this.frame = 0;
      this.timer = 0;
      this.delay = 0;
    },
  };
}

function createHitSpark(): HitSpark {
  return {
    active: false,
    x: 0,
    y: 0,
    frame: 0,
    timer: 0,
    reset() {
      this.frame = 0;
      this.timer = 0;
    },
  };
}

export function createFx(): Fx {
  return {
    explosions: new ObjectPool(createExplosion, EXPLOSION_POOL_SIZE, EXPLOSION_POOL_SIZE),
    sparks: new ObjectPool(createHitSpark, HIT_SPARK_POOL_SIZE, HIT_SPARK_POOL_SIZE),
    shake: { left: 0, mag: 0, dur: 0 },
  };
}

export function clearFx(fx: Fx): void {
  fx.explosions.releaseAll();
  fx.sparks.releaseAll();
}

/** Native frame size; kind selects the raster. `frameTime` overrides the shared step. */
export function spawnExplosion(
  fx: Fx,
  x: number,
  y: number,
  kind: ExplosionKind,
  delay = 0,
  frameTime = EXPLOSION_FRAME_TIME
): void {
  const exp = fx.explosions.tryAcquire();
  if (!exp) return;
  exp.x = x;
  exp.y = y;
  exp.delay = delay;
  exp.kind = kind;
  exp.frameTime = frameTime;
  exp.frameCount = explosionFrameCount(kind);
}

/** Impact puff for a player bullet or homing missile. Separate pool from deaths. */
export function spawnHitSpark(fx: Fx, x: number, y: number): void {
  const spark = fx.sparks.tryAcquire();
  if (!spark) return;
  spark.x = x;
  spark.y = y;
}

/** A weaker shake never cuts a stronger one short. */
export function triggerShake(fx: Fx, intensity: number, duration: number): void {
  const s = fx.shake;
  if (s.left > 0 && intensity < s.mag) return;
  if (s.left > 0 && intensity === s.mag && duration <= s.left) return;
  s.mag = intensity;
  s.dur = duration;
  s.left = duration;
}

export function stepShake(fx: Fx, dt: number): void {
  if (fx.shake.left > 0) fx.shake.left = Math.max(0, fx.shake.left - dt);
}

export function resetShake(fx: Fx): void {
  fx.shake.left = 0;
  fx.shake.mag = 0;
  fx.shake.dur = 0;
}

/** Whole-pixel camera offset for the current shake. */
export function shakeOffset(fx: Fx, time: number): { x: number; y: number } {
  const s = fx.shake;
  if (s.left <= 0 || s.dur <= 0) return { x: 0, y: 0 };
  const amp = s.mag * (s.left / s.dur);
  return { x: Math.round(Math.sin(time * 70) * amp), y: Math.round(Math.cos(time * 53) * amp) };
}

export function updateFx(fx: Fx, dt: number): void {
  fx.explosions.forEach((exp) => {
    if (exp.delay > 0) {
      exp.delay -= dt;
      return;
    }
    exp.timer += dt;
    if (exp.timer >= exp.frameTime) {
      exp.timer -= exp.frameTime;
      exp.frame++;
      if (exp.frame >= exp.frameCount) fx.explosions.release(exp);
    }
  });
  fx.sparks.forEach((spark) => {
    spark.timer += dt;
    if (spark.timer >= HIT_SPARK_FRAME_TIME) {
      spark.timer -= HIT_SPARK_FRAME_TIME;
      spark.frame++;
      if (spark.frame >= HIT_SPARK_FRAME_COUNT) fx.sparks.release(spark);
    }
  });
}
