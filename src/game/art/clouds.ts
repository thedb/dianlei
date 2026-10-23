/**
 * Four compact cloud silhouettes, baked once (P18). Shared by the starfield
 * warning band and the ground shadows. No long strips, and a stamp is never
 * turned on its side:
 *
 * - puff 单朵积云: one round body, a low hump, a flat-ish base.
 * - lobes 三瓣积云: three bulbs that merge into one body.
 * - billow 双峰积云: two humps on one compact body.
 * - lump 不规则团块: heavier on the lower right, so a mirror changes it.
 *
 * Placement keeps each stamp in its own horizontal lane, so a faster cloud
 * can pass a slower one without the pixels stacking into a dark blob. Variety
 * is scale, speed, and horizontal / vertical flips — never a 90° turn. Large
 * stamps are slow and may sit past the screen edge on purpose; small ones are
 * fast wisps. A frame only blits the bake.
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

export const CLOUD_KINDS = ['puff', 'lobes', 'billow', 'lump'] as const;
export type CloudKind = (typeof CLOUD_KINDS)[number];

/** Pixels per mask cell. Sky stamps stay a step smaller than shadows. */
export const CLOUD_SKY_CELL = 5;
export const CLOUD_SHADOW_CELL = 6;

export interface CloudStamp {
  kind: CloudKind;
  x: number;
  y: number;
  mirrorX: boolean;
  mirrorY: boolean;
  /** Uniform draw scale. Large masses are slower; wisps are faster. */
  scale: number;
  /** Multiplier on the role's base drift (`WARNING_CLOUD_DRIFT` or `CLOUD_SHADOW_SCROLL`). */
  speed: number;
}

const PUFF = [
  '......####......',
  '....########....',
  '...##########...',
  '..############..',
  '.##############.',
  '################',
  '.##############.',
  '..############..',
  '....########....',
];

const LOBES = [
  '..##....##....##..',
  '.####..####..####.',
  '##################',
  '##################',
  '.################.',
  '..##############..',
  '....##########....',
  '......######......',
];

const BILLOW = [
  '...###....###...',
  '..#####..#####..',
  '.##############.',
  '################',
  '.##############.',
  '..############..',
  '...##########...',
  '.....######.....',
];

const LUMP = [
  '....#####.......',
  '..#########.....',
  '.############...',
  '##############..',
  '.###############',
  '..##############',
  '...############.',
  '....##########..',
  '......####..##..',
  '........########',
  '..........######',
];

const RAW: Record<CloudKind, readonly string[]> = {
  puff: PUFF,
  lobes: LOBES,
  billow: BILLOW,
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
  puff: tight(checked('puff', RAW.puff)),
  lobes: tight(checked('lobes', RAW.lobes)),
  billow: tight(checked('billow', RAW.billow)),
  lump: tight(checked('lump', RAW.lump)),
};

/** Tight `#` / `.` silhouette for `kind`. */
export function cloudMask(kind: CloudKind): readonly string[] {
  return MASKS[kind];
}

/** Baked pixel size of one stamp. Flips do not change it. */
export function cloudExtent(kind: CloudKind, role: 'sky' | 'shadow'): { w: number; h: number } {
  const mask = MASKS[kind];
  const cell = role === 'sky' ? CLOUD_SKY_CELL : CLOUD_SHADOW_CELL;
  return { w: (mask[0]?.length ?? 0) * cell, h: mask.length * cell };
}

/**
 * Starfield warning band. Four shapes, several sizes. Lanes stay apart in x
 * so different speeds never share pixels. The left lump and the right puff
 * are clipped by the screen edge. A tile-boss handoff does not draw this band
 * (it reads as a white sheet).
 */
export const SKY_CLOUDS: readonly CloudStamp[] = [
  { kind: 'lump', x: 12, y: 70, mirrorX: false, mirrorY: false, scale: 1.8, speed: 0.42 },
  { kind: 'puff', x: 124, y: 310, mirrorX: true, mirrorY: false, scale: 0.55, speed: 1.85 },
  { kind: 'lobes', x: 200, y: 150, mirrorX: false, mirrorY: true, scale: 0.95, speed: 0.95 },
  { kind: 'billow', x: 278, y: 520, mirrorX: true, mirrorY: true, scale: 0.58, speed: 1.6 },
  { kind: 'puff', x: 378, y: 400, mirrorX: false, mirrorY: true, scale: 1.7, speed: 0.5 },
];

/**
 * Ground shadows. Same four shapes, own scales and speeds, still one pass.
 * Lanes do not overlap, so a fast wisp crossing a slow mass stays a separate
 * shadow. The left lump and the right puff hang off the screen edge.
 */
export const SHADOW_CLOUDS: readonly CloudStamp[] = [
  { kind: 'lump', x: 6, y: 190, mirrorX: false, mirrorY: false, scale: 1.55, speed: 0.45 },
  { kind: 'puff', x: 114, y: 500, mirrorX: true, mirrorY: false, scale: 0.5, speed: 1.9 },
  { kind: 'billow', x: 184, y: 820, mirrorX: false, mirrorY: true, scale: 0.78, speed: 1.1 },
  { kind: 'lobes', x: 262, y: 1280, mirrorX: true, mirrorY: true, scale: 0.55, speed: 1.55 },
  { kind: 'puff', x: 368, y: 1520, mirrorX: false, mirrorY: true, scale: 1.35, speed: 0.55 },
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
    puff: renderSprite(rasterCloud('puff', role)),
    lobes: renderSprite(rasterCloud('lobes', role)),
    billow: renderSprite(rasterCloud('billow', role)),
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
  mirrorX: boolean,
  mirrorY: boolean,
  scale: number
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const sx = (mirrorX ? -1 : 1) * scale;
  const sy = (mirrorY ? -1 : 1) * scale;
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

/** Screen y of a shadow stamp. `speed` scales `CLOUD_SHADOW_SCROLL`. */
export function shadowOriginY(stampY: number, scroll: number, speed = 1): number {
  const drift = scroll * CLOUD_SHADOW_SCROLL * speed;
  return ((stampY + drift) % CLOUD_SHADOW_SPAN) - CLOUD_SHADOW_MARGIN;
}

/** Screen y of a sky stamp. `speed` scales `WARNING_CLOUD_DRIFT`. */
export function skyOriginY(stampY: number, time: number, speed = 1): number {
  const span = LOGICAL_H + 120;
  const drift = time * WARNING_CLOUD_DRIFT * speed;
  return ((stampY + drift) % span) - 40;
}

export function drawCloudShadows(
  ctx: CanvasRenderingContext2D,
  sheet: CloudSheet,
  scroll: number,
  layerAlpha: number
): void {
  if (layerAlpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = layerAlpha * CLOUD_SHADOW_ALPHA;
  for (const stamp of SHADOW_CLOUDS) {
    const y = shadowOriginY(stamp.y, scroll, stamp.speed);
    const frame = sheet.shadow[stamp.kind];
    blit(ctx, frame, stamp.x, y, stamp.mirrorX, stamp.mirrorY, stamp.scale);
  }
  ctx.restore();
}

export function drawSkyClouds(
  ctx: CanvasRenderingContext2D,
  sheet: CloudSheet,
  time: number,
  alpha: number
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha * WARNING_CLOUD_ALPHA;
  for (const cloud of SKY_CLOUDS) {
    const y = skyOriginY(cloud.y, time, cloud.speed);
    blit(ctx, sheet.sky[cloud.kind], cloud.x, y, cloud.mirrorX, cloud.mirrorY, cloud.scale);
  }
  ctx.restore();
}
