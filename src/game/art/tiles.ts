/**
 * Map tileset: 16×16 palette art shared by every map asset (`src/game/maps/`).
 * Maps are 23 tiles (368px) wide and drawn at x = -4 so the 360-wide screen
 * crops 4px from each side (design doc §3.7).
 *
 * Ids 0–32 are the original stage-1 tiles (runway, hangar, dock, bunker, …).
 * Ids 33–58 are the 陆地A set. Ids 59–63 are the P13 ruin set (scorch, crater,
 * trench, wreck, snag), used by 陆地B.
 */

import { COLOR } from '@/game/palette';
import { LOGICAL_H, TILE_SIZE } from '@/game/config';
import { createGrid, fillEllipse, fillPoly, fillRect, plot } from './pixelDraw';
import type { SpriteData } from './types';

const G = COLOR.TERRAIN_GRASS;
const GL = COLOR.TERRAIN_LIGHT_GRASS;
const GD = COLOR.TERRAIN_GREEN;
const GF = COLOR.TERRAIN_FOREST;
const DI = COLOR.TERRAIN_DARK_BROWN;
const BR = COLOR.TERRAIN_BROWN;
const BL = COLOR.TERRAIN_LIGHT_BROWN;
const AS = COLOR.TERRAIN_ASPHALT;
const AD = COLOR.SHADOW;
const CC = COLOR.TERRAIN_CONCRETE;
const CL = COLOR.LIGHT_GRAY;
const CD = COLOR.MEDIUM_GRAY;
const OD = COLOR.GROUND_DARK_OLIVE;
const OL = COLOR.GROUND_OLIVE;
const WD = COLOR.WATER_DEEP;
const WO = COLOR.WATER_OCEAN;
const WM = COLOR.WATER_MEDIUM;
const WS = COLOR.WATER_SHALLOW;
const WF = COLOR.WATER_FOAM;
const SD = COLOR.GROUND_TAN;
const K = COLOR.BLACK;

export const TileId = {
  grass: 0,
  grassDark: 1,
  dirt: 2,
  roadV: 3,
  roadH: 4,
  roadX: 5,
  barracks: 6,
  bunker: 7,
  water: 8,
  shallow: 9,
  sand: 10,
  shore: 11,
  dock: 12,
  concrete: 13,
  concreteDark: 14,
  runway: 15,
  runwayMark: 16,
  hangar: 17,
  pad: 18,
  coastRoad: 19,
  grassB: 20,
  tree: 21,
  treePine: 22,
  rock: 23,
  mountain: 24,
  bush: 25,
  wall: 26,
  gate: 27,
  fortWall: 28,
  fortYard: 29,
  hangarRoof: 30,
  radar: 31,
  waterB: 32,
  meadow: 33,
  meadowB: 34,
  meadowDark: 35,
  flowers: 36,
  road: 37,
  street: 38,
  lake: 39,
  bridge: 40,
  cropGreen: 41,
  cropWheat: 42,
  cropPlowed: 43,
  forest: 44,
  oak: 45,
  fir: 46,
  boulder: 47,
  shed: 48,
  houseRedTL: 49,
  houseRedTR: 50,
  houseRedBL: 51,
  houseRedBR: 52,
  houseBrownTL: 53,
  houseBrownTR: 54,
  houseBrownBL: 55,
  houseBrownBR: 56,
  plaza: 57,
  reeds: 58,
  scorch: 59,
  crater: 60,
  trench: 61,
  wreck: 62,
  snag: 63,
} as const;

export type TileId = (typeof TileId)[keyof typeof TileId];

export const TILE_COUNT = 64;

function grassTile(base: number, light: number, dark: number, phase: number): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, base);
  const tufts: Array<[number, number]> = [
    [1, 2],
    [6, 1],
    [11, 3],
    [14, 6],
    [3, 7],
    [8, 8],
    [13, 10],
    [2, 12],
    [7, 13],
    [12, 15],
    [5, 5],
    [15, 14],
  ];
  for (const [x, y] of tufts) {
    const xx = (x + phase * 5) % TILE_SIZE;
    const yy = (y + phase * 3) % TILE_SIZE;
    plot(g, xx, yy, light);
    plot(g, xx, Math.min(TILE_SIZE - 1, yy + 1), dark);
  }
  return g;
}

