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

export interface TrackLayer {
  map: TileMapDef;
  grid: TileGrid;
  origin: number;
  /** Handover time (s) this layer blends in at; null = shown from the start. */
  inAt: number | null;
  /** Handover time (s) the next layer takes over; null = stays to the end. */
  outAt: number | null;
}

export interface BackgroundTrack {
  label: string;
  layers: readonly TrackLayer[];
  /** Tiles speed up and fade into clouds, then stars, from here. Null = never. */
  warningAt: number | null;
  /** Starfield from the first frame, no tiles (宇宙A preview). */
  starsOnly: boolean;
  /** Game time at which the track is over (地图预览 leaves). Null = never. */
  endAt: number | null;
}

/**
 * The stage's maps in order. Entry `i > 0` starts `MAP_BLEND_LEAD` seconds
 * before its handover time so it is already scrolling as it fades in.
 */
export function buildStageTrack(stage: StageData): BackgroundTrack {
  const run = stage.maps.run;
  const boss = getMap(stage.maps.boss);
  if (boss.kind !== 'starfield') throw new Error(`stage ${stage.id}: boss map must be a starfield`);
  const layers = run.map((entry, i): TrackLayer => {
    const next = run[i + 1];
    return {
      map: getTileMap(entry.map),
      grid: getMapGrid(entry.map),
      origin: i === 0 ? 0 : (entry.at - MAP_BLEND_LEAD) * BG_SCROLL_SPEED,
      inAt: i === 0 ? null : entry.at,
      outAt: next ? next.at : null,
    };
  });
  return { label: stage.label, layers, warningAt: stage.warningAt, starsOnly: false, endAt: null };
}

/** A stage's maps up to the warning, with no warning sequence. */
export function buildStageRunTrack(stage: StageData, label: string): BackgroundTrack {
  return { ...buildStageTrack(stage), label, warningAt: null, endAt: stage.warningAt };
}

/** One map from its first row until its last row reaches the top of the screen. */
export function buildMapTrack(id: string): BackgroundTrack {
  const map = getMap(id);
  if (map.kind === 'starfield') {
    return {
      label: map.label,
      layers: [],
      warningAt: null,
      starsOnly: true,
      endAt: map.previewSeconds,
    };
  }
  return {
    label: map.label,
    layers: [{ map, grid: getMapGrid(id), origin: 0, inAt: null, outAt: null }],
    warningAt: null,
    starsOnly: false,
    endAt: (map.rows * TILE_SIZE - LOGICAL_H) / BG_SCROLL_SPEED,
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
