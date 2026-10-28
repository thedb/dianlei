/**
 * Moving swell over the open sea. Chunks stay baked. This pass draws sparse
 * broken dashes whose screen position lags the map scroll and also drifts
 * with the stage clock, so the surface slides instead of sitting in the tile.
 *
 * Only `ocean` / `oceanB` / the legacy water tiles / `wake` receive a dash.
 * Deck, hull, wreck, and gun-pad cells are skipped, so a crest breaks around
 * a ship instead of painting across it.
 */

import {
  LOGICAL_H,
  MAP_CROP_X,
  MAP_TILES_X,
  SEA_SWELL_DRIFT,
  SEA_SWELL_SCROLL,
  SEA_SWELL_SPACING,
  SEA_SWELL_SPECK_DRIFT,
  SEA_SWELL_SPECK_SCROLL,
  SEA_SWELL_SPECK_SPACING,
  TILE_SIZE,
} from '@/game/config';
import { TileId, hash } from '@/game/art/tiles';
import { COLOR, PALETTE } from '@/game/palette';
import {
  backdropSegments,
  segmentScreenSpan,
  type BackdropSegment,
  type TrackLayer,
} from '@/game/maps/track';

const SWELL_TILES: ReadonlySet<number> = new Set([
  TileId.ocean,
  TileId.oceanB,
  TileId.water,
  TileId.waterB,
  TileId.wake,
]);

export function isSwellTile(id: number | null | undefined): boolean {
  return id != null && SWELL_TILES.has(id);
}

/** Screen y of one family of crests. Spacing stays well above the old 8px bands. */
export function swellCrestScreenYs(
  scroll: number,
  time: number,
  spacing = SEA_SWELL_SPACING,
  scrollLag = SEA_SWELL_SCROLL,
  drift = SEA_SWELL_DRIFT
): number[] {
  const phase = scroll * scrollLag + time * drift;
  const origin = ((phase % spacing) + spacing) % spacing;
  const ys: number[] = [];
  for (let y = origin - spacing; y < LOGICAL_H; y += spacing) {
    if (y >= -1 && y < LOGICAL_H) ys.push(y);
  }
  return ys;
}

function segmentsFor(layer: TrackLayer, scroll: number): BackdropSegment[] {
  const local = Math.floor(scroll - layer.origin);
  const mapPx = layer.grid.length * TILE_SIZE;
  const loopPx = layer.loopFrom === null ? null : layer.loopFrom * TILE_SIZE;
  return backdropSegments(local, mapPx, loopPx, LOGICAL_H);
}

/** Tile under a screen point, using the same segment scroll as the map blit. */
export function swellTileAt(
  layer: TrackLayer,
  scroll: number,
  col: number,
  screenY: number,
  segs: readonly BackdropSegment[] = segmentsFor(layer, scroll)
): number | null {
  if (col < 0 || col >= MAP_TILES_X) return null;
  for (const seg of segs) {
    const span = segmentScreenSpan(seg);
    if (screenY < span.top || screenY >= span.bottom) continue;
    const mapY = seg.local + LOGICAL_H - screenY;
    const row = Math.floor(mapY / TILE_SIZE);
    const line = layer.grid[row];
    if (!line) return null;
    return line[col] ?? null;
  }
  return null;
}

function rgba(index: number, alpha: number): string {
  const hex = PALETTE[index] ?? '#1a3050';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const CREST = rgba(COLOR.WATER_MEDIUM, 0.32);
const GLINT = rgba(COLOR.WATER_SHALLOW, 0.28);
const TROUGH = rgba(COLOR.WATER_DEEP, 0.22);
const SPECK = rgba(COLOR.WATER_FOAM, 0.4);

function segmentAt(segs: readonly BackdropSegment[], screenY: number): BackdropSegment | null {
  for (const seg of segs) {
    const box = segmentScreenSpan(seg);
    if (screenY >= box.top && screenY < box.bottom) return seg;
  }
  return null;
}

function paintDashes(
  ctx: CanvasRenderingContext2D,
  layer: TrackLayer,
  segs: readonly BackdropSegment[],
  screenY: number,
  kind: 'crest' | 'trough' | 'speck'
): void {
  const seg = segmentAt(segs, screenY);
  if (!seg) return;
  const y0 = Math.floor(screenY);
  const mapY = seg.local + LOGICAL_H - screenY;
  const row = Math.floor(mapY / TILE_SIZE);
  const tileTop = Math.floor(seg.local + LOGICAL_H - (row + 1) * TILE_SIZE);
  const tileBottom = tileTop + TILE_SIZE;
  for (let col = 0; col < MAP_TILES_X; col++) {
    const tile = swellTileAt(layer, 0, col, screenY, segs);
    if (!isSwellTile(tile)) continue;
    const n = hash(col + 3, y0 + kind.length * 17);
    if (kind === 'speck') {
      if (n % 7 !== 0) continue;
    } else if (kind === 'trough') {
      if (n % 2 === 0) continue;
    } else if (n % 3 === 0) {
      continue;
    }
    const wobble = kind === 'speck' ? 0 : (n % 3) - 1;
    const y = Math.min(tileBottom - 1, Math.max(tileTop, y0 + wobble));
    const x0 = col * TILE_SIZE - MAP_CROP_X;
    if (kind === 'speck') {
      ctx.fillStyle = SPECK;
      ctx.fillRect(x0 + (n % 12) + 2, y, 1, 1);
      continue;
    }
    const inset = 1 + (n % 4);
    const w = Math.min(kind === 'trough' ? 8 : 5 + (n % 5), TILE_SIZE - inset - 1);
    const h = kind === 'trough' ? Math.min(2, tileBottom - y) : 1;
    ctx.fillStyle = kind === 'trough' ? TROUGH : CREST;
    ctx.fillRect(x0 + inset, y, w, h);
    const glintY = y + 2;
    if (kind === 'crest' && n % 5 === 1 && glintY < tileBottom) {
      ctx.fillStyle = GLINT;
      ctx.fillRect(x0 + inset + 1, glintY, 2, 1);
    }
  }
}

/**
 * Draw the swell for one sea layer. `alpha` is that layer's fade.
 * No-op for any other map, and it does not touch the context in that case.
 */
export function drawSeaSwell(
  ctx: CanvasRenderingContext2D,
  layer: TrackLayer,
  scroll: number,
  time: number,
  alpha: number
): void {
  if (alpha <= 0.05) return;
  if (layer.map.id !== 'seaB' && layer.map.id !== 'obsidianBoss') return;
  const segs = segmentsFor(layer, scroll);
  if (segs.length === 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const y of swellCrestScreenYs(scroll, time)) {
    paintDashes(ctx, layer, segs, y, 'crest');
    paintDashes(ctx, layer, segs, y + SEA_SWELL_SPACING / 2, 'trough');
  }
  for (const y of swellCrestScreenYs(
    scroll,
    time,
    SEA_SWELL_SPECK_SPACING,
    SEA_SWELL_SPECK_SCROLL,
    SEA_SWELL_SPECK_DRIFT
  )) {
    paintDashes(ctx, layer, segs, y, 'speck');
  }
  ctx.restore();
}