function waterTile(shift: number): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, WO);
  for (let y = 0; y < TILE_SIZE; y++) {
    const band = (y + shift) % 8;
    const col = band < 2 ? WD : band < 5 ? WO : WM;
    for (let x = 0; x < TILE_SIZE; x++) g[y]![x] = col;
  }
  const fy = (5 + shift) % TILE_SIZE;
  for (let x = 1; x < TILE_SIZE; x += 3) plot(g, x, fy, WF);
  plot(g, 4, (fy + 3) % TILE_SIZE, WS);
  plot(g, 12, (fy + 5) % TILE_SIZE, WD);
  return g;
}

function dirtPath(vertical: boolean): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, BR);
  for (let i = 0; i < TILE_SIZE; i++) {
    if (vertical) {
      plot(g, 2, i, DI);
      plot(g, 13, i, DI);
      plot(g, 1, i, BL);
      plot(g, 14, i, BL);
      if (i % 5 === 0) plot(g, 7, i, SD);
    } else {
      plot(g, i, 2, DI);
      plot(g, i, 13, DI);
      plot(g, i, 1, BL);
      plot(g, i, 14, BL);
      if (i % 5 === 0) plot(g, i, 7, SD);
    }
  }
  return g;
}

function paintTiles(tall: Array<boolean[][] | null>): SpriteData[] {
  const tiles: SpriteData[] = Array.from({ length: TILE_COUNT }, () =>
    createGrid(TILE_SIZE, TILE_SIZE, GD)
  );
  tiles[TileId.grass] = grassTile(GD, G, GF, 0);
  tiles[TileId.grassDark] = grassTile(GF, GD, DI, 1);
  tiles[TileId.grassB] = grassTile(G, GL, GD, 2);

  const dirt = createGrid(TILE_SIZE, TILE_SIZE, BR);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if ((x + y * 3) % 7 === 0) dirt[y]![x] = BL;
      if ((x * 5 + y) % 11 === 0) dirt[y]![x] = DI;
    }
  }
  tiles[TileId.dirt] = dirt;
  tiles[TileId.roadV] = dirtPath(true);
  tiles[TileId.roadH] = dirtPath(false);

  const roadX = createGrid(TILE_SIZE, TILE_SIZE, BR);
  for (let i = 0; i < TILE_SIZE; i++) {
    plot(roadX, 4, i, DI);
    plot(roadX, 11, i, DI);
    plot(roadX, i, 4, DI);
    plot(roadX, i, 11, DI);
    if (i % 4 === 0) plot(roadX, 8, i, SD);
  }
  tiles[TileId.roadX] = roadX;

  const barracks = grassTile(GD, G, GF, 3);
  fillRect(barracks, 1, 2, 14, 4, DI);
  fillRect(barracks, 2, 3, 12, 2, BR);
  fillRect(barracks, 2, 6, 12, 8, OL);
  fillRect(barracks, 6, 8, 4, 6, AD);
  fillRect(barracks, 3, 7, 3, 3, K);
  fillRect(barracks, 10, 7, 3, 3, K);
  plot(barracks, 4, 8, CL);
  plot(barracks, 11, 8, CL);
  tiles[TileId.barracks] = barracks;

  const bunker = grassTile(GF, GD, DI, 4);
  fillEllipse(bunker, 8, 8, 6, 6, CC);
  fillEllipse(bunker, 8, 8, 4, 4, CD);
  fillEllipse(bunker, 8, 8, 2, 2, K);
  plot(bunker, 6, 6, CL);
  tiles[TileId.bunker] = bunker;

  tiles[TileId.water] = waterTile(0);
  tiles[TileId.waterB] = waterTile(3);
  tiles[TileId.shallow] = waterTile(6);
  for (let x = 0; x < TILE_SIZE; x += 2) plot(tiles[TileId.shallow]!, x, 2, WF);

  const sand = createGrid(TILE_SIZE, TILE_SIZE, SD);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if ((x * 3 + y * 5) % 8 === 0) sand[y]![x] = BL;
      if ((x + y) % 13 === 0) sand[y]![x] = WF;
    }
  }
  tiles[TileId.sand] = sand;

  const shore = createGrid(TILE_SIZE, TILE_SIZE, SD);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < 6; x++) shore[y]![x] = x < 4 ? WS : WF;
    if (y % 3 === 0) plot(shore, 6, y, BL);
  }
  tiles[TileId.shore] = shore;

  const dock = createGrid(TILE_SIZE, TILE_SIZE, WM);
  fillRect(dock, 1, 3, 14, 10, BR);
  fillRect(dock, 2, 4, 12, 8, BL);
  for (let y = 5; y <= 11; y += 2) fillRect(dock, 2, y, 12, 1, DI);
  fillRect(dock, 3, 2, 2, 12, DI);
  fillRect(dock, 11, 2, 2, 12, DI);
  tiles[TileId.dock] = dock;

  const concrete = createGrid(TILE_SIZE, TILE_SIZE, CC);
  for (let i = 0; i < TILE_SIZE; i++) {
    plot(concrete, i, 0, CL);
    plot(concrete, 0, i, CL);
    if (i % 4 === 0) plot(concrete, i, 8, CD);
  }
  tiles[TileId.concrete] = concrete;
  tiles[TileId.concreteDark] = createGrid(TILE_SIZE, TILE_SIZE, CD);
  for (let y = 0; y < TILE_SIZE; y += 4)
    fillRect(tiles[TileId.concreteDark]!, 0, y, TILE_SIZE, 1, AS);

  const runway = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(runway, 0, 0, 1, TILE_SIZE, CL);
  fillRect(runway, 15, 0, 1, TILE_SIZE, CD);
  for (let y = 2; y < 14; y += 5) plot(runway, 8, y, AD);
  tiles[TileId.runway] = runway;

  const runwayMark = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(runwayMark, 0, 0, 1, TILE_SIZE, CL);
  fillRect(runwayMark, 15, 0, 1, TILE_SIZE, CD);
  fillRect(runwayMark, 7, 2, 2, 12, CL);
  tiles[TileId.runwayMark] = runwayMark;

  const hangar = createGrid(TILE_SIZE, TILE_SIZE, CD);
  fillRect(hangar, 1, 2, 14, 12, OL);
  fillRect(hangar, 3, 4, 10, 9, AS);
  fillRect(hangar, 6, 4, 4, 9, K);
  fillRect(hangar, 1, 1, 14, 2, AD);
  plot(hangar, 4, 6, CL);
  plot(hangar, 11, 6, CL);
  tiles[TileId.hangar] = hangar;

  const hangarRoof = createGrid(TILE_SIZE, TILE_SIZE, AD);
  for (let y = 2; y < 14; y += 3) fillRect(hangarRoof, 1, y, 14, 1, CD);
  fillRect(hangarRoof, 0, 0, TILE_SIZE, 2, K);
  fillRect(hangarRoof, 0, 14, TILE_SIZE, 2, OL);
  tiles[TileId.hangarRoof] = hangarRoof;

  const pad = createGrid(TILE_SIZE, TILE_SIZE, CC);
  fillEllipse(pad, 8, 8, 7, 7, CD);
  fillEllipse(pad, 8, 8, 5, 5, AS);
  fillEllipse(pad, 8, 8, 2, 2, OD);
  plot(pad, 8, 8, K);
  plot(pad, 6, 6, CL);
  tiles[TileId.pad] = pad;

  const coastRoad = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(coastRoad, 0, 0, 2, TILE_SIZE, SD);
  fillRect(coastRoad, 14, 0, 2, TILE_SIZE, GD);
  fillRect(coastRoad, 7, 0, 1, TILE_SIZE, CL);
  for (let y = 3; y < 16; y += 5) plot(coastRoad, 8, y, AD);
  tiles[TileId.coastRoad] = coastRoad;

  const tree = grassTile(GD, G, GF, 5);
  fillEllipse(tree, 8, 7, 6, 5, GF);
  fillEllipse(tree, 7, 6, 4, 3, GD);
  fillEllipse(tree, 6, 5, 2, 1.4, G);
  fillRect(tree, 7, 11, 2, 3, DI);
  tiles[TileId.tree] = tree;

  const pine = grassTile(GD, G, GF, 6);
  fillPoly(
    pine,
    [
      [8, 1],
      [2, 12],
      [14, 12],
    ],
    GF
  );
  fillPoly(
    pine,
    [
      [8, 3],
      [5, 10],
      [8, 8],
    ],
    GD
  );
  fillRect(pine, 7, 12, 2, 3, DI);
  tiles[TileId.treePine] = pine;

  const rock = grassTile(GD, G, GF, 7);
  fillEllipse(rock, 8, 9, 5, 4, CD);
  fillEllipse(rock, 7, 8, 3, 2, CL);
  fillRect(rock, 10, 9, 2, 3, AD);
  tiles[TileId.rock] = rock;

  const mountain = grassTile(GF, GD, DI, 2);
  fillPoly(
    mountain,
    [
      [8, 1],
      [1, 14],
      [15, 14],
    ],
    CD
  );
  fillPoly(
    mountain,
    [
      [8, 1],
      [15, 14],
      [9, 14],
    ],
    AD
  );
  fillPoly(
    mountain,
    [
      [6, 5],
      [8, 1],
      [10, 5],
    ],
    CL
  );
  tiles[TileId.mountain] = mountain;

  const bush = grassTile(GD, G, GF, 8);
  fillEllipse(bush, 8, 9, 5, 3, GF);
  fillEllipse(bush, 6, 8, 2, 1.5, G);
  tiles[TileId.bush] = bush;

  const wall = createGrid(TILE_SIZE, TILE_SIZE, CC);
  fillRect(wall, 2, 2, 12, 12, CD);
  fillRect(wall, 3, 3, 10, 2, CL);
  fillRect(wall, 3, 11, 10, 2, AD);
  for (let i = 4; i < 12; i += 3) plot(wall, i, 7, K);
  tiles[TileId.wall] = wall;

  const gate = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(gate, 0, 0, 4, TILE_SIZE, CD);
  fillRect(gate, 12, 0, 4, TILE_SIZE, CD);
  fillRect(gate, 0, 0, 4, 2, CL);
  fillRect(gate, 12, 0, 4, 2, CL);
  fillRect(gate, 6, 4, 4, 8, AD);
  tiles[TileId.gate] = gate;

  const fortWall = createGrid(TILE_SIZE, TILE_SIZE, CD);
  for (let y = 0; y < TILE_SIZE; y += 4) {
    fillRect(fortWall, 0, y, TILE_SIZE, 1, AD);
    for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < TILE_SIZE; x += 8) plot(fortWall, x, y + 2, CL);
  }
  tiles[TileId.fortWall] = fortWall;

  const fortYard = createGrid(TILE_SIZE, TILE_SIZE, BL);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if ((x + y) % 5 === 0) fortYard[y]![x] = DI;
      if ((x * 2 + y) % 9 === 0) fortYard[y]![x] = CC;
    }
  }
  tiles[TileId.fortYard] = fortYard;

  const radar = createGrid(TILE_SIZE, TILE_SIZE, CC);
  fillRect(radar, 6, 9, 4, 6, CD);
  fillEllipse(radar, 8, 7, 5, 4, CL);
  fillEllipse(radar, 8, 7, 3, 2, CD);
  plot(radar, 7, 6, K);
  tiles[TileId.radar] = radar;

  paintLandTiles(tiles, tall);
  return tiles;
}

