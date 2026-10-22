/**
 * 河流A: one inland river with forest banks and riverside hamlets. Nine
 * screens, same length as 陆地B. The channel is five tiles wide on every
 * chunk edge (`RIVER_EDGE_COLS`: left bank, right bank, or the center slot)
 * and never breaks. Lakes flare off that channel inside a chunk; they do not
 * touch the edge row. Hamlets, crop plots, and water wheels sit on the banks.
 * Stage 1 does not use this map.
 */

import { MAP_CHUNK_ROWS, MAP_TILES_X, RIVER_A_SEED } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import {
  ROAD_COL,
  isStreamTile,
  sealEdges,
  type ChunkDef,
  type ChunkMapSpec,
  type ChunkPainter,
  type EdgeColumns,
  type HouseColor,
  type StreamSide,
} from './chunks';

const LAST = MAP_CHUNK_ROWS - 1;

/** Five-tile channel. Left mirrors onto right; center is symmetric. */
export const RIVER_EDGE_COLS: EdgeColumns = {
  left: [1, 2, 3, 4, 5],
  right: [MAP_TILES_X - 6, MAP_TILES_X - 5, MAP_TILES_X - 4, MAP_TILES_X - 3, MAP_TILES_X - 2],
  center: [ROAD_COL - 2, ROAD_COL - 1, ROAD_COL, ROAD_COL + 1, ROAD_COL + 2],
};

interface Plot {
  c: number;
  r: number;
  w: number;
  h: number;
  crop: TileId;
}

interface HouseAt {
  c: number;
  r: number;
  color: HouseColor;
}

interface Hamlet {
  c: number;
  r: number;
  w: number;
  h: number;
  houses: readonly HouseAt[];
  plots: readonly Plot[];
  /** Bank cell that should end up next to the river. The search walks outward. */
  wheel: readonly [number, number];
}

function riverChunk(
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
      sealEdges(p, bottom, top, [], TileId.road, RIVER_EDGE_COLS);
    },
  };
}

function channelCenter(side: Exclude<StreamSide, 'none'>): number {
  return RIVER_EDGE_COLS[side][2]!;
}

/** Five-wide channel from the bottom side to the top side. Returns the center per row. */
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

/** Forest on both flanks, meadow left for the channel and its grass shore. */
function woodBanks(p: ChunkPainter): void {
  p.meadow();
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c <= 6; c++) p.set(c, r, TileId.forest);
    for (let c = 16; c < p.cols; c++) p.set(c, r, TileId.forest);
  }
}

/** Widen the channel inside the chunk. Edge rows stay the five-tile slot. */
function flare(p: ChunkPainter, side: Exclude<StreamSide, 'none'>): void {
  const cols = RIVER_EDGE_COLS[side];
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

function clearBank(p: ChunkPainter, c: number, r: number, w: number, h: number): void {
  for (let rr = r; rr < r + h; rr++) {
    for (let cc = c; cc < c + w; cc++) {
      if (rr <= 0 || rr >= LAST) continue;
      const id = p.get(cc, rr);
      if (id === null || isStreamTile(id)) continue;
      if (
        id === TileId.dock ||
        id === TileId.bunker ||
        id === TileId.fortWall ||
        id === TileId.fortYard ||
        id === TileId.radar
      ) {
        continue;
      }
      p.set(cc, rr, TileId.meadow);
    }
  }
}

function touchesLake(p: ChunkPainter, c: number, r: number): boolean {
  return (
    p.get(c - 1, r) === TileId.lake ||
    p.get(c + 1, r) === TileId.lake ||
    p.get(c, r - 1) === TileId.lake ||
    p.get(c, r + 1) === TileId.lake
  );
}

function blockedBank(id: TileId): boolean {
  return (
    isStreamTile(id) ||
    id === TileId.dock ||
    id === TileId.bunker ||
    id === TileId.fortWall ||
    id === TileId.fortYard ||
    id === TileId.radar ||
    id === TileId.wheel ||
    id === TileId.hut ||
    (id >= TileId.houseRedTL && id <= TileId.houseRedBR) ||
    (id >= TileId.houseBrownTL && id <= TileId.houseBrownBR)
  );
}

/** Drop a wheel on the first bank cell that actually meets the river. */
function tryWheel(p: ChunkPainter, c: number, r: number): void {
  const steps: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [3, 0],
    [-3, 0],
  ];
  for (const [dc, dr] of steps) {
    const cc = c + dc;
    const rr = r + dr;
    if (rr <= 1 || rr >= LAST - 1 || cc <= 0 || cc >= p.cols - 1) continue;
    const id = p.get(cc, rr);
    if (id === null || blockedBank(id) || !touchesLake(p, cc, rr)) continue;
    p.set(cc, rr, TileId.wheel);
    const away = p.get(cc - 1, rr) === TileId.lake ? cc + 1 : cc - 1;
    const mill = p.get(away, rr);
    if (mill !== null && rr > 0 && rr < LAST && !blockedBank(mill)) p.set(away, rr, TileId.shed);
    return;
  }
}

