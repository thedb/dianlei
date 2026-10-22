/**
 * 陆地B: a military airfield that breaks into forest. Nine screens (5760 px,
 * 128 s of map preview), bottom to top: perimeter, runway core, a drainage
 * cut at the end of the runway, then woods. Stage 1 does not use this map.
 *
 * Parked aircraft are 2×2 map tiles (see `PLANE`). They are background, with
 * no HP, collision, or drops. The last three chunks are forest: huts and
 * footpaths, then deeper woods, then a ruined clearing. No hangars, barracks,
 * or grid roads in that third.
 *
 * Every chunk keeps a five-column spine on row 0 and row 39 (`AIRFIELD_SPINE`).
 * Water stays off those rows. The drainage channel sits inside `runwayBatteries`.
 */

import { LAND_B_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { PLANE, TileId } from '@/game/art/tiles';
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

const HOUSES = new Set<number>([
  TileId.houseRedTL,
  TileId.houseRedTR,
  TileId.houseRedBL,
  TileId.houseRedBR,
  TileId.houseBrownTL,
  TileId.houseBrownTR,
  TileId.houseBrownBL,
  TileId.houseBrownBR,
]);

function landChunk(
  id: string,
  spineId: TileId | { bottom: TileId; top: TileId },
  body: (p: ChunkPainter) => void
): ChunkDef {
  const bottomId = typeof spineId === 'number' ? spineId : spineId.bottom;
  const topId = typeof spineId === 'number' ? spineId : spineId.top;
  return {
    id,
    bottom: 'none',
    top: 'none',
    variants: 1,
    paint(p) {
      body(p);
      sealEdges(p, 'none', 'none', AIRFIELD_SPINE, bottomId);
      if (topId !== bottomId) {
        for (const c of AIRFIELD_SPINE) p.set(c, LAST, topId);
      }
    },
  };
}

function stampSpine(p: ChunkPainter, id: TileId, r0 = 0, r1 = LAST): void {
  for (let r = r0; r <= r1; r++) for (const c of AIRFIELD_SPINE) p.set(c, r, id);
}

/** Non-spine cells of an edge row, columns 2–20, so chunk joins share a ground. */
function paveEdge(p: ChunkPainter, which: 'top' | 'bottom' | 'both', id: TileId): void {
  const rows = which === 'both' ? [0, LAST] : which === 'top' ? [LAST] : [0];
  for (const r of rows) {
    for (let c = 2; c <= 20; c++) if (!SPINE.has(c)) p.set(c, r, id);
  }
}

function meadowEdges(p: ChunkPainter): void {
  for (const r of [0, LAST]) {
    for (let c = 0; c < p.cols; c++) if (!SPINE.has(c)) p.set(c, r, TileId.meadow);
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

function marksBetween(p: ChunkPainter, r0: number, r1: number): void {
  for (let r = r0; r <= r1; r += 2) p.set(ROAD_COL, r, TileId.runwayMark);
}

/** 2×2 fighter on the apron. `r` is the lower row, nose toward the top of the map. */
function parkedPlane(p: ChunkPainter, c: number, r: number): void {
  const [tl, tr, bl, br] = PLANE;
  p.set(c, r, bl);
  p.set(c + 1, r, br);
  p.set(c, r + 1, tl);
  p.set(c + 1, r + 1, tr);
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

/** Straight drainage: two shoulder ditches into one transverse cut. Interior only. */
function drainage(p: ChunkPainter, ditchFrom: number, channelAt: number): void {
  const lip = channelAt - 1;
  const far = channelAt + 4;
  for (let c = 1; c <= 21; c++) {
    p.set(c, lip, TileId.concrete);
    p.set(c, far, TileId.concrete);
  }
  for (let r = ditchFrom; r <= lip; r++) {
    p.set(7, r, TileId.lake);
    p.set(15, r, TileId.lake);
  }
  for (let r = channelAt; r < channelAt + 4; r++) {
    for (let c = 1; c <= 21; c++) p.set(c, r, TileId.lake);
  }
}

function canPave(id: TileId): boolean {
  return (
    id === TileId.meadow ||
    id === TileId.meadowB ||
    id === TileId.meadowDark ||
    id === TileId.flowers ||
    id === TileId.forest ||
    id === TileId.scorch ||
    id === TileId.dirt ||
    id === TileId.oak ||
    id === TileId.fir ||
    id === TileId.bush
  );
}

/** A one-tile dirt footpath. Skips huts, cabins, and the sealed edge rows. */
function footpath(p: ChunkPainter, points: ReadonlyArray<readonly [number, number]>): void {
  for (let i = 1; i < points.length; i++) {
    const [c0, r0] = points[i - 1]!;
    const [c1, r1] = points[i]!;
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const c = Math.round(c0 + (c1 - c0) * t);
      const r = Math.round(r0 + (r1 - r0) * t);
      if (r <= 0 || r >= LAST) continue;
      const id = p.get(c, r);
      if (id === null || id === TileId.hut || HOUSES.has(id) || id === TileId.lake) continue;
      if (!canPave(id) && id !== TileId.road) continue;
      p.set(c, r, TileId.road);
    }
  }
}

function hut(p: ChunkPainter, c: number, r: number): void {
  if (r <= 0 || r >= LAST) return;
  p.set(c, r, TileId.hut);
}

function woods(p: ChunkPainter, dense: boolean): void {
  p.meadow();
  p.blob(3, 10, 6.5, 10, TileId.forest, 0.35);
  p.blob(19, 9, 6, 9, TileId.forest, 0.4);
  p.blob(4, 30, 6, 8, TileId.forest, 0.35);
  p.blob(19, 31, 6.5, 8, TileId.forest, 0.3);
  if (dense) {
    p.blob(11, 20, 5, 8, TileId.forest, 0.3);
    p.blob(8, 14, 4, 5, TileId.forest, 0.35);
  }
  p.scatter(10, [TileId.oak, TileId.fir, TileId.bush]);
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

/** The fence opens onto concrete. A few fighters already sit on the apron. */
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
  parkedPlane(p, 7, 22);
  parkedPlane(p, 16, 24);
  parkedPlane(p, 7, 34);
  bushes(p);
});

/** Runway, hangar row, pads, and fighters parked beside the hangars. */
const runwayHangars = landChunk('runwayHangars', TileId.runway, (p) => {
  p.meadow();
  concreteBand(p, 1, 38);
  paveEdge(p, 'both', TileId.concrete);
  stampSpine(p, TileId.runway);
  marksBetween(p, 2, 36);
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
  parkedPlane(p, 7, 8);
  parkedPlane(p, 14, 16);
  parkedPlane(p, 7, 26);
  parkedPlane(p, 18, 6);
});

/** Densest screen: tower, fuel and ammo, hangars both sides, AA pits, planes. */
const towerApron = landChunk('towerApron', TileId.runway, (p) => {
  p.meadow();
  concreteBand(p, 1, 38);
  paveEdge(p, 'both', TileId.concrete);
  stampSpine(p, TileId.runway);
  marksBetween(p, 2, 36);
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
  parkedPlane(p, 7, 4);
  parkedPlane(p, 14, 4);
  parkedPlane(p, 7, 12);
  parkedPlane(p, 14, 28);
});

/**
 * Runway ends here. Shoulder ditches feed a transverse channel; above it the
 * ground is already grass. The top edge is a dirt road so the woods can join.
 */
const runwayBatteries = landChunk(
  'runwayBatteries',
  { bottom: TileId.runway, top: TileId.road },
  (p) => {
    p.meadow();
    concreteBand(p, 1, 28);
    paveEdge(p, 'bottom', TileId.concrete);
    paveEdge(p, 'top', TileId.meadow);
    stampSpine(p, TileId.runway, 0, 28);
    marksBetween(p, 2, 26);
    hangar(p, 3, 8);
    hangar(p, 16, 12);
    hangar(p, 3, 20);
    p.rect(17, 4, 2, 2, TileId.radar);
    for (const [c, r] of [
      [2, 6],
      [20, 10],
      [2, 18],
      [20, 24],
    ] as const) {
      p.set(c, r, TileId.bunker);
    }
    parkedPlane(p, 4, 2);
    parkedPlane(p, 18, 6);
    parkedPlane(p, 4, 16);
    parkedPlane(p, 18, 22);
    drainage(p, 2, 30);
    for (let r = 35; r < LAST; r++) p.set(ROAD_COL, r, TileId.road);
    p.set(2, 36, TileId.fir);
    p.set(20, 36, TileId.oak);
    p.set(5, 37, TileId.bush);
  }
);

/** Forest edge of the airfield: scattered huts, two cabins, dirt tracks. */
const hutWoods = landChunk('hutWoods', TileId.road, (p) => {
  woods(p, false);
  footpath(p, [
    [ROAD_COL, 1],
    [7, 8],
    [4, 16],
    [8, 22],
    [16, 24],
    [18, 31],
    [ROAD_COL, 38],
  ]);
  footpath(p, [
    [7, 8],
    [2, 7],
  ]);
  footpath(p, [
    [8, 22],
    [6, 28],
  ]);
  footpath(p, [
    [ROAD_COL, 34],
    [3, 34],
  ]);
  hut(p, 2, 7);
  hut(p, 18, 6);
  hut(p, 16, 20);
  hut(p, 6, 28);
  hut(p, 3, 34);
  p.house(4, 15, 'brown');
  p.house(17, 30, 'brown');
  meadowEdges(p);
});

/** Deeper canopy. Two huts on a track, no military buildings. */
const deepWoods = landChunk('deepWoods', TileId.road, (p) => {
  woods(p, true);
  footpath(p, [
    [ROAD_COL, 1],
    [8, 10],
    [14, 18],
    [6, 28],
    [ROAD_COL, 38],
  ]);
  footpath(p, [
    [14, 18],
    [19, 16],
  ]);
  hut(p, 8, 11);
  hut(p, 19, 16);
  meadowEdges(p);
});

/** The front line in the trees: craters, wrecks, snags. One hut off a track. */
const ruinWoods = landChunk('ruinWoods', TileId.road, (p) => {
  woods(p, false);
  p.blob(11, 18, 5.5, 12, TileId.scorch, 0.28, true);
  const craters: Array<[number, number]> = [
    [2, 8],
    [4, 14],
    [6, 20],
    [8, 26],
    [7, 32],
    [15, 6],
    [17, 12],
    [19, 18],
    [16, 24],
    [18, 30],
    [5, 10],
    [14, 16],
    [6, 28],
    [15, 34],
    [3, 22],
    [20, 26],
  ];
  for (const [c, r] of craters) {
    p.set(c, r, TileId.crater);
    if (!SPINE.has(c + 1)) p.set(c + 1, r, TileId.scorch);
    p.set(c, r + 1, TileId.scorch);
  }
  p.rect(3, 12, 2, 2, TileId.wreck);
  p.rect(16, 18, 2, 2, TileId.wreck);
  p.rect(6, 30, 2, 2, TileId.wreck);
  for (const [c, r] of [
    [1, 6],
    [2, 16],
    [1, 26],
    [2, 34],
    [21, 8],
    [20, 18],
    [21, 28],
    [20, 36],
    [8, 4],
    [14, 36],
  ] as const) {
    p.set(c, r, TileId.snag);
  }
  for (const [c, r, len] of [
    [3, 18, 3],
    [15, 22, 4],
    [5, 33, 4],
  ] as const) {
    for (let i = 0; i < len; i++) p.set(c + i, r, TileId.trench);
  }
  footpath(p, [
    [ROAD_COL, 1],
    [15, 8],
    [12, 20],
    [5, 30],
    [ROAD_COL, 38],
  ]);
  hut(p, 15, 8);
  meadowEdges(p);
});

export const LAND_B_LIBRARY: readonly ChunkDef[] = [
  fenceLine,
  guardPosts,
  taxiIn,
  runwayHangars,
  towerApron,
  runwayBatteries,
  hutWoods,
  deepWoods,
  ruinWoods,
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
    { fixed: 'hutWoods', flip: true },
    { fixed: 'deepWoods' },
    { fixed: 'ruinWoods' },
  ],
};