// ============================================================================
// 陆地A tiles (P12). Light from the top-left: highlights up-left, rims and
// cast shadows down-right. Roads, water, the forest edge and field borders are
// finished per neighbour by `art/mapRaster.ts`; the pixels here are the base.
// ============================================================================

const M = COLOR.TERRAIN_GRASS;
const ML = COLOR.TERRAIN_LIGHT_GRASS;
const MD = COLOR.TERRAIN_GREEN;
const MF = COLOR.TERRAIN_FOREST;
const MX = COLOR.TERRAIN_DARK_GREEN;
const YE = COLOR.EXPLOSION_YELLOW;
const WH = COLOR.WHITE;
const RD = COLOR.ENEMY_DARK_RED;
const RC = COLOR.ENEMY_CRIMSON;
const RM = COLOR.ENEMY_RED;
const RB = COLOR.ENEMY_BRIGHT_RED;
const WALL = COLOR.PALE_GRAY;
const WALL_D = COLOR.LIGHT_GRAY;
const GR = COLOR.GRAY;
const NV = COLOR.SHADOW;

function meadowTile(base: number, light: number, dark: number, phase: number): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, base);
  const tufts: Array<[number, number]> = [
    [2, 1],
    [9, 2],
    [13, 5],
    [5, 6],
    [11, 9],
    [1, 10],
    [7, 12],
    [14, 13],
  ];
  for (const [x, y] of tufts) {
    const xx = (x + phase * 7) % TILE_SIZE;
    const yy = (y + phase * 5) % (TILE_SIZE - 1);
    plot(g, xx, yy, light);
    plot(g, xx + 1, yy, light);
    plot(g, xx + 1, yy + 1, dark);
  }
  return g;
}

