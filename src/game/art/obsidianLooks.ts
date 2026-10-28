/**
 * 黑曜 layered art, Yoan 定稿 3A (sheet_free_gen / gamepal).
 * The fuselage is 80×96 and stays fixed: dark armor, orange canopy, red lamps.
 * Four crystal blades and four hinge locks are separate sprites. A blade is
 * drawn for the left side, pivot on the inboard root, crystal outboard; the
 * right side mirrors it and the fight rotates both. Overload only recolors
 * the canopy to warning yellow. The fuselage does not use player cyan.
 * Wings are not baked into the hull.
 */

import {
  OBSIDIAN_BLADE_H,
  OBSIDIAN_BLADE_STUB,
  OBSIDIAN_BLADE_W,
  OBSIDIAN_HINGE_H,
  OBSIDIAN_HINGE_W,
  OBSIDIAN_HULL_H,
  OBSIDIAN_HULL_W,
} from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillPoly, fillRect, plot, rim } from './pixelDraw';
import type { SpriteData } from './types';

export type ObsidianHullKind = 'warm' | 'warn' | 'wreck';
export type ObsidianBladeKind = 'inner' | 'outer' | 'stub';

/** Hinge pixel inside the blade sprite. The bake copies this onto the frame anchor. */
export const OBSIDIAN_BLADE_PIVOT_X = 16;
export const OBSIDIAN_BLADE_PIVOT_Y = 3;

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const D = COLOR.DARK_GRAY;
const M = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const L = COLOR.LIGHT_GRAY;
const P = COLOR.PALE_GRAY;
const W = COLOR.WHITE;
const CY = COLOR.PLAYER_CYAN;
const CM = COLOR.PLAYER_MED_CYAN;
const CD = COLOR.PLAYER_DARK_CYAN;
const CP = COLOR.PLAYER_PALE_CYAN;
const CB = COLOR.PLAYER_BLUE;
const OR = COLOR.EXPLOSION_ORANGE;
const OY = COLOR.EXPLOSION_ORANGE_YELLOW;
const YE = COLOR.EXPLOSION_YELLOW;
const RO = COLOR.EXPLOSION_RED_ORANGE;
const ER = COLOR.ENEMY_RED;
const EB = COLOR.ENEMY_BRIGHT_RED;
const EC = COLOR.ENEMY_CRIMSON;

type Pt = readonly [number, number];

function mirrorX(x: number): number {
  return OBSIDIAN_HULL_W - 1 - x;
}

function polyPair(g: SpriteData, pts: Pt[], color: number): void {
  fillPoly(g, pts, color);
  fillPoly(
    g,
    pts.map(([x, y]) => [mirrorX(x), y] as const),
    color
  );
}

/** Aft is small y (engines and tails). The nose is the bottom of the sprite. */
function bodyHalf(y: number): number {
  if (y < 18 || y > 94) return -1;
  if (y < 32) return 8 + ((y - 18) / 14) * 3;
  if (y < 58) return 11 + ((y - 32) / 26) * 2;
  if (y < 72) return 13 - ((y - 58) / 14) * 4;
  if (y < 86) return 9 - ((y - 72) / 14) * 5;
  return Math.max(0.8, 4 - (y - 86) * 0.4);
}

function paintFuselage(g: SpriteData): void {
  const cx = (OBSIDIAN_HULL_W - 1) / 2;
  for (let y = 0; y < OBSIDIAN_HULL_H; y++) {
    const half = bodyHalf(y);
    if (half < 0) continue;
    for (let x = 0; x < OBSIDIAN_HULL_W; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      if (dx > half) continue;
      const plate = Math.floor(y / 5) % 2 === 0;
      let color: number = plate ? D : M;
      if (dx > half - 1.15) color = S;
      else if (dx < 1.05) color = G;
      else if (dx < 2.4) color = plate ? M : G;
      plot(g, x, y, color);
    }
  }
}

