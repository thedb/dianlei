/**
 * Map strip raster (P12): turns rows of a tile grid into palette indices.
 * Pure (no canvas), so tests can read pixels.
 *
 * Legacy tiles (ids below `TileId.meadow`) are copied as is. 陆地A tiles, and
 * the same tiles on 陆地B / 河流A, are finished per neighbour:
 * - roads / streets get a band that joins the neighbouring road tiles,
 * - lake water shades from foam to deep by distance to the shore, and land
 *   next to it gets a sand rim,
 * - bridges are a plank deck over that water,
 * - forest canopy gets a ragged rim where it meets open ground,
 * - crop plots get a lit top-left and shaded bottom-right border,
 * - 炉心浮台 harbor tiles: dry-dock pits get stepped walls toward the yard,
 *   barge hulls get an outline with a rounded bow and flooded deck patches,
 *   pads get a lit coping, mud gets puddles, the quay mirrors on the right
 *   bank, and booms / the crane foot / pilings / scrap sit on the ground or
 *   water around them.
 * Then every tall pixel (canopy, roof, deck, boulder) casts a shadow
 * `SHADOW_OFFSET` px down-right through the palette `SHADE` ramp.
 */

import { TILE_SIZE } from '@/game/config';
import { COLOR } from '@/game/palette';
import { TileId, getTileOverlays, getTilePixels, getTileTallMasks, hash } from './tiles';

export const SHADOW_OFFSET = 3;

/** One step darker inside the locked palette. Unlisted indices keep their colour. */
export const SHADE: readonly number[] = (() => {
  const ramp: Array<[number, number]> = [
    [COLOR.TERRAIN_LIGHT_GRASS, COLOR.TERRAIN_GRASS],
    [COLOR.TERRAIN_GRASS, COLOR.TERRAIN_GREEN],
    [COLOR.TERRAIN_GREEN, COLOR.TERRAIN_FOREST],
    [COLOR.TERRAIN_FOREST, COLOR.TERRAIN_DARK_GREEN],
    [COLOR.TERRAIN_DARK_GREEN, COLOR.GROUND_DARK_OLIVE],
    [COLOR.TERRAIN_LIGHT_BROWN, COLOR.TERRAIN_BROWN],
    [COLOR.TERRAIN_BROWN, COLOR.TERRAIN_DARK_BROWN],
    [COLOR.TERRAIN_DARK_BROWN, COLOR.GROUND_DARK_OLIVE],
    [COLOR.GROUND_TAN, COLOR.GROUND_LIGHT_OLIVE],
    [COLOR.GROUND_LIGHT_OLIVE, COLOR.GROUND_MED_OLIVE],
    [COLOR.GROUND_MED_OLIVE, COLOR.GROUND_OLIVE],
    [COLOR.GROUND_OLIVE, COLOR.GROUND_DARK_OLIVE],
    [COLOR.GROUND_DARK_OLIVE, COLOR.SHADOW],
    [COLOR.TERRAIN_ASPHALT, COLOR.DARK_GRAY],
    [COLOR.TERRAIN_CONCRETE, COLOR.MEDIUM_GRAY],
    [COLOR.WHITE, COLOR.PALE_GRAY],
    [COLOR.PALE_GRAY, COLOR.LIGHT_GRAY],
    [COLOR.LIGHT_GRAY, COLOR.GRAY],
    [COLOR.GRAY, COLOR.MEDIUM_GRAY],
    [COLOR.MEDIUM_GRAY, COLOR.DARK_GRAY],
    [COLOR.DARK_GRAY, COLOR.SHADOW],
    [COLOR.WATER_FOAM, COLOR.WATER_SHALLOW],
    [COLOR.WATER_SHALLOW, COLOR.WATER_MEDIUM],
    [COLOR.WATER_MEDIUM, COLOR.WATER_OCEAN],
    [COLOR.WATER_OCEAN, COLOR.WATER_DEEP],
    [COLOR.EXPLOSION_YELLOW, COLOR.GROUND_TAN],
    [COLOR.EXPLOSION_ORANGE_YELLOW, COLOR.TERRAIN_LIGHT_BROWN],
    [COLOR.ENEMY_BRIGHT_RED, COLOR.ENEMY_RED],
    [COLOR.ENEMY_RED, COLOR.ENEMY_CRIMSON],
    [COLOR.ENEMY_CRIMSON, COLOR.ENEMY_DARK_RED],
  ];
  const table = Array.from({ length: 48 }, (_, i) => i);
  for (const [from, to] of ramp) table[from] = to;
  return table;
})();

