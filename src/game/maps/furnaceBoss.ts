/**
 * 炉心浮台: Stage 3's boss arena. One approach screen, then a chassis that
 * loops. Row 0 of the approach is riverA's last row (center channel, banks
 * as that chunk sealed them). The approach's top row and both edges of the
 * loop are the same rib-and-strip seam.
 *
 * The valley keeps going, closes into a scorched gate, then the floating
 * fortress floor fills the frame. No water past the gate. No cloud sheet.
 * Look A is the light-strip chassis. The fight does not swap looks.
 */

import { FURNACE_BOSS_CHUNKS, FURNACE_BOSS_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { composeChunks, type ChunkDef, type ChunkMapSpec, type ChunkPainter } from './chunks';
import { RIVER_A_SPEC, RIVER_EDGE_COLS } from './riverA';

const LAST = MAP_CHUNK_ROWS - 1;
const CENTER = RIVER_EDGE_COLS.center;

const RIBS = [5, 17];
const STRIPS = [7, 9, 13, 15];

let riverTop: readonly TileId[] | null = null;

/** riverA's sealed top row. The approach copies it; it does not restate the ids. */
function riverALastRow(): readonly TileId[] {
  if (!riverTop) {
    const grid = composeChunks(RIVER_A_SPEC);
    riverTop = grid[grid.length - 1]!.slice();
  }
  return riverTop;
}

function paintChassisRow(p: ChunkPainter, row: number, seam: boolean): void {
  for (let c = 0; c < p.cols; c++) {
    let id: TileId = TileId.furnacePlate;
    if (c <= 2 || c >= p.cols - 3) id = TileId.furnaceVoid;
    else if (RIBS.includes(c)) id = TileId.furnaceRib;
    else if (STRIPS.includes(c)) id = TileId.furnaceStrip;
    else if (!seam && row % 8 === 4) id = TileId.furnaceRib;
    p.set(c, row, id);
  }
}

/** Shared seam: outboard dark, two ribs, four light strips. */
export function stampFurnaceEdge(p: ChunkPainter, row: number): void {
  paintChassisRow(p, row, true);
}

function paintChannel(p: ChunkPainter, row: number, cols: readonly number[]): void {
  for (const c of cols) p.set(c, row, TileId.lake);
}

/**
 * River banks, a scorched gate, then the chassis. Row 0 is stamped last so
 * it stays equal to riverA's last row.
 */
export function paintFurnaceApproach(p: ChunkPainter): void {
  const banks: Array<[number, number, TileId]> = [
    [2, 2, TileId.scorch],
    [4, 5, TileId.crater],
    [6, 8, TileId.trench],
    [17, 3, TileId.scorch],
    [19, 6, TileId.snag],
    [21, 9, TileId.wreck],
    [3, 11, TileId.crater],
    [18, 12, TileId.scorch],
    [1, 7, TileId.scorch],
    [20, 10, TileId.trench],
  ];
  for (const [c, r, id] of banks) p.set(c, r, id);
  for (let r = 1; r <= 12; r++) paintChannel(p, r, CENTER);

  for (let r = 13; r <= 18; r++) {
    for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.scorch);
  }
  paintChannel(p, 13, [10, 11, 12]);
  paintChannel(p, 14, [10, 11, 12]);
  paintChannel(p, 15, [11]);
  for (let r = 16; r <= 18; r++) {
    p.set(4, r, TileId.crater);
    p.set(7, r, TileId.gate);
    p.set(15, r, TileId.gate);
    p.set(19, r, TileId.wreck);
  }

  for (let r = 19; r < LAST; r++) paintChassisRow(p, r, false);
  stampFurnaceEdge(p, LAST);

  const top = riverALastRow();
  for (let c = 0; c < p.cols; c++) p.set(c, 0, top[c]!);
}

/** Looping fortress floor. Edge rows match the approach's top row. */
export function paintFurnaceChassis(p: ChunkPainter): void {
  for (let r = 0; r <= LAST; r++) paintChassisRow(p, r, r === 0 || r === LAST);
  stampFurnaceEdge(p, 0);
  stampFurnaceEdge(p, LAST);
}

const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFurnaceApproach(p);
  },
};

const chassis: ChunkDef = {
  id: 'chassis',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    paintFurnaceChassis(p);
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