function paintTails(g: SpriteData): void {
  const tail: Pt[] = [
    [27, 2],
    [36, 1],
    [35, 18],
    [28, 20],
  ];
  polyPair(g, tail, D);
  const face: Pt[] = [
    [29, 4],
    [34, 3],
    [33, 15],
    [30, 17],
  ];
  polyPair(g, face, M);
  plot(g, 31, 6, L);
  plot(g, 32, 7, G);
  plot(g, mirrorX(31), 6, L);
  plot(g, mirrorX(32), 7, G);
}

function paintWings(g: SpriteData): void {
  const wing: Pt[] = [
    [33, 60],
    [22, 50],
    [15, 34],
    [21, 26],
    [33, 38],
  ];
  polyPair(g, wing, D);
  const face: Pt[] = [
    [31, 54],
    [23, 46],
    [18, 36],
    [23, 30],
    [31, 42],
  ];
  polyPair(g, face, M);
  for (let i = 0; i < 8; i++) {
    plot(g, 20 + i, 34 + Math.floor(i / 2), S);
    plot(g, mirrorX(20 + i), 34 + Math.floor(i / 2), S);
  }
}

function paintCanards(g: SpriteData): void {
  const fin: Pt[] = [
    [34, 80],
    [26, 72],
    [25, 76],
    [32, 84],
  ];
  polyPair(g, fin, D);
  polyPair(
    g,
    [
      [32, 79],
      [28, 74],
      [27, 76],
      [31, 82],
    ],
    M
  );
}

function paintEngines(g: SpriteData, kind: ObsidianHullKind): void {
  const dead = kind === 'wreck';
  for (const cx of [31, mirrorX(31)]) {
    fillEllipse(g, cx, 10, 5.2, 6.3, dead ? S : D);
    fillEllipse(g, cx, 10.4, 3.3, 4.3, dead ? K : S);
    if (!dead) {
      fillEllipse(g, cx, 11, 1.4, 2.1, P);
      plot(g, cx, 11, W);
    }
  }
}

function paintIntakes(g: SpriteData): void {
  for (const x0 of [30, mirrorX(34)]) {
    for (let y = 46; y <= 53; y++) {
      for (let x = x0; x < x0 + 5; x++) plot(g, x, y, S);
    }
    for (let x = x0; x < x0 + 5; x++) plot(g, x, 54, L);
  }
}

function paintCanopy(g: SpriteData, kind: ObsidianHullKind): void {
  const cx = (OBSIDIAN_HULL_W - 1) / 2;
  const cy = 68;
  if (kind === 'wreck') {
    fillEllipse(g, cx, cy, 6.4, 11.2, D);
    fillEllipse(g, cx, cy, 4.6, 9.2, S);
    fillEllipse(g, cx, cy - 1, 2.2, 4.4, K);
    for (let i = 0; i < 8; i++) plot(g, 36 + i, 64 + i, K);
    return;
  }
  const glass = kind === 'warn' ? YE : OR;
  const core = kind === 'warn' ? W : OY;
  fillEllipse(g, cx, cy, 6.6, 11.4, D);
  fillEllipse(g, cx, cy, 5.4, 10, RO);
  fillEllipse(g, cx, cy + 0.4, 4.2, 8.4, glass);
  fillEllipse(g, cx, cy - 1, 2, 4.2, core);
  plot(g, 37, 62, P);
  plot(g, 38, 63, W);
  plot(g, 39, 63, W);
}

function paintSeams(g: SpriteData): void {
  const cx = (OBSIDIAN_HULL_W - 1) / 2;
  for (const y of [26, 36, 48, 58, 80]) {
    const row = g[y];
    if (!row) continue;
    for (let x = 0; x < OBSIDIAN_HULL_W; x++) {
      if ((row[x] ?? -1) < 0) continue;
      if (Math.abs(x + 0.5 - cx) > 16) continue;
      if (row[x] === L || row[x] === W) continue;
      plot(g, x, y, D);
    }
  }
}