/** Tall pixels cast the top-left-light shadow onto their lower-right neighbours. */
function tallMask(width: number, height: number): boolean[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => false));
}

function overlay(
  base: SpriteData,
  mask: boolean[][],
  paint: (g: SpriteData) => void
): { pixels: SpriteData; tall: boolean[][] } {
  const layer = createGrid(base[0]!.length, base.length, -1);
  paint(layer);
  const pixels = base.map((row) => [...row]);
  for (let y = 0; y < layer.length; y++) {
    for (let x = 0; x < layer[y]!.length; x++) {
      const c = layer[y]![x]!;
      if (c < 0) continue;
      pixels[y]![x] = c;
      mask[y]![x] = true;
    }
  }
  return { pixels, tall: mask };
}

function oakTile(): { pixels: SpriteData; tall: boolean[][] } {
  return overlay(meadowTile(M, ML, MD, 3), tallMask(TILE_SIZE, TILE_SIZE), (g) => {
    fillEllipse(g, 8, 8, 6.6, 6.4, MX);
    fillEllipse(g, 7.6, 7.6, 6, 5.8, MF);
    fillEllipse(g, 6.4, 6.2, 3.8, 3.4, MD);
    fillEllipse(g, 5.4, 5, 1.8, 1.4, M);
    plot(g, 9, 4, MD);
    plot(g, 11, 7, MD);
    plot(g, 4, 9, MD);
  });
}

