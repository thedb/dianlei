/**
 * 铁堡厂轨: Stage 2's boss arena. One approach screen, then a factory floor
 * that loops. Row 0 of the approach matches 陆地B's edge (road on
 * AIRFIELD_SPINE, no water). The approach's top row and both edges of the
 * loop are the same three rails, so the seam does not jump a track.
 *
 * Screen X of a rail pixel is `col * 16 + pixel - MAP_CROP_X` (the map is
 * 368px wide and drawn at x = -4). Those pixels are 72 / 180 / 288.
 */

import {
  FACTORY_BOSS_CHUNKS,
  FACTORY_BOSS_SEED,
  MAP_CHUNK_ROWS,
  MAP_CROP_X,
  TILE_SIZE,
} from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { AIRFIELD_SPINE } from './landB';
import { ROAD_COL, type ChunkDef, type ChunkMapSpec, type ChunkPainter } from './chunks';

const LAST = MAP_CHUNK_ROWS - 1;

export const FACTORY_RAILS = [
  { col: 4, pixel: 12, x: 72, tile: TileId.factoryRailW },
  { col: 11, pixel: 8, x: 180, tile: TileId.factoryRailC },
  { col: 18, pixel: 4, x: 288, tile: TileId.factoryRailE },
] as const;

/** Screen X of a pixel inside a tile column, after the 4px crop. */
export function factoryRailScreenX(col: number, pixel: number): number {
  return col * TILE_SIZE + pixel - MAP_CROP_X;
}

/** Shared seam: side walls, factory floor, and the three rail tiles. */
export function stampFactoryEdge(p: ChunkPainter, row: number): void {
  for (let c = 0; c < p.cols; c++) {
    const wall = c <= 1 || c >= p.cols - 2;
    p.set(c, row, wall ? TileId.factoryWall : TileId.factoryFloor);
  }
  for (const rail of FACTORY_RAILS) p.set(rail.col, row, rail.tile);
}

function sideWalls(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    p.set(0, r, TileId.factoryWall);
    p.set(1, r, TileId.factoryWall);
    p.set(p.cols - 2, r, TileId.factoryWall);
    p.set(p.cols - 1, r, TileId.factoryWall);
  }
}

function layRails(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    for (const rail of FACTORY_RAILS) p.set(rail.col, r, rail.tile);
  }
}

/** 陆地B's edge, and nothing else: five road columns, meadow beside them. */
function sealApproachBottom(p: ChunkPainter): void {
  const spine = new Set<number>(AIRFIELD_SPINE);
  for (let c = 0; c < p.cols; c++) {
    p.set(c, 0, spine.has(c) ? TileId.road : TileId.meadow);
  }
}

/** Woods road into the factory gate, then the floor the loop repeats. */
const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    p.meadow();
    for (let r = 1; r <= 16; r++) p.set(ROAD_COL, r, TileId.road);
    const trees: Array<[number, number, TileId]> = [
      [3, 3, TileId.oak],
      [6, 6, TileId.fir],
      [16, 4, TileId.oak],
      [19, 7, TileId.fir],
      [8, 10, TileId.forest],
      [14, 9, TileId.forest],
      [2, 13, TileId.bush],
      [20, 12, TileId.bush],
    ];
    for (const [c, r, id] of trees) p.set(c, r, id);

    for (let r = 18; r <= LAST; r++) {
      for (let c = 2; c < p.cols - 2; c++) p.set(c, r, TileId.factoryFloor);
    }
    sideWalls(p, 18, LAST);
    p.set(ROAD_COL - 2, 20, TileId.gate);
    p.set(ROAD_COL + 2, 20, TileId.gate);
    p.set(3, 22, TileId.factoryWindow);
    p.set(p.cols - 4, 22, TileId.factoryWindow);
    p.set(6, 26, TileId.factoryWindow);
    p.set(16, 26, TileId.factoryWindow);
    layRails(p, 24, LAST - 1);
    stampFactoryEdge(p, LAST);
    sealApproachBottom(p);
  },
};

/** Indoor triple-rail floor. Edge rows match the approach's top row. */
const floor: ChunkDef = {
  id: 'floor',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.factoryFloor);
    }
    sideWalls(p, 0, LAST);
    layRails(p, 0, LAST);
    const windows: Array<[number, number]> = [
      [3, 6],
      [19, 6],
      [3, 16],
      [19, 16],
      [6, 24],
      [16, 24],
      [3, 32],
      [19, 32],
    ];
    for (const [c, r] of windows) p.set(c, r, TileId.factoryWindow);
    stampFactoryEdge(p, 0);
    stampFactoryEdge(p, LAST);
  },
};

export const FACTORY_BOSS_LIBRARY: readonly ChunkDef[] = [approach, floor];

export const FACTORY_BOSS_SPEC: ChunkMapSpec = {
  library: FACTORY_BOSS_LIBRARY,
  seed: FACTORY_BOSS_SEED,
  maxRepeats: 1,
  slots: Array.from({ length: FACTORY_BOSS_CHUNKS }, (_, i) =>
    i === 0 ? { fixed: 'approach' as const, variant: 0 } : { fixed: 'floor' as const, variant: 0 }
  ),
};

/** First row of the looping floor (the approach is the chunk below it). */
export const FACTORY_BOSS_LOOP_ROW = MAP_CHUNK_ROWS;
