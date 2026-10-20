/**
 * Bullet sprites - player and enemy bullets
 * Design doc §10.2: player bullet 4x12, enemy small 6x6, large 12x12
 */

import { COLOR } from '@/game/palette';
import type { SpriteFrame } from './types';
import { renderSprite } from './spriteRenderer';

// Shorthand
const _ = -1;
const W = COLOR.WHITE;
const PC = COLOR.PLAYER_CYAN;
const PM = COLOR.PLAYER_MED_CYAN;
const PD = COLOR.PLAYER_DARK_CYAN;
const BM = COLOR.BULLET_MAGENTA;
const BP = COLOR.BULLET_PINK;
const BD = COLOR.BULLET_DARK;
const BC = COLOR.BULLET_CORE;

/**
 * Player bullet - 4x12 cyan laser
 */
const PLAYER_BULLET = [
  [_, PC, PC, _],
  [PM, W, W, PM],
  [PM, W, W, PM],
  [PM, W, W, PM],
  [PC, W, W, PC],
  [PC, W, W, PC],
  [PC, W, W, PC],
  [PC, W, W, PC],
  [PC, W, W, PC],
  [PM, W, W, PM],
  [PD, PC, PC, PD],
  [_, PD, PD, _],
];

/**
 * Enemy bullet small - 6x6 pink/magenta orb
 */
const ENEMY_BULLET_SMALL = [
  [_, _, BD, BD, _, _],
  [_, BD, BM, BM, BD, _],
  [BD, BM, BC, BC, BM, BD],
  [BD, BM, BC, BC, BM, BD],
  [_, BD, BM, BM, BD, _],
  [_, _, BD, BD, _, _],
];

/**
 * Enemy bullet large - 12x12 pink/magenta orb
 */
const ENEMY_BULLET_LARGE = [
  [_, _, _, _, BD, BD, BD, BD, _, _, _, _],
  [_, _, BD, BD, BM, BM, BM, BM, BD, BD, _, _],
  [_, BD, BM, BM, BP, BP, BP, BP, BM, BM, BD, _],
  [_, BD, BM, BP, BP, BC, BC, BP, BP, BM, BD, _],
  [BD, BM, BP, BP, BC, BC, BC, BC, BP, BP, BM, BD],
  [BD, BM, BP, BC, BC, W, W, BC, BC, BP, BM, BD],
  [BD, BM, BP, BC, BC, W, W, BC, BC, BP, BM, BD],
  [BD, BM, BP, BP, BC, BC, BC, BC, BP, BP, BM, BD],
  [_, BD, BM, BP, BP, BC, BC, BP, BP, BM, BD, _],
  [_, BD, BM, BM, BP, BP, BP, BP, BM, BM, BD, _],
  [_, _, BD, BD, BM, BM, BM, BM, BD, BD, _, _],
  [_, _, _, _, BD, BD, BD, BD, _, _, _, _],
];

/**
 * Missile — 6×12, nose at the top. Drawn rotated to its velocity.
 */
const MISSILE: number[][] = [
  [_, _, BD, BD, _, _],
  [_, BD, BC, BC, BD, _],
  [_, BD, BM, BM, BD, _],
  [BD, BP, BM, BM, BP, BD],
  [BD, BP, BM, BM, BP, BD],
  [BD, BP, BP, BP, BP, BD],
  [BD, BM, BP, BP, BM, BD],
  [_, BD, BM, BM, BD, _],
  [_, BD, W, W, BD, _],
  [_, _, BD, BD, _, _],
  [_, BD, COLOR.EXPLOSION_ORANGE, COLOR.EXPLOSION_ORANGE, BD, _],
  [_, _, BD, BD, _, _],
];

export interface BulletAssets {
  playerBullet: SpriteFrame;
  enemyBulletSmall: SpriteFrame;
  enemyBulletLarge: SpriteFrame;
  missile: SpriteFrame;
}

/** Create all bullet sprites */
export function createBulletAssets(): BulletAssets {
  return {
    playerBullet: renderSprite(PLAYER_BULLET, 0.5, 0.5),
    enemyBulletSmall: renderSprite(ENEMY_BULLET_SMALL, 0.5, 0.5),
    enemyBulletLarge: renderSprite(ENEMY_BULLET_LARGE, 0.5, 0.5),
    missile: renderSprite(MISSILE, 0.5, 0.5),
  };
}

/** Draw bullet glow effect behind the bullet sprite */
export function drawBulletGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Colors for bullet glow effects */
export const BULLET_GLOW_COLORS = {
  player: 'rgba(0, 229, 255, 0.4)',
  enemy: 'rgba(255, 64, 255, 0.4)',
};
