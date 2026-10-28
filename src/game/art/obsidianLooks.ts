/**
 * 黑曜 layered art, v3 parts sheet (Yoan confirmed).
 * Fuselage stays on the 80×96 frame: longer slim body, nose radar, orange
 * canopy, one centered jet. Wings are separate sprites. Swept pose is a
 * solid cyan gradient (root dark, tip bright) over a dark metal plate.
 * The open cross uses a longer, narrower blade. Right side is the same
 * sprite rotated, not a mirrored crystal. The fuselage does not use player
 * cyan. Overload only recolors the canopy to warning yellow.
 */

import {
  OBSIDIAN_BLADE_H,
  OBSIDIAN_BLADE_STUB,
  OBSIDIAN_BLADE_W,
  OBSIDIAN_CROSS_H,
  OBSIDIAN_CROSS_W,
  OBSIDIAN_HINGE_H,
  OBSIDIAN_HINGE_W,
  OBSIDIAN_HULL_H,
  OBSIDIAN_HULL_W,
} from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillPoly, fillRect, plot, rim } from './pixelDraw';
import type { SpriteData } from './types';

export type ObsidianHullKind = 'warm' | 'warn' | 'wreck';
export type ObsidianBladeKind = 'swept' | 'cross' | 'stub';

/** Root pixel of the swept wing. The bake copies this onto the frame anchor. */
export const OBSIDIAN_BLADE_PIVOT_X = 14;
export const OBSIDIAN_BLADE_PIVOT_Y = 4;
export const OBSIDIAN_CROSS_PIVOT_X = 9;
export const OBSIDIAN_CROSS_PIVOT_Y = 3;

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
const OR = COLOR.EXPLOSION_ORANGE;
const OY = COLOR.EXPLOSION_ORANGE_YELLOW;
const YE = COLOR.EXPLOSION_YELLOW;
const RO = COLOR.EXPLOSION_RED_ORANGE;
const ER = COLOR.ENEMY_RED;
const EB = COLOR.ENEMY_BRIGHT_RED;
const EC = COLOR.ENEMY_CRIMSON;

type Pt = readonly [number, number];

const CX = (OBSIDIAN_HULL_W - 1) / 2;

function crystal(t: number): number {
  if (t < 0.22) return CD;
  if (t < 0.48) return CM;
  if (t < 0.72) return CY;
  if (t < 0.9) return CP;
  return W;
}

function paintWing(
  g: SpriteData,
  y0: number,
  y1: number,
  halfAt: (t: number) => number,
  colorAt: (t: number, edge: boolean, core: boolean) => number
): void {
  const span = Math.max(1, y1 - y0);
  const cx = ((g[0]?.length ?? 1) - 1) / 2;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / span;
    const half = halfAt(t);
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    for (let x = left; x <= right; x++) {
      const edge = x === left || x === right;
      const core = Math.abs(x - cx) < 1.2;
      plot(g, x, y, colorAt(t, edge, core));
    }
  }
}

/** Dark plate under the crystal so the swept pose reads as a wing. */
function paintPlate(g: SpriteData): void {
  const y0 = OBSIDIAN_BLADE_PIVOT_Y + 1;
  const y1 = y0 + Math.round((OBSIDIAN_BLADE_H - y0) * 0.74);
  paintWing(
    g,
    y0,
    y1,
    (t) => OBSIDIAN_BLADE_W * 0.46 * (1 - 0.42 * t),
    (t, edge) => {
      if (edge) return S;
      if (t > 0.16 && t < 0.24) return ER;
      return t < 0.5 ? D : M;
    }
  );
}

function paintCrystal(g: SpriteData, y0: number, y1: number, wide: number): void {
  paintWing(
    g,
    y0,
    y1,
    (t) => {
      let half = wide * (0.62 - 0.34 * t);
      if (t > 0.86) half *= Math.max(0, (1 - t) / 0.14);
      return half;
    },
    (t, edge, core) => {
      if (edge) return t > 0.75 ? W : CP;
      if (core && t > 0.4) return t > 0.85 ? W : CP;
      return crystal(t);
    }
  );
}

