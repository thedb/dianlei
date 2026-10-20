/**
 * Item sprites - P (power-up) and B (bomb) items
 * Design doc §10.2: items 16x16
 */

import { COLOR } from '@/game/palette';
import type { SpriteFrame } from './types';
import { renderSprite } from './spriteRenderer';

// Shorthand
const _ = -1;
const K = COLOR.BLACK;
const W = COLOR.WHITE;
// Reserved: const _LG = COLOR.LIGHT_GRAY;
// Reserved: const _G = COLOR.GRAY;

// Power-up uses cyan/blue
const PC = COLOR.PLAYER_CYAN;
const PM = COLOR.PLAYER_MED_CYAN;
// Reserved: const _PD = COLOR.PLAYER_DARK_CYAN;
const PB = COLOR.PLAYER_BLUE;

// Bomb uses orange/yellow
// Reserved: const _EY = COLOR.EXPLOSION_YELLOW;
const EO = COLOR.EXPLOSION_ORANGE_YELLOW;
const EX = COLOR.EXPLOSION_ORANGE;
const ER = COLOR.EXPLOSION_RED_ORANGE;

/**
 * Power-up item (P) - 16x16 cyan capsule
 */
const ITEM_P = [
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
  [_, _, _, K, PM, PM, PC, PC, PC, PC, PM, PM, K, _, _, _],
  [_, _, K, PM, PC, PC, PC, W, W, PC, PC, PC, PM, K, _, _],
  [_, K, PM, PC, PC, W, W, W, W, W, W, PC, PC, PM, K, _],
  [K, PM, PC, PC, W, W, K, K, K, K, W, W, PC, PC, PM, K],
  [K, PM, PC, W, W, K, K, W, W, K, K, W, W, PC, PM, K],
  [K, PC, PC, W, K, K, W, W, W, W, K, K, W, PC, PC, K],
  [K, PC, PC, W, K, W, W, PB, PB, W, W, K, W, PC, PC, K],
  [K, PC, PC, W, K, W, W, PB, PB, W, W, K, W, PC, PC, K],
  [K, PC, PC, W, K, K, W, W, W, W, K, K, W, PC, PC, K],
  [K, PM, PC, W, W, K, K, W, W, K, K, W, W, PC, PM, K],
  [K, PM, PC, PC, W, W, K, K, K, K, W, W, PC, PC, PM, K],
  [_, K, PM, PC, PC, W, W, W, W, W, W, PC, PC, PM, K, _],
  [_, _, K, PM, PC, PC, PC, W, W, PC, PC, PC, PM, K, _, _],
  [_, _, _, K, PM, PM, PC, PC, PC, PC, PM, PM, K, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
];

/**
 * Bomb item (B) - 16x16 orange capsule
 */
const ITEM_B = [
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
  [_, _, _, K, EX, EX, EO, EO, EO, EO, EX, EX, K, _, _, _],
  [_, _, K, EX, EO, EO, EO, W, W, EO, EO, EO, EX, K, _, _],
  [_, K, EX, EO, EO, W, W, W, W, W, W, EO, EO, EX, K, _],
  [K, EX, EO, EO, W, W, K, K, K, K, W, W, EO, EO, EX, K],
  [K, EX, EO, W, W, K, K, W, W, K, K, W, W, EO, EX, K],
  [K, EO, EO, W, K, K, W, W, W, W, K, K, W, EO, EO, K],
  [K, EO, EO, W, K, W, W, ER, ER, W, W, K, W, EO, EO, K],
  [K, EO, EO, W, K, W, W, ER, ER, W, W, K, W, EO, EO, K],
  [K, EO, EO, W, K, K, W, W, W, W, K, K, W, EO, EO, K],
  [K, EX, EO, W, W, K, K, W, W, K, K, W, W, EO, EX, K],
  [K, EX, EO, EO, W, W, K, K, K, K, W, W, EO, EO, EX, K],
  [_, K, EX, EO, EO, W, W, W, W, W, W, EO, EO, EX, K, _],
  [_, _, K, EX, EO, EO, EO, W, W, EO, EO, EO, EX, K, _, _],
  [_, _, _, K, EX, EX, EO, EO, EO, EO, EX, EX, K, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
];

/**
 * Alternate frame for flashing effect (brighter version)
 */
const ITEM_P_FLASH = [
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
  [_, _, _, K, PC, PC, W, W, W, W, PC, PC, K, _, _, _],
  [_, _, K, PC, W, W, W, W, W, W, W, W, PC, K, _, _],
  [_, K, PC, W, W, W, W, W, W, W, W, W, W, PC, K, _],
  [K, PC, W, W, W, W, K, K, K, K, W, W, W, W, PC, K],
  [K, PC, W, W, W, K, K, W, W, K, K, W, W, W, PC, K],
  [K, W, W, W, K, K, W, W, W, W, K, K, W, W, W, K],
  [K, W, W, W, K, W, W, PB, PB, W, W, K, W, W, W, K],
  [K, W, W, W, K, W, W, PB, PB, W, W, K, W, W, W, K],
  [K, W, W, W, K, K, W, W, W, W, K, K, W, W, W, K],
  [K, PC, W, W, W, K, K, W, W, K, K, W, W, W, PC, K],
  [K, PC, W, W, W, W, K, K, K, K, W, W, W, W, PC, K],
  [_, K, PC, W, W, W, W, W, W, W, W, W, W, PC, K, _],
  [_, _, K, PC, W, W, W, W, W, W, W, W, PC, K, _, _],
  [_, _, _, K, PC, PC, W, W, W, W, PC, PC, K, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
];

const ITEM_B_FLASH = [
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
  [_, _, _, K, EO, EO, W, W, W, W, EO, EO, K, _, _, _],
  [_, _, K, EO, W, W, W, W, W, W, W, W, EO, K, _, _],
  [_, K, EO, W, W, W, W, W, W, W, W, W, W, EO, K, _],
  [K, EO, W, W, W, W, K, K, K, K, W, W, W, W, EO, K],
  [K, EO, W, W, W, K, K, W, W, K, K, W, W, W, EO, K],
  [K, W, W, W, K, K, W, W, W, W, K, K, W, W, W, K],
  [K, W, W, W, K, W, W, ER, ER, W, W, K, W, W, W, K],
  [K, W, W, W, K, W, W, ER, ER, W, W, K, W, W, W, K],
  [K, W, W, W, K, K, W, W, W, W, K, K, W, W, W, K],
  [K, EO, W, W, W, K, K, W, W, K, K, W, W, W, EO, K],
  [K, EO, W, W, W, W, K, K, K, K, W, W, W, W, EO, K],
  [_, K, EO, W, W, W, W, W, W, W, W, W, W, EO, K, _],
  [_, _, K, EO, W, W, W, W, W, W, W, W, EO, K, _, _],
  [_, _, _, K, EO, EO, W, W, W, W, EO, EO, K, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
];

export interface ItemAssets {
  powerUp: SpriteFrame;
  powerUpFlash: SpriteFrame;
  bomb: SpriteFrame;
  bombFlash: SpriteFrame;
}

/** Create all item sprites */
export function createItemAssets(): ItemAssets {
  return {
    powerUp: renderSprite(ITEM_P, 0.5, 0.5),
    powerUpFlash: renderSprite(ITEM_P_FLASH, 0.5, 0.5),
    bomb: renderSprite(ITEM_B, 0.5, 0.5),
    bombFlash: renderSprite(ITEM_B_FLASH, 0.5, 0.5),
  };
}
