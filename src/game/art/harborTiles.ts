/**
 * 炉心浮台 look C 淹水船坞废港 tiles (ids 76–86): mud bank, concrete pad,
 * quay wall, dry-dock pit floor, barge deck, crane boom lattice (two
 * diagonals), crane foot, broken pilings, scrap, and a burn mark.
 * Bright daytime scrap port, keyed to 河流A: pale concrete, olive mud,
 * rust orange steel. Water is the map's own lake tile.
 * Mud / slab / quay / pit / hull tile seamlessly up and down so the loop can
 * repeat. Pits and hulls get their walls and outline from `mapRaster.ts`
 * per neighbour; booms, the crane foot, pilings, and scrap are overlays
 * (transparent cells show the ground the raster picks under them).
 * Integer coordinates only: `plot` indexes rows directly.
 */

import { TILE_SIZE } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillRect, plot } from './pixelDraw';
import type { SpriteData } from './types';

const K = COLOR.BLACK;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const PG = COLOR.PALE_GRAY;
const CO = COLOR.TERRAIN_CONCRETE;
const OL = COLOR.GROUND_OLIVE;
const OM = COLOR.GROUND_MED_OLIVE;
const OI = COLOR.GROUND_LIGHT_OLIVE;
const TN = COLOR.GROUND_TAN;
const DB = COLOR.TERRAIN_DARK_BROWN;
const BR = COLOR.TERRAIN_BROWN;
const LB = COLOR.TERRAIN_LIGHT_BROWN;
const ER = COLOR.ENEMY_RED;
const EC = COLOR.ENEMY_CRIMSON;
const RO = COLOR.EXPLOSION_RED_ORANGE;
const OR = COLOR.EXPLOSION_ORANGE;
const OY = COLOR.EXPLOSION_ORANGE_YELLOW;
const WM = COLOR.WATER_MEDIUM;
const WS = COLOR.WATER_SHALLOW;

const N = TILE_SIZE;
const L = N - 1;

export function harborMudTile(): SpriteData {
  const g = createGrid(N, N, OM);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = (x * 7 + y * 13 + ((x * y) % 5)) % 17;
      if (v === 0 || v === 9) g[y]![x] = OL;
      else if (v === 4) g[y]![x] = BR;
      else if (v === 12 && (x + y) % 3 === 0) g[y]![x] = OI;
    }
  }
  fillRect(g, 3, 10, 4, 1, OL);
  fillRect(g, 10, 4, 3, 1, OL);
  plot(g, 11, 3, TN);
  return g;
}

export function harborSlabTile(): SpriteData {
  const g = createGrid(N, N, CO);
  for (const [x, y, c] of [
    [3, 3, G],
    [4, 4, G],
    [5, 4, MG],
    [11, 2, G],
    [12, 11, G],
    [9, 3, LG],
    [10, 4, LG],
    [3, 11, LG],
    [6, 12, LB],
    [7, 13, LB],
    [13, 5, LG],
  ] as const) {
    plot(g, x, y, c);
  }
  for (let y = 9; y < 15; y += 2) plot(g, 10, y, LB);
  for (let y = 1; y < 6; y += 2) plot(g, 2, y, BR);
  return g;
}

/** Quay wall: water-side face on the left, pale coping and a bollard, pad on the right. */
export function harborQuayTile(): SpriteData {
  const g = createGrid(N, N, CO);
  fillRect(g, 0, 0, 1, N, MG);
  fillRect(g, 1, 0, 2, N, G);
  for (let y = 3; y < N; y += 4) fillRect(g, 1, y, 2, 1, MG);
  fillRect(g, 3, 0, 1, N, PG);
  fillRect(g, 4, 0, 1, N, LG);
  fillRect(g, 5, 0, 1, N, G);
  for (let y = 9; y < 15; y++) plot(g, 2, y, y % 2 ? LB : G);
  fillRect(g, 8, 2, 3, 3, ER);
  fillRect(g, 8, 2, 3, 1, RO);
  plot(g, 9, 2, OR);
  plot(g, 10, 4, EC);
  fillRect(g, 7, 9, 1, 1, G);
  fillRect(g, 12, 12, 1, 1, LG);
  return g;
}

/** Dry-dock floor: rust sludge with standing water. Walls come from the raster. */
export function harborPitTile(): SpriteData {
  const g = createGrid(N, N, BR);
  fillEllipse(g, 4, 12, 4, 3, DB);
  fillEllipse(g, 12, 4, 3, 2, LB);
  fillEllipse(g, 11, 13, 2, 2, DB);
  fillEllipse(g, 6, 5, 4, 2, WM);
  fillRect(g, 4, 4, 3, 1, WS);
  for (const [x, y] of [
    [1, 2],
    [14, 9],
    [8, 9],
    [2, 7],
    [13, 15],
  ] as const) {
    plot(g, x, y, LB);
  }
  plot(g, 9, 2, ER);
  return g;
}

