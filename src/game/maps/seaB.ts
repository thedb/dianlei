/**
 * 海面B: Stage 4's run. Nine fixed chunks, seed 37, no mirror.
 * Chunk 0 is our flight deck. Chunk 1 is the stern, so the deck leaves the
 * bottom of the screen at 25.6s. The old striped wake rectangles are not
 * painted. Chunk 2 is open water with one unarmed sentry. Chunks 3–5 are the escorts and the six gun pads. Chunk 6 is
 * swell. Chunks 7–8 are the salvage field and a saucer-rim fragment.
 *
 * Edge rows are painted here. `sealEdges` is not used: it would write lake and
 * meadow. The planner still joins every chunk on stream side `none`.
 * Open water is `ocean` / `oceanB` (calm mounds). The last row is entirely
 * `ocean`, so the boss approach can copy it. `water` / `waterB` are not used.
 */

import { MAP_CHUNK_ROWS, SEA_B_SEED } from '@/game/config';
import { TileId, hash } from '@/game/art/tiles';
import {
  paintChunk,
  planChunks,
  type ChunkDef,
  type ChunkMapSpec,
  type ChunkPainter,
} from './chunks';

export const SEA_CHUNK_IDS = [
  'deckCatapult',
  'deckStern',
  'wakeOpen',
  'escortLeft',
  'cruiserLine',
  'escortRight',
  'openSwell',
  'wreckNear',
  'wreckFar',
] as const;

export type SeaChunkId = (typeof SEA_CHUNK_IDS)[number];

/** Last map row that is still our deck (the stern). Exit time is (row + 1) × 16 / 40 = 25.6s. */
export const OUR_DECK_LAST_ROW = 63;

export type SeaEdge = 'deck' | 'sea';

export const SEA_CHUNK_EDGES: Readonly<Record<SeaChunkId, readonly [SeaEdge, SeaEdge]>> = {
  deckCatapult: ['deck', 'deck'],
  deckStern: ['deck', 'sea'],
  wakeOpen: ['sea', 'sea'],
  escortLeft: ['sea', 'sea'],
  cruiserLine: ['sea', 'sea'],
  escortRight: ['sea', 'sea'],
  openSwell: ['sea', 'sea'],
  wreckNear: ['sea', 'sea'],
  wreckFar: ['sea', 'sea'],
};

/**
 * Catapult lane. Columns 10 and 12 are the white guide lines. Columns 9–13
 * stay clear of parked fighters on both deck chunks. The player launches
 * down the gap (column 11).
 */
export const CATAPULT_MARK_COLS = [10, 12] as const;
export const CATAPULT_LANE = { c0: 9, c1: 13 } as const;

/**
 * 2×2 friendly fighters. `row` is the tail row; the nose is the next row up.
 * Both groups sit on the full-width stern deck, off the catapult lane:
 * two to port, one to starboard beside the island.
 */
export const SEA_PLANE_GROUPS: readonly { row: number; cols: readonly number[] }[] = [
  { row: 46, cols: [3, 6, 14] },
  { row: 50, cols: [3, 6, 14] },
];

export const SEA_ISLANDS: readonly { r0: number; r1: number; c0: number; c1: number }[] = [
  { r0: 8, r1: 30, c0: 16, c1: 19 },
  { r0: 42, r1: 52, c0: 16, c1: 19 },
];

/**
 * Stern deck, wide end first. Each step after the full deck insets 2 columns
 * per side, the same language as 黑曜舰空's bow (tip is columns 10–12).
 * The island and the fighters end on the full-width step. Row 40 is the
 * chunk edge and stays a full-width deck seal; it is not in this table.
 */
export const STERN_TAPER: readonly { r1: number; c0: number; c1: number }[] = [
  { r1: 52, c0: 2, c1: 20 },
  { r1: 55, c0: 4, c1: 18 },
  { r1: 58, c0: 6, c1: 16 },
  { r1: 61, c0: 8, c1: 14 },
  { r1: 63, c0: 10, c1: 12 },
];