function firTile(): { pixels: SpriteData; tall: boolean[][] } {
  return overlay(meadowTile(M, ML, MD, 5), tallMask(TILE_SIZE, TILE_SIZE), (g) => {
    fillEllipse(g, 8, 8, 5.6, 5.6, MX);
    const spikes: Array<[number, number]> = [
      [8, 1],
      [14, 8],
      [8, 14],
      [1, 8],
      [3, 3],
      [13, 3],
      [13, 13],
      [3, 13],
    ];
    for (const [x, y] of spikes) plot(g, x, y, MX);
    fillEllipse(g, 7.5, 7.5, 4.2, 4.2, MF);
    fillEllipse(g, 7, 7, 2.6, 2.6, MD);
    plot(g, 6, 6, M);
    plot(g, 7, 6, M);
  });
}

function boulderTile(): { pixels: SpriteData; tall: boolean[][] } {
  return overlay(meadowTile(M, ML, MD, 6), tallMask(TILE_SIZE, TILE_SIZE), (g) => {
    fillEllipse(g, 8.5, 9, 6, 5, AD);
    fillEllipse(g, 8, 8.4, 5.6, 4.6, CD);
    fillEllipse(g, 7, 7.4, 4, 3.2, GR);
    fillEllipse(g, 6, 6.4, 2, 1.4, CL);
    plot(g, 10, 9, COLOR.DARK_GRAY);
    plot(g, 11, 10, COLOR.DARK_GRAY);
    fillEllipse(g, 12.5, 12.5, 1.6, 1.2, CD);
  });
}

