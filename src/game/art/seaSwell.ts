/**
 * Moving swell over the open sea. Chunks stay baked. This pass draws short
 * broken crests whose screen position lags the map scroll and also drifts
 * with the stage clock.
 *
 * Several wavelengths run at once (two crest families, a trough family, and
 * foam). Each wave's phase, whether it is drawn, how long its runs are, and
 * where the foam sits come from `hash(family, wave index)` — and, for a
 * column's width, from that column too. The hash does not include screen y
 * or the frame, so a crest keeps its shape while it travels and the same
 * scroll and time always redraw the same dashes.
 *
 * Only `ocean` / `oceanB` and the legacy water tiles receive a mark.
 * Deck, hull, wreck, gun pads, and the enemy deck are skipped. Crests are
 * broken bands of shallow blue with a foam cap, troughs are deep blue, and
 * foam specks are 2×2. Spacing stays wide so this is not a scanline field.
 * Alphas and pixel heights stay at the signed-off contrast.
 */

import {
  LOGICAL_H,
  MAP_CROP_X,
  MAP_TILES_X,
  SEA_SWELL_DRIFT,
  SEA_SWELL_JITTER,
  SEA_SWELL_LONG_DRIFT,
  SEA_SWELL_LONG_SCROLL,
  SEA_SWELL_LONG_SPACING,
  SEA_SWELL_SCROLL,
  SEA_SWELL_SPACING,
  SEA_SWELL_SPECK_DRIFT,
  SEA_SWELL_SPECK_SCROLL,
  SEA_SWELL_SPECK_SPACING,
  SEA_SWELL_TROUGH_DRIFT,
  SEA_SWELL_TROUGH_SCROLL,
  SEA_SWELL_TROUGH_SPACING,
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
]);

type SwellKind = 'crest' | 'trough' | 'speck';

interface SwellFamily {
  id: number;
  kind: SwellKind;
  spacing: number;
  scroll: number;
  drift: number;
}

const FAMILIES: readonly SwellFamily[] = [
  {
    id: 1,
    kind: 'crest',
    spacing: SEA_SWELL_SPACING,
    scroll: SEA_SWELL_SCROLL,
    drift: SEA_SWELL_DRIFT,
  },
  {
    id: 2,
    kind: 'crest',
    spacing: SEA_SWELL_LONG_SPACING,
    scroll: SEA_SWELL_LONG_SCROLL,
    drift: SEA_SWELL_LONG_DRIFT,
  },
  {
    id: 3,
    kind: 'trough',
    spacing: SEA_SWELL_TROUGH_SPACING,
    scroll: SEA_SWELL_TROUGH_SCROLL,
    drift: SEA_SWELL_TROUGH_DRIFT,
  },
  {
    id: 4,
    kind: 'speck',
    spacing: SEA_SWELL_SPECK_SPACING,
    scroll: SEA_SWELL_SPECK_SCROLL,
    drift: SEA_SWELL_SPECK_DRIFT,
  },
];

export function isSwellTile(id: number | null | undefined): boolean {
  return id != null && SWELL_TILES.has(id);
}

function familyById(id: number): SwellFamily {
  return FAMILIES.find((family) => family.id === id) ?? FAMILIES[0]!;
}

/** About one wave in five is left out, so a family is not a filled comb. */
export function swellWaveKept(familyId: number, index: number): boolean {
  return hash(familyId + 3, index) % 5 !== 0;
}

/** ±SEA_SWELL_JITTER, stable for a family and a wave index. */
function waveJitter(familyId: number, index: number): number {
  const span = SEA_SWELL_JITTER * 2 + 1;
  return (hash(familyId, index) % span) - SEA_SWELL_JITTER;
}

/**
 * Screen y of one wave. `index` is the wave's identity: the same index
 * keeps its jitter as scroll and time move it.
 */
export function swellWaveScreenY(
  scroll: number,
  time: number,
  index: number,
  spacing = SEA_SWELL_SPACING,
  scrollLag = SEA_SWELL_SCROLL,
  drift = SEA_SWELL_DRIFT,
  familyId = 1
): number {
  const phase = scroll * scrollLag + time * drift;
  return phase - index * spacing + waveJitter(familyId, index);
}

function visibleIndices(phase: number, spacing: number): number[] {
  const pad = SEA_SWELL_JITTER + 4;
  const lo = Math.floor((phase - LOGICAL_H - pad - SEA_SWELL_JITTER) / spacing);
  const hi = Math.ceil((phase + pad + SEA_SWELL_JITTER) / spacing);
  const indices: number[] = [];
  for (let index = lo; index <= hi; index++) indices.push(index);
  return indices;
}

/** On-screen y of one family, kept waves only, ascending. */
export function swellFamilyScreenYs(scroll: number, time: number, familyId = 1): number[] {
  const family = familyById(familyId);
  const phase = scroll * family.scroll + time * family.drift;
  const ys: number[] = [];
  for (const index of visibleIndices(phase, family.spacing)) {
    if (!swellWaveKept(family.id, index)) continue;
    const y = phase - index * family.spacing + waveJitter(family.id, index);
    if (y >= -SEA_SWELL_JITTER && y < LOGICAL_H) ys.push(y);
  }
  ys.sort((a, b) => a - b);
  return ys;
}