/** Inclusive deck span for a stern map row, or null on the edge and past the tip. */
export function sternDeckSpan(row: number): { c0: number; c1: number } | null {
  if (row <= MAP_CHUNK_ROWS || row > OUR_DECK_LAST_ROW) return null;
  for (const step of STERN_TAPER) {
    if (row <= step.r1) return { c0: step.c0, c1: step.c1 };
  }
  return null;
}

/**
 * The two striped wake rectangles (rows 64–76 cols 8–14, and rows 81–86
 * cols 9–13) are not placed. Those cells stay `ocean` / `oceanB`.
 */

/** Unarmed sentry on chunk 2. Hull only, no gun pad. */
export const SEA_SENTRY = { r0: 108, r1: 116, c0: 15, c1: 20 } as const;

export const SEA_HULLS: readonly {
  id: SeaChunkId;
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}[] = [
  { id: 'escortLeft', r0: 124, r1: 154, c0: 3, c1: 10 },
  { id: 'cruiserLine', r0: 166, r1: 192, c0: 5, c1: 17 },
  { id: 'escortRight', r0: 208, r1: 232, c0: 12, c1: 20 },
];

/** Lowest row and leftmost column of each 2×2 gun pad. */
export const SEA_GUN_PADS: readonly { id: string; row: number; col: number }[] = [
  { id: 'B01', row: 132, col: 8 },
  { id: 'B02', row: 146, col: 5 },
  { id: 'B03', row: 170, col: 7 },
  { id: 'B04', row: 184, col: 14 },
  { id: 'B05', row: 214, col: 15 },
  { id: 'B06', row: 226, col: 17 },
];

/** Single water cells reserved for later floaters. This round spawns nothing there. */
export const SEA_FLOAT_ANCHORS: readonly { id: string; row: number; col: number }[] = [
  { id: 'F01', row: 288, col: 5 },
  { id: 'F02', row: 294, col: 16 },
  { id: 'F03', row: 302, col: 9 },
  { id: 'F04', row: 308, col: 18 },
  { id: 'F05', row: 314, col: 4 },
  { id: 'F06', row: 316, col: 13 },
  { id: 'F07', row: 324, col: 7 },
  { id: 'F08', row: 332, col: 15 },
];

/** Salvage ship on chunk 7. Cargo alloy sits inside the hull, not on the rim. */
export const SEA_SALVAGE = { r0: 283, r1: 292, c0: 11, c1: 15 } as const;

export const SEA_SALVAGE_CARGO: readonly (readonly [number, number])[] = [
  [12, 285],
  [13, 285],
  [14, 286],
  [12, 288],
  [13, 288],
  [14, 289],
];

/**
 * A fragment of a 208px saucer rim (radius 6.5 tiles). The arc sits in chunk 8
 * and does not cover the floater anchors.
 */
export const SAUCER_RIM_RADIUS = 208 / 32;
export const SAUCER_RIM_CENTER = { col: 4, row: 345 } as const;
const SAUCER_RIM_BAND = 1.15;

export function isSaucerRim(col: number, row: number): boolean {
  if (row < 336 || row > 354 || col < 7) return false;
  const dx = col + 0.5 - SAUCER_RIM_CENTER.col;
  const dy = row + 0.5 - SAUCER_RIM_CENTER.row;
  return Math.abs(Math.hypot(dx, dy) - SAUCER_RIM_RADIUS) <= SAUCER_RIM_BAND;
}

function chunkIndex(id: SeaChunkId): number {
  return SEA_CHUNK_IDS.indexOf(id);
}

function row0Of(id: SeaChunkId): number {
  return chunkIndex(id) * MAP_CHUNK_ROWS;
}

/**
 * Open sea. About one cell in five is the second mound, scattered by hash,
 * not a row stripe. Edge rows are sealed to plain `ocean` afterwards.
 */
