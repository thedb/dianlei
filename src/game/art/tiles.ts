/**
 * Stage 1 scrolling tiles. 16×16 palette art, three sections.
 * Map is 23 tiles (368px) wide and drawn at x = -4 so the 360-wide screen
 * crops 4px from each side (design doc §3.7).
 */

import { COLOR, PALETTE } from '@/game/palette';
import {
  BG_SCROLL_SPEED,
  LOGICAL_H,
  MAP_CROP_X,
  MAP_TILES_X,
  SECTION_BASE_END,
  SECTION_BLEND_LEAD,
  SECTION_BLEND_TAIL,
  SECTION_COAST_END,
  SECTION_GROUND_END,
  TILE_SIZE,
  warningTileScrollPx,
} from '@/game/config';
import type { ScrollFrame } from '@/game/systems/background';
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
} as const;

export type TileId = (typeof TileId)[keyof typeof TileId];

const TILE_COUNT = 33;

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

function paintTiles(): SpriteData[] {
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

  return tiles;
}

function clampCol(n: number): number {
  return Math.max(1, Math.min(MAP_TILES_X - 2, n));
}

function roadCol(y: number): number {
  const sway = Math.sin(y * 0.11) * 4.2 + Math.sin(y * 0.037 + 1.3) * 2.1;
  return clampCol(Math.round(11 + sway));
}

function riverCenter(y: number): number {
  const sway = Math.sin(y * 0.07) * 5 + Math.sin(y * 0.021 + 2) * 2;
  return clampCol(Math.round(11 + sway));
}

function paintPath(grid: TileId[][]): void {
  const rows = grid.length;
  let prev = roadCol(0);
  for (let y = 0; y < rows; y++) {
    const col = roadCol(y);
    const row = grid[y]!;
    if (col === prev) {
      row[col] = TileId.roadV;
    } else {
      const a = Math.min(prev, col);
      const b = Math.max(prev, col);
      for (let x = a; x <= b; x++) row[x] = TileId.roadH;
      row[prev] = TileId.dirt;
      row[col] = TileId.roadV;
    }
    prev = col;
  }
}

function paintRiver(grid: TileId[][], y: number, x0: number, x1: number): void {
  const row = grid[y];
  if (!row) return;
  for (let x = x0; x <= x1; x++) {
    if (x < 0 || x >= MAP_TILES_X) continue;
    const edge = x === x0 || x === x1;
    row[x] = edge
      ? hash(x, y) % 3 === 0
        ? TileId.shallow
        : TileId.waterB
      : hash(x, y) % 4 === 0
        ? TileId.waterB
        : TileId.water;
  }
}

function stampFort(grid: TileId[][], cx: number, cy: number): void {
  const rows = grid.length;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (y < 0 || y >= rows || x < 0 || x >= MAP_TILES_X) continue;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const cell =
        ax === 3 && ay === 3
          ? TileId.bunker
          : ax === 3 || ay === 3
            ? TileId.fortWall
            : dx === 0 && dy === 0
              ? TileId.bunker
              : TileId.fortYard;
      grid[y]![x] = cell;
    }
  }
}

/** Ground: forest, a winding dirt track, hut camps, edge peaks. */
export function buildGroundMap(rows: number): TileId[][] {
  const grid = emptyGrid(rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const h = hash(x, y);
      const clump = hash(x >> 1, y >> 1);
      const edge = x <= 1 || x >= MAP_TILES_X - 2;
      let id: TileId = h % 6 === 0 ? TileId.grassB : h % 8 === 0 ? TileId.grassDark : TileId.grass;
      if (edge && h % 4 !== 0) id = h % 3 === 0 ? TileId.rock : TileId.mountain;
      else if (clump % 4 === 0) id = h % 5 === 0 ? TileId.treePine : TileId.tree;
      else if (h % 17 === 0) id = TileId.bush;
      else if (h % 23 === 0) id = TileId.rock;
      grid[y]![x] = id;
    }
  }
  paintPath(grid);
  for (let i = 0; i < rows; i += 28) {
    const y = i + 14;
    if (y + 3 >= rows) break;
    const road = roadCol(y);
    const x = road < 11 ? Math.min(MAP_TILES_X - 6, road + 5) : Math.max(1, road - 8);
    stamp(grid, x, y, 5, 4, TileId.grass);
    stamp(grid, x, y, 4, 3, TileId.barracks);
    stamp(grid, x + (road < 11 ? -2 : 4), y + 1, 2, 2, TileId.bunker);
  }
  const blendRows = 8;
  for (let y = Math.max(0, rows - blendRows); y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const id = grid[y]![x];
      if (id === TileId.roadV || id === TileId.roadH || id === TileId.roadX || id === TileId.dirt) {
        continue;
      }
      if ((x + y) % 2 === 0) grid[y]![x] = TileId.sand;
    }
  }
  return grid;
}

