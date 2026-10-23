/**
 * Background track: which maps scroll by, from what world scroll, and when
 * they blend. A stage builds one from `StageData.maps`; 地图预览 builds one
 * for a single map or for a stage's whole pre-boss run.
 *
 * World scroll is the pixels the ground has travelled. A layer's `origin` is
 * the world scroll at which its row 0 sits on the bottom edge of the screen.
 */

import { BG_SCROLL_SPEED, LOGICAL_H, MAP_BLEND_LEAD, MAP_CROP_X, TILE_SIZE } from '@/game/config';
import type { StageData } from '@/game/levels/types';
import { getMap, getMapGrid, getTileMap } from './registry';
import { terrainAt } from './terrain';
import type { TileGrid, TileMapDef } from './types';

/** `run` is the stage approach. `boss` fades in at the warning and may loop. */
export type LayerRole = 'run' | 'boss';

/**
 * What the warning does to the ground.
 * `starfield`: tiles fade out, stars fade in, scroll stops (a space stage).
 * `tiles`: the run stays opaque and the boss map is stitched on past it.
 * `none`: no warning sequence (map preview, or a stage run that stops at the warning).
 */
export type MapHandoff = 'starfield' | 'tiles' | 'none';

export interface TrackLayer {
  map: TileMapDef;
  grid: TileGrid;
  origin: number;
  /** Handover time (s) this layer blends in at; null = shown from the start. */
  inAt: number | null;
  /** Handover time (s) the next layer takes over; null = stays to the end. */
  outAt: number | null;
  role: LayerRole;
  /** Tile row where this layer starts repeating. Null = finite. */
  loopFrom: number | null;
}

export interface BackgroundTrack {
  label: string;
  layers: readonly TrackLayer[];
  /** Warning clock. Null = the track never plays the warning. */
  warningAt: number | null;
  /** Starfield from the first frame, no tiles (宇宙A preview). */
  starsOnly: boolean;
  handoff: MapHandoff;
  /** Game time at which the track is over (地图预览 leaves). Null = never. */
  endAt: number | null;
}

/** One blit of a background layer: authored pixels `[y0, y1)` at scroll `local`. */
export interface BackdropSegment {
  local: number;
  y0: number;
  y1: number;
}

/**
 * Visible pieces of a layer. A looping layer splits into two segments when the
 * seam is on screen: the end of the loop, then its start again above that.
 * `local` is the integer world scroll minus the layer origin. Y grows upward.
 */
export function backdropSegments(
  local: number,
  mapPx: number,
  loopFromPx: number | null,
  viewH: number
): BackdropSegment[] {
  const view1 = local + viewH;
  if (loopFromPx === null || loopFromPx >= mapPx || mapPx - loopFromPx <= 0) {
    const y0 = Math.max(0, local);
    const y1 = Math.min(mapPx, view1);
    return y1 > y0 ? [{ local, y0, y1 }] : [];
  }
  const span = mapPx - loopFromPx;
  const segs: BackdropSegment[] = [];
  // A negative local means the layer has not reached the view yet. Start at
  // its first pixel so the bottom row enters from the top instead of the
  // whole first screen popping on.
  let u = Math.max(0, local);
  while (u < view1 && segs.length < 3) {
    const y = u < loopFromPx ? u : loopFromPx + ((u - loopFromPx) % span);
    const room = u < loopFromPx ? loopFromPx - u : span - (y - loopFromPx);
    const run = Math.min(view1 - u, room);
    if (run <= 0) break;
    segs.push({ local: local - u + y, y0: y, y1: y + run });
    u += run;
  }
  return segs;
}

/** Screen interval of one backdrop segment. Y grows downward. */
export function segmentScreenSpan(
  seg: BackdropSegment,
  viewH = LOGICAL_H
): { top: number; bottom: number } {
  const top = seg.local + viewH - seg.y1;
  return { top, bottom: top + (seg.y1 - seg.y0) };
}

function tilePreviewEnd(map: TileMapDef): number {
  const mapPx = map.rows * TILE_SIZE;
  if (map.loopFrom === undefined) return (mapPx - LOGICAL_H) / BG_SCROLL_SPEED;
  const span = mapPx - map.loopFrom * TILE_SIZE;
  return (mapPx + span - LOGICAL_H) / BG_SCROLL_SPEED;
}

function runLayer(
  entry: StageData['maps']['run'][number],
  index: number,
  nextAt: number | undefined
): TrackLayer {
  return {
    map: getTileMap(entry.map),
    grid: getMapGrid(entry.map),
    origin: index === 0 ? 0 : (entry.at - MAP_BLEND_LEAD) * BG_SCROLL_SPEED,
    inAt: index === 0 ? null : entry.at,
    outAt: nextAt ?? null,
    role: 'run',
    loopFrom: null,
  };
}

/**
 * The stage's maps in order. Entry `i > 0` starts `MAP_BLEND_LEAD` seconds
 * before its handover time so it is already scrolling as it fades in.
 * A tile boss is stitched on past the last run map (its row 0 meets that
 * map's last row) and then loops. A starfield boss keeps the warning-to-stars
 * handoff and is not a layer.
 */
