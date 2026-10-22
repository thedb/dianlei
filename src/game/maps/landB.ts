/**
 * 陆地B: a military airfield. Nine screens (5760 px, 128 s of map preview),
 * bottom to top: perimeter approach, the runway core, then a battlefield
 * the airfield breaks into. Stage 1 does not use this map.
 *
 * Every chunk keeps a five-column spine on row 0 and row 39 (`AIRFIELD_SPINE`)
 * and no water, so the road or runway joins across chunks. The spine tile
 * changes with the phase: dirt road, runway, then dirt road again.
 */

import { LAND_B_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { ROAD_COL, sealEdges, type ChunkDef, type ChunkMapSpec, type ChunkPainter } from './chunks';

const LAST = MAP_CHUNK_ROWS - 1;

/** Five columns centered on the main road. Symmetric, so mirroring keeps the set. */
export const AIRFIELD_SPINE = [
  ROAD_COL - 2,
  ROAD_COL - 1,
  ROAD_COL,
  ROAD_COL + 1,
  ROAD_COL + 2,
] as const;

const SPINE = new Set<number>(AIRFIELD_SPINE);

function landChunk(id: string, spineId: TileId, body: (p: ChunkPainter) => void): ChunkDef {
  return {
    id,
    bottom: 'none',
    top: 'none',
    variants: 1,
    paint(p) {
      body(p);
      sealEdges(p, 'none', 'none', AIRFIELD_SPINE, spineId);
    },
  };
}

function stampSpine(p: ChunkPainter, id: TileId): void {
  for (let r = 0; r < p.rows; r++) for (const c of AIRFIELD_SPINE) p.set(c, r, id);
}

/** Non-spine cells of an edge row, columns 2–20, so chunk joins share a ground. */
function paveEdge(p: ChunkPainter, which: 'top' | 'bottom' | 'both', id: TileId): void {
  const rows = which === 'both' ? [0, LAST] : which === 'top' ? [LAST] : [0];
  for (const r of rows) {
    for (let c = 2; c <= 20; c++) if (!SPINE.has(c)) p.set(c, r, id);
  }
}

function shoulders(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    p.set(8, r, TileId.dirt);
    p.set(14, r, TileId.dirt);
  }
}

function walls(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    p.set(1, r, TileId.wall);
    p.set(p.cols - 2, r, TileId.wall);
  }
}

function hangar(p: ChunkPainter, c: number, r: number): void {
  p.rect(c, r, 4, 2, TileId.hangar);
  p.rect(c, r + 2, 4, 1, TileId.hangarRoof);
}

function pad(p: ChunkPainter, c: number, r: number): void {
  p.rect(c, r, 2, 2, TileId.pad);
}

function concreteBand(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r++) {
    for (let c = 2; c <= 20; c++) {
      if (SPINE.has(c)) continue;
      p.set(c, r, (c + r) % 7 === 0 ? TileId.concreteDark : TileId.concrete);
    }
  }
}

function marks(p: ChunkPainter): void {
  for (let r = 2; r < LAST; r += 2) p.set(ROAD_COL, r, TileId.runwayMark);
}

function bushes(p: ChunkPainter): void {
  const spots: Array<[number, number]> = [
    [3, 8],
    [4, 18],
    [6, 28],
    [16, 10],
    [18, 22],
    [19, 32],
  ];
  for (const [c, r] of spots) p.set(c, r, TileId.bush);
  p.scatter(8, [TileId.bush, TileId.fir], (c) => c < 7 || c > 15);
}

function scorchGround(p: ChunkPainter): void {
  p.meadow();
  for (let r = 1; r < LAST; r++) {
    for (let c = 0; c < p.cols; c++) {
      if ((c + r) % 3 !== 0) p.set(c, r, TileId.scorch);
      else if ((c * 2 + r) % 5 === 0) p.set(c, r, TileId.dirt);
    }
  }
}

function craters(p: ChunkPainter, spots: ReadonlyArray<readonly [number, number]>): void {
  for (const [c, r] of spots) {
    p.set(c, r, TileId.crater);
    if (!SPINE.has(c + 1)) p.set(c + 1, r, TileId.scorch);
    p.set(c, r + 1, TileId.scorch);
  }
}

function wreck(p: ChunkPainter, c: number, r: number): void {
  p.rect(c, r, 2, 2, TileId.wreck);
}

function snagFringe(p: ChunkPainter): void {
  for (let r = 4; r <= 34; r += 6) {
    p.set(1, r, TileId.snag);
    p.set(p.cols - 2, r + 3, TileId.snag);
    if (r % 12 === 4) p.set(2, r + 2, TileId.fir);
  }
}