function fortBand(y: number): boolean {
  return [36, 96, 150].some((c) => Math.abs(y - c) <= 7);
}

/** Coast: a winding river, bridges, and stone forts on the islands it splits around. */
export function buildCoastMap(rows: number): TileId[][] {
  const grid = emptyGrid(rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const h = hash(x + 9, y + 3);
      const clump = hash((x + 2) >> 1, y >> 1);
      let id: TileId = h % 7 === 0 ? TileId.grassB : TileId.grass;
      if (x === 0 || x === MAP_TILES_X - 1) id = h % 2 === 0 ? TileId.mountain : TileId.rock;
      else if (clump % 5 === 0) id = TileId.tree;
      else if (h % 19 === 0) id = TileId.bush;
      grid[y]![x] = id;
    }
  }
  for (let y = 0; y < rows; y++) {
    if (fortBand(y)) {
      paintRiver(grid, y, 1, 5);
      paintRiver(grid, y, MAP_TILES_X - 6, MAP_TILES_X - 2);
    } else {
      const c = riverCenter(y);
      paintRiver(grid, y, c - 2, c + 2);
      for (const x of [c - 3, c + 3]) {
        if (x < 0 || x >= MAP_TILES_X) continue;
        const id = grid[y]![x];
        if (id === TileId.grass || id === TileId.grassB || id === TileId.tree) {
          grid[y]![x] = TileId.sand;
        }
      }
    }
  }
  for (const y of [18, 58, 78, 120]) {
    if (y + 1 >= rows || fortBand(y)) continue;
    const c = riverCenter(y);
    for (let x = c - 2; x <= c + 2; x++) {
      grid[y]![x] = TileId.dock;
      grid[y + 1]![x] = TileId.dock;
    }
  }
  for (const cy of [36, 96, 150]) {
    if (cy >= 3 && cy < rows - 3) stampFort(grid, 11, cy);
  }
  for (let y = 0; y < rows; y++) {
    if (fortBand(y)) continue;
    const x = clampCol(riverCenter(y) + 6);
    const id = grid[y]![x];
    if (id === TileId.grass || id === TileId.grassB || id === TileId.sand || id === TileId.bush) {
      grid[y]![x] = TileId.coastRoad;
    }
  }
  const top = Math.min(6, rows);
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const id = grid[y]![x];
      if (id === TileId.water || id === TileId.waterB || id === TileId.shallow) continue;
      if ((x + y) % 2 === 0) grid[y]![x] = TileId.sand;
    }
  }
  const blend = 8;
  for (let y = Math.max(0, rows - blend); y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const id = grid[y]![x];
      if (id === TileId.water || id === TileId.waterB || id === TileId.dock) continue;
      if ((x + y) % 3 !== 0) grid[y]![x] = TileId.concrete;
    }
  }
  return grid;
}

