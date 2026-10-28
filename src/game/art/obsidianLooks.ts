/**
 * 黑曜 layered art. The fuselage is 80×96 and stays fixed. The four blades
 * and the hinge locks are separate sprites so the fight can rotate them.
 * Overload only recolors the canopy to warning yellow. No player cyan.
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
import { createGrid, fillEllipse, fillPoly, plot, rim } from './pixelDraw';
import type { SpriteData } from './types';

export type ObsidianHullKind = 'warm' | 'warn' | 'wreck';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const D = COLOR.DARK_GRAY;
const M = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const L = COLOR.LIGHT_GRAY;
const P = COLOR.PALE_GRAY;
const W = COLOR.WHITE;

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

/** Aft is small y (engines). The nose is the bottom of the sprite. */
function fuselageHalf(y: number): number {
  if (y < 14 || y > 93) return -1;
  if (y < 26) return 8.4;
  if (y < 40) return 8.4 - ((y - 26) / 14) * 1.2;
  if (y < 62) return 7.2;
  if (y < 78) return 7.2 - ((y - 62) / 16) * 3.4;
  return Math.max(0.6, 3.8 - (y - 78) * 0.28);
}

function paintFuselage(g: SpriteData): void {
  const cx = (OBSIDIAN_HULL_W - 1) / 2;
  for (let y = 0; y < OBSIDIAN_HULL_H; y++) {
    const half = fuselageHalf(y);
    if (half < 0) continue;
    for (let x = 0; x < OBSIDIAN_HULL_W; x++) {
      const dx = Math.abs(x + 0.5 - cx);
      if (dx > half) continue;
      let color: number = M;
      if (dx > half - 1.15) color = D;
      else if (dx < 1.15) color = L;
      else if (dx < 2.4) color = G;
      plot(g, x, y, color);
    }
  }
}

function paintTails(g: SpriteData): void {
  const tail: Pt[] = [
    [27, 2],
    [36, 1],
    [35, 20],
    [29, 22],
  ];
  polyPair(g, tail, D);
  const tailFace: Pt[] = [
    [29, 4],
    [34, 3],
    [33, 16],
    [30, 18],
  ];
  polyPair(g, tailFace, M);
  for (let y = 5; y <= 16; y++) {
    plot(g, 32, y, L);
    plot(g, mirrorX(32), y, L);
  }
}

function paintRoots(g: SpriteData): void {
  fillEllipse(g, 30, 24, 5, 4, D);
  fillEllipse(g, mirrorX(30), 24, 5, 4, D);
  fillEllipse(g, 34, 32, 4, 3.2, M);
  fillEllipse(g, mirrorX(34), 32, 4, 3.2, M);
}

function paintEngines(g: SpriteData, kind: ObsidianHullKind): void {
  const dead = kind === 'wreck';
  for (const cx of [32.5, 46.5]) {
    fillEllipse(g, cx, 11, 5.2, 6.2, dead ? S : D);
    fillEllipse(g, cx, 11.5, 3.1, 4.2, dead ? K : S);
    if (!dead) {
      fillEllipse(g, cx, 12, 1.6, 2.6, P);
      plot(g, Math.round(cx), 12, W);
    }
  }
}

function paintIntakes(g: SpriteData): void {
  for (const x0 of [33, 42]) {
    for (let y = 48; y <= 55; y++) {
      for (let x = x0; x < x0 + 5; x++) plot(g, x, y, S);
    }
    for (let x = x0; x < x0 + 5; x++) plot(g, x, 56, L);
  }
}

function paintCanopy(g: SpriteData, kind: ObsidianHullKind): void {
  const cx = (OBSIDIAN_HULL_W - 1) / 2;
  const glass = kind === 'warn' ? COLOR.EXPLOSION_YELLOW : kind === 'wreck' ? S : COLOR.GROUND_TAN;
  const core =
    kind === 'warn' ? COLOR.EXPLOSION_ORANGE_YELLOW : kind === 'wreck' ? K : COLOR.GROUND_TAN;
  fillEllipse(g, cx, 68, 5.2, 8.2, D);
  fillEllipse(g, cx, 68.5, 3.6, 6.4, glass);
  fillEllipse(g, cx, 67, 1.8, 3.2, core);
  if (kind !== 'wreck') {
    plot(g, 38, 64, P);
    plot(g, 41, 64, P);
    plot(g, 39, 65, W);
    plot(g, 40, 65, W);
  } else {
    for (let y = 66; y <= 71; y++) {
      plot(g, 39, y, K);
      plot(g, 40, y, K);
    }
  }
}

