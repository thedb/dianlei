/**
 * 黑曜舰空: Stage 4's boss arena. One approach, then a looping enemy flight
 * deck (`loopFrom` = 40). Row 0 is 海面B's last row. The deck is steel gray
 * with red lines and empty parking spots, and the island sits on the port
 * side. It does not reuse our concrete deck.
 *
 * Layout is bottom row first in map space (row 0 is the stitch). At the
 * boss enter, local scroll is about 120 px, so the upper half of the screen
 * is already the bow and the lower edge is still open sea.
 */

import { MAP_CHUNK_ROWS, OBSIDIAN_BOSS_CHUNKS, OBSIDIAN_BOSS_SEED } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import type { ChunkDef, ChunkMapSpec, ChunkPainter } from './chunks';
import { paintSeaSurface, seaBTopRow } from './seaB';

const LAST = MAP_CHUNK_ROWS - 1;

/** Cols 2–20 are enemy deck. The side columns stay open water. */
export function obsidianDeckSeam(): TileId[] {
  return Array.from({ length: 23 }, (_, c) =>
    c >= 2 && c <= 20 ? TileId.enemyDeck : TileId.ocean
  );
}

/** Inclusive deck span for an approach row, or null while it is still open sea. */
function bowSpan(row: number): { c0: number; c1: number } | null {
  if (row >= 33) return { c0: 2, c1: 20 };
  if (row >= 30) return { c0: 4, c1: 18 };
  if (row >= 27) return { c0: 6, c1: 16 };
  if (row >= 24) return { c0: 8, c1: 14 };
  if (row >= 22) return { c0: 10, c1: 12 };
  return null;
}

const APPROACH_SCRAP: readonly (readonly [number, number])[] = [
  [6, 8],
  [14, 10],
  [18, 12],
  [9, 14],
];

/** Eight empty spots on the loop. None sit on the island, the red lines, or an edge row. */
export const OBSIDIAN_SPOTS: readonly (readonly [number, number])[] = [
  [9, 12],
  [12, 12],
  [16, 12],
  [19, 12],
  [9, 26],
  [12, 26],
  [16, 26],
  [19, 26],
];

function fillWater(p: ChunkPainter): void {
  paintSeaSurface(p);
}

function paintSeam(p: ChunkPainter, row: number): void {
  const seam = obsidianDeckSeam();
  for (let c = 0; c < p.cols; c++) p.set(c, row, seam[c]!);
}

function paintApproach(p: ChunkPainter): void {
  fillWater(p);
  for (const [c, r] of APPROACH_SCRAP) p.set(c, r, TileId.wreckAlloy);
  for (let r = 1; r < LAST; r++) {
    const span = bowSpan(r);
    if (!span) continue;
    for (let c = span.c0; c <= span.c1; c++) p.set(c, r, TileId.enemyDeck);
  }
  for (let r = 33; r <= 38; r++) {
    for (let c = 3; c <= 6; c++) p.set(c, r, TileId.carrierIsland);
  }
  for (let r = 32; r <= 38; r++) {
    p.set(11, r, TileId.enemyMark);
    p.set(15, r, TileId.enemyMark);
  }
  for (let c = 0; c < p.cols; c++) p.set(c, 0, seaBTopRow()[c]!);
  paintSeam(p, LAST);
}

function paintLoop(p: ChunkPainter): void {
  fillWater(p);
  for (let r = 1; r < LAST; r++) {
    for (let c = 2; c <= 20; c++) p.set(c, r, TileId.enemyDeck);
  }
  for (let r = 8; r <= 31; r++) {
    for (let c = 3; c <= 6; c++) p.set(c, r, TileId.carrierIsland);
  }
  for (let r = 1; r < LAST; r++) {
    p.set(11, r, TileId.enemyMark);
    p.set(15, r, TileId.enemyMark);
  }
  for (const [c, r] of OBSIDIAN_SPOTS) p.set(c, r, TileId.deckSpot);
  paintSeam(p, 0);
  paintSeam(p, LAST);
}

const approach: ChunkDef = {
  id: 'approach',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint: paintApproach,
};

const deckLoop: ChunkDef = {
  id: 'deckLoop',
  bottom: 'none',
  top: 'none',
  variants: 1,
  paint: paintLoop,
};

export const OBSIDIAN_BOSS_LIBRARY: readonly ChunkDef[] = [approach, deckLoop];

export const OBSIDIAN_BOSS_SPEC: ChunkMapSpec = {
  library: OBSIDIAN_BOSS_LIBRARY,
  seed: OBSIDIAN_BOSS_SEED,
  maxRepeats: 1,
  slots: Array.from({ length: OBSIDIAN_BOSS_CHUNKS }, (_, i) =>
    i === 0
      ? { fixed: 'approach' as const, variant: 0 }
      : { fixed: 'deckLoop' as const, variant: 0 }
  ),
};

/** First row of the looping enemy deck (the approach is the chunk below it). */
export const OBSIDIAN_BOSS_LOOP_ROW = MAP_CHUNK_ROWS;
