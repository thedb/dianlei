/**
 * 百战要塞: Stage 1's boss arena. Two screens, reusing the land tileset.
 *
 * Chunk 0 is the approach. Its bottom row is the same road contract as
 * 陆地A's sealed top (road at ROAD_COL, no water), so the stage track can
 * butt the two maps together. The first `APPROACH_HANDOFF_ROWS` are that
 * countryside band; above them the ground scorches, cliffs rise, and a gate
 * meets the courtyard. Chunk 1 loops. No water: tanks still on screen when
 * the warning hits must not get stuck.
 */

import { LAND_BOSS_CHUNKS, LAND_BOSS_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { ROAD_COL, sealEdges, type ChunkDef, type ChunkMapSpec, type ChunkPainter } from './chunks';

const LAST = MAP_CHUNK_ROWS - 1;

/** Shared seam: side walls and scorched floor. Approach top and both courtyard edges. */
export function stampArenaEdge(p: ChunkPainter, row: number): void {
  for (let c = 0; c < p.cols; c++) {
    const wall = c <= 1 || c >= p.cols - 2;
    p.set(c, row, wall ? TileId.fortWall : TileId.scorch);
  }
}

function sideWalls(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    p.set(0, r, TileId.fortWall);
    p.set(1, r, TileId.fortWall);
    p.set(p.cols - 2, r, TileId.fortWall);
    p.set(p.cols - 1, r, TileId.fortWall);
  }
}

/**
 * Countryside rows at the bottom of the approach, before the scorch field.
 * Row 0 is the stitch onto 陆地A.
 */
export const APPROACH_HANDOFF_ROWS = 18;

/** Countryside at the bottom, fortress gate at the top. */
const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    p.meadow();
    p.rect(2, APPROACH_HANDOFF_ROWS, p.cols - 4, p.rows - 1 - APPROACH_HANDOFF_ROWS, TileId.scorch);
    for (let r = 1; r <= 30; r++) p.set(ROAD_COL, r, TileId.road);

    const trees: Array<[number, number, TileId]> = [
      [3, 4, TileId.oak],
      [6, 7, TileId.fir],
      [16, 5, TileId.oak],
      [19, 8, TileId.bush],
      [8, 3, TileId.flowers],
      [14, 6, TileId.flowers],
    ];
    for (const [c, r, id] of trees) p.set(c, r, id);

    const burns: Array<[number, number, TileId]> = [
      [8, 12, TileId.dirt],
      [14, 13, TileId.dirt],
      [7, 15, TileId.scorch],
      [15, 16, TileId.scorch],
      [9, 16, TileId.crater],
      [13, 14, TileId.snag],
    ];
    for (const [c, r, id] of burns) p.set(c, r, id);

    for (let r = 14; r <= 26; r++) {
      p.set(2, r, TileId.boulder);
      p.set(3, r, TileId.boulder);
      p.set(p.cols - 3, r, TileId.boulder);
      p.set(p.cols - 4, r, TileId.boulder);
    }
    for (let c = 4; c <= 8; c++) p.set(c, 22, TileId.trench);
    for (let c = 14; c <= 18; c++) p.set(c, 22, TileId.trench);

    sideWalls(p, 28, LAST);
    p.set(ROAD_COL - 2, 31, TileId.gate);
    p.set(ROAD_COL + 2, 31, TileId.gate);
    p.set(3, 33, TileId.bunker);
    p.set(p.cols - 4, 33, TileId.bunker);
    p.set(6, 35, TileId.wreck);
    p.set(15, 36, TileId.crater);
    p.set(ROAD_COL, 34, TileId.scorch);
    p.set(ROAD_COL, 36, TileId.scorch);

    for (let c = 0; c < p.cols; c++) {
      if (c !== ROAD_COL) p.set(c, 0, TileId.meadow);
    }
    sealEdges(p, 'none', 'none', [ROAD_COL]);
    stampArenaEdge(p, LAST);
  },
};

/** Walled scorched yard. Edge rows are identical so the chunk can loop. */
const courtyard: ChunkDef = {
  id: 'courtyard',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint(p) {
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) p.set(c, r, TileId.scorch);
    }
    sideWalls(p, 0, LAST);
    p.rect(7, 14, 9, 12, TileId.fortYard);
    p.set(3, 8, TileId.bunker);
    p.set(p.cols - 4, 8, TileId.bunker);
    p.set(3, 32, TileId.bunker);
    p.set(p.cols - 4, 32, TileId.bunker);
    p.set(5, 10, TileId.crater);
    p.set(16, 12, TileId.crater);
    p.set(8, 30, TileId.crater);
    p.set(14, 28, TileId.wreck);
    p.set(10, 20, TileId.wreck);
    p.set(6, 22, TileId.snag);
    for (let c = 4; c <= 18; c++) {
      if (c >= 7 && c <= 15) continue;
      p.set(c, 6, TileId.trench);
      p.set(c, 34, TileId.trench);
    }
    sealEdges(p, 'none', 'none', []);
    stampArenaEdge(p, 0);
    stampArenaEdge(p, LAST);
  },
};

export const LAND_BOSS_LIBRARY: readonly ChunkDef[] = [approach, courtyard];

export const LAND_BOSS_SPEC: ChunkMapSpec = {
  library: LAND_BOSS_LIBRARY,
  seed: LAND_BOSS_SEED,
  maxRepeats: 1,
  slots: Array.from({ length: LAND_BOSS_CHUNKS }, (_, i) =>
    i === 0
      ? { fixed: 'approach' as const, variant: 0 }
      : { fixed: 'courtyard' as const, variant: 0 }
  ),
};

/** First row of the looping courtyard (the approach is the chunk below it). */
export const LAND_BOSS_LOOP_ROW = MAP_CHUNK_ROWS;