const ROADLIKE = new Set<number>([TileId.road, TileId.street, TileId.bridge]);
const WATERLIKE = new Set<number>([TileId.lake, TileId.bridge]);
const CROPS = new Set<number>([TileId.cropGreen, TileId.cropWheat, TileId.cropPlowed]);
const MEADOW_BASES = [TileId.meadow, TileId.meadowB, TileId.meadow, TileId.meadowB] as const;

const HARBOR = new Set<number>([
  TileId.harborMud,
  TileId.harborSlab,
  TileId.harborQuay,
  TileId.harborPit,
  TileId.bargeHull,
  TileId.craneBoomNE,
  TileId.craneBoomNW,
  TileId.craneFoot,
  TileId.harborPiles,
  TileId.harborScrap,
  TileId.harborBurn,
]);
const PITLIKE = new Set<number>([TileId.harborPit, TileId.bargeHull]);
const OVERLAYS = new Set<number>([
  TileId.craneBoomNE,
  TileId.craneBoomNW,
  TileId.craneFoot,
  TileId.harborPiles,
  TileId.harborScrap,
  TileId.harborBurn,
]);
/**
 * Cells that may stand in water. Lake water runs under them without foam, so
 * the layout keeps them either in water or off the lake's edge.
 */
const FLOATING = new Set<number>([
  TileId.harborPiles,
  TileId.craneBoomNE,
  TileId.craneBoomNW,
  TileId.bargeHull,
]);
/** Yard cells a quay backs onto; its water face looks away from them. */
const YARD = new Set<number>([
  TileId.harborSlab,
  TileId.harborPit,
  TileId.bargeHull,
  TileId.craneBoomNE,
  TileId.craneBoomNW,
  TileId.craneFoot,
  TileId.harborScrap,
  TileId.harborBurn,
]);
/** Quay bollard colours; every other quay row leaves the bollard out. */
const BOLLARD = new Set<number>([
  COLOR.ENEMY_RED,
  COLOR.ENEMY_CRIMSON,
  COLOR.EXPLOSION_RED_ORANGE,
  COLOR.EXPLOSION_ORANGE,
]);
const PIT_WALL = 4;
/** With yard (or water) on both sides, quays right of this column face right. */
const HARBOR_MID_COL = 11;
/** Pad expansion joints, in map pixels. */
const SLAB_SEAM_X = 48;
const SLAB_SEAM_Y = 32;
const BOW_R = 6;
const STERN_R = 3;

export interface StripPixels {
  width: number;
  height: number;
  /** Palette index per pixel, row-major, top row first. */
  data: Uint8Array;
}

/** Grid access in which off-grid neighbours read as the cell itself, so map edges stay seamless. */
type Cell = (c: number, r: number) => number;

/** Neighbours in screen terms: n is the row above on screen (map row + 1). */
interface Around {
  n: number;
  s: number;
  w: number;
  e: number;
  nw: number;
  ne: number;
  sw: number;
  se: number;
}

function around(cell: Cell, c: number, r: number): Around {
  return {
    n: cell(c, r + 1),
    s: cell(c, r - 1),
    w: cell(c - 1, r),
    e: cell(c + 1, r),
    nw: cell(c - 1, r + 1),
    ne: cell(c + 1, r + 1),
    sw: cell(c - 1, r - 1),
    se: cell(c + 1, r - 1),
  };
}

/** Chebyshev distance (px) from (x, y) in a tile to the nearest neighbour for which `other` is true. */
function edgeDistance(a: Around, other: (id: number) => boolean, x: number, y: number): number {
  const L = TILE_SIZE - 1;
  let d = 99;
  if (other(a.n)) d = Math.min(d, y);
  if (other(a.s)) d = Math.min(d, L - y);
  if (other(a.w)) d = Math.min(d, x);
  if (other(a.e)) d = Math.min(d, L - x);
  if (other(a.nw)) d = Math.min(d, Math.max(x, y));
  if (other(a.ne)) d = Math.min(d, Math.max(L - x, y));
  if (other(a.sw)) d = Math.min(d, Math.max(x, L - y));
  if (other(a.se)) d = Math.min(d, Math.max(L - x, L - y));
  return d;
}

function positive(n: number): number {
  return n >>> 0;
}