export function paintSeaSurface(p: ChunkPainter): void {
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const patch = hash(c * 3 + 11, r * 7 + 5) % 5 === 0;
      p.set(c, r, patch ? TileId.oceanB : TileId.ocean);
    }
  }
}

function deckBlock(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    for (let c = 2; c <= 20; c++) p.set(c, r, TileId.carrierDeck);
  }
}

function placeIsland(p: ChunkPainter, mapRow0: number, island: (typeof SEA_ISLANDS)[number]): void {
  for (let r = island.r0; r <= island.r1; r++) {
    for (let c = island.c0; c <= island.c1; c++) p.set(c, r - mapRow0, TileId.carrierIsland);
  }
}

function placePlane(p: ChunkPainter, col: number, row: number, mapRow0: number): void {
  const r = row - mapRow0;
  p.set(col, r, TileId.carrierPlaneBL);
  p.set(col + 1, r, TileId.carrierPlaneBR);
  p.set(col, r + 1, TileId.carrierPlaneTL);
  p.set(col + 1, r + 1, TileId.carrierPlaneTR);
}

function paintCatapultMarks(
  p: ChunkPainter,
  local: number,
  span: { c0: number; c1: number }
): void {
  for (const col of CATAPULT_MARK_COLS) {
    if (col >= span.c0 && col <= span.c1) p.set(col, local, TileId.carrierMark);
  }
}

function paintCatapult(p: ChunkPainter): void {
  const full = { c0: 2, c1: 20 };
  deckBlock(p, 1, MAP_CHUNK_ROWS - 2);
  placeIsland(p, 0, SEA_ISLANDS[0]!);
  // Edge rows stay plain deck. The lines run the rest of the opening deck.
  for (let r = 1; r <= MAP_CHUNK_ROWS - 2; r++) paintCatapultMarks(p, r, full);
}

function paintStern(p: ChunkPainter): void {
  const origin = row0Of('deckStern');
  // Row 40 is the deck edge (sealed later). Rows 41–63 step in toward the sea.
  for (let row = origin + 1; row <= OUR_DECK_LAST_ROW; row++) {
    const span = sternDeckSpan(row);
    if (!span) continue;
    const local = row - origin;
    for (let c = span.c0; c <= span.c1; c++) p.set(c, local, TileId.carrierDeck);
    paintCatapultMarks(p, local, span);
  }
  placeIsland(p, origin, SEA_ISLANDS[1]!);
  for (const group of SEA_PLANE_GROUPS) {
    for (const col of group.cols) placePlane(p, col, group.row, origin);
  }
}

function paintWakeOpen(p: ChunkPainter): void {
  const origin = row0Of('wakeOpen');
  for (let r = SEA_SENTRY.r0; r <= SEA_SENTRY.r1; r++) {
    for (let c = SEA_SENTRY.c0; c <= SEA_SENTRY.c1; c++) {
      p.set(c, r - origin, TileId.cruiserHull);
    }
  }
}

function paintHull(p: ChunkPainter, id: SeaChunkId): void {
  const origin = row0Of(id);
  const hull = SEA_HULLS.find((entry) => entry.id === id)!;
  for (let r = hull.r0; r <= hull.r1; r++) {
    for (let c = hull.c0; c <= hull.c1; c++) p.set(c, r - origin, TileId.cruiserHull);
  }
  for (const pad of SEA_GUN_PADS) {
    if (pad.row < hull.r0 || pad.row > hull.r1) continue;
    for (let r = pad.row; r < pad.row + 2; r++) {
      for (let c = pad.col; c < pad.col + 2; c++) p.set(c, r - origin, TileId.cruiserGunDeck);
    }
  }
}

function scatterWreck(p: ChunkPainter, origin: number, dense: boolean): void {
  const alloyMod = dense ? 13 : 23;
  const burnMod = dense ? 29 : 41;
  for (let r = 1; r < p.rows - 1; r++) {
    for (let c = 0; c < p.cols; c++) {
      const mapRow = origin + r;
      if (insideRect(c, mapRow, SEA_SALVAGE)) continue;
      const n = hash(c + 17, mapRow + 91);
      if (n % alloyMod === 0) p.set(c, r, TileId.wreckAlloy);
      else if (n % burnMod === 0) p.set(c, r, TileId.wreckBurn);
    }
  }
}