/**
 * Columns a crest or trough paints. One to three runs of 3–7 columns,
 * with a gap between runs, so a wave does not cross the whole screen.
 */
export function swellRunColumns(familyId: number, index: number): number[] {
  const n = hash(familyId + 5, index);
  const count = 1 + (n % 3);
  const cols: number[] = [];
  let col = n % 6;
  for (let i = 0; i < count; i++) {
    const h = hash(familyId * 19 + i + 8, index);
    const len = 3 + (h % 5);
    const fit = Math.min(len, MAP_TILES_X - col);
    if (fit >= 3) {
      for (let c = col; c < col + fit; c++) cols.push(c);
    }
    col += Math.max(fit, 0) + 2 + (h % 4);
    if (col >= MAP_TILES_X) break;
  }
  return cols;
}

/**
 * Foam on a crest column. The modulus depends on the wave, so neighboring
 * waves are not the same density, and the choice does not follow screen y.
 */
export function swellShowsFoam(familyId: number, index: number, col: number): boolean {
  const density = 2 + (hash(familyId + 29, index) % 3);
  return hash(familyId + 40, index * MAP_TILES_X + col) % density === 0;
}

/** Five to nine foam specks, scattered columns, not a dotted row. */
export function swellSpeckColumns(familyId: number, index: number): number[] {
  const count = 5 + (hash(familyId + 7, index) % 5);
  const cols: number[] = [];
  let salt = 0;
  while (cols.length < count && salt < 40) {
    const col = hash(familyId + 50 + salt, index) % MAP_TILES_X;
    salt += 1;
    if (!cols.includes(col)) cols.push(col);
  }
  return cols;
}

function columnNudge(familyId: number, index: number, col: number, span: number): number {
  return (hash(familyId + 70, index * MAP_TILES_X + col) % span) - (span >> 1);
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

const CREST = rgba(COLOR.WATER_SHALLOW, 0.92);
const GLINT = rgba(COLOR.WATER_FOAM, 0.95);
const TROUGH = rgba(COLOR.WATER_DEEP, 0.82);
const SPECK = rgba(COLOR.WATER_FOAM, 1);

function segmentAt(segs: readonly BackdropSegment[], screenY: number): BackdropSegment | null {
  for (const seg of segs) {
    const box = segmentScreenSpan(seg);
    if (screenY >= box.top && screenY < box.bottom) return seg;
  }
  return null;
}

function paintMark(
  ctx: CanvasRenderingContext2D,
  layer: TrackLayer,
  segs: readonly BackdropSegment[],
  screenY: number,
  col: number,
  kind: SwellKind,
  familyId: number,
  index: number
): void {
  const tile = swellTileAt(layer, 0, col, screenY, segs);
  if (!isSwellTile(tile)) return;
  const seg = segmentAt(segs, screenY);
  if (!seg) return;
  const mapY = seg.local + LOGICAL_H - screenY;
  const row = Math.floor(mapY / TILE_SIZE);
  const tileTop = Math.floor(seg.local + LOGICAL_H - (row + 1) * TILE_SIZE);
  const tileBottom = tileTop + TILE_SIZE;
  const y = Math.min(tileBottom - 1, Math.max(tileTop, Math.floor(screenY)));
  const x0 = col * TILE_SIZE - MAP_CROP_X;
  const n = hash(familyId * 17 + col, index);
  if (kind === 'speck') {
    const speck = Math.min(2, tileBottom - y);
    ctx.fillStyle = SPECK;
    ctx.fillRect(x0 + (n % 10) + 2, y, 2, speck);
    return;
  }
  const inset = 1 + (n % 3);
  const w = Math.min(kind === 'trough' ? 10 + (n % 4) : 8 + (n % 5), TILE_SIZE - inset);
  const h = Math.min(kind === 'trough' ? 3 : 2, tileBottom - y);
  ctx.fillStyle = kind === 'trough' ? TROUGH : CREST;
  ctx.fillRect(x0 + inset, y, w, h);
  const glintY = y + h;
  if (kind === 'crest' && swellShowsFoam(familyId, index, col) && glintY < tileBottom) {
    ctx.fillStyle = GLINT;
    ctx.fillRect(x0 + inset, glintY, Math.min(4, w), 1);
  }
}

function paintFamily(
  ctx: CanvasRenderingContext2D,
  layer: TrackLayer,
  segs: readonly BackdropSegment[],
  scroll: number,
  time: number,
  family: SwellFamily
): void {
  const phase = scroll * family.scroll + time * family.drift;
  for (const index of visibleIndices(phase, family.spacing)) {
    if (!swellWaveKept(family.id, index)) continue;
    const y = phase - index * family.spacing + waveJitter(family.id, index);
    if (family.kind === 'speck') {
      const span = 5;
      for (const col of swellSpeckColumns(family.id, index)) {
        paintMark(
          ctx,
          layer,
          segs,
          y + columnNudge(family.id, index, col, span),
          col,
          family.kind,
          family.id,
          index
        );
      }
      continue;
    }
    const span = 3;
    for (const col of swellRunColumns(family.id, index)) {
      paintMark(
        ctx,
        layer,
        segs,
        y + columnNudge(family.id, index, col, span),
        col,
        family.kind,
        family.id,
        index
      );
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
  for (const family of FAMILIES) paintFamily(ctx, layer, segs, scroll, time, family);
  ctx.restore();
}