function shedTile(): { pixels: SpriteData; tall: boolean[][] } {
  return overlay(meadowTile(M, ML, MD, 7), tallMask(TILE_SIZE, TILE_SIZE), (g) => {
    fillRect(g, 2, 3, 12, 10, DI);
    fillRect(g, 3, 4, 10, 4, BL);
    fillRect(g, 3, 8, 10, 4, BR);
    fillRect(g, 3, 7, 10, 1, DI);
    for (let x = 4; x < 13; x += 3) plot(g, x, 10, DI);
  });
}

/** One 32×32 house: pitched roof (ridge left-right), wall strip, door, chimney. */
function houseSprite(
  light: number,
  mid: number,
  dark: number,
  edge: number
): {
  pixels: SpriteData;
  tall: boolean[][];
} {
  const S = TILE_SIZE * 2;
  const base = createGrid(S, S, M);
  for (let y = 0; y < S; y += TILE_SIZE) {
    for (let x = 0; x < S; x += TILE_SIZE) {
      const t = meadowTile(M, ML, MD, (x + y) / TILE_SIZE + 1);
      for (let yy = 0; yy < TILE_SIZE; yy++) {
        for (let xx = 0; xx < TILE_SIZE; xx++) base[y + yy]![x + xx] = t[yy]![xx]!;
      }
    }
  }
  return overlay(base, tallMask(S, S), (g) => {
    fillRect(g, 3, 4, 26, 23, edge);
    fillRect(g, 4, 5, 24, 8, light);
    fillRect(g, 4, 13, 24, 8, mid);
    fillRect(g, 4, 12, 24, 1, dark);
    for (let y = 7; y < 12; y += 3) {
      for (let x = 5 + (y % 2); x < 28; x += 4) plot(g, x, y, mid);
    }
    for (let y = 15; y < 21; y += 3) {
      for (let x = 5 + (y % 2); x < 28; x += 4) plot(g, x, y, dark);
    }
    fillRect(g, 4, 21, 24, 5, WALL);
    fillRect(g, 4, 25, 24, 1, WALL_D);
    fillRect(g, 14, 22, 4, 4, DI);
    fillRect(g, 7, 22, 3, 2, NV);
    fillRect(g, 22, 22, 3, 2, NV);
    fillRect(g, 21, 6, 3, 5, CD);
    fillRect(g, 21, 6, 3, 1, CL);
    plot(g, 4, 5, edge);
    plot(g, 27, 5, edge);
  });
}

function cropGreenTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, MD);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const lane = x % 4;
      if (lane === 0) g[y]![x] = MF;
      else if (lane === 1 && (y + x) % 3 !== 0) g[y]![x] = M;
      else if (lane === 2 && y % 4 === 1) g[y]![x] = ML;
    }
  }
  return g;
}

function cropWheatTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, SD);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (x % 3 === 0) g[y]![x] = COLOR.GROUND_LIGHT_OLIVE;
      else if ((x * 7 + y * 3) % 13 === 0) g[y]![x] = YE;
    }
  }
  return g;
}

function cropPlowedTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, BR);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const band = y % 4;
      if (band === 0) g[y]![x] = BL;
      else if (band === 2) g[y]![x] = DI;
      if ((x * 5 + y) % 17 === 0) g[y]![x] = MD;
    }
  }
  return g;
}

function plazaTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, CC);
  for (let y = 0; y < TILE_SIZE; y++) {
    const shift = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
    for (let x = 0; x < TILE_SIZE; x++) {
      if (y % 4 === 3 || (x + shift) % 8 === 7) g[y]![x] = CD;
      else if (y % 4 === 0 && (x + shift) % 8 === 0) g[y]![x] = CL;
    }
  }
  return g;
}

