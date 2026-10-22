/**
 * Four cloud silhouettes, baked once and shared by the warning band and the
 * ground shadows (P15). They are not one ellipse resized:
 *
 * - shelf 扁长积云: wide and flat, two low humps, a level base.
 * - lobes 鼓包多瓣: three round bulbs that merge into one body.
 * - streak 薄卷云条: a two-pixel wisp sloping up to the right, with a gap
 *   and a hook at the lower left.
 * - lump 不规则团块: an off-balance mass, heavier on the lower right, with a
 *   notch and a small upper-right knob. Mirroring it changes the outline.
 *
 * Ground shadows place these with quarter-turns, horizontal mirrors, and
 * stacks of two or three. A frame only blits the baked sprites.
 */

import {
  CLOUD_SHADOW_ALPHA,
  CLOUD_SHADOW_MARGIN,
  CLOUD_SHADOW_SCROLL,
  CLOUD_SHADOW_SPAN,
  LOGICAL_H,
  WARNING_CLOUD_ALPHA,
  WARNING_CLOUD_DRIFT,
} from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid } from './pixelDraw';
import { renderSprite } from './spriteRenderer';
import type { SpriteData, SpriteFrame } from './types';

export const CLOUD_KINDS = ['shelf', 'lobes', 'streak', 'lump'] as const;
export type CloudKind = (typeof CLOUD_KINDS)[number];

/** Pixels per mask cell. Sky stamps stay flatter; shadows are a step larger. */
export const CLOUD_SKY_CELL = 5;
export const CLOUD_SHADOW_CELL = 6;

export type CloudTurn = 0 | 1 | 2 | 3;

export interface SkyCloud {
  kind: CloudKind;
  x: number;
  y: number;
  turns: CloudTurn;
  mirrorX: boolean;
}

export interface CloudStamp {
  kind: CloudKind;
  turns: CloudTurn;
  mirrorX: boolean;
  dx: number;
  dy: number;
}

export interface ShadowCluster {
  x: number;
  y: number;
  stamps: readonly CloudStamp[];
}

const SHELF = [
  '...........####......####...........',
  '........##########..##########......',
  '......############################..',
  '....################################',
  '..##################################',
  '####################################',
  '####################################',
  '.##################################.',
];

const LOBES = [
  '....##.......##.......##....',
  '...####.....####.....####...',
  '..######...######...######..',
  '############################',
  '############################',
  '############################',
  '.##########################.',
  '..########################..',
  '...######################...',
  '....####################....',
  '......################......',
  '........############........',
  '..........########..........',
];

const STREAK = [
  '..........................................',
  '................................####......',
  '........................############......',
  '...................#############..........',
  '........########...#####..................',
  '################..........................',
  '########..................................',
  '#####.....................................',
];

const LUMP = [
  '....######................',
  '..##########..............',
  '.##############..##.......',
  '################.####.....',
  '##################..###...',
  '.####################.....',
  '..######################..',
  '....######################',
  '......####################',
  '....####################..',
  '......######..########....',
  '........############......',
  '..........########........',
];

const RAW: Record<CloudKind, readonly string[]> = {
  shelf: SHELF,
  lobes: LOBES,
  streak: STREAK,
  lump: LUMP,
};

function checked(kind: CloudKind, rows: readonly string[]): readonly string[] {
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error(`cloud ${kind} is empty`);
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`cloud ${kind} row width ${row.length} !== ${width}`);
    }
    for (const ch of row) {
      if (ch !== '#' && ch !== '.') throw new Error(`cloud ${kind} has '${ch}'`);
    }
  }
  return rows;
}

function tight(rows: readonly string[]): readonly string[] {
  let top = 0;
  let bottom = rows.length - 1;
  while (top <= bottom && !rows[top]!.includes('#')) top++;
  while (bottom >= top && !rows[bottom]!.includes('#')) bottom--;
  const body = rows.slice(top, bottom + 1);
  let left = body[0]?.length ?? 0;
  let right = 0;
  for (const row of body) {
    const a = row.indexOf('#');
    const b = row.lastIndexOf('#');
    if (a >= 0) left = Math.min(left, a);
    if (b >= 0) right = Math.max(right, b);
  }
  return body.map((row) => row.slice(left, right + 1));
}

const MASKS: Record<CloudKind, readonly string[]> = {
  shelf: tight(checked('shelf', RAW.shelf)),
  lobes: tight(checked('lobes', RAW.lobes)),
  streak: tight(checked('streak', RAW.streak)),
  lump: tight(checked('lump', RAW.lump)),
};

/** Tight `#` / `.` silhouette for `kind`. */
export function cloudMask(kind: CloudKind): readonly string[] {
  return MASKS[kind];
}

/**
 * Warning band. One stamp each, so the four outlines stay readable.
 * Mirrors and a half-turn keep a repeated kind from looking copied.
 */
export const SKY_CLOUDS: readonly SkyCloud[] = [
  { kind: 'shelf', x: 70, y: 20, turns: 0, mirrorX: false },
  { kind: 'lobes', x: 220, y: 100, turns: 0, mirrorX: false },
  { kind: 'streak', x: 300, y: 40, turns: 0, mirrorX: false },
  { kind: 'lump', x: 130, y: 190, turns: 0, mirrorX: false },
  { kind: 'shelf', x: 250, y: 280, turns: 0, mirrorX: true },
  { kind: 'lobes', x: 80, y: 360, turns: 0, mirrorX: true },
  { kind: 'streak', x: 180, y: 450, turns: 2, mirrorX: true },
  { kind: 'lump', x: 300, y: 560, turns: 2, mirrorX: false },
];

