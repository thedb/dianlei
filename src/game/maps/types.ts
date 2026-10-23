/**
 * Map assets (P12). A map is data: a tileset grid, its length, and a terrain
 * mask read from the tiles. Stages say which maps they use and when
 * (`StageData.maps`); maps know nothing about stages, waves, or buildings.
 */

import type { TileId } from '@/game/art/tiles';

/** One map, row-major. Row 0 is the first row on screen (bottom); rows grow toward the top. */
export type TileGrid = TileId[][];

/**
 * - `land`: open ground. Land buildings may sit here; tanks drive.
 * - `water`: rivers, lakes, sea. Sea buildings sit here; tanks are blocked.
 * - `feature`: roads, bridges, houses, rocks, decor. Tanks drive; no building may sit here.
 */
export type Terrain = 'land' | 'water' | 'feature';

interface MapDefBase {
  /** Registry key (`maps/registry.ts`). */
  id: string;
  /** Shown in 地图预览. */
  label: string;
}

/** A scrolling tile map. `build` must be deterministic; the registry caches it. */
export interface TileMapDef extends MapDefBase {
  kind: 'tiles';
  rows: number;
  build(): TileGrid;
  /** Soft cloud shadows drift over the map. */
  cloudShadows?: boolean;
  /**
   * First tile row of a seamless loop. Rows below it play once (an approach
   * strip). Omit on a map that scrolls through and ends.
   */
  loopFrom?: number;
}

/** A tile-less backdrop: the parallax starfield (宇宙A). */
export interface StarfieldMapDef extends MapDefBase {
  kind: 'starfield';
  /** How long 地图预览 plays it, seconds. */
  previewSeconds: number;
}

export type MapDef = TileMapDef | StarfieldMapDef;