function reedsTile(): SpriteData {
  const g = meadowTile(M, ML, MD, 4);
  const stems: Array<[number, number]> = [
    [2, 4],
    [5, 9],
    [8, 3],
    [11, 10],
    [13, 5],
    [4, 13],
    [10, 14],
  ];
  for (const [x, y] of stems) {
    plot(g, x, y, SD);
    plot(g, x, y + 1, COLOR.GROUND_MED_OLIVE);
    plot(g, x + 1, y + 1, COLOR.GROUND_LIGHT_OLIVE);
    plot(g, x, y + 2, MF);
  }
  return g;
}

function flowersTile(): SpriteData {
  const g = meadowTile(M, ML, MD, 2);
  const dots: Array<[number, number, number]> = [
    [3, 2, YE],
    [10, 4, WH],
    [6, 8, YE],
    [13, 9, WH],
    [2, 12, WH],
    [9, 13, YE],
    [14, 1, YE],
  ];
  for (const [x, y, c] of dots) {
    plot(g, x, y, c);
    plot(g, x, y + 1, MD);
  }
  return g;
}

function scorchTile(): SpriteData {
  const g = meadowTile(MX, MD, NV, 3);
  const ash: Array<[number, number]> = [
    [2, 3],
    [8, 6],
    [13, 4],
    [5, 11],
    [11, 13],
    [7, 2],
    [14, 9],
  ];
  for (const [x, y] of ash) plot(g, x, y, NV);
  plot(g, 4, 8, COLOR.EXPLOSION_ORANGE);
  plot(g, 12, 10, COLOR.GROUND_DARK_OLIVE);
  return g;
}

function craterTile(): SpriteData {
  const g = scorchTile();
  fillEllipse(g, 8, 8.5, 6.2, 5.2, DI);
  fillEllipse(g, 8, 8.2, 4.4, 3.4, AD);
  fillEllipse(g, 8, 8.4, 2.2, 1.6, K);
  fillEllipse(g, 6.2, 6.4, 1.3, 0.8, CD);
  return g;
}

function trenchTile(): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, BR);
  fillRect(g, 0, 0, TILE_SIZE, 3, BL);
  fillRect(g, 0, 3, TILE_SIZE, 10, DI);
  fillRect(g, 0, 6, TILE_SIZE, 4, NV);
  fillRect(g, 0, 13, TILE_SIZE, 3, AD);
  for (let x = 2; x < TILE_SIZE; x += 4) plot(g, x, 8, K);
  return g;
}

function wreckTile(): { pixels: SpriteData; tall: boolean[][] } {
  return overlay(scorchTile(), tallMask(TILE_SIZE, TILE_SIZE), (g) => {
    fillRect(g, 2, 8, 12, 3, AD);
    fillRect(g, 3, 6, 7, 2, CD);
    fillRect(g, 10, 4, 3, 6, GR);
    fillRect(g, 4, 10, 5, 2, DI);
    plot(g, 5, 8, COLOR.ENEMY_DARK_RED);
    plot(g, 11, 5, CL);
  });
}

function snagTile(): { pixels: SpriteData; tall: boolean[][] } {
  return overlay(scorchTile(), tallMask(TILE_SIZE, TILE_SIZE), (g) => {
    fillRect(g, 7, 5, 2, 8, DI);
    fillRect(g, 6, 13, 4, 2, AD);
    plot(g, 5, 7, K);
    plot(g, 10, 6, K);
    plot(g, 4, 5, DI);
    plot(g, 11, 4, DI);
    plot(g, 8, 3, NV);
  });
}

