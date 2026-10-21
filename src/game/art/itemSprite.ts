/**
 * Item sprites — 方案 B energy icons.
 *
 * Design doc §3.2 / §10.2. Both used to be the same capsule with a letter
 * (P cyan, B orange). Yoan's 方案 B splits them by silhouette and letter:
 * - Power pickup (item type `P`, still the 火力 rule): gold finned missile + M
 * - Bomb pickup (item type `B`): steel-blue octagon badge + B, fuse and spark
 *
 * 16×18: width stays on the 16px item grid; +2px height fits the spark / flame
 * without shrinking the letters below readability at 360×640.
 */

import { COLOR } from '@/game/palette';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite } from './spriteRenderer';

export const ITEM_SPRITE_W = 16;
export const ITEM_SPRITE_H = 18;

const GLYPH: Record<string, number> = {
  '.': -1,
  K: COLOR.BLACK,
  F: COLOR.DARK_GRAY,
  W: COLOR.WHITE,
  H: COLOR.PLAYER_PALE_CYAN,
  C: COLOR.PLAYER_CYAN,
  M: COLOR.PLAYER_MED_CYAN,
  U: COLOR.PLAYER_DARK_CYAN,
  A: COLOR.WATER_SHALLOW,
  N: COLOR.WATER_MEDIUM,
  D: COLOR.WATER_OCEAN,
  S: COLOR.WATER_DEEP,
  Y: COLOR.EXPLOSION_YELLOW,
  Q: COLOR.EXPLOSION_ORANGE_YELLOW,
  O: COLOR.EXPLOSION_ORANGE,
  V: COLOR.BULLET_DARK,
};

function sprite(rows: readonly string[]): SpriteData {
  if (rows.length !== ITEM_SPRITE_H) {
    throw new Error(`item sprite height ${rows.length}`);
  }
  return rows.map((row, y) => {
    if (row.length !== ITEM_SPRITE_W) {
      throw new Error(`item sprite width ${row.length} on row ${y}: ${row}`);
    }
    return [...row].map((ch) => {
      const color = GLYPH[ch];
      if (color === undefined) throw new Error(`unknown item glyph "${ch}"`);
      return color;
    });
  });
}

function recolor(grid: SpriteData, map: ReadonlyMap<number, number>): SpriteData {
  return grid.map((row) => row.map((cell) => (cell < 0 ? cell : (map.get(cell) ?? cell))));
}

/**
 * Bomb energy — octagon badge, letter B, fuse spark.
 * Light falls on the top-left bevel; the inner counters of B stay dark so the
 * letter survives the flash frame.
 */
const BOMB_ROWS = [
  '......O..O......',
  '.....YOWWOY.....',
  '.......FF.......',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHAAAAADSK...',
  '..KHCWWWWWWCDK..',
  '.KHACWWUUWWCSDK.',
  'KHACCWWUUWWCCDSK',
  'KHACCWWWWWWCCDSK',
  'KHACCWWUUWWCCDSK',
  'KHACCWWUUWWCCDSK',
  'KHACCWWWWWWCCDSK',
  '.KHAMMMMMMMMDSK.',
  '..KSDDDDDDDDSK..',
  '...KDDDDDDDDK...',
  '....KDDDDDDK....',
  '.....KKKKKK.....',
] as const;

const BOMB = sprite(BOMB_ROWS);

const BOMB_FLASH = recolor(
  BOMB,
  new Map([
    [COLOR.PLAYER_PALE_CYAN, COLOR.WHITE],
    [COLOR.WATER_SHALLOW, COLOR.PLAYER_PALE_CYAN],
    [COLOR.WATER_MEDIUM, COLOR.WHITE],
    [COLOR.WATER_OCEAN, COLOR.WATER_SHALLOW],
    [COLOR.WATER_DEEP, COLOR.WATER_MEDIUM],
    [COLOR.EXPLOSION_ORANGE, COLOR.EXPLOSION_YELLOW],
    [COLOR.EXPLOSION_YELLOW, COLOR.WHITE],
    [COLOR.DARK_GRAY, COLOR.LIGHT_GRAY],
  ])
);

/**
 * Missile energy — gold body, purple rim, letter M, side fins, nozzle flame.
 * Letter counters stay mid-gold (not yellow) so M stays readable when the
 * flash frame pushes the body toward white-yellow.
 */
const MISSILE_ROWS = [
  '.......VV.......',
  '......VYYV......',
  '.....VYQQYV.....',
  '....VYQQQQYV....',
  '...VYQQQQQQYV...',
  '..VQQQQQQQQQQV..',
  '..VYWWQQQQWWOV..',
  '..VYWWWQQWWWOV..',
  '..VYWWQWWQWWOV..',
  '..VYWWQQQQWWOV..',
  '..VYWWQQQQWWOV..',
  '..VYQQQQQQQQOV..',
  '..VQQQQQQQQQQV..',
  '.VQQQQQQQQQQQQV.',
  'VO.VQOOOOOOQV.OV',
  'VO..VYYYYYYV..OV',
  '.....YOYYOY.....',
  '......OOOO......',
] as const;

const MISSILE = sprite(MISSILE_ROWS);

const MISSILE_FLASH = recolor(
  MISSILE,
  new Map([
    [COLOR.EXPLOSION_ORANGE_YELLOW, COLOR.EXPLOSION_YELLOW],
    [COLOR.EXPLOSION_ORANGE, COLOR.EXPLOSION_ORANGE_YELLOW],
    [COLOR.EXPLOSION_YELLOW, COLOR.WHITE],
  ])
);

export function bombEnergyPixels(flash = false): SpriteData {
  return flash ? BOMB_FLASH : BOMB;
}

export function missileEnergyPixels(flash = false): SpriteData {
  return flash ? MISSILE_FLASH : MISSILE;
}

export interface ItemAssets {
  /** Power pickup. Drawn as the missile-energy icon; item type stays `P`. */
  powerUp: SpriteFrame;
  powerUpFlash: SpriteFrame;
  bomb: SpriteFrame;
  bombFlash: SpriteFrame;
}

/** Create all item sprites */
export function createItemAssets(): ItemAssets {
  return {
    powerUp: renderSprite(MISSILE, 0.5, 0.5),
    powerUpFlash: renderSprite(MISSILE_FLASH, 0.5, 0.5),
    bomb: renderSprite(BOMB, 0.5, 0.5),
    bombFlash: renderSprite(BOMB_FLASH, 0.5, 0.5),
  };
}