function paintPanels(g: SpriteData): void {
  const cx = (OBSIDIAN_HULL_W - 1) / 2;
  for (const y of [24, 36, 46, 78]) {
    for (let x = 0; x < OBSIDIAN_HULL_W; x++) {
      if (g[y]?.[x] === undefined || g[y][x]! < 0) continue;
      if (Math.abs(x + 0.5 - cx) > 7) continue;
      if (g[y][x] === L || g[y][x] === W) continue;
      plot(g, x, y, D);
    }
  }
}

function paintHoles(g: SpriteData): void {
  const holes: Array<readonly [number, number, number, number]> = [[36, 50, 8, 10]];
  for (const [x0, y0, w, h] of holes) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        plot(g, x, y, edge ? S : K);
      }
    }
  }
}

/** Forward rim (toward the nose) stays light so the sweep reads. */
function leadingEdge(g: SpriteData): void {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y]![x]! < 0) continue;
      if ((g[y + 1]?.[x] ?? -1) >= 0) continue;
      if (y < 18) continue;
      plot(g, x, y, L);
    }
  }
}

function paintSpine(g: SpriteData, kind: ObsidianHullKind): void {
  if (kind === 'wreck') return;
  const lamp = kind === 'warn' ? COLOR.EXPLOSION_ORANGE : COLOR.ENEMY_RED;
  for (let y = 30; y <= 84; y += 4) {
    plot(g, 39, y, lamp);
    plot(g, 40, y, lamp);
  }
}

function paint(kind: ObsidianHullKind): SpriteData {
  const g = createGrid(OBSIDIAN_HULL_W, OBSIDIAN_HULL_H, -1);
  paintTails(g);
  paintFuselage(g);
  paintRoots(g);
  paintEngines(g, kind);
  paintIntakes(g);
  paintCanopy(g, kind);
  paintSpine(g, kind);
  paintPanels(g);
  if (kind === 'wreck') paintHoles(g);
  rim(g, K);
  leadingEdge(g);
  return g;
}

export function buildObsidianHull(kind: ObsidianHullKind): SpriteData {
  return paint(kind);
}

/** Blade pointing down. The root is the top row, which the draw pass pivots on. */
export function buildObsidianBlade(kind: 'live' | 'stub'): SpriteData {
  const h = kind === 'stub' ? OBSIDIAN_BLADE_STUB : OBSIDIAN_BLADE_H;
  const w = OBSIDIAN_BLADE_W;
  const g = createGrid(w, h, -1);
  const tip = h - 1;
  fillPoly(
    g,
    [
      [1, 1],
      [w - 2, 1],
      [w - 4, Math.max(4, tip - 2)],
      [6, tip],
      [3, Math.max(4, tip - 2)],
    ],
    D
  );
  fillPoly(
    g,
    [
      [3, 3],
      [w - 4, 3],
      [8, Math.max(6, tip - 4)],
      [6, Math.max(5, tip - 2)],
      [4, Math.max(6, tip - 4)],
    ],
    M
  );
  for (let y = 4; y < tip - 1; y++) {
    plot(g, 6, y, y % 3 === 0 ? COLOR.ENEMY_BRIGHT_RED : COLOR.ENEMY_RED);
    plot(g, 5, y, S);
  }
  for (let y = 6; y < tip - 2; y += 2) {
    plot(g, 3, y, L);
    plot(g, 9, y, P);
  }
  fillEllipse(g, 6, 3, 2, 2, K);
  plot(g, 6, 3, COLOR.ENEMY_VIVID_RED);
  return g;
}

/** Latch that sits on a hinge. Live locks carry the red lamp the player shoots. */
export function buildObsidianHinge(kind: 'live' | 'dead'): SpriteData {
  const g = createGrid(OBSIDIAN_HINGE_W, OBSIDIAN_HINGE_H, -1);
  fillPoly(
    g,
    [
      [2, 1],
      [9, 1],
      [11, 4],
      [11, 10],
      [9, 13],
      [2, 13],
      [0, 10],
      [0, 4],
    ],
    D
  );
  fillPoly(
    g,
    [
      [3, 3],
      [8, 3],
      [9, 5],
      [9, 9],
      [8, 11],
      [3, 11],
      [2, 9],
      [2, 5],
    ],
    M
  );
  const lamp = kind === 'live' ? COLOR.ENEMY_VIVID_RED : S;
  fillEllipse(g, 5.5, 6.5, 2.1, 2.1, lamp);
  plot(g, 5, 6, kind === 'live' ? COLOR.ENEMY_BRIGHT_RED : K);
  plot(g, 6, 6, kind === 'live' ? COLOR.ENEMY_BRIGHT_RED : K);
  plot(g, 3, 3, L);
  plot(g, 8, 3, L);
  return g;
}
