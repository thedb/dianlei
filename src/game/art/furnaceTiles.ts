/**
 * 炉心浮台 chassis tiles (ids 76–79): plate, rib, cyan light strip, and the
 * dark void outside the hull. Look A 灯带四瓣 is the only look the fight uses.
 * Every tile tiles seamlessly up and down, so the loop rows can repeat.
 * Integer coordinates only: `plot` indexes rows directly.
 */

import { TILE_SIZE } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillRect, plot } from './pixelDraw';
import type { SpriteData } from './types';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const CY = COLOR.PLAYER_CYAN;
const CM = COLOR.PLAYER_MED_CYAN;
const CD = COLOR.PLAYER_DARK_CYAN;
const CP = COLOR.PLAYER_PALE_CYAN;

export function furnacePlateTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, DG);
  fillRect(g, 0, 0, TILE_SIZE, 1, MG);
  fillRect(g, 0, 0, 1, TILE_SIZE, MG);
  fillRect(g, 0, TILE_SIZE - 1, TILE_SIZE, 1, S);
  fillRect(g, TILE_SIZE - 1, 0, 1, TILE_SIZE, S);
  for (const [x, y] of [
    [3, 3],
    [12, 3],
    [3, 12],
    [12, 12],
  ] as const) {
    plot(g, x, y, LG);
    plot(g, x + 1, y + 1, K);
  }
  fillRect(g, 6, 7, 4, 1, S);
  return g;
}

export function furnaceRibTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, DG);
  fillRect(g, 4, 0, 8, TILE_SIZE, MG);
  fillRect(g, 4, 0, 1, TILE_SIZE, LG);
  fillRect(g, 5, 0, 1, TILE_SIZE, G);
  fillRect(g, 11, 0, 1, TILE_SIZE, S);
  fillRect(g, 12, 0, 1, TILE_SIZE, K);
  for (const y of [3, 11]) {
    plot(g, 7, y, LG);
    plot(g, 8, y + 1, K);
  }
  return g;
}

export function furnaceStripTile(): SpriteData {
  const g = furnacePlateTile();
  fillRect(g, 5, 0, 6, TILE_SIZE, K);
  fillRect(g, 6, 0, 4, TILE_SIZE, CD);
  fillRect(g, 7, 0, 2, TILE_SIZE, CM);
  for (let y = 1; y < TILE_SIZE; y += 4) {
    fillRect(g, 7, y, 2, 2, CY);
    plot(g, 7, y, CP);
  }
  return g;
}

export function furnaceVoidTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, S);
  for (const [x, y] of [
    [2, 5],
    [9, 1],
    [13, 10],
    [6, 13],
  ] as const) {
    plot(g, x, y, K);
  }
  plot(g, 11, 6, DG);
  return g;
}