/**
 * Ground shadows. Each cluster stacks two or three shapes. Spacing is wide
 * on purpose: a screen shows one or two clusters, not a blanket of ellipses.
 */
export const SHADOW_CLUSTERS: readonly ShadowCluster[] = [
  {
    x: 150,
    y: 120,
    stamps: [
      { kind: 'shelf', turns: 0, mirrorX: false, dx: -10, dy: 6 },
      { kind: 'lump', turns: 0, mirrorX: true, dx: 46, dy: -12 },
    ],
  },
  {
    x: 230,
    y: 520,
    stamps: [
      { kind: 'lobes', turns: 0, mirrorX: false, dx: -28, dy: 0 },
      { kind: 'lobes', turns: 0, mirrorX: true, dx: 34, dy: 8 },
      { kind: 'streak', turns: 2, mirrorX: false, dx: 4, dy: 22 },
    ],
  },
  {
    x: 110,
    y: 920,
    stamps: [
      { kind: 'lump', turns: 1, mirrorX: false, dx: 0, dy: 0 },
      { kind: 'shelf', turns: 2, mirrorX: true, dx: 24, dy: 16 },
    ],
  },
  {
    x: 250,
    y: 1320,
    stamps: [
      { kind: 'streak', turns: 0, mirrorX: true, dx: -16, dy: -8 },
      { kind: 'lobes', turns: 2, mirrorX: true, dx: 18, dy: 6 },
    ],
  },
];

function edgeCell(mask: readonly string[], c: number, r: number): boolean {
  const row = mask[r] ?? '';
  if (c === 0 || r === 0 || c === row.length - 1 || r === mask.length - 1) return true;
  return (
    mask[r - 1]?.[c] !== '#' || mask[r + 1]?.[c] !== '#' || row[c - 1] !== '#' || row[c + 1] !== '#'
  );
}

function skyColor(c: number, r: number, cols: number, rows: number, edge: boolean): number {
  if (edge) return COLOR.LIGHT_GRAY;
  if (c < cols * 0.4 && r < rows * 0.45) return COLOR.PLAYER_WHITE;
  return COLOR.PALE_GRAY;
}

/** Expand a mask into palette pixels. `shadow` is one flat colour. */
export function rasterCloud(kind: CloudKind, role: 'sky' | 'shadow'): SpriteData {
  const mask = MASKS[kind];
  const cell = role === 'sky' ? CLOUD_SKY_CELL : CLOUD_SHADOW_CELL;
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const grid = createGrid(cols * cell, rows * cell, -1);
  for (let r = 0; r < rows; r++) {
    const src = mask[r] ?? '';
    for (let c = 0; c < cols; c++) {
      if (src[c] !== '#') continue;
      const color =
        role === 'shadow' ? COLOR.SHADOW : skyColor(c, r, cols, rows, edgeCell(mask, c, r));
      for (let dy = 0; dy < cell; dy++) {
        const dest = grid[r * cell + dy];
        if (!dest) continue;
        for (let dx = 0; dx < cell; dx++) dest[c * cell + dx] = color;
      }
    }
  }
  return grid;
}

export interface CloudSheet {
  sky: Record<CloudKind, SpriteFrame>;
  shadow: Record<CloudKind, SpriteFrame>;
}

function bakeRole(role: 'sky' | 'shadow'): Record<CloudKind, SpriteFrame> {
  return {
    shelf: renderSprite(rasterCloud('shelf', role)),
    lobes: renderSprite(rasterCloud('lobes', role)),
    streak: renderSprite(rasterCloud('streak', role)),
    lump: renderSprite(rasterCloud('lump', role)),
  };
}

/** Boot-time bake. Draw paths only blit these frames. */
export function createCloudSheet(): CloudSheet {
  return { sky: bakeRole('sky'), shadow: bakeRole('shadow') };
}

function blit(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  turns: CloudTurn,
  mirrorX: boolean
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (turns !== 0) ctx.rotate((turns * Math.PI) / 2);
  if (mirrorX) ctx.scale(-1, 1);
  ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

/** Screen y of a shadow cluster's anchor. Wraps across `CLOUD_SHADOW_SPAN`. */
export function shadowOriginY(clusterY: number, scroll: number): number {
  const drift = scroll * CLOUD_SHADOW_SCROLL;
  return ((clusterY + drift) % CLOUD_SHADOW_SPAN) - CLOUD_SHADOW_MARGIN;
}

export function drawCloudShadows(
  ctx: CanvasRenderingContext2D,
  sheet: CloudSheet,
  scroll: number,
  layerAlpha: number
): void {
  if (layerAlpha <= 0.01) return;
  ctx.globalAlpha = layerAlpha * CLOUD_SHADOW_ALPHA;
  for (const cluster of SHADOW_CLUSTERS) {
    const y = shadowOriginY(cluster.y, scroll);
    for (const stamp of cluster.stamps) {
      const frame = sheet.shadow[stamp.kind];
      blit(ctx, frame, cluster.x + stamp.dx, y + stamp.dy, stamp.turns, stamp.mirrorX);
    }
  }
}

export function drawSkyClouds(
  ctx: CanvasRenderingContext2D,
  sheet: CloudSheet,
  time: number,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha * WARNING_CLOUD_ALPHA;
  const drift = time * WARNING_CLOUD_DRIFT;
  const span = LOGICAL_H + 120;
  for (const cloud of SKY_CLOUDS) {
    const y = ((cloud.y + drift) % span) - 40;
    blit(ctx, sheet.sky[cloud.kind], cloud.x, y, cloud.turns, cloud.mirrorX);
  }
}
