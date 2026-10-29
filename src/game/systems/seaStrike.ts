/**
 * Stage-4 naval strikes.
 *
 * A torpedo plane drops one vertical lane: a warning column, then a lethal
 * water strip that scrolls with the sea. Flak buildings paint a red circle
 * on the player and, after the delay, burst a fragment ring there.
 * Neither is a downward fan or a twin fixed shot.
 */

import type { Poolable } from '@/engine/pool';
import {
  AA_BURST_COUNT,
  AA_BURST_DELAY,
  AA_BURST_SPEED,
  AA_FIRE_INTERVAL,
  AA_MARK_RADIUS,
  HITBOX_RADIUS,
  LOGICAL_H,
} from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
import type { Enemy } from '@/game/entities/enemy';
import { shouldEnemyFire } from '@/game/entities/enemy';
import type { BulletSpawner } from '@/game/entities/enemyBullet';
import { executeFirePattern } from '@/game/systems/danmaku';

export interface TorpedoTrack extends Poolable {
  x: number;
  /** Top of the lane, in screen pixels. Scrolls with the sea. */
  y: number;
  length: number;
  width: number;
  phase: 'warn' | 'live';
  /** Seconds left in the current phase. */
  timer: number;
  life: number;
}

export interface FlakMark extends Poolable {
  x: number;
  y: number;
  delay: number;
  age: number;
  count: number;
  speed: number;
  radius: number;
}

export interface AaProfile {
  delay: number;
  count: number;
  interval: number;
  speed: number;
}

export function aaProfile(difficulty: Difficulty): AaProfile {
  return {
    delay: AA_BURST_DELAY[difficulty],
    count: AA_BURST_COUNT[difficulty],
    interval: AA_FIRE_INTERVAL[difficulty],
    speed: AA_BURST_SPEED,
  };
}

export function createTorpedoTrack(): TorpedoTrack {
  return {
    active: false,
    x: 0,
    y: 0,
    length: 0,
    width: 0,
    phase: 'warn',
    timer: 0,
    life: 0,
    reset() {
      this.x = 0;
      this.y = 0;
      this.length = 0;
      this.width = 0;
      this.phase = 'warn';
      this.timer = 0;
      this.life = 0;
    },
  };
}

export function spawnTorpedoTrack(
  track: TorpedoTrack,
  x: number,
  y: number,
  warn: number,
  life: number,
  length: number,
  width: number
): void {
  track.x = x;
  track.y = y;
  track.length = length;
  track.width = width;
  track.phase = 'warn';
  track.timer = warn;
  track.life = life;
}

/** Scroll the lane. True when it should leave the pool. */
export function updateTorpedoTrack(track: TorpedoTrack, dt: number, scrollDelta: number): boolean {
  track.y += scrollDelta;
  track.timer -= dt;
  if (track.phase === 'warn' && track.timer <= 0) {
    track.phase = 'live';
    track.timer = track.life;
  }
  if (track.phase === 'live' && track.timer <= 0) return true;
  return track.y > LOGICAL_H + 20;
}

export function torpedoHitsPlayer(track: TorpedoTrack, px: number, py: number): boolean {
  if (track.phase !== 'live') return false;
  const left = track.x - track.width / 2;
  const top = track.y;
  const nx = Math.max(left, Math.min(px, left + track.width));
  const ny = Math.max(top, Math.min(py, top + track.length));
  const dx = px - nx;
  const dy = py - ny;
  return dx * dx + dy * dy <= HITBOX_RADIUS * HITBOX_RADIUS;
}

/**
 * When the plane's fire clock says drop, acquire one lane under it.
 * The clock already waited until the climb was on screen.
 */
export function launchTorpedoIfDue(
  enemy: Enemy,
  dt: number,
  playerX: number,
  playerY: number,
  acquire: () => TorpedoTrack | null
): void {
  if (enemy.fire.kind !== 'torpedo') return;
  const result = shouldEnemyFire(enemy, dt, playerX, playerY);
  if (!result.shouldFire || result.fireData.kind !== 'torpedo') return;
  const track = acquire();
  if (!track) return;
  const fire = result.fireData;
  spawnTorpedoTrack(track, enemy.x, enemy.y + 6, fire.warn, fire.life, fire.length, fire.width);
}

export function createFlakMark(): FlakMark {
  return {
    active: false,
    x: 0,
    y: 0,
    delay: 0,
    age: 0,
    count: 0,
    speed: 0,
    radius: AA_MARK_RADIUS,
    reset() {
      this.x = 0;
      this.y = 0;
      this.delay = 0;
      this.age = 0;
      this.count = 0;
      this.speed = 0;
      this.radius = AA_MARK_RADIUS;
    },
  };
}

export function armFlakMark(
  mark: FlakMark,
  x: number,
  y: number,
  delay: number,
  count: number,
  speed: number
): void {
  mark.x = x;
  mark.y = y;
  mark.delay = delay;
  mark.age = 0;
  mark.count = count;
  mark.speed = speed;
  mark.radius = AA_MARK_RADIUS;
}

/** Age the circle. On the delay, spawn the ring and report that the mark is done. */
export function updateFlakMark(mark: FlakMark, dt: number, spawner: BulletSpawner): boolean {
  mark.age += dt;
  if (mark.age < mark.delay) return false;
  executeFirePattern(
    {
      kind: 'pattern',
      pattern: {
        shape: 'ring',
        count: mark.count,
        bullet: 'small',
        speed: mark.speed,
      },
    },
    mark.x,
    mark.y,
    mark.x,
    mark.y,
    spawner
  );
  return true;
}

export function drawTorpedoTrack(ctx: CanvasRenderingContext2D, track: TorpedoTrack): void {
  const left = track.x - track.width / 2;
  ctx.save();
  if (track.phase === 'warn') {
    const blink = Math.floor(track.timer * 8) % 2 === 0;
    ctx.fillStyle = blink ? 'rgba(180, 240, 255, 0.28)' : 'rgba(80, 180, 220, 0.16)';
    ctx.fillRect(left, track.y, track.width, track.length);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(track.x - 1, track.y, 2, track.length);
  } else {
    ctx.fillStyle = 'rgba(40, 140, 170, 0.55)';
    ctx.fillRect(left, track.y, track.width, track.length);
    ctx.fillStyle = 'rgba(200, 255, 255, 0.9)';
    ctx.fillRect(left, track.y, track.width, 3);
    ctx.fillRect(track.x - 1, track.y, 2, track.length);
  }
  ctx.restore();
}

export function drawFlakMark(ctx: CanvasRenderingContext2D, mark: FlakMark): void {
  const u = mark.delay <= 0 ? 1 : Math.min(1, mark.age / mark.delay);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 40, 48, 0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 40, 48, ${0.12 + u * 0.2})`;
  ctx.fill();
  ctx.restore();
}

/** Lock line and a narrow fan while a radar painter is still painting. */
export function drawRadarPaint(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  if (enemy.move.kind !== 'radar_paint') return;
  if (enemy.phase !== 'hold' || enemy.moveTimer >= enemy.move.paint) return;
  const reach = 220;
  const spread = (18 * Math.PI) / 180;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 220, 60, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(enemy.x, enemy.y);
  ctx.lineTo(
    enemy.x + Math.cos(enemy.aimAngle) * reach,
    enemy.y + Math.sin(enemy.aimAngle) * reach
  );
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 60, 40, 0.18)';
  ctx.beginPath();
  ctx.moveTo(enemy.x, enemy.y);
  ctx.arc(enemy.x, enemy.y, reach * 0.55, enemy.aimAngle - spread, enemy.aimAngle + spread);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
