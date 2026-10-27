/**
 * 炉心浮台: Stage 3's boss arena. One approach chunk, then a chassis floor
 * that loops. Row 0 of the approach is 河流A's last row, cell for cell, so the
 * stitch has no seam. Rows 1–12 keep the center channel with scorched banks,
 * rows 13–18 close the river into a scorched basin and a gate, and the chassis
 * starts on row 19. Every chassis row is the same seam row plus fixed beams,
 * so the approach's top row and both loop edges match.
 *
 * The chassis is look A 灯带四瓣 (`FURNACE_LOOK`): dark void outboard, ribs,
 * plate, and two cyan light strips. No water, no cloud sheet.
 */

import { FURNACE_BOSS_CHUNKS, FURNACE_BOSS_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import {
  paintChunk,
  planChunks,
  type ChunkDef,
  type ChunkMapSpec,
  type ChunkPainter,
} from './chunks';
import { RIVER_A_LIBRARY, RIVER_A_SPEC, RIVER_EDGE_COLS } from './riverA';

const LAST = MAP_CHUNK_ROWS - 1;

/** First chassis row of the approach. */
export const FURNACE_CHASSIS_ROW = 19;

/** Chassis columns: void outboard, ribs, strips, plate. Same on every row. */
const VOID_COLS = new Set<number>([0, 1, 21, 22]);
const RIB_COLS = new Set<number>([2, 11, 20]);
const STRIP_COLS = new Set<number>([6, 16]);
/** Cross beams, as offsets inside a chassis run. Never on an edge row. */
const BEAM_EVERY = 10;

let riverTop: readonly TileId[] | null = null;

/** 河流A's last row. Built from its own plan so this module does not need the registry. */
export function riverATopRow(): readonly TileId[] {
  if (!riverTop) {
    const plan = planChunks(RIVER_A_SPEC);
    const last = paintChunk(RIVER_A_LIBRARY, plan[plan.length - 1]!);
    riverTop = [...last[LAST]!];
  }
  return riverTop;
}

function chassisTile(c: number): TileId {
  if (VOID_COLS.has(c)) return TileId.furnaceVoid;
  if (RIB_COLS.has(c)) return TileId.furnaceRib;
  if (STRIP_COLS.has(c)) return TileId.furnaceStrip;
  return TileId.furnacePlate;
}

/** The seam row: the approach's top row and both edges of the loop. */
export function stampFurnaceEdge(p: ChunkPainter, row: number): void {
  for (let c = 0; c < p.cols; c++) p.set(c, row, chassisTile(c));
}

function paintChassis(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    stampFurnaceEdge(p, r);
    const beam = r > r0 && r < r1 && (r - r0) % BEAM_EVERY === BEAM_EVERY / 2;
    if (!beam) continue;
    for (let c = 3; c <= 19; c++) {
      if (!STRIP_COLS.has(c)) p.set(c, r, TileId.furnaceRib);
    }
  }
}

const SCORCH_SPOTS: ReadonlyArray<readonly [number, number, TileId]> = [
  [7, 2, TileId.scorch],
  [15, 3, TileId.scorch],
  [6, 5, TileId.crater],
  [16, 6, TileId.snag],
  [4, 8, TileId.scorch],
  [8, 9, TileId.wreck],
  [14, 9, TileId.scorch],
  [18, 10, TileId.crater],
  [3, 11, TileId.snag],
  [7, 12, TileId.scorch],
  [15, 12, TileId.trench],
];

/** River valley, scorched basin, gate, then the chassis the loop repeats. */
export function paintFurnaceApproach(p: ChunkPainter, edge: readonly TileId[]): void {
  p.meadow();
  for (let r = 1; r <= 12; r++) {
    for (let c = 0; c <= 4; c++) p.set(c, r, TileId.forest);
    for (let c = 18; c < p.cols; c++) p.set(c, r, TileId.forest);
    for (const c of RIVER_EDGE_COLS.center) p.set(c, r, TileId.lake);
  }
  for (const [c, r, id] of SCORCH_SPOTS) p.set(c, r, id);
  for (let r = 13; r <= 15; r++) {
    for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.scorch);
    const half = 15 - r;
    for (let c = 11 - half; c <= 11 + half; c++) p.set(c, r, TileId.lake);
  }
  p.set(5, 14, TileId.crater);
  p.set(17, 13, TileId.wreck);
  p.set(19, 15, TileId.crater);
  for (let r = 16; r <= 18; r++) {
    for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.fortWall);
    for (let c = 10; c <= 12; c++) p.set(c, r, TileId.road);
    p.set(9, r, TileId.gate);
    p.set(13, r, TileId.gate);
  }
  paintChassis(p, FURNACE_CHASSIS_ROW, LAST);
  for (let c = 0; c < p.cols; c++) p.set(c, 0, edge[c]!);
}

/** Looping chassis. Row 0 and the last row are the seam row. */
export function paintFurnaceFloor(p: ChunkPainter): void {
  paintChassis(p, 0, LAST);
}

const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFurnaceApproach(p, riverATopRow());
  },
};

const chassis: ChunkDef = {
  id: 'chassis',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFurnaceFloor(p);
  },
};

export const FURNACE_BOSS_LIBRARY: readonly ChunkDef[] = [approach, chassis];

export const FURNACE_BOSS_SPEC: ChunkMapSpec = {
  library: FURNACE_BOSS_LIBRARY,
  seed: FURNACE_BOSS_SEED,
  maxRepeats: 1,
  slots: Array.from({ length: FURNACE_BOSS_CHUNKS }, (_, i) =>
    i === 0 ? { fixed: 'approach' as const, variant: 0 } : { fixed: 'chassis' as const, variant: 0 }
  ),
};

/** First row of the looping chassis (the approach is the chunk below it). */
export const FURNACE_BOSS_LOOP_ROW = MAP_CHUNK_ROWS;