function waterColor(d: number, gx: number, gy: number): number {
  if (d === 0) return COLOR.WATER_FOAM;
  if (d <= 2) return COLOR.WATER_SHALLOW;
  if (d <= 4) return COLOR.WATER_MEDIUM;
  const h = hash(positive(gx >> 1), positive(gy));
  if (h % 23 === 0) return COLOR.WATER_MEDIUM;
  if (d >= 7 && h % 5 === 0) return COLOR.WATER_DEEP;
  return COLOR.WATER_OCEAN;
}

function canopyColor(gx: number, gy: number): number {
  const j = Math.round(gy / 7);
  const offset = (((j % 2) + 2) % 2) * 4;
  const i = Math.round((gx - offset) / 8);
  const dx = gx - (i * 8 + offset);
  const dy = gy - j * 7;
  const lean = dx + dy;
  if (dx * dx + dy * dy > 20 || lean >= 4) return COLOR.TERRAIN_DARK_GREEN;
  if (lean <= -5 && hash(positive(gx), positive(gy)) % 3 === 0) return COLOR.TERRAIN_GREEN;
  if (lean <= -2) return COLOR.TERRAIN_GREEN;
  return COLOR.TERRAIN_FOREST;
}

class StripWriter {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly tall: Uint8Array;

  constructor(cols: number, tileRows: number) {
    this.width = cols * TILE_SIZE;
    this.height = tileRows * TILE_SIZE;
    this.data = new Uint8Array(this.width * this.height);
    this.tall = new Uint8Array(this.width * this.height);
  }

  put(x: number, y: number, color: number, tall: boolean): void {
    const i = y * this.width + x;
    this.data[i] = color;
    this.tall[i] = tall ? 1 : 0;
  }
}

/** Paint one tile into the writer at (ox, oy). `gy0` is the global screen-down y of its top row. */
function paintTile(
  out: StripWriter,
  cell: Cell,
  c: number,
  r: number,
  ox: number,
  oy: number
): void {
  const tiles = getTilePixels();
  const talls = getTileTallMasks();
  const id = cell(c, r);
  const a = around(cell, c, r);
  const gx0 = c * TILE_SIZE;
  const gy0 = -(r + 1) * TILE_SIZE;
  const auto = ROADLIKE.has(id) || id === TileId.lake || id === TileId.forest;
  const baseId = auto ? MEADOW_BASES[hash(c, r) % MEADOW_BASES.length]! : id;
  const base = tiles[baseId]!;
  const tallMask = auto ? null : talls[id];

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      out.put(ox + x, oy + y, base[y]![x]!, tallMask?.[y]?.[x] ?? false);
    }
  }
  if (id < TileId.meadow) return;

  if (HARBOR.has(id)) {
    paintHarbor(out, a, id, ox, oy, gx0, gy0, c, r);
    return;
  }

  if (WATERLIKE.has(id)) {
    const land = (n: number) => !WATERLIKE.has(n) && !FLOATING.has(n);
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const d = edgeDistance(a, land, x, y);
        out.put(ox + x, oy + y, waterColor(d, gx0 + x, gy0 + y), false);
      }
    }
  } else if (edgeDistance(a, (n) => WATERLIKE.has(n), 7, 7) < 99) {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const d = edgeDistance(a, (n) => WATERLIKE.has(n), x, y);
        const i = (oy + y) * out.width + ox + x;
        if (out.tall[i]) continue;
        if (d === 0) out.data[i] = COLOR.GROUND_TAN;
        else if (d === 1 && (x + y) % 2 === 0) out.data[i] = COLOR.GROUND_LIGHT_OLIVE;
      }
    }
  }

  if (id === TileId.bridge) {
    const vertical = ROADLIKE.has(a.n) || ROADLIKE.has(a.s);
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const across = vertical ? x : y;
        const along = vertical ? gy0 + y : gx0 + x;
        if (across < 2 || across > 13) continue;
        let color: number = COLOR.TERRAIN_LIGHT_BROWN;
        if (across === 2 || across === 13) {
          color = positive(along) % 6 === 0 ? COLOR.GROUND_DARK_OLIVE : COLOR.TERRAIN_DARK_BROWN;
        } else if (positive(along) % 3 === 0) {
          color = COLOR.TERRAIN_BROWN;
        }
        out.put(ox + x, oy + y, color, true);
      }
    }
  } else if (id === TileId.road || id === TileId.street) {
    paintRoadBand(out, a, id === TileId.street, ox, oy, gx0, gy0);
  } else if (id === TileId.forest) {
    const open = (n: number) => n !== TileId.forest;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const gx = gx0 + x;
        const gy = gy0 + y;
        const rim = 1 + (hash(positive(gx >> 1), positive(gy >> 1)) % 3);
        if (edgeDistance(a, open, x, y) < rim) continue;
        out.put(ox + x, oy + y, canopyColor(gx, gy), true);
      }
    }
  } else if (CROPS.has(id)) {
    const green = id === TileId.cropGreen;
    const lit = green ? COLOR.TERRAIN_LIGHT_GRASS : COLOR.TERRAIN_LIGHT_BROWN;
    const dark = green ? COLOR.TERRAIN_DARK_GREEN : COLOR.TERRAIN_DARK_BROWN;
    for (let i = 0; i < TILE_SIZE; i++) {
      if (a.n !== id) out.put(ox + i, oy, lit, false);
      if (a.w !== id) out.put(ox, oy + i, lit, false);
      if (a.s !== id) out.put(ox + i, oy + TILE_SIZE - 1, dark, false);
      if (a.e !== id) out.put(ox + TILE_SIZE - 1, oy + i, dark, false);
    }
  }
}

