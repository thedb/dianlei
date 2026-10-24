/**
 * 铁堡厂轨: Stage 2's boss arena. One approach screen, then a factory hall
 * that loops. Row 0 of the approach matches 陆地B's edge (road on
 * AIRFIELD_SPINE, no water). The approach's top row and both edges of the
 * loop are the same factory seam, so the rails do not jump.
 *
 * Woods lead to a gate. Past the gate the hall fills the chunk: side walls,
 * a repeating bay, and three rails. The loop is that hall again, so once
 * the gate scrolls off the frame is factory from top to bottom.
 *
 * Screen X of a rail pixel is `col * 16 + pixel - MAP_CROP_X` (the map is
 * 368px wide and drawn at x = -4). Those pixels are 72 / 180 / 288.
 * Which interior is on screen comes from `FACTORY_LOOK` (default A until
 * Yoan picks). The other four looks use the same rail columns.
 */

import {
  FACTORY_BOSS_CHUNKS,
  FACTORY_BOSS_SEED,
  FACTORY_LOOK,
  MAP_CHUNK_ROWS,
  MAP_CROP_X,
  TILE_SIZE,
} from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { FACTORY_LAYOUT, type FactoryLookId } from '@/game/art/factoryLooks';
import { AIRFIELD_SPINE } from './landB';
import { ROAD_COL, type ChunkDef, type ChunkMapSpec, type ChunkPainter } from './chunks';

const LAST = MAP_CHUNK_ROWS - 1;
const RAIL_COLS = new Set<number>([4, 11, 18]);

export const FACTORY_RAILS = [
  { col: 4, pixel: 12, x: 72, tile: TileId.factoryRailW },
  { col: 11, pixel: 8, x: 180, tile: TileId.factoryRailC },
  { col: 18, pixel: 4, x: 288, tile: TileId.factoryRailE },
] as const;

/** Screen X of a pixel inside a tile column, after the 4px crop. */
export function factoryRailScreenX(col: number, pixel: number): number {
  return col * TILE_SIZE + pixel - MAP_CROP_X;
}

/** Shared seam: side walls, the look's clerestory, floor, and the three rails. */
export function stampFactoryEdge(
  p: ChunkPainter,
  row: number,
  look: FactoryLookId = FACTORY_LOOK
): void {
  const layout = FACTORY_LAYOUT[look];
  for (let c = 0; c < p.cols; c++) {
    const wall = c <= 1 || c >= p.cols - 2;
    p.set(c, row, wall ? TileId.factoryWall : TileId.factoryFloor);
  }
  for (const c of layout.clerestory) p.set(c, row, TileId.factoryWindow);
  for (const rail of FACTORY_RAILS) p.set(rail.col, row, rail.tile);
}

function paintHall(p: ChunkPainter, r0: number, r1: number, look: FactoryLookId): void {
  const layout = FACTORY_LAYOUT[look];
  for (let r = r0; r <= r1; r++) {
    for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.factoryFloor);
    p.set(0, r, TileId.factoryWall);
    p.set(1, r, TileId.factoryWall);
    p.set(p.cols - 2, r, TileId.factoryWall);
    p.set(p.cols - 1, r, TileId.factoryWall);
    for (const c of layout.clerestory) p.set(c, r, TileId.factoryWindow);
    for (const rail of FACTORY_RAILS) p.set(rail.col, r, rail.tile);
    const interior = r > r0 && r < r1;
    if (interior && layout.beamEvery > 0 && (r - r0) % layout.beamEvery === layout.beamEvery - 1) {
      for (let c = 2; c < p.cols - 2; c++) {
        if (RAIL_COLS.has(c) || layout.clerestory.includes(c)) continue;
        p.set(c, r, TileId.factoryWall);
      }
    }
    if (interior && layout.bayEvery > 0 && (r - r0) % layout.bayEvery === 0) {
      for (const c of layout.bays) {
        if (!RAIL_COLS.has(c)) p.set(c, r, TileId.factoryWindow);
      }
    }
  }
}

/** Wall face with a center gate. The hall, and its rails, start above this. */
function paintGate(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.factoryWall);
    p.set(3, r, TileId.factoryWindow);
    p.set(p.cols - 4, r, TileId.factoryWindow);
    for (let c = 9; c <= 13; c++) p.set(c, r, r === r1 ? TileId.factoryFloor : TileId.road);
    p.set(8, r, TileId.gate);
    p.set(14, r, TileId.gate);
  }
}

/** 陆地B's edge, and nothing else: five road columns, meadow beside them. */
function sealApproachBottom(p: ChunkPainter): void {
  const spine = new Set<number>(AIRFIELD_SPINE);
  for (let c = 0; c < p.cols; c++) {
    p.set(c, 0, spine.has(c) ? TileId.road : TileId.meadow);
  }
}

/** Woods, then the gate, then the hall that the loop repeats. */
export function paintFactoryApproach(p: ChunkPainter, look: FactoryLookId = FACTORY_LOOK): void {
  p.meadow();
  for (let r = 1; r <= 14; r++) p.set(ROAD_COL, r, TileId.road);
  const trees: Array<[number, number, TileId]> = [
    [3, 3, TileId.oak],
    [6, 6, TileId.fir],
    [16, 4, TileId.oak],
    [19, 7, TileId.fir],
    [8, 10, TileId.forest],
    [14, 9, TileId.forest],
    [2, 12, TileId.bush],
    [20, 11, TileId.bush],
  ];
  for (const [c, r, id] of trees) p.set(c, r, id);
  paintGate(p, 15, 18);
  paintHall(p, 19, LAST - 1, look);
  stampFactoryEdge(p, LAST, look);
  sealApproachBottom(p);
}

/** Indoor triple-rail hall. Edge rows match the approach's top row. */
export function paintFactoryFloor(p: ChunkPainter, look: FactoryLookId = FACTORY_LOOK): void {
  paintHall(p, 0, LAST, look);
  stampFactoryEdge(p, 0, look);
  stampFactoryEdge(p, LAST, look);
}

const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFactoryApproach(p, FACTORY_LOOK);
  },
};

const floor: ChunkDef = {
  id: 'floor',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFactoryFloor(p, FACTORY_LOOK);
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