/** Barge deck: rust plates and two hatches. Hull outline and bow come from the raster. */
export function bargeDeckTile(): SpriteData {
  const g = createGrid(N, N, LB);
  for (let y = 0; y < N; y += 4) fillRect(g, 0, y, N, 1, BR);
  fillRect(g, 3, 2, 10, 5, OL);
  fillRect(g, 4, 3, 8, 3, OM);
  fillRect(g, 4, 3, 8, 1, OI);
  fillRect(g, 5, 10, 6, 4, ER);
  fillRect(g, 5, 10, 6, 1, RO);
  fillRect(g, 5, 13, 6, 1, EC);
  plot(g, 1, 9, RO);
  plot(g, 14, 6, RO);
  return g;
}

/**
 * Crane boom lattice. `rising` runs from the bottom-left corner to the
 * top-right corner, so tiles placed one column right and one row up join.
 */
export function craneBoomTile(rising: boolean): SpriteData {
  const g = createGrid(N, N);
  for (let i = 0; i < N; i++) {
    const x = rising ? i : L - i;
    const y = L - i;
    for (const [dx, dy, c] of [
      [-2, 0, ER],
      [-1, 0, OR],
      [2, 0, ER],
      [3, 0, RO],
    ] as const) {
      plot(g, x + (rising ? dx : -dx), y + dy, c);
    }
    if (i % 4 === 0) {
      for (let k = -1; k <= 2; k++) plot(g, x + (rising ? k : -k), y, OY);
    }
    if (i % 4 === 2) plot(g, x, y, EC);
  }
  return g;
}

/** Crane foot: a braced square frame. */
export function craneFootTile(): SpriteData {
  const g = createGrid(N, N);
  fillRect(g, 2, 2, 12, 12, EC);
  fillRect(g, 3, 3, 10, 10, BR);
  fillRect(g, 2, 2, 12, 2, OR);
  fillRect(g, 2, 2, 2, 12, OR);
  fillRect(g, 12, 2, 2, 12, RO);
  fillRect(g, 2, 12, 12, 2, RO);
  for (let i = 4; i < 12; i++) {
    plot(g, i, i, OR);
    plot(g, 15 - i, i, ER);
  }
  fillRect(g, 7, 7, 2, 2, OY);
  return g;
}

/** Broken pier pilings: four posts, two of them snapped short. */
export function harborPilesTile(): SpriteData {
  const g = createGrid(N, N);
  for (const [x, y, tall] of [
    [2, 3, true],
    [9, 1, false],
    [5, 10, false],
    [12, 9, true],
  ] as const) {
    fillRect(g, x, y, 3, 3, BR);
    fillRect(g, x, y, 3, 1, TN);
    plot(g, x + 2, y + 2, DB);
    if (tall) {
      fillRect(g, x, y + 3, 3, 1, DB);
      plot(g, x + 1, y + 1, LB);
    }
  }
  fillRect(g, 4, 6, 6, 1, LB);
  return g;
}

/** Rusted scrap: a bent plate, a pipe stub, and loose bolts. */
export function harborScrapTile(): SpriteData {
  const g = createGrid(N, N);
  fillRect(g, 2, 3, 6, 4, ER);
  fillRect(g, 2, 3, 6, 1, RO);
  fillRect(g, 3, 6, 4, 1, EC);
  fillRect(g, 9, 9, 5, 2, G);
  fillRect(g, 9, 9, 5, 1, PG);
  plot(g, 13, 10, DG);
  for (const [x, y] of [
    [11, 3],
    [4, 12],
    [7, 14],
    [13, 13],
  ] as const) {
    plot(g, x, y, BR);
  }
  plot(g, 5, 13, OR);
  return g;
}

/** Burn mark on mud or a pad: char, ash, and two embers. Overlay, flat. */
export function harborBurnTile(): SpriteData {
  const g = createGrid(N, N);
  for (let y = 1; y < L; y++) {
    for (let x = 1; x < L; x++) {
      const dx = x - 7.5;
      const dy = (y - 8) * 1.3;
      const d = dx * dx + dy * dy;
      const v = (x * 7 + y * 3) % 5;
      if (d < 12) g[y]![x] = v === 0 ? DB : K;
      else if (d < 28 && v !== 1) g[y]![x] = DB;
      else if (d < 44 && v === 2) g[y]![x] = OL;
    }
  }
  plot(g, 6, 7, RO);
  plot(g, 9, 9, OR);
  return g;
}
