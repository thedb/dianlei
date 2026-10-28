/**
 * 黑曜 hull, 80×96, nose down. A swept carrier fighter: twin tails, twin
 * nozzles, intakes, a layered canopy, and wing-root rails. Dark metal so
 * the silhouette reads on the bright deck. Overload only recolors the
 * canopy to warning yellow. The wreck keeps the outline, kills the nozzles,
 * and opens interior holes. No player cyan.
 */

import { OBSIDIAN_HULL_H, OBSIDIAN_HULL_W } from '@/game/config';
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
  if (y < 10 || y > 93) return -1;
  if (y < 18) return 3.6;
  if (y < 28) return 4.2 + ((y - 18) / 10) * 2.4;
  if (y < 58) return 6.6 + ((y - 28) / 30) * 1.6;
  if (y < 74) return 8.2 - ((y - 58) / 16) * 2.4;
  if (y < 86) return 5.8 - ((y - 74) / 12) * 3.2;
  return Math.max(0.45, 2.6 - (y - 86) * 0.32);
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

function paintWings(g: SpriteData): void {
  const wing: Pt[] = [
    [29, 56],
    [5, 46],
    [2, 36],
    [7, 29],
    [31, 40],
  ];
  polyPair(g, wing, D);
  const inner: Pt[] = [
    [28, 54],
    [10, 46],
    [8, 36],
    [12, 32],
    [30, 42],
  ];
  polyPair(g, inner, M);
  const strake: Pt[] = [
    [27, 54],
    [18, 66],
    [22, 70],
    [31, 58],
  ];
  polyPair(g, strake, D);
  const fin: Pt[] = [
    [14, 18],
    [22, 16],
    [20, 32],
  ];
  polyPair(g, fin, G);
}

function paintTails(g: SpriteData): void {
  const tail: Pt[] = [
    [11, 1],
    [23, 1],
    [21, 13],
    [9, 16],
  ];
  polyPair(g, tail, D);
  const tailFace: Pt[] = [
    [13, 3],
    [21, 3],
    [19, 12],
    [12, 13],
  ];
  polyPair(g, tailFace, M);
  for (let y = 4; y <= 11; y++) {
    plot(g, 16, y, L);
    plot(g, mirrorX(16), y, L);
  }
}

function paintEngines(g: SpriteData, kind: ObsidianHullKind): void {
  const dead = kind === 'wreck';
  for (const cx of [23.5, 55.5]) {
    fillEllipse(g, cx, 11, 5.2, 6.2, dead ? S : D);
    fillEllipse(g, cx, 11.5, 3.1, 4.2, dead ? K : S);
    if (!dead) {
      fillEllipse(g, cx, 12, 1.6, 2.6, P);
      plot(g, Math.round(cx), 12, W);
    }
  }
}

function paintIntakes(g: SpriteData): void {
  for (const x0 of [28, 47]) {
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

function paintRails(g: SpriteData): void {
  for (const x0 of [16, 60]) {
    for (let y = 52; y <= 60; y++) {
      plot(g, x0, y, D);
      plot(g, x0 + 1, y, M);
      plot(g, x0 + 2, y, D);
    }
    plot(g, x0, 61, P);
    plot(g, x0 + 1, 61, P);
    plot(g, x0 + 2, 61, P);
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
  const holes: Array<readonly [number, number, number, number]> = [
    [14, 38, 6, 5],
    [60, 37, 6, 5],
    [37, 48, 6, 8],
  ];
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

function paint(kind: ObsidianHullKind): SpriteData {
  const g = createGrid(OBSIDIAN_HULL_W, OBSIDIAN_HULL_H, -1);
  paintWings(g);
  paintTails(g);
  paintFuselage(g);
  paintEngines(g, kind);
  paintIntakes(g);
  paintRails(g);
  paintCanopy(g, kind);
  paintPanels(g);
  if (kind === 'wreck') paintHoles(g);
  rim(g, K);
  leadingEdge(g);
  return g;
}

export function buildObsidianHull(kind: ObsidianHullKind): SpriteData {
  return paint(kind);
}