function paintHoles(g: SpriteData): void {
  for (let y = 42; y < 52; y++) {
    for (let x = 34; x < 43; x++) {
      const edge = x === 34 || y === 42 || x === 42 || y === 51;
      plot(g, x, y, edge ? S : K);
    }
  }
  for (let i = 0; i < 5; i++) {
    plot(g, 16 + i, 32 + (i % 2), -1);
    plot(g, 17 + i, 33, -1);
  }
}

/** Nose-facing rim stays light so the sweep reads against the deck. */
function leadingEdge(g: SpriteData): void {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  for (let y = 20; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      if ((g[y]?.[x] ?? -1) < 0) continue;
      if ((g[y + 1]?.[x] ?? -1) >= 0) continue;
      plot(g, x, y, L);
    }
  }
}

function lamp(g: SpriteData, x: number, y: number, color: number): void {
  if ((g[y]?.[x] ?? -1) < 0) return;
  plot(g, x, y, color);
}

function paintLamps(g: SpriteData, kind: ObsidianHullKind): void {
  const hot = kind === 'wreck' ? EC : EB;
  const dim = kind === 'wreck' ? S : ER;
  for (const y of [24, 32, 40, 50, 82, 88]) {
    lamp(g, 39, y, hot);
    lamp(g, 40, y, dim);
  }
  if (kind !== 'wreck') {
    lamp(g, 28, 10, ER);
    lamp(g, mirrorX(28), 10, ER);
    lamp(g, 26, 14, EB);
    lamp(g, mirrorX(26), 14, EB);
  }
  lamp(g, 16, 34, hot);
  lamp(g, mirrorX(16), 34, hot);
  lamp(g, 30, 46, dim);
  lamp(g, mirrorX(30), 46, dim);
}

function paint(kind: ObsidianHullKind): SpriteData {
  const g = createGrid(OBSIDIAN_HULL_W, OBSIDIAN_HULL_H, -1);
  paintTails(g);
  paintWings(g);
  paintFuselage(g);
  paintCanards(g);
  paintEngines(g, kind);
  paintIntakes(g);
  paintSeams(g);
  paintCanopy(g, kind);
  if (kind === 'wreck') paintHoles(g);
  rim(g, K);
  if (kind !== 'wreck') leadingEdge(g);
  paintLamps(g, kind);
  return g;
}

export function buildObsidianHull(kind: ObsidianHullKind): SpriteData {
  return paint(kind);
}

interface CrystalSpec {
  y0: number;
  y1: number;
  half0: number;
  half1: number;
  cx0: number;
  cx1: number;
}

const CRYSTAL: Record<'inner' | 'outer', CrystalSpec> = {
  inner: { y0: 13, y1: 57, half0: 4.3, half1: 1.4, cx0: 11, cx1: 8.2 },
  outer: { y0: 13, y1: 62, half0: 6.1, half1: 1.8, cx0: 9.4, cx1: 6.4 },
};

function paintCrystal(g: SpriteData, spec: CrystalSpec): void {
  const span = Math.max(1, spec.y1 - spec.y0);
  for (let y = spec.y0; y <= spec.y1; y++) {
    const t = (y - spec.y0) / span;
    const half = spec.half0 + (spec.half1 - spec.half0) * t;
    const cx = spec.cx0 + (spec.cx1 - spec.cx0) * t;
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    for (let x = left; x <= right; x++) {
      let color: number = y % 5 === 0 ? CD : CM;
      if (x === left) color = CP;
      else if (x === left + 1) color = y % 3 === 0 ? W : CY;
      else if (x === right) color = CB;
      else if (x >= right - 1) color = CD;
      else if (Math.abs(x + 0.5 - cx) < 1.15) color = y % 4 === 0 ? W : CY;
      plot(g, x, y, color);
    }
  }
}

