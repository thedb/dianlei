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
import { createGrid, fillEllipse, fillRect, plot } from './pixelDraw';
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
} as const;

export type TileId = (typeof TileId)[keyof typeof TileId];

const TILE_COUNT = 20;

function solid(color: number, speck: number, speckEvery: number): SpriteData {
  const g = createGrid(TILE_SIZE, TILE_SIZE, color);
  for (let y = 1; y < TILE_SIZE; y += speckEvery) {
    const x = (y * 3) % (TILE_SIZE - 2);
    plot(g, x + 1, y, speck);
  }
  return g;
}

function paintTiles(): SpriteData[] {
  const tiles: SpriteData[] = Array.from({ length: TILE_COUNT }, () =>
    createGrid(TILE_SIZE, TILE_SIZE, 0)
  );
  tiles[TileId.grass] = solid(G, GL, 5);
  tiles[TileId.grassDark] = solid(GD, GF, 4);
  const dirt = solid(BR, BL, 5);
  plot(dirt, 4, 4, DI);
  plot(dirt, 11, 9, DI);
  tiles[TileId.dirt] = dirt;

  const roadV = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(roadV, 0, 0, 2, TILE_SIZE, CL);
  fillRect(roadV, 14, 0, 2, TILE_SIZE, CD);
  fillRect(roadV, 7, 0, 2, TILE_SIZE, AD);
  tiles[TileId.roadV] = roadV;

  const roadH = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(roadH, 0, 0, TILE_SIZE, 2, CL);
  fillRect(roadH, 0, 14, TILE_SIZE, 2, CD);
  fillRect(roadH, 0, 7, TILE_SIZE, 2, AD);
  tiles[TileId.roadH] = roadH;

  const roadX = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(roadX, 0, 0, TILE_SIZE, 2, CL);
  fillRect(roadX, 0, 14, TILE_SIZE, 2, CD);
  fillRect(roadX, 0, 0, 2, TILE_SIZE, CL);
  fillRect(roadX, 14, 0, 2, TILE_SIZE, CD);
  tiles[TileId.roadX] = roadX;

  const barracks = createGrid(TILE_SIZE, TILE_SIZE, OL);
  fillRect(barracks, 0, 0, TILE_SIZE, 5, BR);
  fillRect(barracks, 0, 5, TILE_SIZE, 1, DI);
  fillRect(barracks, 2, 8, 3, 3, AD);
  fillRect(barracks, 11, 8, 3, 3, AD);
  fillRect(barracks, 6, 12, 4, 4, OD);
  tiles[TileId.barracks] = barracks;

  const bunker = createGrid(TILE_SIZE, TILE_SIZE, DI);
  fillEllipse(bunker, 8, 9, 6, 5, BR);
  fillEllipse(bunker, 8, 9, 3, 2, AD);
  fillRect(bunker, 7, 8, 2, 2, K);
  tiles[TileId.bunker] = bunker;

  tiles[TileId.water] = solid(WO, WD, 4);
  const shallow = solid(WM, WS, 5);
  tiles[TileId.shallow] = shallow;
  tiles[TileId.sand] = solid(SD, BL, 5);

  const shore = createGrid(TILE_SIZE, TILE_SIZE, SD);
  fillRect(shore, 0, 0, 5, TILE_SIZE, WS);
  fillRect(shore, 5, 0, 2, TILE_SIZE, WF);
  tiles[TileId.shore] = shore;

  const dock = createGrid(TILE_SIZE, TILE_SIZE, WM);
  fillRect(dock, 2, 0, 12, TILE_SIZE, BR);
  fillRect(dock, 4, 0, 2, TILE_SIZE, DI);
  fillRect(dock, 10, 0, 2, TILE_SIZE, DI);
  for (let y = 2; y < 16; y += 4) fillRect(dock, 2, y, 12, 1, BL);
  tiles[TileId.dock] = dock;

  tiles[TileId.concrete] = solid(CC, CL, 6);
  tiles[TileId.concreteDark] = solid(CD, AS, 6);

  const runway = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(runway, 0, 0, 1, TILE_SIZE, CL);
  fillRect(runway, 15, 0, 1, TILE_SIZE, CL);
  tiles[TileId.runway] = runway;

  const runwayMark = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(runwayMark, 0, 0, 1, TILE_SIZE, CL);
  fillRect(runwayMark, 15, 0, 1, TILE_SIZE, CL);
  fillRect(runwayMark, 7, 2, 2, 10, CL);
  tiles[TileId.runwayMark] = runwayMark;

  const hangar = createGrid(TILE_SIZE, TILE_SIZE, CD);
  fillRect(hangar, 0, 0, TILE_SIZE, 6, AD);
  fillRect(hangar, 1, 6, 14, 1, CL);
  fillRect(hangar, 3, 9, 10, 6, AS);
  fillRect(hangar, 7, 9, 2, 6, K);
  tiles[TileId.hangar] = hangar;

  const pad = createGrid(TILE_SIZE, TILE_SIZE, CC);
  fillEllipse(pad, 8, 8, 6, 6, CD);
  fillEllipse(pad, 8, 8, 3, 3, AS);
  plot(pad, 8, 8, K);
  tiles[TileId.pad] = pad;

  const coastRoad = createGrid(TILE_SIZE, TILE_SIZE, AS);
  fillRect(coastRoad, 0, 0, 2, TILE_SIZE, SD);
  fillRect(coastRoad, 14, 0, 2, TILE_SIZE, GD);
  fillRect(coastRoad, 7, 0, 1, TILE_SIZE, CL);
  tiles[TileId.coastRoad] = coastRoad;

  return tiles;
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
  /** World scroll (px) at which this map's y=0 sits on the top of the screen */
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

function fillAll(grid: TileId[][], id: TileId): void {
  for (const row of grid) row.fill(id);
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

/** Ground: grass, a vertical highway, crossroads, barracks, tank berms. */
export function buildGroundMap(rows: number): TileId[][] {
  const grid = emptyGrid(rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      const h = hash(x, y);
      grid[y]![x] = h % 11 === 0 ? TileId.grassDark : TileId.grass;
      if (h % 29 === 0) grid[y]![x] = TileId.dirt;
    }
  }
  stamp(grid, 5, 0, 3, rows, TileId.roadV);
  for (const y of [18, 52, 86, 120, 150]) {
    if (y < rows) stamp(grid, 0, y, MAP_TILES_X, 2, TileId.roadH);
    if (y < rows) stamp(grid, 5, y, 3, 2, TileId.roadX);
  }
  const buildings: Array<[number, number]> = [
    [10, 12],
    [15, 36],
    [9, 64],
    [16, 98],
    [11, 132],
  ];
  for (const [x, y] of buildings) stamp(grid, x, y, 4, 3, TileId.barracks);
  const berms: Array<[number, number]> = [
    [3, 28],
    [9, 44],
    [2, 74],
    [9, 108],
    [3, 142],
  ];
  for (const [x, y] of berms) stamp(grid, x, y, 2, 2, TileId.bunker);
  // Sand creeps in at the bottom so the coast crossfade has something to meet.
  const blendRows = 8;
  for (let y = Math.max(0, rows - blendRows); y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      if (grid[y]![x] === TileId.roadV || grid[y]![x] === TileId.roadX) continue;
      if ((x + y) % 2 === 0) grid[y]![x] = TileId.sand;
    }
  }
  return grid;
}