function paintLandTiles(tiles: SpriteData[], tall: Array<boolean[][] | null>): void {
  tiles[TileId.meadow] = meadowTile(M, ML, MD, 0);
  tiles[TileId.meadowB] = meadowTile(M, ML, MD, 1);
  tiles[TileId.meadowDark] = meadowTile(MD, M, MF, 2);
  tiles[TileId.flowers] = flowersTile();
  tiles[TileId.reeds] = reedsTile();
  tiles[TileId.scorch] = scorchTile();
  tiles[TileId.crater] = craterTile();
  tiles[TileId.trench] = trenchTile();
  tiles[TileId.plaza] = plazaTile();
  tiles[TileId.cropGreen] = cropGreenTile();
  tiles[TileId.cropWheat] = cropWheatTile();
  tiles[TileId.cropPlowed] = cropPlowedTile();
  // Finished per neighbour in the raster; these are their stand-alone looks.
  tiles[TileId.road] = dirtPath(true);
  tiles[TileId.street] = createGrid(TILE_SIZE, TILE_SIZE, AS);
  tiles[TileId.lake] = createGrid(TILE_SIZE, TILE_SIZE, WO);
  tiles[TileId.bridge] = dirtPath(true);
  tiles[TileId.forest] = createGrid(TILE_SIZE, TILE_SIZE, MF);

  const sprites: Array<[TileId, { pixels: SpriteData; tall: boolean[][] }]> = [
    [TileId.oak, oakTile()],
    [TileId.fir, firTile()],
    [TileId.boulder, boulderTile()],
    [TileId.shed, shedTile()],
    [TileId.wreck, wreckTile()],
    [TileId.snag, snagTile()],
  ];
  for (const [id, art] of sprites) {
    tiles[id] = art.pixels;
    tall[id] = art.tall;
  }

  const houses: Array<[readonly [TileId, TileId, TileId, TileId], ReturnType<typeof houseSprite>]> =
    [
      [HOUSE_RED, houseSprite(RB, RM, RC, RD)],
      [HOUSE_BROWN, houseSprite(BL, BR, DI, COLOR.GROUND_DARK_OLIVE)],
    ];
  for (const [ids, art] of houses) {
    // ids: screen top-left, top-right, bottom-left, bottom-right
    ids.forEach((id, q) => {
      const ox = (q % 2) * TILE_SIZE;
      const oy = Math.floor(q / 2) * TILE_SIZE;
      tiles[id] = art.pixels.slice(oy, oy + TILE_SIZE).map((row) => row.slice(ox, ox + TILE_SIZE));
      tall[id] = art.tall.slice(oy, oy + TILE_SIZE).map((row) => row.slice(ox, ox + TILE_SIZE));
    });
  }
}

/** Screen quadrants of a 2×2 house: top-left, top-right, bottom-left, bottom-right. */
export const HOUSE_RED = [
  TileId.houseRedTL,
  TileId.houseRedTR,
  TileId.houseRedBL,
  TileId.houseRedBR,
] as const;
export const HOUSE_BROWN = [
  TileId.houseBrownTL,
  TileId.houseBrownTR,
  TileId.houseBrownBL,
  TileId.houseBrownBR,
] as const;

let tilePixels: SpriteData[] | null = null;
let tileTall: Array<boolean[][] | null> | null = null;

export function getTilePixels(): SpriteData[] {
  if (!tilePixels) {
    tileTall = Array.from({ length: TILE_COUNT }, () => null);
    tilePixels = paintTiles(tileTall);
  }
  return tilePixels;
}

/**
 * Per-tile mask of pixels that stand up off the ground (canopies, roofs,
 * boulders). The raster casts their shadow down-right. Null = flat tile.
 */
export function getTileTallMasks(): ReadonlyArray<boolean[][] | null> {
  getTilePixels();
  return tileTall!;
}

export function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

export interface Star {
  x: number;
  y: number;
  layer: 0 | 1 | 2;
}

/** Seeded starfield. Effects may use alpha; positions are stable. */
export function buildStars(count = 56): Star[] {
  const stars: Star[] = [];
  let seed = 0x51ed1;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const layer = (i % 3) as 0 | 1 | 2;
    stars.push({
      x: rand() * 360,
      y: rand() * (LOGICAL_H + 80),
      layer,
    });
  }
  return stars;
}
