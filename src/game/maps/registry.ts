/**
 * Map registry (P12). The only module that knows every map asset. Stages,
 * 地图预览, the background renderer, and tests ask here.
 *
 * Adding a map: write its `MapDef` (a chunk library plus `composeChunks` for a
 * new tile map, like `landA.ts` / `landB.ts` / `riverA.ts`), add it to `MAPS`,
 * and reference its id from a stage's `maps.run`, or from `maps.boss` (a
 * looping tile arena, or a starfield on a real space stage). 地图预览 lists it
 * automatically. Stage 1's run stays `landA`; its boss is `landBoss`.
 */

import { MAP_CHUNK_ROWS, SPACE_A_PREVIEW_SECONDS } from '@/game/config';
import { composeChunks } from './chunks';
import { LAND_A_SPEC } from './landA';
import { FACTORY_BOSS_LOOP_ROW, FACTORY_BOSS_SPEC } from './factoryBoss';
import { FURNACE_BOSS_LOOP_ROW, FURNACE_BOSS_SPEC } from './furnaceBoss';
import { LAND_BOSS_LOOP_ROW, LAND_BOSS_SPEC } from './landBoss';
import { LAND_B_SPEC } from './landB';
import { OBSIDIAN_BOSS_LOOP_ROW, OBSIDIAN_BOSS_SPEC } from './obsidianBoss';
import { RIVER_A_SPEC } from './riverA';
import { SEA_B_SPEC } from './seaB';
import type { MapDef, StarfieldMapDef, TileGrid, TileMapDef } from './types';

export const LAND_A: TileMapDef = {
  id: 'landA',
  label: '陆地A',
  kind: 'tiles',
  rows: LAND_A_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(LAND_A_SPEC),
  cloudShadows: true,
};

/**
 * Military airfield (P13, polished in P14). Preview and future stages only —
 * stage 1 stays on 陆地A. Outskirts, runway, drainage, then forest. See `landB.ts`.
 */
export const LAND_B: TileMapDef = {
  id: 'landB',
  label: '陆地B',
  kind: 'tiles',
  rows: LAND_B_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(LAND_B_SPEC),
  cloudShadows: true,
};

/**
 * Inland river and bank hamlets (P14, was 海面A). Preview and future stages only.
 * The channel joins on a fixed left / right / center slot. See `riverA.ts`.
 */
export const RIVER_A: TileMapDef = {
  id: 'riverA',
  label: '河流A',
  kind: 'tiles',
  rows: RIVER_A_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(RIVER_A_SPEC),
  cloudShadows: true,
};

/**
 * Stage 1 boss arena (百战). One approach chunk, then a courtyard that loops
 * from `loopFrom`. Same land tiles as 陆地A. Not the stage's run map.
 */
export const LAND_BOSS: TileMapDef = {
  id: 'landBoss',
  label: '百战要塞',
  kind: 'tiles',
  rows: LAND_BOSS_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(LAND_BOSS_SPEC),
  cloudShadows: true,
  loopFrom: LAND_BOSS_LOOP_ROW,
};

/**
 * Stage 2 boss arena (铁堡厂轨). One approach chunk, then a triple-rail floor
 * that loops. No cloud sheet. Not a stage-1 map.
 */
export const FACTORY_BOSS: TileMapDef = {
  id: 'factoryBoss',
  label: '铁堡厂轨',
  kind: 'tiles',
  rows: FACTORY_BOSS_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(FACTORY_BOSS_SPEC),
  loopFrom: FACTORY_BOSS_LOOP_ROW,
};

/**
 * Stage 3 boss arena (炉心浮台). Row 0 is 河流A's last row; burnt banks and a
 * flooded basin lead into a waterside dockyard that loops, with 河流A's
 * channel running on as its center canal. No cloud sheet.
 */
export const FURNACE_BOSS: TileMapDef = {
  id: 'furnaceBoss',
  label: '炉心浮台',
  kind: 'tiles',
  rows: FURNACE_BOSS_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(FURNACE_BOSS_SPEC),
  loopFrom: FURNACE_BOSS_LOOP_ROW,
};

/**
 * Stage 4 run (海面B). Nine sea chunks: a short friendly deck, open water,
 * escorts, swell, then wreckage. Not a river. Cloud shadows on, no loop.
 */
export const SEA_B: TileMapDef = {
  id: 'seaB',
  label: '海面B',
  kind: 'tiles',
  rows: SEA_B_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(SEA_B_SPEC),
  cloudShadows: true,
};

/**
 * Stage 4 boss arena (黑曜舰空). Row 0 is 海面B's last row. The loop is an
 * empty enemy carrier deck, island on the port side. Cloud shadows on.
 * The warning band stays off because the handoff is tiles, not stars.
 */
export const OBSIDIAN_BOSS: TileMapDef = {
  id: 'obsidianBoss',
  label: '黑曜舰空',
  kind: 'tiles',
  rows: OBSIDIAN_BOSS_SPEC.slots.length * MAP_CHUNK_ROWS,
  build: () => composeChunks(OBSIDIAN_BOSS_SPEC),
  cloudShadows: true,
  loopFrom: OBSIDIAN_BOSS_LOOP_ROW,
};

/** Starfield for a real space stage and for 地图预览. Stage 1's boss does not use it. */
export const SPACE_A: StarfieldMapDef = {
  id: 'spaceA',
  label: '宇宙A',
  kind: 'starfield',
  previewSeconds: SPACE_A_PREVIEW_SECONDS,
};

const MAPS: readonly MapDef[] = [
  LAND_A,
  LAND_B,
  RIVER_A,
  LAND_BOSS,
  FACTORY_BOSS,
  FURNACE_BOSS,
  SEA_B,
  OBSIDIAN_BOSS,
  SPACE_A,
];

export function listMaps(): readonly MapDef[] {
  return MAPS;
}

export function getMap(id: string): MapDef {
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`unknown map ${id}`);
  return map;
}

export function getTileMap(id: string): TileMapDef {
  const map = getMap(id);
  if (map.kind !== 'tiles') throw new Error(`map ${id} has no tiles`);
  return map;
}

const grids = new Map<string, TileGrid>();

/** The map's grid, built once. Grids are shared; never mutate them. */
export function getMapGrid(id: string): TileGrid {
  let grid = grids.get(id);
  if (!grid) {
    const map = getTileMap(id);
    grid = map.build();
    if (grid.length !== map.rows) {
      throw new Error(`map ${id} built ${grid.length} rows, declared ${map.rows}`);
    }
    grids.set(id, grid);
  }
  return grid;
}
