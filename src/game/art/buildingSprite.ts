/**
 * Destructible building sprites (owner-approved concept sheet, P6).
 * Top-down palette art like the tank and turret: intact frames carry the 1px
 * red attackable rim, wrecks a black rim. The sea gun's twin barrels are code-drawn
 * so they can track the player, same as the ground turret.
 */

import { COLOR } from '@/game/palette';
import type { BuildingType } from '@/game/levels/types';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite, createHitFlashSprite } from './spriteRenderer';
import { createGrid, inGrid } from './pixelDraw';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const PG = COLOR.PALE_GRAY;
const W = COLOR.WHITE;

const EC = COLOR.ENEMY_CRIMSON;
const ER = COLOR.ENEMY_RED;
const EH = COLOR.ENEMY_BRIGHT_RED;
const EV = COLOR.ENEMY_VIVID_RED;

const OD = COLOR.GROUND_DARK_OLIVE;
const OL = COLOR.GROUND_OLIVE;
const OM = COLOR.GROUND_MED_OLIVE;
const OI = COLOR.GROUND_LIGHT_OLIVE;
const TN = COLOR.GROUND_TAN;

const DI = COLOR.TERRAIN_DARK_BROWN;
const BR = COLOR.TERRAIN_BROWN;
const BL = COLOR.TERRAIN_LIGHT_BROWN;
const AS = COLOR.TERRAIN_ASPHALT;
const CC = COLOR.TERRAIN_CONCRETE;

const WS = COLOR.WATER_SHALLOW;
const WF = COLOR.WATER_FOAM;

const X2 = COLOR.EXPLOSION_ORANGE_YELLOW;
const X3 = COLOR.EXPLOSION_ORANGE;
const X4 = COLOR.EXPLOSION_RED_ORANGE;

type Paint = (x: number, y: number) => number;

function set(g: SpriteData, x: number, y: number, c: number): void {
  if (inGrid(g, x, y)) g[y]![x] = c;
}

function rect(g: SpriteData, x: number, y: number, w: number, h: number, c: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(g, xx, yy, c);
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function each(g: SpriteData, fn: (x: number, y: number) => void): void {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0]!.length; x++) fn(x, y);
}

function octagon(
  g: SpriteData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ch: number,
  paint: Paint
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (
        x - x0 + (y - y0) < ch ||
        x1 - x + (y - y0) < ch ||
        x - x0 + (y1 - y) < ch ||
        x1 - x + (y1 - y) < ch
      ) {
        continue;
      }
      set(g, x, y, paint(x, y));
    }
  }
}

/** Seeded so wrecks bake the same rubble every boot. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

type Box = readonly [number, number, number, number];

function scatter(g: SpriteData, seed: number, n: number, cols: readonly number[], box: Box): void {
  const rng = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = randInt(rng, box[0], box[2]);
    const y = randInt(rng, box[1], box[3]);
    if (g[y]![x]! >= 0) g[y]![x] = cols[Math.floor(rng() * cols.length)]!;
  }
}

function rubble(
  g: SpriteData,
  seed: number,
  n: number,
  box: Box,
  cols: readonly number[] = [CC, MG, LG, DG]
): void {
  const rng = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = randInt(rng, box[0], box[2]);
    const y = randInt(rng, box[1], box[3]);
    const c = cols[Math.floor(rng() * cols.length)]!;
    set(g, x, y, c);
    if (rng() < 0.6) {
      set(g, x + 1, y, c);
      set(g, x, y + 1, c === DG ? S : K);
    }
  }
}

/** Rim that treats foam as open water, so the sea gun's outline sits inside its wake ring. */
function rimSolid(g: SpriteData, color: number): void {
  const h = g.length;
  const w = g[0]!.length;
  const open = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h || g[y]![x]! < 0 || g[y]![x] === WF || g[y]![x] === WS;
  const marks: Array<[number, number]> = [];
  each(g, (x, y) => {
    if (open(x, y)) return;
    if (open(x + 1, y) || open(x - 1, y) || open(x, y + 1) || open(x, y - 1)) marks.push([x, y]);
  });
  for (const [x, y] of marks) g[y]![x] = color;
}