export function buildStageTrack(stage: StageData): BackgroundTrack {
  const run = stage.maps.run;
  const boss = getMap(stage.maps.boss);
  const layers = run.map((entry, i) => runLayer(entry, i, run[i + 1]?.at));
  if (boss.kind === 'starfield') {
    return {
      label: stage.label,
      layers,
      warningAt: stage.warningAt,
      starsOnly: false,
      handoff: 'starfield',
      endAt: null,
    };
  }
  if (boss.loopFrom === undefined) {
    throw new Error(`stage ${stage.id}: boss map ${boss.id} must set loopFrom`);
  }
  const lastRun = layers[layers.length - 1];
  const runEnd = lastRun ? lastRun.origin + lastRun.grid.length * TILE_SIZE : 0;
  // If the run already ended above the warning view, start the boss at the
  // top of that view so the screen is not empty. Stage 1's landA is longer,
  // so the seam is the real end of the map.
  const origin = Math.max(runEnd, stage.warningAt * BG_SCROLL_SPEED + LOGICAL_H);
  layers.push({
    map: boss,
    grid: getMapGrid(boss.id),
    origin,
    inAt: null,
    outAt: null,
    role: 'boss',
    loopFrom: boss.loopFrom,
  });
  return {
    label: stage.label,
    layers,
    warningAt: stage.warningAt,
    starsOnly: false,
    handoff: 'tiles',
    endAt: null,
  };
}

/** A stage's maps up to the warning, with no warning sequence and no boss layer. */
export function buildStageRunTrack(stage: StageData, label: string): BackgroundTrack {
  const full = buildStageTrack(stage);
  return {
    ...full,
    label,
    layers: full.layers.filter((layer) => layer.role !== 'boss'),
    warningAt: null,
    handoff: 'none',
    endAt: stage.warningAt,
  };
}

/**
 * One map from its first row. A finite map ends when its last row reaches the
 * top of the screen. A looping map plays the approach plus one extra pass of
 * the loop, so the seam is on screen, then ends.
 */
export function buildMapTrack(id: string): BackgroundTrack {
  const map = getMap(id);
  if (map.kind === 'starfield') {
    return {
      label: map.label,
      layers: [],
      warningAt: null,
      starsOnly: true,
      handoff: 'none',
      endAt: map.previewSeconds,
    };
  }
  return {
    label: map.label,
    layers: [
      {
        map,
        grid: getMapGrid(id),
        origin: 0,
        inAt: null,
        outAt: null,
        role: 'run',
        loopFrom: map.loopFrom ?? null,
      },
    ],
    warningAt: null,
    starsOnly: false,
    handoff: 'none',
    endAt: tilePreviewEnd(map),
  };
}

export function trackFinished(track: BackgroundTrack, gameTime: number): boolean {
  return track.endAt !== null && gameTime >= track.endAt;
}

export function layerIndexOf(track: BackgroundTrack, mapId: string): number {
  return track.layers.findIndex((layer) => layer.map.id === mapId);
}

/**
 * Screen Y of an upright logical map pixel.
 * `scroll` 0 puts logical y=0 at the bottom of the view. Increasing `scroll`
 * moves that pixel downward; pixels ahead of it enter from the top.
 */
export function mapPixelScreenY(logicalY: number, scroll: number, viewH = LOGICAL_H): number {
  const row = Math.floor(logicalY / TILE_SIZE);
  const inTile = logicalY - row * TILE_SIZE;
  return scroll + viewH - (row + 1) * TILE_SIZE + inTile;
}

/** Inverse of `mapPixelScreenY` for a layer-local scroll (world scroll minus the layer origin). */
export function logicalMapY(screenY: number, localScroll: number, viewH = LOGICAL_H): number {
  const rel = localScroll + viewH - screenY;
  if (rel <= 0) return -1;
  const row = Math.ceil(rel / TILE_SIZE) - 1;
  const inTile = (row + 1) * TILE_SIZE - rel;
  return row * TILE_SIZE + inTile;
}

export function logicalMapX(screenX: number): number {
  return screenX + MAP_CROP_X;
}

/** The layer tanks and terrain checks read: the most opaque, later wins a tie. */
export function dominantLayer(alphas: readonly number[]): number {
  let best = -1;
  let bestA = 0.05;
  alphas.forEach((alpha, i) => {
    if (alpha >= bestA) {
      best = i;
      bestA = alpha;
    }
  });
  return best;
}

/** True when a tank center sits on water. Off-map is land (not blocked). */
export function terrainBlocksTank(
  track: BackgroundTrack,
  scroll: number,
  alphas: readonly number[],
  x: number,
  y: number
): boolean {
  const index = dominantLayer(alphas);
  const layer = track.layers[index];
  if (!layer) return false;
  const mapY = logicalMapY(y, scroll - layer.origin);
  if (mapY < 0) return false;
  const col = Math.floor(logicalMapX(x) / TILE_SIZE);
  const row = Math.floor(mapY / TILE_SIZE);
  return terrainAt(layer.grid, col, row) === 'water';
}
