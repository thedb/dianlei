/**
 * Wingman slot M (design §5.3.2). Independent of the weapon registry:
 * P and T never change these ships, and nothing here is an item.
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
export function matePlacements(level: number): MatePlacement[] {
  const n = mateLevel(level);
  if (n <= 0) return [];
  const left: MatePlacement = { side: 'left', dx: -MATE_OFFSET_X, dy: MATE_OFFSET_Y };
  if (n === 1) return [left];
  return [left, { side: 'right', dx: MATE_OFFSET_X, dy: MATE_OFFSET_Y }];
}

/** Whole pixels for a source length at MATE_SCALE. At least 1. */
export function matePixels(sourcePixels: number): number {
  return Math.max(1, Math.round(sourcePixels * MATE_SCALE));
}

/**
 * One straight vulcan bullet per wingman, on the caller's beat.
 * Damage is always PLAYER_BULLET_DAMAGE. The main weapon's level, spread,
 * and any weapon-test P伤 override are not applied.
 */
export function fireMates(level: number, x: number, y: number, emit: MateShotEmitter): void {
  for (const mate of matePlacements(level)) {
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