function hamlet(p: ChunkPainter, h: Hamlet): void {
  clearBank(p, h.c, h.r, h.w, h.h);
  for (const house of h.houses) {
    if (house.r <= 0 || house.r >= LAST - 1) continue;
    if (!p.open2x2(house.c, house.r)) continue;
    p.house(house.c, house.r, house.color);
  }
  tryWheel(p, h.wheel[0], h.wheel[1]);
  for (const plot of h.plots) {
    for (let rr = plot.r; rr < plot.r + plot.h; rr++) {
      for (let cc = plot.c; cc < plot.c + plot.w; cc++) {
        if (rr <= 0 || rr >= LAST) continue;
        if (!p.isOpen(cc, rr)) continue;
        p.set(cc, rr, plot.crop);
      }
    }
  }
}

function settle(p: ChunkPainter, hamlets: readonly Hamlet[]): void {
  for (const h of hamlets) hamlet(p, h);
}

const forestMouth = riverChunk('forestMouth', 'center', 'center', (p) => {
  woodBanks(p);
  paintCanal(p, 'center', 'center');
  clearings(p);
  settle(p, [
    {
      c: 0,
      r: 6,
      w: 8,
      h: 14,
      houses: [
        { c: 1, r: 8, color: 'brown' },
        { c: 4, r: 12, color: 'red' },
      ],
      plots: [{ c: 1, r: 16, w: 6, h: 3, crop: TileId.cropWheat }],
      wheel: [8, 10],
    },
    {
      c: 15,
      r: 22,
      w: 8,
      h: 14,
      houses: [
        { c: 16, r: 24, color: 'brown' },
        { c: 19, r: 28, color: 'red' },
      ],
      plots: [{ c: 16, r: 22, w: 5, h: 3, crop: TileId.cropGreen }],
      wheel: [14, 26],
    },
  ]);
  reeds(p);
  p.scatter(8, [TileId.bush, TileId.flowers]);
});

const lakeCenter = riverChunk('lakeCenter', 'center', 'center', (p) => {
  woodBanks(p);
  paintCanal(p, 'center', 'center');
  flare(p, 'center');
  island(p, 5, 18);
  quay(p, 3, channelCenter('center'), -1);
  quay(p, 3, channelCenter('center'), 1);
  clearings(p);
  settle(p, [
    {
      c: 0,
      r: 1,
      w: 8,
      h: 6,
      houses: [{ c: 1, r: 2, color: 'brown' }],
      plots: [{ c: 4, r: 2, w: 3, h: 3, crop: TileId.cropPlowed }],
      wheel: [7, 8],
    },
    {
      c: 15,
      r: 33,
      w: 8,
      h: 6,
      houses: [{ c: 16, r: 34, color: 'red' }],
      plots: [{ c: 19, r: 34, w: 3, h: 3, crop: TileId.cropWheat }],
      wheel: [14, 35],
    },
  ]);
  reeds(p);
});

const bendLeft = riverChunk('bendLeft', 'center', 'left', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'center', 'left');
  quay(p, 30, at(30), 1);
  clearings(p);
  settle(p, [
    {
      c: 15,
      r: 4,
      w: 7,
      h: 12,
      houses: [
        { c: 16, r: 6, color: 'brown' },
        { c: 18, r: 10, color: 'red' },
      ],
      plots: [{ c: 15, r: 13, w: 6, h: 3, crop: TileId.cropGreen }],
      wheel: [13, 8],
    },
    {
      c: 8,
      r: 26,
      w: 10,
      h: 10,
      houses: [
        { c: 10, r: 28, color: 'brown' },
        { c: 14, r: 32, color: 'red' },
      ],
      plots: [{ c: 9, r: 34, w: 6, h: 3, crop: TileId.cropWheat }],
      wheel: [6, 30],
    },
  ]);
  reeds(p);
});

const dockLeft = riverChunk('dockLeft', 'left', 'left', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'left', 'left');
  quay(p, 12, at(12), 1);
  quay(p, 26, at(26), 1);
  gunPit(p, 9, 18);
  clearings(p);
  settle(p, [
    {
      c: 8,
      r: 4,
      w: 13,
      h: 8,
      houses: [
        { c: 9, r: 5, color: 'red' },
        { c: 13, r: 5, color: 'brown' },
        { c: 11, r: 8, color: 'brown' },
      ],
      plots: [{ c: 16, r: 4, w: 5, h: 4, crop: TileId.cropGreen }],
      wheel: [6, 6],
    },
    {
      c: 8,
      r: 30,
      w: 12,
      h: 8,
      houses: [{ c: 10, r: 32, color: 'red' }],
      plots: [{ c: 14, r: 32, w: 5, h: 3, crop: TileId.cropWheat }],
      wheel: [6, 33],
    },
  ]);
  reeds(p);
});

