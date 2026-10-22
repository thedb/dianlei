/**
 * 海面A: an inland canal with forest banks. Nine screens, same length as
 * 陆地B. The canal is five tiles wide on every chunk edge (`SEA_EDGE_COLS`:
 * left bank, right bank, or the center slot) and never breaks. Lakes flare
 * off that canal inside a chunk; they do not touch the edge row. Stage 1
 * does not use this map.
 */

import { MAP_CHUNK_ROWS, MAP_TILES_X, SEA_A_SEED } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import {
  ROAD_COL,
  isStreamTile,
  sealEdges,
  type ChunkDef,
  type ChunkMapSpec,
  type ChunkPainter,
  type EdgeColumns,
  type StreamSide,
} from './chunks';

const LAST = MAP_CHUNK_ROWS - 1;

/** Five-tile canal. Left mirrors onto right; center is symmetric. */
export const SEA_EDGE_COLS: EdgeColumns = {
  left: [1, 2, 3, 4, 5],
  right: [MAP_TILES_X - 6, MAP_TILES_X - 5, MAP_TILES_X - 4, MAP_TILES_X - 3, MAP_TILES_X - 2],
  center: [ROAD_COL - 2, ROAD_COL - 1, ROAD_COL, ROAD_COL + 1, ROAD_COL + 2],
};

function seaChunk(
  id: string,
  bottom: StreamSide,
  top: StreamSide,
  body: (p: ChunkPainter) => void
): ChunkDef {
  return {
    id,
    bottom,
    top,
    variants: 1,
    paint(p) {
      body(p);
      sealEdges(p, bottom, top, [], TileId.road, SEA_EDGE_COLS);
    },
  };
}

function channelCenter(side: Exclude<StreamSide, 'none'>): number {
  return SEA_EDGE_COLS[side][2]!;
}

/** Five-wide canal from the bottom side to the top side. Returns the center per row. */
function paintCanal(
  p: ChunkPainter,
  bottom: Exclude<StreamSide, 'none'>,
  top: Exclude<StreamSide, 'none'>
): (row: number) => number {
  const c0 = channelCenter(bottom);
  const c1 = channelCenter(top);
  const centerAt = (r: number): number => {
    if (r <= 0) return c0;
    if (r >= p.rows - 1) return c1;
    const t = r / (p.rows - 1);
    const s = t * t * (3 - 2 * t);
    return Math.round(c0 + (c1 - c0) * s);
  };
  let prev = centerAt(0);
  for (let r = 0; r < p.rows; r++) {
    const c = centerAt(r);
    const lo = Math.min(prev, c) - 2;
    const hi = Math.max(prev, c) + 2;
    for (let x = lo; x <= hi; x++) p.set(x, r, TileId.lake);
    prev = c;
  }
  return centerAt;
}

/** Forest on both flanks, meadow left for the canal and its grass shore. */
function woodBanks(p: ChunkPainter): void {
  p.meadow();
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c <= 6; c++) p.set(c, r, TileId.forest);
    for (let c = 16; c < p.cols; c++) p.set(c, r, TileId.forest);
  }
}

/** Widen the canal inside the chunk. Edge rows stay the five-tile slot. */
function flare(p: ChunkPainter, side: Exclude<StreamSide, 'none'>): void {
  const cols = SEA_EDGE_COLS[side];
  const lo0 = cols[0]!;
  const hi0 = cols[cols.length - 1]!;
  for (let r = 6; r <= 33; r++) {
    const dist = Math.min(r - 6, 33 - r);
    const extra = Math.min(6, Math.floor(dist / 2));
    let lo = lo0;
    let hi = hi0;
    if (side === 'left') hi = Math.min(p.cols - 2, hi0 + extra);
    else if (side === 'right') lo = Math.max(1, lo0 - extra);
    else {
      lo = Math.max(1, lo0 - extra);
      hi = Math.min(p.cols - 2, hi0 + extra);
    }
    for (let c = lo; c <= hi; c++) p.set(c, r, TileId.lake);
  }
}

function clearings(p: ChunkPainter): void {
  const spots: Array<[number, number]> = [
    [2, 8],
    [3, 24],
    [19, 12],
    [20, 30],
  ];
  for (const [c, r] of spots) {
    const id = p.get(c, r);
    if (id === null || isStreamTile(id)) continue;
    p.rect(c, r, 2, 2, TileId.meadow);
    p.set(c, r + 1, TileId.oak);
    p.set(c + 1, r, TileId.fir);
  }
}

/** Deck across whatever water is on this row, with a short road onto each bank. */
function crossBridge(p: ChunkPainter, row: number, center: number): void {
  if (row <= 1 || row >= p.rows - 2) return;
  for (let dc = -6; dc <= 6; dc++) {
    const c = center + dc;
    if (c < 0 || c >= p.cols) continue;
    const id = p.get(c, row);
    if (id !== null && isStreamTile(id)) p.set(c, row, TileId.bridge);
    else p.set(c, row, TileId.road);
  }
}