function trenches(p: ChunkPainter): void {
  for (const r of [10, 20, 30]) {
    for (let c = 2; c <= 20; c++) p.set(c, r, TileId.trench);
  }
}

/** Perimeter fence, a gate across the road, sparse brush, one sentry block. */
const fenceLine = landChunk('fenceLine', TileId.road, (p) => {
  p.meadow();
  shoulders(p, 0, LAST);
  walls(p, 0, LAST);
  stampSpine(p, TileId.road);
  for (const c of AIRFIELD_SPINE) p.set(c, 8, TileId.gate);
  p.set(8, 8, TileId.wall);
  p.set(14, 8, TileId.wall);
  p.rect(3, 18, 3, 2, TileId.barracks);
  p.set(4, 21, TileId.bunker);
  bushes(p);
});

/** Guard bunkers and a side track. Mirrored in the plan, so the posts swap sides. */
const guardPosts = landChunk('guardPosts', TileId.road, (p) => {
  p.meadow();
  shoulders(p, 0, LAST);
  walls(p, 0, LAST);
  stampSpine(p, TileId.road);
  p.hRoad(16, 2, ROAD_COL);
  p.set(3, 14, TileId.bunker);
  p.set(18, 24, TileId.bunker);
  p.rect(4, 28, 3, 2, TileId.barracks);
  p.set(6, 30, TileId.radar);
  bushes(p);
  p.scatter(4, [TileId.fir, TileId.oak], (c) => c < 6 || c > 16);
});

/** The fence opens onto concrete. The top edge is already the apron. */
const taxiIn = landChunk('taxiIn', TileId.road, (p) => {
  p.meadow();
  shoulders(p, 0, 17);
  walls(p, 0, 16);
  concreteBand(p, 18, 38);
  paveEdge(p, 'top', TileId.concrete);
  stampSpine(p, TileId.road);
  for (const c of AIRFIELD_SPINE) p.set(c, 18, TileId.gate);
  hangar(p, 3, 28);
  pad(p, 16, 30);
  p.set(19, 24, TileId.bunker);
  bushes(p);
});

/** Runway, hangar row, pads. Bottom edge matches the taxiway's concrete. */
const runwayHangars = landChunk('runwayHangars', TileId.runway, (p) => {
  p.meadow();
  concreteBand(p, 1, 38);
  paveEdge(p, 'both', TileId.concrete);
  stampSpine(p, TileId.runway);
  marks(p);
  hangar(p, 3, 6);
  hangar(p, 3, 22);
  hangar(p, 16, 12);
  hangar(p, 16, 28);
  pad(p, 7, 14);
  pad(p, 14, 20);
  pad(p, 7, 32);
  p.set(2, 16, TileId.bunker);
  p.set(20, 26, TileId.bunker);
  p.hRoad(18, 3, 8, TileId.street);
  p.hRoad(32, 14, 19, TileId.street);
});

/** Densest screen: tower, fuel and ammo, hangars both sides, AA pits, pads. */
const towerApron = landChunk('towerApron', TileId.runway, (p) => {
  p.meadow();
  concreteBand(p, 1, 38);
  paveEdge(p, 'both', TileId.concrete);
  stampSpine(p, TileId.runway);
  marks(p);
  p.hRoad(8, 3, 19, TileId.street);
  p.hRoad(20, 3, 19, TileId.street);
  p.rect(3, 2, 3, 2, TileId.barracks);
  p.rect(16, 2, 3, 2, TileId.barracks);
  hangar(p, 3, 4);
  hangar(p, 3, 16);
  hangar(p, 3, 28);
  hangar(p, 16, 10);
  hangar(p, 16, 22);
  hangar(p, 16, 34);
  pad(p, 7, 14);
  pad(p, 14, 14);
  pad(p, 7, 32);
  pad(p, 14, 32);
  p.rect(16, 26, 2, 2, TileId.radar);
  p.set(2, 14, TileId.bunker);
  p.set(20, 18, TileId.bunker);
  p.set(2, 30, TileId.bunker);
  p.set(20, 8, TileId.bunker);
});

