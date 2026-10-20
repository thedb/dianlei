/**
 * Explosion sprites - small, medium, large explosions
 * Design doc §10.3: small 4 frames, medium 6 frames, large 8 frames
 */

import { COLOR } from '@/game/palette';
import type { SpriteFrame } from './types';
import { renderSprite } from './spriteRenderer';

// Shorthand
const _ = -1;
// Reserved: const _K = COLOR.BLACK;
const W = COLOR.WHITE;
const G = COLOR.GRAY;
const DG = COLOR.DARK_GRAY;

const EY = COLOR.EXPLOSION_YELLOW;
const EO = COLOR.EXPLOSION_ORANGE_YELLOW;
const EX = COLOR.EXPLOSION_ORANGE;
// Reserved: const _ER = COLOR.EXPLOSION_RED_ORANGE;

/**
 * Small explosion frames (16x16, 4 frames)
 */
const SMALL_EXPLOSION_1 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, W, EY, EY, W, _, _, _, _, _, _],
  [_, _, _, _, _, W, EY, EY, EY, EY, W, _, _, _, _, _],
  [_, _, _, _, _, W, EY, EY, EY, EY, W, _, _, _, _, _],
  [_, _, _, _, _, _, W, EY, EY, W, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const SMALL_EXPLOSION_2 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, W, W, EY, EY, W, W, _, _, _, _, _],
  [_, _, _, _, W, EY, EY, EY, EY, EY, EY, W, _, _, _, _],
  [_, _, _, W, EY, EY, EO, EO, EO, EO, EY, EY, W, _, _, _],
  [_, _, _, W, EY, EO, EO, W, W, EO, EO, EY, W, _, _, _],
  [_, _, _, W, EY, EO, EO, W, W, EO, EO, EY, W, _, _, _],
  [_, _, _, W, EY, EY, EO, EO, EO, EO, EY, EY, W, _, _, _],
  [_, _, _, _, W, EY, EY, EY, EY, EY, EY, W, _, _, _, _],
  [_, _, _, _, _, W, W, EY, EY, W, W, _, _, _, _, _],
  [_, _, _, _, _, _, _, W, W, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const SMALL_EXPLOSION_3 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, W, _, _, W, _, _, _, _, _, _],
  [_, _, _, _, _, W, EX, W, W, EX, W, _, _, _, _, _],
  [_, _, _, _, W, EX, EO, EY, EY, EO, EX, W, _, _, _, _],
  [_, _, _, W, EX, EO, EY, EY, EY, EY, EO, EX, W, _, _, _],
  [_, _, W, EX, EO, EY, EY, W, W, EY, EY, EO, EX, W, _, _],
  [_, W, EX, EO, EY, EY, W, DG, DG, W, EY, EY, EO, EX, W, _],
  [_, _, W, EY, EY, W, DG, G, G, DG, W, EY, EY, W, _, _],
  [_, _, W, EY, EY, W, DG, G, G, DG, W, EY, EY, W, _, _],
  [_, W, EX, EO, EY, EY, W, DG, DG, W, EY, EY, EO, EX, W, _],
  [_, _, W, EX, EO, EY, EY, W, W, EY, EY, EO, EX, W, _, _],
  [_, _, _, W, EX, EO, EY, EY, EY, EY, EO, EX, W, _, _, _],
  [_, _, _, _, W, EX, EO, EY, EY, EO, EX, W, _, _, _, _],
  [_, _, _, _, _, W, EX, W, W, EX, W, _, _, _, _, _],
  [_, _, _, _, _, _, W, _, _, W, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const SMALL_EXPLOSION_4 = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, DG, _, _, DG, _, _, _, _, _, _],
  [_, _, _, _, _, DG, G, DG, DG, G, DG, _, _, _, _, _],
  [_, _, _, _, DG, G, DG, DG, DG, DG, G, DG, _, _, _, _],
  [_, _, _, DG, G, DG, DG, G, G, DG, DG, G, DG, _, _, _],
  [_, _, DG, G, DG, DG, G, G, G, G, DG, DG, G, DG, _, _],
  [_, _, _, DG, DG, G, G, G, G, G, G, DG, DG, _, _, _],
  [_, _, _, DG, DG, G, G, G, G, G, G, DG, DG, _, _, _],
  [_, _, DG, G, DG, DG, G, G, G, G, DG, DG, G, DG, _, _],
  [_, _, _, DG, G, DG, DG, G, G, DG, DG, G, DG, _, _, _],
  [_, _, _, _, DG, G, DG, DG, DG, DG, G, DG, _, _, _, _],
  [_, _, _, _, _, DG, G, DG, DG, G, DG, _, _, _, _, _],
  [_, _, _, _, _, _, DG, _, _, DG, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

/**
 * Hit spark - small impact effect (8x8, 2 frames)
 */
const HIT_SPARK_1 = [
  [_, _, _, W, W, _, _, _],
  [_, _, W, EY, EY, W, _, _],
  [_, W, EY, W, W, EY, W, _],
  [W, EY, W, W, W, W, EY, W],
  [W, EY, W, W, W, W, EY, W],
  [_, W, EY, W, W, EY, W, _],
  [_, _, W, EY, EY, W, _, _],
  [_, _, _, W, W, _, _, _],
];

const HIT_SPARK_2 = [
  [_, _, _, _, _, _, _, _],
  [_, _, _, W, W, _, _, _],
  [_, _, W, EO, EO, W, _, _],
  [_, W, EO, EO, EO, EO, W, _],
  [_, W, EO, EO, EO, EO, W, _],
  [_, _, W, EO, EO, W, _, _],
  [_, _, _, W, W, _, _, _],
  [_, _, _, _, _, _, _, _],
];

export interface ExplosionAssets {
  smallExplosion: SpriteFrame[];
  hitSpark: SpriteFrame[];
}

/** Create all explosion sprites */
export function createExplosionAssets(): ExplosionAssets {
  return {
    smallExplosion: [
      renderSprite(SMALL_EXPLOSION_1, 0.5, 0.5),
      renderSprite(SMALL_EXPLOSION_2, 0.5, 0.5),
      renderSprite(SMALL_EXPLOSION_3, 0.5, 0.5),
      renderSprite(SMALL_EXPLOSION_4, 0.5, 0.5),
    ],
    hitSpark: [renderSprite(HIT_SPARK_1, 0.5, 0.5), renderSprite(HIT_SPARK_2, 0.5, 0.5)],
  };
}