/** Quay on the bank, `dir` +1 toward higher columns. Skips cells that are water. */
function quay(p: ChunkPainter, row: number, center: number, dir: -1 | 1): void {
  const c = center + dir * 3;
  for (let i = 0; i < 4; i++) {
    const r = row + i;
    if (r <= 0 || r >= LAST) continue;
    const id = p.get(c, r);
    if (id === null || isStreamTile(id)) continue;
    p.set(c, r, TileId.dock);
  }
}

function gunPit(p: ChunkPainter, c: number, r: number): void {
  p.rect(c, r, 3, 3, TileId.fortYard);
  p.set(c, r + 2, TileId.fortWall);
  p.set(c + 1, r + 2, TileId.fortWall);
  p.set(c + 2, r + 2, TileId.fortWall);
  p.set(c + 1, r, TileId.bunker);
  p.set(c + 1, r + 1, TileId.radar);
}

function reeds(p: ChunkPainter): void {
  for (let r = 1; r < LAST; r++) {
    for (let c = 0; c < p.cols; c++) {
      if (!p.isOpen(c, r)) continue;
      const wet =
        p.get(c - 1, r) === TileId.lake ||
        p.get(c + 1, r) === TileId.lake ||
        p.get(c, r - 1) === TileId.lake ||
        p.get(c, r + 1) === TileId.lake;
      if (wet && p.chance(0.4)) p.set(c, r, TileId.reeds);
    }
  }
}

/** 2×2 island, only when a full water ring already surrounds it. */
function island(p: ChunkPainter, c: number, r: number): void {
  for (let dc = -1; dc <= 2; dc++) {
    for (let dr = -1; dr <= 2; dr++) {
      const edge = dc < 0 || dr < 0 || dc > 1 || dr > 1;
      if (!edge) continue;
      const id = p.get(c + dc, r + dr);
      if (id === null || !isStreamTile(id)) return;
    }
  }
  p.set(c, r, TileId.oak);
  p.set(c + 1, r, TileId.fir);
  p.set(c, r + 1, TileId.meadow);
  p.set(c + 1, r + 1, TileId.oak);
}

const forestMouth = seaChunk('forestMouth', 'center', 'center', (p) => {
  woodBanks(p);
  paintCanal(p, 'center', 'center');
  clearings(p);
  reeds(p);
  p.scatter(8, [TileId.bush, TileId.flowers]);
});

const lakeCenter = seaChunk('lakeCenter', 'center', 'center', (p) => {
  woodBanks(p);
  paintCanal(p, 'center', 'center');
  flare(p, 'center');
  island(p, 5, 18);
  quay(p, 3, channelCenter('center'), -1);
  quay(p, 3, channelCenter('center'), 1);
  clearings(p);
  reeds(p);
});

const bendLeft = seaChunk('bendLeft', 'center', 'left', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'center', 'left');
  quay(p, 30, at(30), 1);
  clearings(p);
  reeds(p);
});

const dockLeft = seaChunk('dockLeft', 'left', 'left', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'left', 'left');
  quay(p, 12, at(12), 1);
  quay(p, 26, at(26), 1);
  gunPit(p, 9, 18);
  clearings(p);
  reeds(p);
});

const bridgeLeft = seaChunk('bridgeLeft', 'left', 'left', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'left', 'left');
  crossBridge(p, 18, at(18));
  gunPit(p, 9, 28);
  clearings(p);
  reeds(p);
});

const bendRight = seaChunk('bendRight', 'left', 'right', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'left', 'right');
  let row = 20;
  for (let r = 10; r <= 30; r++) {
    if (Math.abs(at(r) - ROAD_COL) < Math.abs(at(row) - ROAD_COL)) row = r;
  }
  crossBridge(p, row, at(row));
  clearings(p);
  reeds(p);
});

const batteryRight = seaChunk('batteryRight', 'right', 'right', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'right', 'right');
  quay(p, 22, at(22), -1);
  gunPit(p, 10, 12);
  clearings(p);
  reeds(p);
});

const lakeRight = seaChunk('lakeRight', 'right', 'right', (p) => {
  woodBanks(p);
  paintCanal(p, 'right', 'right');
  flare(p, 'right');
  island(p, 13, 18);
  quay(p, 3, channelCenter('right'), -1);
  clearings(p);
  reeds(p);
});

const forestHead = seaChunk('forestHead', 'right', 'center', (p) => {
  woodBanks(p);
  paintCanal(p, 'right', 'center');
  clearings(p);
  reeds(p);
  p.scatter(10, [TileId.oak, TileId.fir, TileId.bush]);
});

export const SEA_A_LIBRARY: readonly ChunkDef[] = [
  forestMouth,
  lakeCenter,
  bendLeft,
  dockLeft,
  bridgeLeft,
  bendRight,
  batteryRight,
  lakeRight,
  forestHead,
];

export const SEA_A_SPEC: ChunkMapSpec = {
  library: SEA_A_LIBRARY,
  seed: SEA_A_SEED,
  maxRepeats: 2,
  slots: [
    { fixed: 'forestMouth' },
    { fixed: 'lakeCenter' },
    { fixed: 'bendLeft' },
    { fixed: 'dockLeft' },
    { fixed: 'bridgeLeft' },
    { fixed: 'bendRight' },
    { fixed: 'batteryRight' },
    { fixed: 'lakeRight' },
    { fixed: 'forestHead' },
  ],
};