/** Base: perimeter wall, runway, hangar rows, pads, then mountains outside the fence. */
export function buildBaseMap(rows: number): TileId[][] {
  const grid = emptyGrid(rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const h = hash(x, y + 9);
      const outside = x === 0 || x === MAP_TILES_X - 1 || y === 0 || y === rows - 1;
      const wallLine = x === 1 || x === MAP_TILES_X - 2 || y === 2 || y === rows - 3;
      if (outside) {
        grid[y]![x] = h % 2 === 0 ? TileId.mountain : TileId.grassDark;
      } else if (y === 2 && x >= 9 && x <= 13) {
        grid[y]![x] = x === 9 || x === 13 ? TileId.wall : TileId.gate;
      } else if (wallLine) {
        grid[y]![x] = TileId.wall;
      } else {
        grid[y]![x] = h % 9 === 0 ? TileId.concreteDark : TileId.concrete;
      }
    }
  }
  if (rows > 8) stamp(grid, 3, 4, 2, 2, TileId.radar);
  const runwayEnd = Math.max(4, rows - 4);
  for (let y = 4; y < runwayEnd; y++) {
    for (let x = 9; x <= 13; x++) grid[y]![x] = TileId.runway;
    if (y % 2 === 0) grid[y]![11] = TileId.runwayMark;
  }
  for (let y = 8; y + 3 < rows - 6; y += 26) {
    stamp(grid, 3, y, 4, 1, TileId.hangarRoof);
    stamp(grid, 3, y + 1, 4, 2, TileId.hangar);
    const rightY = y + 12;
    if (rightY + 3 < rows - 6) {
      stamp(grid, 16, rightY, 4, 1, TileId.hangarRoof);
      stamp(grid, 16, rightY + 1, 4, 2, TileId.hangar);
    }
  }
  for (let y = 18; y + 2 < rows - 6; y += 24) {
    stamp(grid, 7, y, 2, 2, TileId.pad);
    stamp(grid, 15, y, 2, 2, TileId.pad);
  }
  const top = Math.min(2, rows);
  for (let y = 0; y < top; y++) {
    for (let x = 2; x < MAP_TILES_X - 2; x++) {
      if ((x + y) % 2 === 0) grid[y]![x] = TileId.sand;
    }
  }
  return grid;
}

let tilePixels: SpriteData[] | null = null;

export function getTilePixels(): SpriteData[] {
  if (!tilePixels) tilePixels = paintTiles();
  return tilePixels;
}

function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

export interface MapLayerSpec {
  id: 'ground' | 'coast' | 'base';
  /**
   * World scroll (px) at which this map's logical y=0 sits on the bottom of the screen.
   * Later rows are ahead of the ship and enter from the top.
   */
  origin: number;
  rows: number;
}

/** How tall each section bitmap is, including the warning overrun on the base. */
export function mapLayerSpecs(): Record<'ground' | 'coast' | 'base', MapLayerSpec> {
  const groundEnd = SECTION_GROUND_END + SECTION_BLEND_TAIL;
  const coastStart = SECTION_GROUND_END - SECTION_BLEND_LEAD;
  const coastEnd = SECTION_COAST_END + SECTION_BLEND_TAIL;
  const baseStart = SECTION_COAST_END - SECTION_BLEND_LEAD;
  const rowsFor = (startSec: number, endSec: number, extraPx: number) =>
    Math.ceil(((endSec - startSec) * BG_SCROLL_SPEED + LOGICAL_H + extraPx) / TILE_SIZE);

  return {
    ground: {
      id: 'ground',
      origin: 0,
      rows: rowsFor(0, groundEnd, 0),
    },
    coast: {
      id: 'coast',
      origin: coastStart * BG_SCROLL_SPEED,
      rows: rowsFor(coastStart, coastEnd, 0),
    },
    base: {
      id: 'base',
      origin: baseStart * BG_SCROLL_SPEED,
      rows: rowsFor(baseStart, SECTION_BASE_END, warningTileScrollPx()),
    },
  };
}

function stamp(grid: TileId[][], x: number, y: number, w: number, h: number, id: TileId): void {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let yy = y; yy < y + h; yy++) {
    if (yy < 0 || yy >= rows) continue;
    const row = grid[yy]!;
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || xx >= cols) continue;
      row[xx] = id;
    }
  }
}