function pillbox(dead: boolean): SpriteData {
  let g = createGrid(32, 32);
  each(g, (x, y) => {
    const dx = x - 15.5;
    const dy = y - 15.5;
    const r = Math.hypot(dx, dy);
    if (r >= 9.5 && r < 12.2) g[y]![x] = (x + y) % 3 ? DI : BR;
    if (r >= 12.2 && r <= 15.2) {
      const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 9));
      g[y]![x] = r < 13.4 ? BL : seg % 2 === 0 ? TN : BR;
      if (r > 14.4) g[y]![x] = dy < 0 ? BR : DI;
    }
  });
  octagon(g, 6, 6, 25, 25, 6, (x, y) => (x + y < 22 ? LG : x + y > 40 ? MG : CC));
  for (let y = 9; y < 23; y++) {
    for (let x = 9; x < 23; x++) {
      const dd = (x - 15.5) ** 2 + (y - 15) ** 2;
      if (dd <= 36) g[y]![x] = dd <= 8 && x < 16 && y < 15 ? OI : x + y < 31 ? OM : OL;
    }
  }
  set(g, 13, 12, PG);
  set(g, 14, 12, W);
  rect(g, 11, 21, 10, 2, K);
  rect(g, 12, 23, 8, 1, AS);
  rect(g, 15, 22, 2, 7, DG);
  set(g, 15, 28, K);
  set(g, 16, 28, K);
  set(g, 15, 22, G);
  for (const x of [9, 22]) {
    set(g, x, 15, K);
    set(g, x, 16, DG);
  }
  if (!dead) {
    rimSolid(g, ER);
    return g;
  }
  const trimmed = createGrid(32, 32);
  each(g, (x, y) => {
    if (Math.hypot(x - 15.5, y - 15.5) <= 15 && g[y]![x]! >= 0) trimmed[y]![x] = g[y]![x]!;
  });
  g = trimmed;
  each(g, (x, y) => {
    const c = g[y]![x]!;
    if (c < 0) return;
    const r = Math.hypot(x - 15.5, y - 15.8);
    if (r < 5) g[y]![x] = K;
    else if (r < 8) g[y]![x] = (x + y) % 3 ? S : DI;
    else if (r < 10.5 && (x * 7 + y * 3) % 4) g[y]![x] = (x + y) % 2 ? DG : MG;
    else if (r < 12 && (c === CC || c === LG || c === MG)) g[y]![x] = (x + y) % 3 ? MG : AS;
  });
  for (const [x, y] of [
    [3, 10],
    [4, 11],
    [27, 20],
    [26, 21],
    [12, 29],
    [13, 29],
    [20, 2],
    [21, 2],
  ] as const) {
    set(g, x, y, DI);
  }
  rubble(g, 11, 30, [5, 5, 26, 26]);
  set(g, 15, 15, X3);
  set(g, 16, 16, X4);
  set(g, 14, 17, X4);
  rimSolid(g, K);
  return g;
}

function radarStation(dead: boolean): SpriteData {
  const g = createGrid(32, 32);
  octagon(g, 1, 1, 30, 30, 4, (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 5 ? CC : MG));
  for (let x = 2; x < 30; x++) set(g, x, 2, LG);
  for (let x = 4; x < 28; x++) set(g, x, 28, Math.floor(x / 2) % 2 ? TN : K);
  rect(g, 19, 18, 9, 8, OM);
  rect(g, 19, 18, 9, 2, OI);
  rect(g, 19, 24, 9, 2, OD);
  rect(g, 21, 21, 2, 2, K);
  rect(g, 24, 21, 2, 2, K);
  set(g, 21, 21, AS);
  set(g, 24, 21, AS);
  rect(g, 4, 20, 7, 6, OL);
  rect(g, 4, 20, 7, 1, OI);
  for (const x of [5, 7, 9]) {
    set(g, x, 22, K);
    set(g, x, 24, K);
  }
  rect(g, 14, 15, 4, 4, DG);
  rect(g, 15, 16, 2, 2, MG);
  each(g, (x, y) => {
    if (inEllipse(x, y, 17, 13, 10, 7.2) && g[y]![x]! >= 0) g[y]![x] = AS;
  });
  each(g, (x, y) => {
    if (!inEllipse(x, y, 14, 10, 10, 7.2)) return;
    const inner = inEllipse(x, y, 13, 9.4, 7.6, 5.2);
    g[y]![x] = inner ? (x + y < 20 ? PG : LG) : y > 11 ? G : LG;
    if (inner && inEllipse(x, y, 11.5, 8, 3.2, 2.2)) g[y]![x] = W;
  });
  each(g, (x, y) => {
    if (inEllipse(x, y, 13, 9.4, 7.6, 5.2) && !inEllipse(x, y, 13, 9.4, 6.6, 4.3)) g[y]![x] = G;
  });
  for (let t = -6; t <= 6; t += 3) set(g, 13 + t, 9, G);
  for (let i = 0; i < 5; i++) set(g, 14 + Math.floor(i / 2), 10 - i, DG);
  set(g, 16, 5, EV);
  set(g, 16, 4, EH);
  if (!dead) {
    rimSolid(g, ER);
    return g;
  }
  each(g, (x, y) => {
    if (g[y]![x]! < 0) return;
    const r = Math.hypot(x - 15, y - 13);
    if (inEllipse(x, y, 14, 10, 10.5, 7.6)) g[y]![x] = (x + y) % 2 ? CC : MG;
    if (r < 9) g[y]![x] = r < 3.5 ? K : (x * 3 + y) % 3 ? S : DI;
    else if (r < 12 && (x + 2 * y) % 3 === 0) g[y]![x] = AS;
  });
  for (const [x, y, c] of [
    [5, 6, LG],
    [6, 6, PG],
    [7, 7, G],
    [6, 8, LG],
    [22, 4, PG],
    [23, 5, LG],
    [24, 5, G],
    [8, 16, LG],
    [9, 17, G],
  ] as const) {
    set(g, x, y, c);
  }
  rect(g, 19, 18, 9, 2, AS);
  scatter(g, 5, 14, [K, DG, OD], [19, 18, 27, 25]);
  rubble(g, 21, 22, [3, 3, 28, 27]);
  set(g, 15, 12, X3);
  set(g, 13, 14, X4);
  rimSolid(g, K);
  return g;
}