/** Runway continues, with a second battery line and fewer empty pads. */
const runwayBatteries = landChunk('runwayBatteries', TileId.runway, (p) => {
  p.meadow();
  concreteBand(p, 1, 38);
  paveEdge(p, 'both', TileId.concrete);
  stampSpine(p, TileId.runway);
  marks(p);
  hangar(p, 3, 8);
  hangar(p, 16, 18);
  hangar(p, 3, 28);
  pad(p, 7, 4);
  pad(p, 14, 6);
  pad(p, 7, 20);
  pad(p, 14, 30);
  p.rect(17, 4, 2, 2, TileId.radar);
  p.rect(16, 32, 3, 2, TileId.barracks);
  for (const [c, r] of [
    [2, 6],
    [20, 12],
    [2, 22],
    [20, 28],
  ] as const) {
    p.set(c, r, TileId.bunker);
  }
  p.hRoad(16, 3, 8, TileId.street);
  p.hRoad(26, 14, 19, TileId.street);
});

/** The runway is still the edge spine, but the apron is holed by craters. */
const craterApron = landChunk('craterApron', TileId.runway, (p) => {
  scorchGround(p);
  concreteBand(p, 2, 16);
  paveEdge(p, 'bottom', TileId.concrete);
  paveEdge(p, 'top', TileId.scorch);
  stampSpine(p, TileId.runway);
  hangar(p, 3, 6);
  wreck(p, 16, 8);
  wreck(p, 16, 24);
  wreck(p, 4, 28);
  pad(p, 7, 18);
  p.set(7, 19, TileId.crater);
  craters(p, [
    [10, 8],
    [12, 14],
    [9, 22],
    [13, 28],
    [11, 34],
    [6, 12],
    [15, 16],
    [8, 32],
  ]);
  snagFringe(p);
  p.set(2, 20, TileId.bunker);
});

/** Trenches cut the field. The spine on the edges is a dirt road again. */
const trenchLine = landChunk('trenchLine', TileId.road, (p) => {
  scorchGround(p);
  paveEdge(p, 'both', TileId.scorch);
  stampSpine(p, TileId.road);
  trenches(p);
  p.set(ROAD_COL, 14, TileId.runway);
  p.set(ROAD_COL, 24, TileId.runwayMark);
  p.set(ROAD_COL - 1, 16, TileId.runway);
  wreck(p, 4, 6);
  wreck(p, 16, 12);
  wreck(p, 6, 26);
  wreck(p, 15, 32);
  hangar(p, 3, 34);
  p.set(3, 36, TileId.crater);
  craters(p, [
    [9, 6],
    [12, 12],
    [8, 16],
    [14, 22],
    [10, 26],
    [13, 34],
    [5, 18],
    [17, 8],
  ]);
  snagFringe(p);
  for (let r = 4; r <= 34; r += 8) p.set(1, r, TileId.wall);
});

/** Craters, wrecks, a broken wall, and a scorched tree fringe. No intact runway. */
const battlefield = landChunk('battlefield', TileId.road, (p) => {
  scorchGround(p);
  paveEdge(p, 'both', TileId.scorch);
  stampSpine(p, TileId.road);
  trenches(p);
  for (let r = 4; r <= 34; r += 4) {
    for (const c of AIRFIELD_SPINE) {
      if ((c + r) % 2 === 0) p.set(c, r, r % 8 === 0 ? TileId.crater : TileId.scorch);
    }
  }
  craters(p, [
    [4, 6],
    [7, 10],
    [15, 8],
    [18, 14],
    [6, 18],
    [16, 20],
    [9, 24],
    [13, 28],
    [5, 32],
    [17, 34],
  ]);
  wreck(p, 3, 8);
  wreck(p, 16, 10);
  wreck(p, 5, 22);
  wreck(p, 15, 26);
  wreck(p, 8, 34);
  p.rect(16, 32, 4, 1, TileId.hangarRoof);
  p.set(17, 33, TileId.wreck);
  snagFringe(p);
  for (let r = 5; r <= 33; r += 7) {
    p.set(1, r, TileId.wall);
    if (r % 2 === 1) p.set(p.cols - 2, r + 1, TileId.wall);
  }
  p.set(2, 16, TileId.bunker);
});

export const LAND_B_LIBRARY: readonly ChunkDef[] = [
  fenceLine,
  guardPosts,
  taxiIn,
  runwayHangars,
  towerApron,
  runwayBatteries,
  craterApron,
  trenchLine,
  battlefield,
];

export const LAND_B_SPEC: ChunkMapSpec = {
  library: LAND_B_LIBRARY,
  seed: LAND_B_SEED,
  maxRepeats: 2,
  slots: [
    { fixed: 'fenceLine' },
    { fixed: 'guardPosts', flip: true },
    { fixed: 'taxiIn' },
    { fixed: 'runwayHangars' },
    { fixed: 'towerApron' },
    { fixed: 'runwayBatteries' },
    { fixed: 'craterApron' },
    { fixed: 'trenchLine', flip: true },
    { fixed: 'battlefield' },
  ],
};