function paintRoot(g: SpriteData, pivotX: number, pivotY: number, half: number): void {
  fillRect(g, pivotX - half, pivotY - 2, half * 2 + 1, 7, M);
  fillRect(g, pivotX - half + 1, pivotY - 1, half * 2 - 1, 4, D);
  fillRect(g, pivotX - Math.max(2, half - 2), pivotY, Math.max(4, half * 2 - 3), 2, OR);
  plot(g, pivotX, pivotY, S);
}

/** Stacked swept wing. Tip hangs in +y so angle 0 points down the nose. */
export function buildObsidianBlade(kind: ObsidianBladeKind): SpriteData {
  if (kind === 'stub') {
    const g = createGrid(OBSIDIAN_BLADE_W, OBSIDIAN_BLADE_STUB, -1);
    paintRoot(g, OBSIDIAN_BLADE_PIVOT_X, OBSIDIAN_BLADE_PIVOT_Y, 5);
    paintCrystal(g, 8, 15, 5);
    plot(g, 12, 14, K);
    plot(g, 16, 13, K);
    rim(g, K);
    return g;
  }
  if (kind === 'cross') {
    const g = createGrid(OBSIDIAN_CROSS_W, OBSIDIAN_CROSS_H, -1);
    paintRoot(g, OBSIDIAN_CROSS_PIVOT_X, OBSIDIAN_CROSS_PIVOT_Y, 4);
    paintCrystal(g, OBSIDIAN_CROSS_PIVOT_Y + 2, OBSIDIAN_CROSS_H - 2, OBSIDIAN_CROSS_W * 0.42);
    rim(g, K);
    paintTip(g, OBSIDIAN_CROSS_PIVOT_X);
    return g;
  }
  const g = createGrid(OBSIDIAN_BLADE_W, OBSIDIAN_BLADE_H, -1);
  paintPlate(g);
  paintRoot(g, OBSIDIAN_BLADE_PIVOT_X, OBSIDIAN_BLADE_PIVOT_Y, 6);
  paintCrystal(g, OBSIDIAN_BLADE_PIVOT_Y + 2, OBSIDIAN_BLADE_H - 2, OBSIDIAN_BLADE_W * 0.34);
  rim(g, K);
  paintTip(g, OBSIDIAN_BLADE_PIVOT_X);
  return g;
}

/** The last rows are a few pixels wide, so the black outline would hide the gradient. */
function paintTip(g: SpriteData, pivotX: number): void {
  const height = g.length;
  const y0 = height - 8;
  const y1 = height - 2;
  const cx = pivotX + 0.5;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const half = Math.max(1.1, 3.2 * (1 - t));
    const color = t > 0.5 ? W : CP;
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    for (let x = left; x <= right; x++) plot(g, x, y, color);
  }
}

function fuselage(): Pt[] {
  const r: Pt[] = [
    [CX, 93],
    [CX + 4, 84],
    [CX + 8, 70],
    [CX + 11, 54],
    [CX + 12, 38],
    [CX + 10, 24],
    [CX + 6, 14],
    [CX + 3, 9],
    [CX - 3, 9],
    [CX - 6, 14],
    [CX - 10, 24],
    [CX - 12, 38],
    [CX - 11, 54],
    [CX - 8, 70],
    [CX - 4, 84],
  ];
  return r;
}

function paintBody(g: SpriteData): void {
  fillPoly(g, fuselage(), D);
  const inner: Pt[] = [
    [CX, 88],
    [CX + 5, 72],
    [CX + 7, 52],
    [CX + 6, 32],
    [CX + 3, 16],
    [CX - 3, 16],
    [CX - 6, 32],
    [CX - 7, 52],
    [CX - 5, 72],
  ];
  fillPoly(g, inner, M);
  for (let y = 18; y <= 86; y += 2) {
    plot(g, Math.round(CX), y, G);
  }
}