function paintCollar(g: SpriteData, live: boolean): void {
  const x0 = OBSIDIAN_BLADE_PIVOT_X - 4;
  fillRect(g, x0, 0, 8, 11, D);
  fillRect(g, x0 + 1, 1, 6, 7, M);
  fillRect(g, x0 + 1, 1, 1, 7, L);
  plot(g, x0 + 2, 3, K);
  plot(g, x0 + 5, 3, K);
  plot(g, OBSIDIAN_BLADE_PIVOT_X, OBSIDIAN_BLADE_PIVOT_Y, S);
  if (!live) {
    plot(g, x0 + 2, 8, S);
    plot(g, x0 + 3, 9, K);
  }
}

/** Orange nozzle just under the lock, on collar pixels the rim does not own. */
function paintRootGlow(g: SpriteData): void {
  const x = OBSIDIAN_BLADE_PIVOT_X - 2;
  plot(g, x, 8, OR);
  plot(g, x + 1, 8, OY);
  plot(g, x + 1, 9, OR);
}

function restoreCrystalEdge(g: SpriteData, y0: number, y1: number): void {
  const w = g[0]?.length ?? 0;
  for (let y = y0; y <= y1; y++) {
    let left = -1;
    for (let x = 0; x < w; x++) {
      if ((g[y]?.[x] ?? -1) >= 0) {
        left = x;
        break;
      }
    }
    if (left < 0) continue;
    plot(g, left, y, CP);
    if ((g[y]?.[left + 1] ?? -1) >= 0) plot(g, left + 1, y, y % 3 === 0 ? W : CY);
  }
}

/** Left-side blade. The root is the pivot; the crystal hangs outboard and down. */
export function buildObsidianBlade(kind: ObsidianBladeKind): SpriteData {
  const h = kind === 'stub' ? OBSIDIAN_BLADE_STUB : OBSIDIAN_BLADE_H;
  const g = createGrid(OBSIDIAN_BLADE_W, h, -1);
  if (kind === 'stub') {
    paintCrystal(g, { y0: 12, y1: 16, half0: 3.2, half1: 1.6, cx0: 11, cx1: 10 });
    for (const [x, y] of [
      [8, 16],
      [9, 15],
      [13, 16],
    ] as const) {
      plot(g, x, y, -1);
    }
    paintCollar(g, false);
    rim(g, K);
    return g;
  }
  const spec = CRYSTAL[kind];
  paintCrystal(g, spec);
  paintCollar(g, true);
  rim(g, K);
  restoreCrystalEdge(g, spec.y0, spec.y1);
  paintRootGlow(g);
  return g;
}

/** Round lock on the hinge. Live locks carry the orange ring the player shoots. */
export function buildObsidianHinge(kind: 'live' | 'dead'): SpriteData {
  const g = createGrid(OBSIDIAN_HINGE_W, OBSIDIAN_HINGE_H, -1);
  const cx = OBSIDIAN_HINGE_W / 2;
  const cy = OBSIDIAN_HINGE_H / 2;
  const r = Math.min(OBSIDIAN_HINGE_W, OBSIDIAN_HINGE_H) / 2;
  const live = kind === 'live';
  for (let y = 0; y < OBSIDIAN_HINGE_H; y++) {
    for (let x = 0; x < OBSIDIAN_HINGE_W; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r - 0.35) continue;
      let color: number = D;
      if (d > r - 1.15) color = S;
      else if (d >= r * 0.58) color = live ? OR : G;
      else if (d >= r * 0.32) color = live ? M : S;
      else color = live ? P : K;
      if (live && d >= r * 0.58 && d < r - 1.15 && x < cx && y < cy) color = OY;
      plot(g, x, y, color);
    }
  }
  const sx = Math.floor(cx);
  const sy = Math.floor(cy);
  plot(g, sx, sy, live ? W : K);
  plot(g, sx - 1, sy - 1, live ? P : D);
  return g;
}