const bridgeLeft = riverChunk('bridgeLeft', 'left', 'left', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'left', 'left');
  crossBridge(p, 18, at(18));
  gunPit(p, 9, 28);
  clearings(p);
  settle(p, [
    {
      c: 8,
      r: 4,
      w: 13,
      h: 10,
      houses: [
        { c: 9, r: 6, color: 'brown' },
        { c: 14, r: 8, color: 'red' },
      ],
      plots: [{ c: 16, r: 5, w: 4, h: 4, crop: TileId.cropPlowed }],
      wheel: [6, 7],
    },
    {
      c: 8,
      r: 22,
      w: 12,
      h: 6,
      houses: [
        { c: 10, r: 22, color: 'brown' },
        { c: 15, r: 24, color: 'red' },
      ],
      plots: [{ c: 9, r: 26, w: 5, h: 2, crop: TileId.cropWheat }],
      wheel: [6, 23],
    },
  ]);
  reeds(p);
});

const bendRight = riverChunk('bendRight', 'left', 'right', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'left', 'right');
  let row = 20;
  for (let r = 10; r <= 30; r++) {
    if (Math.abs(at(r) - ROAD_COL) < Math.abs(at(row) - ROAD_COL)) row = r;
  }
  crossBridge(p, row, at(row));
  clearings(p);
  settle(p, [
    {
      c: 8,
      r: 3,
      w: 13,
      h: 8,
      houses: [
        { c: 10, r: 4, color: 'brown' },
        { c: 14, r: 6, color: 'red' },
      ],
      plots: [{ c: 16, r: 3, w: 4, h: 3, crop: TileId.cropGreen }],
      wheel: [7, 5],
    },
    {
      c: 1,
      r: 28,
      w: 12,
      h: 9,
      houses: [
        { c: 2, r: 30, color: 'brown' },
        { c: 6, r: 33, color: 'red' },
      ],
      plots: [{ c: 2, r: 28, w: 5, h: 2, crop: TileId.cropWheat }],
      wheel: [14, 32],
    },
  ]);
  reeds(p);
});

const batteryRight = riverChunk('batteryRight', 'right', 'right', (p) => {
  woodBanks(p);
  const at = paintCanal(p, 'right', 'right');
  quay(p, 22, at(22), -1);
  gunPit(p, 10, 12);
  clearings(p);
  settle(p, [
    {
      c: 2,
      r: 4,
      w: 8,
      h: 6,
      houses: [{ c: 3, r: 5, color: 'brown' }],
      plots: [{ c: 2, r: 4, w: 4, h: 2, crop: TileId.cropPlowed }],
      wheel: [16, 6],
    },
    {
      c: 2,
      r: 24,
      w: 13,
      h: 12,
      houses: [
        { c: 3, r: 26, color: 'red' },
        { c: 7, r: 26, color: 'brown' },
        { c: 5, r: 30, color: 'brown' },
      ],
      plots: [{ c: 10, r: 28, w: 4, h: 4, crop: TileId.cropGreen }],
      wheel: [16, 28],
    },
  ]);
  reeds(p);
});

const lakeRight = riverChunk('lakeRight', 'right', 'right', (p) => {
  woodBanks(p);
  paintCanal(p, 'right', 'right');
  flare(p, 'right');
  island(p, 13, 18);
  quay(p, 3, channelCenter('right'), -1);
  clearings(p);
  settle(p, [
    {
      c: 1,
      r: 12,
      w: 10,
      h: 16,
      houses: [
        { c: 2, r: 14, color: 'brown' },
        { c: 6, r: 14, color: 'red' },
        { c: 4, r: 20, color: 'brown' },
      ],
      plots: [{ c: 2, r: 24, w: 6, h: 3, crop: TileId.cropWheat }],
      wheel: [10, 18],
    },
  ]);
  reeds(p);
});

const forestHead = riverChunk('forestHead', 'right', 'center', (p) => {
  woodBanks(p);
  paintCanal(p, 'right', 'center');
  clearings(p);
  settle(p, [
    {
      c: 1,
      r: 8,
      w: 8,
      h: 14,
      houses: [
        { c: 2, r: 10, color: 'brown' },
        { c: 5, r: 16, color: 'red' },
      ],
      plots: [{ c: 1, r: 20, w: 6, h: 3, crop: TileId.cropGreen }],
      wheel: [14, 12],
    },
    {
      c: 15,
      r: 30,
      w: 7,
      h: 7,
      houses: [{ c: 16, r: 32, color: 'brown' }],
      plots: [{ c: 16, r: 30, w: 4, h: 2, crop: TileId.cropWheat }],
      wheel: [14, 33],
    },
  ]);
  reeds(p);
  p.scatter(10, [TileId.oak, TileId.fir, TileId.bush]);
});

export const RIVER_A_LIBRARY: readonly ChunkDef[] = [
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

export const RIVER_A_SPEC: ChunkMapSpec = {
  library: RIVER_A_LIBRARY,
  seed: RIVER_A_SEED,
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