/** Coast: river on the left, beach, docks, coastal highway. */
export function buildCoastMap(rows: number): TileId[][] {
  const grid = emptyGrid(rows);
  fillAll(grid, TileId.grass);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x <= 6; x++) grid[y]![x] = x >= 5 ? TileId.shallow : TileId.water;
    grid[y]![7] = TileId.shore;
    grid[y]![8] = TileId.sand;
    grid[y]![9] = TileId.sand;
    if (hash(3, y) % 9 === 0) grid[y]![4] = TileId.shallow;
  }
  stamp(grid, 16, 0, 3, rows, TileId.coastRoad);
  for (const y of [16, 48, 88, 124]) {
    stamp(grid, 4, y, 7, 2, TileId.dock);
    stamp(grid, 10, y, 6, 2, TileId.sand);
  }
  for (const [x, y] of [
    [11, 24],
    [12, 60],
    [11, 100],
    [13, 136],
  ] as Array<[number, number]>) {
    stamp(grid, x, y, 3, 2, TileId.barracks);
  }
  const top = Math.min(6, rows);
  for (let y = 0; y < top; y++) {
    for (let x = 10; x < MAP_TILES_X; x++) {
      if (grid[y]![x] !== TileId.coastRoad) grid[y]![x] = TileId.sand;
    }
  }
  const blend = 8;
  for (let y = Math.max(0, rows - blend); y < rows; y++) {
    for (let x = 8; x < MAP_TILES_X; x++) {
      if ((x + y) % 3 !== 0) grid[y]![x] = TileId.concrete;
    }
  }
  return grid;
}

/** Base: concrete apron, runway, hangars, turret pads. */
export function buildBaseMap(rows: number): TileId[][] {
  const grid = emptyGrid(rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      grid[y]![x] = hash(x, y + 9) % 8 === 0 ? TileId.concreteDark : TileId.concrete;
    }
  }
  stamp(grid, 8, 0, 7, rows, TileId.runway);
  for (let y = 0; y < rows; y++) {
    if (y % 2 === 0) grid[y]![11] = TileId.runwayMark;
  }
  for (const y of [8, 40, 78, 116, 154]) {
    stamp(grid, 1, y, 5, 4, TileId.hangar);
    stamp(grid, 17, y + 10, 5, 4, TileId.hangar);
  }
  for (const [x, y] of [
    [3, 22],
    [18, 48],
    [4, 70],
    [19, 104],
    [3, 132],
    [18, 160],
  ] as Array<[number, number]>) {
    stamp(grid, x, y, 2, 2, TileId.pad);
  }
  const top = Math.min(8, rows);
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < MAP_TILES_X; x++) {
      if (grid[y]![x] === TileId.runway || grid[y]![x] === TileId.runwayMark) continue;
      if ((x + y) % 2 === 0) grid[y]![x] = TileId.sand;
    }
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
      const originY = ty * TILE_SIZE;
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

export function createBackgroundMaps(): BackgroundMaps {
  if (cachedMaps) return cachedMaps;
  const specs = mapLayerSpecs();
  const grids = {
    ground: buildGroundMap(specs.ground.rows),
    coast: buildCoastMap(specs.coast.rows),
    base: buildBaseMap(specs.base.rows),
  };
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

function blitMap(
  ctx: CanvasRenderingContext2D,
  map: OffscreenCanvas | HTMLCanvasElement,
  sourceY: number,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  const viewH = LOGICAL_H;
  const maxY = Math.max(0, map.height - viewH);
  const sy = Math.max(0, Math.min(maxY, Math.floor(sourceY)));
  ctx.globalAlpha = alpha;
  ctx.drawImage(map, 0, sy, map.width, viewH, -MAP_CROP_X, 0, map.width, viewH);
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