function tankTop(
  g: SpriteData,
  cx: number,
  cy: number,
  r: number,
  dead: boolean,
  seed: number
): void {
  each(g, (x, y) => {
    const dd = Math.hypot(x - cx, y - cy);
    if (dd > r) return;
    if (dead) {
      g[y]![x] = dd > r - 1.6 ? DG : dd < r - 3.5 ? K : (x + y + seed) % 3 ? S : DI;
    } else if (dd > r - 1.2) {
      g[y]![x] = x - cx + (y - cy) > 0 ? MG : LG;
    } else {
      const light = x - cx + (y - cy);
      g[y]![x] = light < -r * 0.9 ? W : light < 0 ? PG : LG;
    }
  });
  if (dead) return;
  each(g, (x, y) => {
    const dd = Math.hypot(x - cx, y - cy);
    if (dd > r - 2.6 && dd <= r - 1.6) g[y]![x] = x - cx + (y - cy) < 0 ? ER : EC;
  });
  rect(g, Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2, DG);
  set(g, Math.floor(cx) - 1, Math.floor(cy) - 1, G);
}

function fuelDepot(dead: boolean): SpriteData {
  const g = createGrid(48, 32);
  octagon(g, 0, 1, 47, 31, 3, () => BR);
  octagon(g, 2, 3, 45, 29, 2, (x, y) => ((x + y) % 7 ? CC : MG));
  for (let x = 3; x < 45; x++) {
    set(g, x, 3, BL);
    set(g, x, 29, DI);
  }
  rect(g, 4, 16, 40, 2, AS);
  rect(g, 4, 16, 40, 1, G);
  rect(g, 23, 6, 2, 22, AS);
  set(g, 23, 6, G);
  for (let x = 6; x < 44; x += 6) set(g, x, 17, K);
  tankTop(g, 12.5, 10.5, 7.5, dead, 1);
  tankTop(g, 35.5, 10.5, 7.5, dead, 2);
  tankTop(g, 12.5, 23.5, 6.5, dead, 3);
  rect(g, 30, 20, 12, 7, OM);
  rect(g, 30, 20, 12, 2, OI);
  rect(g, 30, 25, 12, 2, OD);
  for (const x of [32, 35, 38]) {
    set(g, x, 22, K);
    set(g, x, 23, AS);
  }
  if (!dead) {
    rimSolid(g, ER);
    return g;
  }
  rect(g, 30, 20, 12, 2, AS);
  scatter(g, 9, 30, [K, DG, DI], [30, 20, 41, 26]);
  for (const [x, y, c] of [
    [29, 3, LG],
    [30, 3, PG],
    [42, 4, LG],
    [43, 5, G],
    [41, 16, PG],
    [7, 30, LG],
  ] as const) {
    set(g, x, y, c);
  }
  for (let y = 4; y < 29; y++) {
    for (let x = 3; x < 45; x++) {
      const c = g[y]![x]!;
      const burnable = c === CC || c === MG || c === AS || c === G;
      if (burnable && Math.hypot(x - 24, y - 16) < 9 && (x * 5 + y * 3) % 4) {
        g[y]![x] = (x + y) % 2 ? S : DI;
      }
    }
  }
  for (const [x, y] of [
    [12, 10],
    [35, 11],
    [13, 23],
    [24, 16],
  ] as const) {
    set(g, x, y, X3);
    set(g, x + 1, y, X4);
    set(g, x, y - 1, X2);
  }
  rubble(g, 31, 26, [3, 4, 44, 28], [MG, LG, DG, AS]);
  rimSolid(g, K);
  return g;
}