/** In water: at least two sides are lake or other cells standing in it. */
function wetAround(a: Around): boolean {
  const sides = [a.n, a.s, a.w, a.e];
  const wet = sides.filter((n) => WATERLIKE.has(n) || FLOATING.has(n)).length;
  return wet >= 2 && sides.some((n) => WATERLIKE.has(n));
}

/** Ground under a hull or an overlay: water, a pit floor, a pad, or mud. */
function harborGround(a: Around, id: number): number {
  if (FLOATING.has(id) && wetAround(a)) return TileId.lake;
  const sides = [a.s, a.n, a.w, a.e];
  if (id === TileId.bargeHull) {
    return sides.some((n) => n === TileId.harborPit) ? TileId.harborPit : TileId.harborMud;
  }
  for (const n of sides) {
    if (n === TileId.harborSlab || n === TileId.harborMud || n === TileId.harborPit) return n;
  }
  return TileId.harborMud;
}

function groundColor(
  ground: number,
  a: Around,
  x: number,
  y: number,
  gx: number,
  gy: number
): number {
  if (ground === TileId.lake) {
    const land = (n: number) => !WATERLIKE.has(n) && !FLOATING.has(n);
    return waterColor(edgeDistance(a, land, x, y), gx, gy);
  }
  return getTilePixels()[ground]![y]![x]!;
}

/** Dry-dock sludge in 4 px blocks keyed on map pixels, so the floor never tiles. */
function pitFloorColor(gx: number, gy: number, fallback: number): number {
  const b = hash(positive(gx >> 2) + 503, positive(gy >> 2) + 71) % 17;
  if (b === 0) return COLOR.TERRAIN_DARK_BROWN;
  if (b === 1) return COLOR.WATER_MEDIUM;
  return fallback;
}

/** Quay water face: away from the yard; ties fall back to the column. */
function quayFacesRight(a: Around, c: number): boolean {
  const w = YARD.has(a.w);
  const e = YARD.has(a.e);
  if (w !== e) return w;
  return c > HARBOR_MID_COL;
}

/** Hull pixel: -1 outside the rounded ends, else distance (px) to the hull edge. */
function hullDepth(a: Around, x: number, y: number): number {
  const L = TILE_SIZE - 1;
  const open = (n: number) => n !== TileId.bargeHull;
  const dn = open(a.n) ? y : 99;
  const ds = open(a.s) ? L - y : 99;
  const dw = open(a.w) ? x : 99;
  const de = open(a.e) ? L - x : 99;
  for (const [dv, R] of [
    [dn, BOW_R],
    [ds, STERN_R],
  ] as const) {
    for (const dh of [dw, de]) {
      if (dv < R && dh < R) {
        const d = R - Math.hypot(R - dv - 0.5, R - dh - 0.5);
        return d < 0 ? -1 : Math.floor(d);
      }
    }
  }
  return Math.min(dn, ds, dw, de);
}

