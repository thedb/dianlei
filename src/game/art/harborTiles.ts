/**
 * 炉心浮台 look C 淹水船坞废港 tiles (ids 76–86): wet mud flat, rusted
 * concrete pad, quay wall, dry-dock pit floor, barge deck, crane boom
 * lattice (two diagonals), crane foot, broken pilings, scrap, and a burn mark.
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
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const AS = COLOR.TERRAIN_ASPHALT;
const OD = COLOR.GROUND_DARK_OLIVE;
const OL = COLOR.GROUND_OLIVE;
const DB = COLOR.TERRAIN_DARK_BROWN;
const BR = COLOR.TERRAIN_BROWN;
const LB = COLOR.TERRAIN_LIGHT_BROWN;
const RD = COLOR.ENEMY_DARK_RED;
const RC = COLOR.ENEMY_CRIMSON;
const EB = COLOR.ENEMY_BLACK;
const WD = COLOR.WATER_DEEP;
const WO = COLOR.WATER_OCEAN;

const N = TILE_SIZE;
const L = N - 1;

export function harborMudTile(): SpriteData {
  const g = createGrid(N, N, OD);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = (x * 7 + y * 13 + ((x * y) % 5)) % 17;
      if (v === 0 || v === 9) g[y]![x] = DG;
      else if (v === 4) g[y]![x] = DB;
      else if (v === 12 && (x + y) % 3 === 0) g[y]![x] = S;
    }
  }
  fillRect(g, 3, 10, 4, 1, S);
  fillRect(g, 10, 4, 3, 1, S);
  return g;
}

export function harborSlabTile(): SpriteData {
  const g = createGrid(N, N, AS);
  for (const [x, y] of [
    [9, 3],
    [10, 3],
    [10, 4],
    [3, 11],
    [4, 11],
  ] as const) {
    plot(g, x, y, OD);
  }
  for (const [x, y, c] of [
    [3, 3, DG],
    [4, 4, DG],
    [5, 4, S],
    [11, 2, DG],
    [12, 11, DG],
    [6, 12, DB],
    [7, 13, DB],
    [13, 5, AS],
  ] as const) {
    plot(g, x, y, c);
  }
  for (let y = 9; y < 15; y++) plot(g, 10, y, y % 2 ? RD : DB);
  for (let y = 1; y < 6; y++) plot(g, 2, y, y % 2 ? DB : RD);
  return g;
}

/** Quay wall: water-side drop on the left, coping and a bollard, pad on the right. */
export function harborQuayTile(): SpriteData {
  const g = createGrid(N, N, MG);
  fillRect(g, 0, 0, 4, N, OD);
  for (let y = 1; y < N; y += 4) plot(g, 1, y, DG);
  fillRect(g, 4, 0, 2, N, S);
  fillRect(g, 6, 0, 6, N, G);
  fillRect(g, 6, 0, 1, N, MG);
  fillRect(g, 11, 0, 1, N, AS);
  fillRect(g, 6, 7, 6, 1, AS);
  fillRect(g, 7, 2, 4, 3, EB);
  fillRect(g, 8, 2, 2, 2, BR);
  plot(g, 8, 2, LB);
  for (let y = 9; y < 15; y++) plot(g, 5, y, y % 2 ? RD : S);
  fillRect(g, 12, 0, 1, N, DG);
  return g;
}

/** Dry-dock floor: rust sludge with standing water. Walls come from the raster. */
export function harborPitTile(): SpriteData {
  const g = createGrid(N, N, EB);
  fillEllipse(g, 4, 12, 4, 3, RD);
  fillEllipse(g, 12, 4, 3, 2, RD);
  fillEllipse(g, 11, 13, 2, 2, DB);
  fillEllipse(g, 6, 5, 4, 2, WD);
  fillRect(g, 4, 4, 3, 1, WO);
  for (const [x, y] of [
    [1, 2],
    [14, 9],
    [8, 9],
    [2, 7],
    [13, 15],
  ] as const) {
    plot(g, x, y, S);
  }
  plot(g, 9, 2, DB);
  return g;
}

/** Barge deck: rusted plates and two hatches. Hull outline and bow come from the raster. */
export function bargeDeckTile(): SpriteData {
  const g = createGrid(N, N, DB);
  for (let y = 0; y < N; y += 4) fillRect(g, 0, y, N, 1, RD);
  fillRect(g, 3, 2, 10, 5, EB);
  fillRect(g, 4, 3, 8, 3, S);
  fillRect(g, 4, 3, 8, 1, RC);
  fillRect(g, 5, 10, 6, 4, BR);
  fillRect(g, 5, 10, 6, 1, LB);
  fillRect(g, 5, 13, 6, 1, RD);
  plot(g, 1, 9, RC);
  plot(g, 14, 6, RC);
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
      [-2, 0, RD],
      [-1, 0, RC],
      [2, 0, RD],
      [3, 0, RD],
    ] as const) {
      plot(g, x + (rising ? dx : -dx), y + dy, c);
    }
    if (i % 4 === 0) {
      for (let k = -1; k <= 2; k++) plot(g, x + (rising ? k : -k), y, BR);
    }
    if (i % 4 === 2) plot(g, x, y, K);
  }
  return g;
}

/** Crane foot: a braced square frame. */
export function craneFootTile(): SpriteData {
  const g = createGrid(N, N);
  fillRect(g, 2, 2, 12, 12, EB);
  fillRect(g, 3, 3, 10, 10, S);
  fillRect(g, 2, 2, 12, 2, RC);
  fillRect(g, 2, 2, 2, 12, RC);
  fillRect(g, 12, 2, 2, 12, RD);
  fillRect(g, 2, 12, 12, 2, RD);
  for (let i = 4; i < 12; i++) {
    plot(g, i, i, BR);
    plot(g, 15 - i, i, RD);
  }
  fillRect(g, 7, 7, 2, 2, LB);
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
    fillRect(g, x, y, 3, 3, DB);
    fillRect(g, x, y, 3, 1, LB);
    plot(g, x + 2, y + 2, K);
    if (tall) {
      fillRect(g, x, y + 3, 3, 1, BR);
      plot(g, x + 1, y + 1, BR);
    }
  }
  fillRect(g, 4, 6, 6, 1, DB);
  return g;
}

/** Rusted scrap: a bent plate, a pipe stub, and loose bolts. */
export function harborScrapTile(): SpriteData {
  const g = createGrid(N, N);
  fillRect(g, 2, 3, 6, 4, RD);
  fillRect(g, 2, 3, 6, 1, RC);
  fillRect(g, 3, 6, 4, 1, EB);
  fillRect(g, 9, 9, 5, 2, AS);
  fillRect(g, 9, 9, 5, 1, G);
  plot(g, 13, 10, K);
  for (const [x, y] of [
    [11, 3],
    [4, 12],
    [7, 14],
    [13, 13],
  ] as const) {
    plot(g, x, y, DB);
  }
  plot(g, 5, 13, OL);
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
      if (d < 18) g[y]![x] = v === 0 ? DB : K;
      else if (d < 36 && v !== 1) g[y]![x] = EB;
      else if (d < 48 && v === 2) g[y]![x] = DG;
    }
  }
  plot(g, 6, 7, COLOR.EXPLOSION_RED_ORANGE);
  plot(g, 9, 9, RC);
  return g;
}