function insideRect(
  col: number,
  row: number,
  rect: { r0: number; r1: number; c0: number; c1: number }
): boolean {
  return row >= rect.r0 && row <= rect.r1 && col >= rect.c0 && col <= rect.c1;
}

function paintSalvage(p: ChunkPainter, origin: number): void {
  for (let r = SEA_SALVAGE.r0; r <= SEA_SALVAGE.r1; r++) {
    for (let c = SEA_SALVAGE.c0; c <= SEA_SALVAGE.c1; c++) {
      p.set(c, r - origin, TileId.cruiserHull);
    }
  }
  for (const [c, r] of SEA_SALVAGE_CARGO) p.set(c, r - origin, TileId.wreckAlloy);
}

function paintWreckNear(p: ChunkPainter): void {
  const origin = row0Of('wreckNear');
  scatterWreck(p, origin, false);
  paintSalvage(p, origin);
}

function paintWreckFar(p: ChunkPainter): void {
  const origin = row0Of('wreckFar');
  scatterWreck(p, origin, true);
  for (let r = 1; r < p.rows - 1; r++) {
    for (let c = 0; c < p.cols; c++) {
      if (isSaucerRim(c, origin + r)) p.set(c, r, TileId.wreckAlloy);
    }
  }
}

function pinAnchors(p: ChunkPainter, origin: number): void {
  for (const anchor of SEA_FLOAT_ANCHORS) {
    const local = anchor.row - origin;
    if (local <= 0 || local >= p.rows - 1) continue;
    p.set(anchor.col, local, TileId.ocean);
  }
}

function sealRow(p: ChunkPainter, row: number, edge: SeaEdge): void {
  for (let c = 0; c < p.cols; c++) {
    const deck = edge === 'deck' && c >= 2 && c <= 20;
    p.set(c, row, deck ? TileId.carrierDeck : TileId.ocean);
  }
}

function paintSeaChunk(p: ChunkPainter, id: SeaChunkId): void {
  paintSeaSurface(p);
  if (id === 'deckCatapult') paintCatapult(p);
  else if (id === 'deckStern') paintStern(p);
  else if (id === 'wakeOpen') paintWakeOpen(p);
  else if (id === 'escortLeft' || id === 'cruiserLine' || id === 'escortRight') paintHull(p, id);
  else if (id === 'wreckNear') paintWreckNear(p);
  else if (id === 'wreckFar') paintWreckFar(p);
  pinAnchors(p, row0Of(id));
  const [bottom, top] = SEA_CHUNK_EDGES[id];
  sealRow(p, 0, bottom);
  sealRow(p, p.rows - 1, top);
}

function makeChunk(id: SeaChunkId): ChunkDef {
  return {
    id,
    bottom: 'none',
    top: 'none',
    variants: 1,
    paint(p) {
      paintSeaChunk(p, id);
    },
  };
}

export const SEA_B_LIBRARY: readonly ChunkDef[] = SEA_CHUNK_IDS.map(makeChunk);

export const SEA_B_SPEC: ChunkMapSpec = {
  library: SEA_B_LIBRARY,
  seed: SEA_B_SEED,
  maxRepeats: 1,
  slots: SEA_CHUNK_IDS.map((id) => ({ fixed: id, variant: 0 as const })),
};

let topRow: readonly TileId[] | null = null;

/** Last row of 海面B. The boss approach copies it cell for cell. */
export function seaBTopRow(): readonly TileId[] {
  if (!topRow) {
    const plan = planChunks(SEA_B_SPEC);
    const last = paintChunk(SEA_B_LIBRARY, plan[plan.length - 1]!);
    topRow = [...last[MAP_CHUNK_ROWS - 1]!];
  }
  return topRow;
}
