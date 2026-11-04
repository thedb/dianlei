/**
 * Wingman slot M (design §5.3.2). Independent of the weapon registry:
 * P and T never change these ships. The M pickup raises the level
 * (`applyMatePickup`); it is not a `WEAPONS` row.
 * Levels: 0 none, 1 the left ship, 2 one ship on each side.
 * They draw and shoot. They are not colliders.
 */

import {
  DEATH_MATE_LOSS,
  MATE_MAX_LEVEL,
  MATE_MUZZLE_Y,
  MATE_OFFSET_X,
  MATE_OFFSET_Y,
  MATE_SCALE,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
} from '@/game/config';

export interface MateShotEmitter {
  bullet(x: number, y: number, vx: number, vy: number, damage: number): void;
}

export type MateSide = 'left' | 'right';

export interface MatePlacement {
  side: MateSide;
  /** Offset from the player center, logical pixels. */
  dx: number;
  dy: number;
}

/** Clamp to 0..MATE_MAX_LEVEL. Non-finite values become 0. */
export function mateLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MATE_MAX_LEVEL, Math.floor(level)));
}

/** How many wingmen a level shows and fires. */
export function mateCount(level: number): number {
  return matePlacements(level).length;
}

/**
 * M=1 is the left ship only. M=2 adds the right ship at the same height.
 * Offsets are from the player center, so the ships track the live position.
 */
export function matePlacements(level: number, offsetX = MATE_OFFSET_X): MatePlacement[] {
  const n = mateLevel(level);
  if (n <= 0) return [];
  const left: MatePlacement = { side: 'left', dx: -offsetX, dy: MATE_OFFSET_Y };
  if (n === 1) return [left];
  return [left, { side: 'right', dx: offsetX, dy: MATE_OFFSET_Y }];
}

/** Whole pixels for a source length at MATE_SCALE. At least 1. */
export function matePixels(sourcePixels: number): number {
  return Math.max(1, Math.round(sourcePixels * MATE_SCALE));
}

/**
 * One straight vulcan bullet per wingman. The caller owns the 5 Hz clock.
 * Damage is always PLAYER_BULLET_DAMAGE and speed is PLAYER_BULLET_SPEED.
 * The main weapon's level, spread, Mandy's wide pattern, Jason's 900 speed,
 * and any weapon-test P伤 override are not applied.
 * `offsetX` defaults to Eagle's MATE_OFFSET_X.
 */
export function fireMates(
  level: number,
  x: number,
  y: number,
  emit: MateShotEmitter,
  offsetX = MATE_OFFSET_X
): void {
  for (const mate of matePlacements(level, offsetX)) {
    emit.bullet(
      x + mate.dx,
      y + mate.dy - MATE_MUZZLE_Y,
      0,
      -PLAYER_BULLET_SPEED,
      PLAYER_BULLET_DAMAGE
    );
  }
}

/** Death drops one level and stops at 0. */
export function applyMateDeath(level: number): number {
  return Math.max(0, mateLevel(level) - DEATH_MATE_LOSS);
}

export type MatePickupResult = 'levelUp' | 'overflow';

/**
 * Collect one M. +1 up to MATE_MAX_LEVEL, then overflow (the caller pays
 * M_OVERFLOW_SCORE). P and T never call this.
 */
export function applyMatePickup(level: number): { level: number; result: MatePickupResult } {
  const current = mateLevel(level);
  if (current >= MATE_MAX_LEVEL) return { level: current, result: 'overflow' };
  return { level: current + 1, result: 'levelUp' };
}