function paintSeams(g: SpriteData): void {
  for (const y of [28, 42, 58, 74]) {
    for (let x = 30; x <= 49; x++) {
      if ((g[y]?.[x] ?? -1) < 0) continue;
      if (g[y]![x] === L || g[y]![x] === W) continue;
      plot(g, x, y, S);
    }
  }
  for (let y = 30; y <= 80; y++) {
    plot(g, Math.round(CX - 6), y, S);
    plot(g, Math.round(CX + 6), y, S);
  }
}

function paintCanopy(g: SpriteData, kind: ObsidianHullKind): void {
  const cy = 66;
  if (kind === 'wreck') {
    fillEllipse(g, CX, cy, 5.2, 9, D);
    fillEllipse(g, CX, cy, 3.4, 6.4, S);
    fillEllipse(g, CX, cy, 1.6, 3, K);
    for (let i = 0; i < 7; i++) plot(g, Math.round(CX - 3 + i), cy - 4 + i, K);
    return;
  }
  const glass = kind === 'warn' ? YE : OR;
  const core = kind === 'warn' ? W : OY;
  fillEllipse(g, CX, cy, 5.6, 10, D);
  fillEllipse(g, CX, cy, 4.4, 8.4, RO);
  fillEllipse(g, CX, cy + 0.4, 3.2, 6.6, glass);
  fillEllipse(g, CX, cy - 1, 1.6, 3.2, core);
  plot(g, Math.round(CX - 2), cy - 5, P);
}

function paintRadar(g: SpriteData): void {
  fillRect(g, CX - 2, 90, 5, 5, G);
  fillEllipse(g, CX, 94, 2.4, 2.2, P);
  fillEllipse(g, CX, 94, 1.1, 1.1, L);
}

function paintNozzle(g: SpriteData, kind: ObsidianHullKind): void {
  const nozzle: Pt[] = [
    [CX - 7, 2],
    [CX + 7, 2],
    [CX + 9, 11],
    [CX - 9, 11],
  ];
  fillPoly(g, nozzle, kind === 'wreck' ? S : K);
  fillRect(g, CX - 5, 4, 11, 6, kind === 'wreck' ? K : S);
  if (kind !== 'wreck') {
    fillEllipse(g, CX, 8, 3.2, 2.4, OR);
    fillEllipse(g, CX, 8, 1.3, 1.1, OY);
  }
}

function paintCheeks(g: SpriteData): void {
  fillRect(g, CX - 16, 40, 7, 16, M);
  fillRect(g, CX + 10, 40, 7, 16, M);
  fillRect(g, CX - 15, 41, 5, 14, D);
  fillRect(g, CX + 11, 41, 5, 14, D);
}

function paintLamps(g: SpriteData, kind: ObsidianHullKind): void {
  const hot = kind === 'wreck' ? EC : EB;
  const dim = kind === 'wreck' ? S : ER;
  for (const y of [34, 48, 62, 78]) {
    plot(g, Math.round(CX - 8), y, hot);
    plot(g, Math.round(CX + 8), y, dim);
  }
}

function paintHoles(g: SpriteData): void {
  for (let y = 46; y <= 54; y++) {
    for (let x = 34; x <= 40; x++) {
      const edge = x === 34 || y === 46 || x === 40 || y === 54;
      plot(g, x, y, edge ? S : K);
    }
  }
}

function paint(kind: ObsidianHullKind): SpriteData {
  const g = createGrid(OBSIDIAN_HULL_W, OBSIDIAN_HULL_H, -1);
  paintCheeks(g);
  paintBody(g);
  paintSeams(g);
  paintNozzle(g, kind);
  paintCanopy(g, kind);
  paintRadar(g);
  if (kind === 'wreck') paintHoles(g);
  rim(g, K);
  paintLamps(g, kind);
  paintRadar(g);
  if (kind !== 'wreck') paintNozzle(g, kind);
  return g;
}

export function buildObsidianHull(kind: ObsidianHullKind): SpriteData {
  return paint(kind);
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