function paintHarbor(
  out: StripWriter,
  a: Around,
  id: number,
  ox: number,
  oy: number,
  gx0: number,
  gy0: number,
  c: number,
  r: number
): void {
  const art = getTilePixels()[id]!;
  const overlay = getTileOverlays()[id];
  const L = TILE_SIZE - 1;
  const notPit = (n: number) => !PITLIKE.has(n);
  const ground = OVERLAYS.has(id) || id === TileId.bargeHull ? harborGround(a, id) : id;
  const mirror = id === TileId.harborQuay && quayFacesRight(a, c);
  const pad = (n: number) => n === TileId.harborSlab || OVERLAYS.has(n);
  const h = hash(positive(c) + 911, positive(r) + 37);
  const puddle = id === TileId.harborMud && h % 3 === 0;
  const px = 4 + (h % 8);
  const py = 4 + ((h >>> 4) % 8);
  const pr = 2 + ((h >>> 8) % 2);

  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const gx = gx0 + x;
      const gy = gy0 + y;
      let color: number;
      let tall = false;
      if (overlay) {
        const cell = overlay[y]![x]!;
        color = cell >= 0 ? cell : groundColor(ground, a, x, y, gx, gy);
        tall = cell >= 0 && id !== TileId.harborScrap && id !== TileId.harborBurn;
      } else if (id === TileId.bargeHull) {
        const d = hullDepth(a, x, y);
        const wet = hash(positive(gx >> 2), positive(gy >> 2)) % 11 === 0;
        if (d < 0) color = groundColor(ground, a, x, y, gx, gy);
        else if (d === 0) color = COLOR.ENEMY_BLACK;
        else if (d === 1) {
          color = COLOR.ENEMY_BRIGHT_RED;
          tall = true;
        } else if (d === 2) color = COLOR.ENEMY_RED;
        else if (wet) color = COLOR.WATER_MEDIUM;
        else color = art[y]![x]!;
      } else if (id === TileId.harborPit) {
        const d = edgeDistance(a, notPit, x, y);
        color = pitFloorColor(gx, gy, art[h & 1 ? L - y : y]![h & 2 ? L - x : x]!);
        if (d === 0) {
          color = COLOR.PALE_GRAY;
          tall = true;
        } else if (d < PIT_WALL) {
          const step = positive(gx + gy) % 4 === 0;
          color = d % 2 === 1 ? COLOR.LIGHT_GRAY : step ? COLOR.MEDIUM_GRAY : COLOR.GRAY;
        } else if (d === PIT_WALL) {
          color = COLOR.MEDIUM_GRAY;
        }
      } else {
        const fx = mirror || (id === TileId.harborSlab && h & 2) ? L - x : x;
        color = art[id === TileId.harborSlab && h & 1 ? L - y : y]![fx]!;
        if (id === TileId.harborQuay && r % 2 === 1 && BOLLARD.has(color)) {
          color = COLOR.TERRAIN_CONCRETE;
        }
        if (id === TileId.harborSlab) {
          const seam = positive(gx) % SLAB_SEAM_X === 0 || positive(gy) % SLAB_SEAM_Y === 0;
          if (seam) color = COLOR.GRAY;
          if ((y === 0 && !pad(a.n)) || (x === 0 && !pad(a.w))) color = COLOR.LIGHT_GRAY;
          if ((y === L && !pad(a.s)) || (x === L && !pad(a.e))) color = COLOR.MEDIUM_GRAY;
        }
        if (puddle) {
          const dx = x - px;
          const dy = y - py;
          const inside = dx * dx + dy * dy * 2 <= pr * pr * 2;
          if (inside) color = dx < 0 && dy < 0 ? COLOR.WATER_SHALLOW : COLOR.WATER_MEDIUM;
        }
        if (id !== TileId.harborQuay) {
          const wd = edgeDistance(a, (n) => WATERLIKE.has(n), x, y);
          const mud = id === TileId.harborMud;
          if (wd === 0) color = mud ? COLOR.GROUND_TAN : COLOR.PALE_GRAY;
          else if (wd === 1 && (mud ? (x + y) % 2 === 0 : true)) {
            color = mud ? COLOR.GROUND_LIGHT_OLIVE : COLOR.GRAY;
          }
        }
      }
      out.put(ox + x, oy + y, color, tall);
    }
  }
}