/** Turret pivot relative to the sprite center. The battle scene draws the barrels here. */
export const SEA_GUN_PIVOT = { x: 0, y: -2 } as const;

const TURRET_PARTS: ReadonlySet<number> = new Set([OI, OM, OL, OD, DG, G, K]);

function seaGun(dead: boolean): SpriteData {
  const g = createGrid(32, 32);
  each(g, (x, y) => {
    const dd = Math.hypot(x - 15.5, y - 15.5);
    if (dd > 13.2 && dd <= 15.4) g[y]![x] = (x * 3 + y) % 4 ? WF : WS;
    if (dd > 13.2) return;
    const light = x - 15.5 + (y - 15.5);
    g[y]![x] = light < -9 ? LG : light < 8 ? CC : MG;
    if (dd > 11.6) g[y]![x] = light > 0 ? MG : CC;
    if (dd > 11 && dd <= 11.6) g[y]![x] = AS;
  });
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    set(g, Math.round(15.5 + 9.5 * Math.cos(rad)), Math.round(15.5 + 9.5 * Math.sin(rad)), DG);
  }
  each(g, (x, y) => {
    if (Math.hypot((x - 15.5) / 1.05, y - 14) <= 6.2) {
      g[y]![x] = x + y < 26 ? OI : x + y < 33 ? OM : OL;
    }
  });
  rect(g, 13, 13, 6, 2, OD);
  set(g, 14, 11, PG);
  set(g, 15, 11, W);
  if (!dead) {
    rimSolid(g, ER);
    return g;
  }
  each(g, (x, y) => {
    const c = g[y]![x]!;
    if (c < 0) return;
    const dd = Math.hypot(x - 15.5, y - 15);
    if (dd < 6.5) g[y]![x] = dd < 3.5 ? K : (x + y) % 2 ? S : DI;
    else if (dd < 10 && TURRET_PARTS.has(c)) g[y]![x] = (x + y) % 2 ? DG : AS;
  });
  for (let i = 0; i < 8; i++) {
    set(g, 20 + i, 22 + Math.floor(i / 3), DG);
    set(g, 20 + i, 23 + Math.floor(i / 3), K);
  }
  each(g, (x, y) => {
    const d = Math.hypot(x - 27, y - 7);
    if (d < 5.2 && g[y]![x]! >= 0) g[y]![x] = d > 4.2 ? WF : -1;
  });
  rubble(g, 3, 22, [4, 4, 27, 27]);
  set(g, 15, 15, X3);
  set(g, 16, 14, X4);
  rimSolid(g, K);
  return g;
}

const BUILDERS: Record<BuildingType, (dead: boolean) => SpriteData> = {
  pillbox,
  fuel_depot: fuelDepot,
  radar_station: radarStation,
  sea_gun: seaGun,
};

export interface BuildingArt {
  intact: SpriteData;
  wreck: SpriteData;
}

/** Palette-index art for one building. Safe in unit tests (no canvas). */
export function buildBuildingArt(type: BuildingType): BuildingArt {
  return { intact: BUILDERS[type](false), wreck: BUILDERS[type](true) };
}

export interface BuildingSpriteSheet {
  idle: SpriteFrame;
  hitFlash: SpriteFrame;
  wreck: SpriteFrame;
}

export interface BuildingAssets {
  byType: Record<BuildingType, BuildingSpriteSheet>;
}

export function createBuildingAssets(): BuildingAssets {
  const byType = {} as Record<BuildingType, BuildingSpriteSheet>;
  (Object.keys(BUILDERS) as BuildingType[]).forEach((type) => {
    const art = buildBuildingArt(type);
    const idle = renderSprite(art.intact, 0.5, 0.5);
    byType[type] = {
      idle,
      hitFlash: createHitFlashSprite(idle),
      wreck: renderSprite(art.wreck, 0.5, 0.5),
    };
  });
  return { byType };
}