function emptyGrid(rows: number): TileId[][] {
  const grid: TileId[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: TileId[] = [];
    for (let x = 0; x < MAP_TILES_X; x++) row.push(TileId.grass);
    grid.push(row);
  }
  return grid;
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

export interface BackgroundMaps {
  ground: OffscreenCanvas | HTMLCanvasElement;
  coast: OffscreenCanvas | HTMLCanvasElement;
  base: OffscreenCanvas | HTMLCanvasElement;
  grids: {
    ground: TileId[][];
    coast: TileId[][];
    base: TileId[][];
  };
  stars: Star[];
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const RGB = PALETTE.map((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
});

export function renderTileGrid(grid: TileId[][]): OffscreenCanvas | HTMLCanvasElement {
  const tiles = getTilePixels();
  const rows = grid.length;
  const cols = MAP_TILES_X;
  const w = cols * TILE_SIZE;
  const h = rows * TILE_SIZE;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context for tile map');
  const image = ctx.createImageData(w, h);
  const px = image.data;
  for (let ty = 0; ty < rows; ty++) {
    const row = grid[ty]!;
    for (let tx = 0; tx < cols; tx++) {
      const tile = tiles[row[tx]!]!;
      const originX = tx * TILE_SIZE;
      // Logical row 0 is the start of the section and is stored at the bottom of the
      // bitmap, each tile still upright. Blitting toward y=0 then brings new terrain
      // in from the top of the screen and slides the field downward.
      const originY = (rows - 1 - ty) * TILE_SIZE;
      for (let y = 0; y < TILE_SIZE; y++) {
        const src = tile[y]!;
        const diBase = ((originY + y) * w + originX) * 4;
        for (let x = 0; x < TILE_SIZE; x++) {
          const rgb = RGB[src[x]!]!;
          const di = diBase + x * 4;
          px[di] = rgb[0];
          px[di + 1] = rgb[1];
          px[di + 2] = rgb[2];
          px[di + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

let cachedMaps: BackgroundMaps | null = null;
let cachedGrids: TerrainGrids | null = null;

/** Stage 1 tile grids without rendering. Same objects the background bitmaps are drawn from. */
export function getStageGrids(): TerrainGrids {
  if (cachedGrids) return cachedGrids;
  const specs = mapLayerSpecs();
  cachedGrids = {
    ground: buildGroundMap(specs.ground.rows),
    coast: buildCoastMap(specs.coast.rows),
    base: buildBaseMap(specs.base.rows),
  };
  return cachedGrids;
}

export function createBackgroundMaps(): BackgroundMaps {
  if (cachedMaps) return cachedMaps;
  const grids = getStageGrids();
  cachedMaps = {
    ground: renderTileGrid(grids.ground),
    coast: renderTileGrid(grids.coast),
    base: renderTileGrid(grids.base),
    grids,
    stars: buildStars(),
  };
  return cachedMaps;
}

interface Cloud {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

const CLOUDS: readonly Cloud[] = [
  { x: 50, y: 40, rx: 78, ry: 16 },
  { x: 180, y: 120, rx: 96, ry: 18 },
  { x: 300, y: 70, rx: 70, ry: 14 },
  { x: 120, y: 220, rx: 110, ry: 20 },
  { x: 250, y: 300, rx: 80, ry: 15 },
  { x: 40, y: 380, rx: 90, ry: 16 },
  { x: 200, y: 460, rx: 120, ry: 18 },
  { x: 320, y: 520, rx: 64, ry: 14 },
];

/**
 * Screen Y of an upright logical map pixel.
 * `scroll` 0 puts logical y=0 at the bottom of the view. Increasing `scroll`
 * moves that pixel downward; pixels ahead of it enter from the top.
 */
export function mapPixelScreenY(logicalY: number, scroll: number, viewH = LOGICAL_H): number {
  const row = Math.floor(logicalY / TILE_SIZE);
  const inTile = logicalY - row * TILE_SIZE;
  return scroll + viewH - (row + 1) * TILE_SIZE + inTile;
}

/** Inverse of `mapPixelScreenY` for a layer-local scroll (world scroll minus the layer origin). */
export function logicalMapY(screenY: number, localScroll: number, viewH = LOGICAL_H): number {
  const rel = localScroll + viewH - screenY;
  if (rel <= 0) return -1;
  const row = Math.ceil(rel / TILE_SIZE) - 1;
  const inTile = (row + 1) * TILE_SIZE - rel;
  return row * TILE_SIZE + inTile;
}

export function logicalMapX(screenX: number): number {
  return screenX + MAP_CROP_X;
}

/**
 * Source Y into a row-reversed section bitmap.
 * Logical scroll 0 shows the start of the section (bottom of the bitmap).
 * Larger scroll moves the window up the bitmap, which slides the field down the screen.
 */
export function scrollSourceY(mapHeight: number, logicalScroll: number, viewH = LOGICAL_H): number {
  const maxY = Math.max(0, mapHeight - viewH);
  const sy = maxY - Math.floor(logicalScroll);
  if (sy < 0) return 0;
  if (sy > maxY) return maxY;
  return sy;
}

const WATER_TILES: ReadonlySet<TileId> = new Set([TileId.water, TileId.waterB, TileId.shallow]);

export function isWaterTile(id: TileId): boolean {
  return WATER_TILES.has(id);
}

export interface TerrainGrids {
  ground: TileId[][];
  coast: TileId[][];
  base: TileId[][];
}

/** Later section wins a crossfade tie so coast water applies as soon as the river is visible. */
export function dominantTerrain(fade: {
  ground: number;
  coast: number;
  base: number;
}): 'ground' | 'coast' | 'base' | null {
  let best: 'ground' | 'coast' | 'base' | null = null;
  let bestA = 0.05;
  const layers = [
    ['ground', fade.ground],
    ['coast', fade.coast],
    ['base', fade.base],
  ] as const;
  for (const [id, alpha] of layers) {
    if (alpha >= bestA) {
      best = id;
      bestA = alpha;
    }
  }
  return best;
}

/** True when a tank center sits on river / shallow water. Off-map is land (not blocked). */
export function terrainBlocksTank(
  grids: TerrainGrids,
  scroll: number,
  fade: { ground: number; coast: number; base: number },
  x: number,
  y: number
): boolean {
  const layer = dominantTerrain(fade);
  if (!layer) return false;
  const spec = mapLayerSpecs()[layer];
  const mapY = logicalMapY(y, scroll - spec.origin);
  const mapX = logicalMapX(x);
  if (mapY < 0) return false;
  const col = Math.floor(mapX / TILE_SIZE);
  const row = Math.floor(mapY / TILE_SIZE);
  const grid = grids[layer];
  const line = grid[row];
  if (!line || col < 0 || col >= line.length) return false;
  return isWaterTile(line[col]!);
}

function blitMap(
  ctx: CanvasRenderingContext2D,
  map: OffscreenCanvas | HTMLCanvasElement,
  logicalScroll: number,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  const sy = scrollSourceY(map.height, logicalScroll);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(map, 0, sy, map.width, LOGICAL_H, -MAP_CROP_X, 0, map.width, LOGICAL_H);
  ctx.restore();
}

/**
 * Draw the scrolling field, then clouds and stars when the warning fade asks for them.
 * `frame.scroll` is the world scroll in pixels.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  maps: BackgroundMaps,
  frame: ScrollFrame,
  time: number
): void {
  const specs = mapLayerSpecs();
  const { fade } = frame;
  blitMap(ctx, maps.ground, frame.scroll - specs.ground.origin, fade.ground);
  blitMap(ctx, maps.coast, frame.scroll - specs.coast.origin, fade.coast);
  blitMap(ctx, maps.base, frame.scroll - specs.base.origin, fade.base);

  if (fade.clouds > 0.01) {
    const drift = time * 70;
    ctx.globalAlpha = fade.clouds * 0.85;
    ctx.fillStyle = 'rgba(210, 220, 230, 0.9)';
    for (const cloud of CLOUDS) {
      const y = ((cloud.y + drift) % (LOGICAL_H + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(cloud.x, y, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (fade.stars > 0.01) {
    ctx.globalAlpha = fade.stars;
    for (const star of maps.stars) {
      const speedScroll = frame.starScroll[star.layer];
      const y = (star.y + speedScroll) % (LOGICAL_H + 40);
      const size = star.layer === 2 ? 2 : 1;
      ctx.fillStyle = star.layer === 0 ? 'rgba(180, 190, 210, 0.7)' : 'rgba(245, 248, 255, 0.95)';
      ctx.fillRect(Math.floor(star.x), Math.floor(y), size, size);
    }
  }

  ctx.globalAlpha = 1;
}