function paintRoadBand(
  out: StripWriter,
  a: Around,
  paved: boolean,
  ox: number,
  oy: number,
  gx0: number,
  gy0: number
): void {
  const half = paved ? 5.5 : 4.5;
  const n = ROADLIKE.has(a.n);
  const s = ROADLIKE.has(a.s);
  const w = ROADLIKE.has(a.w);
  const e = ROADLIKE.has(a.e);
  const mid = (TILE_SIZE - 1) / 2;
  const inside = (x: number, y: number): boolean => {
    const ax = Math.abs(x - mid);
    const ay = Math.abs(y - mid);
    if (ax <= half && ay <= half) return true;
    if (n && y <= mid && ax <= half) return true;
    if (s && y >= mid && ax <= half) return true;
    if (w && x <= mid && ay <= half) return true;
    if (e && x >= mid && ay <= half) return true;
    return false;
  };
  const straightV = n && s && !w && !e;
  const straightH = w && e && !n && !s;
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (!inside(x, y)) continue;
      const gx = gx0 + x;
      const gy = gy0 + y;
      let color: number;
      if (!inside(x - 1, y) || !inside(x, y - 1)) {
        color = paved ? COLOR.TERRAIN_CONCRETE : COLOR.TERRAIN_LIGHT_BROWN;
      } else if (!inside(x + 1, y) || !inside(x, y + 1)) {
        color = paved ? COLOR.MEDIUM_GRAY : COLOR.TERRAIN_DARK_BROWN;
      } else if (paved) {
        const dashV = straightV && (x === 7 || x === 8) && positive(gy) % 8 < 4;
        const dashH = straightH && (y === 7 || y === 8) && positive(gx) % 8 < 4;
        color = dashV || dashH ? COLOR.PALE_GRAY : COLOR.TERRAIN_ASPHALT;
      } else {
        const h = hash(positive(gx), positive(gy));
        color = h % 9 === 0 ? COLOR.TERRAIN_LIGHT_BROWN : COLOR.TERRAIN_BROWN;
        const rut = (straightV && (x === 5 || x === 10)) || (straightH && (y === 5 || y === 10));
        if (rut && h % 3 !== 0) color = COLOR.TERRAIN_DARK_BROWN;
      }
      out.put(ox + x, oy + y, color, false);
    }
  }
}

/**
 * Incremental raster of map rows `[row0, row0 + rows)`. The writer holds one
 * extra tile row on top (map row `row0 + rows`) so shadows and neighbour
 * finishing cross the strip seam. Step it a few tile rows per frame, then finish.
 */
export interface StripJob {
  readonly row0: number;
  readonly rows: number;
  /** Next writer tile row to paint (0 = the margin row on top). */
  next: number;
  readonly writer: StripWriter;
  readonly cell: Cell;
}

export function createStripJob(
  grid: readonly (readonly number[])[],
  row0: number,
  rows: number
): StripJob {
  const total = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cell: Cell = (c, r) => {
    const rr = r < 0 ? 0 : r >= total ? total - 1 : r;
    const cc = c < 0 ? 0 : c >= cols ? cols - 1 : c;
    return grid[rr]![cc]!;
  };
  return { row0, rows, next: 0, writer: new StripWriter(cols, rows + 1), cell };
}

/** Paint up to `tileRows` more rows. Returns true once every row is painted. */
export function stepStripJob(job: StripJob, tileRows: number): boolean {
  const cols = job.writer.width / TILE_SIZE;
  const end = Math.min(job.rows + 1, job.next + tileRows);
  for (; job.next < end; job.next++) {
    const r = job.row0 + job.rows - job.next;
    for (let c = 0; c < cols; c++) {
      paintTile(job.writer, job.cell, c, r, c * TILE_SIZE, job.next * TILE_SIZE);
    }
  }
  return job.next > job.rows;
}

/** Shadow pass, then drop the margin row. */
export function finishStripJob(job: StripJob): StripPixels {
  while (!stepStripJob(job, job.rows + 1)) {
    // paint whatever is left
  }
  const { width, height, data, tall } = job.writer;
  const k = SHADOW_OFFSET;
  for (let y = height - 1; y >= TILE_SIZE; y--) {
    for (let x = width - 1; x >= k; x--) {
      const i = y * width + x;
      if (tall[i]) continue;
      if (tall[(y - k) * width + x - k]) data[i] = SHADE[data[i]!]!;
    }
  }
  return {
    width,
    height: height - TILE_SIZE,
    data: data.subarray(TILE_SIZE * width),
  };
}

export function rasterStrip(
  grid: readonly (readonly number[])[],
  row0: number,
  rows: number
): StripPixels {
  return finishStripJob(createStripJob(grid, row0, rows));
}
