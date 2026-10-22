/**
 * 陆地A: farmland, villages, woods and streams. Eleven one-screen chunks
 * (7040 px, 176 s at BG_SCROLL_SPEED), enough for all of stage 1 before the
 * boss plus the warning run-out, so the stage never loops it.
 *
 * Slots 4–6 are fixed: the stream that rises from a pond, runs past a lake,
 * and turns under the road into a second lake. Stage 1's sea guns sit on that
 * water. Every other slot is a seeded pick from the dry chunk kinds.
 */

import { LAND_A_CHUNKS, LAND_A_SEED, MAP_CHUNK_ROWS } from '@/game/config';
import { TileId } from '@/game/art/tiles';
import {
  ROAD_COL,
  type ChunkDef,
  type ChunkMapSpec,
  type ChunkPainter,
  type HouseColor,
} from './chunks';

const TREES: readonly TileId[] = [TileId.oak, TileId.oak, TileId.fir];
const CROPS: readonly TileId[] = [TileId.cropGreen, TileId.cropWheat, TileId.cropPlowed];
const LAST = MAP_CHUNK_ROWS - 1;

function clumps(p: ChunkPainter, count: number, ids: readonly TileId[], margin = 3): void {
  for (let i = 0; i < count; i++) {
    const left = p.chance(0.5);
    const cx = left ? p.int(0, ROAD_COL - margin - 1) : p.int(ROAD_COL + margin + 1, p.cols - 1);
    const cy = p.int(3, LAST - 3);
    p.blob(cx, cy, 1 + p.rng() * 1.6, 1 + p.rng() * 1.8, () => p.pick(ids), 0.35, true);
  }
}

function houseColor(p: ChunkPainter): HouseColor {
  return p.chance(0.6) ? 'red' : 'brown';
}

const meadow: ChunkDef = {
  id: 'meadow',
  bottom: 'none',
  top: 'none',
  variants: 2,
  paint(p, variant) {
    p.meadow();
    p.mainRoad(2);
    clumps(p, 5 + variant * 2, TREES);
    if (variant === 1) {
      const row = p.int(8, 30);
      const left = p.chance(0.5);
      for (let c = left ? 0 : ROAD_COL + 2; c < (left ? ROAD_COL - 1 : p.cols); c++) {
        if (p.isOpen(c, row) && p.chance(0.8)) p.set(c, row, TileId.bush);
      }
    }
    p.scatter(14, [TileId.flowers, TileId.bush, TileId.boulder, TileId.oak]);
  },
};

const farmland: ChunkDef = {
  id: 'farmland',
  bottom: 'none',
  top: 'none',
  variants: 2,
  paint(p, variant) {
    p.meadow();
    for (const side of ['left', 'right'] as const) {
      let r = p.int(1, 3);
      while (r < LAST - 4) {
        const h = Math.min(p.int(4, 8), LAST - 1 - r);
        const w = p.int(5, 8);
        const c0 = side === 'left' ? ROAD_COL - 2 - w : ROAD_COL + 3;
        p.rect(c0, r, w, h, p.pick(CROPS));
        if (p.chance(0.5)) {
          for (let c = c0; c < c0 + w; c++) p.set(c, r + h, TileId.bush);
        }
        r += h + p.int(1, 2);
      }
    }
    const trackRow = p.int(12, 27);
    const toLeft = variant === 0;
    p.hRoad(trackRow, toLeft ? 0 : ROAD_COL, toLeft ? ROAD_COL : p.cols - 1);
    const hc = toLeft ? p.int(1, 4) : p.int(p.cols - 6, p.cols - 3);
    p.rect(hc - 1, trackRow + 1, 4, 3, TileId.meadow);
    p.house(hc, trackRow + 1, 'brown');
    p.set(hc + 2, trackRow + 1, TileId.shed);
    p.mainRoad(1);
    p.scatter(6, [TileId.oak, TileId.bush]);
  },
};

const village: ChunkDef = {
  id: 'village',
  bottom: 'none',
  top: 'none',
  variants: 2,
  paint(p, variant) {
    p.meadow();
    const street = p.int(16, 22);
    const inTown = (r: number) => Math.abs(r - street) <= 9;
    p.mainRoad(0, (r) => (inTown(r) ? TileId.street : TileId.road));
    p.hRoad(street, 0, p.cols - 1, TileId.street);
    const lots = [1, 4, 7, ROAD_COL + 3, ROAD_COL + 6, ROAD_COL + 9];
    for (const c of lots) {
      for (const r of [street + 1, street - 2]) {
        if (p.chance(0.78)) p.house(c, r, houseColor(p));
        else if (p.chance(0.5)) p.rect(c, r, 2, 2, TileId.cropGreen);
        else p.set(c, r, TileId.oak);
      }
    }
    p.rect(ROAD_COL + 1, street + 1, 2, 2, TileId.plaza);
    if (variant === 1) {
      for (const r of [street + 5, street - 6]) {
        if (p.open2x2(ROAD_COL - 3, r)) p.house(ROAD_COL - 3, r, houseColor(p));
        if (p.open2x2(ROAD_COL + 2, r)) p.house(ROAD_COL + 2, r, houseColor(p));
      }
    }
    clumps(p, 4, TREES, 2);
    p.scatter(8, [TileId.flowers, TileId.bush]);
  },
};

const crossroads: ChunkDef = {
  id: 'crossroads',
  bottom: 'none',
  top: 'none',
  variants: 2,
  paint(p, variant) {
    p.meadow();
    const row = p.int(14, 25);
    p.hRoad(row, 0, p.cols - 1);
    for (let c = 1; c < p.cols - 1; c += 3) {
      if (Math.abs(c - ROAD_COL) < 2) continue;
      if (p.chance(0.75)) p.set(c, row + 1, TileId.oak);
      if (p.chance(0.75)) p.set(c, row - 1, TileId.oak);
    }
    p.set(ROAD_COL + 2, row + 2, TileId.shed);
    if (variant === 1) {
      const lane = row + p.int(8, 11);
      if (lane < LAST - 2) p.hRoad(lane, ROAD_COL, p.chance(0.5) ? 0 : p.cols - 1);
    }
    p.mainRoad(1);
    clumps(p, 4, TREES);
    p.scatter(12, [TileId.flowers, TileId.bush, TileId.boulder]);
  },
};

const forest: ChunkDef = {
  id: 'forest',
  bottom: 'none',
  top: 'none',
  variants: 2,
  paint(p, variant) {
    p.meadow();
    const leftW = variant === 0 ? 8 : 9;
    const rightW = variant === 0 ? 8 : 5;
    p.blob(leftW / 2 - 1, LAST / 2, leftW / 2 + 2, LAST / 2 + 4, TileId.forest, 0.18);
    p.blob(p.cols - rightW / 2, LAST / 2, rightW / 2 + 2, LAST / 2 + 4, TileId.forest, 0.18);
    for (let i = 0; i < 3; i++) {
      const left = p.chance(0.5);
      p.blob(
        left ? p.int(1, 5) : p.int(p.cols - 6, p.cols - 2),
        p.int(6, LAST - 6),
        1.8,
        2.4,
        TileId.meadow,
        0.3
      );
    }
    for (let r = 0; r < p.rows; r++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (p.get(ROAD_COL + dc, r) === TileId.forest) p.set(ROAD_COL + dc, r, TileId.meadow);
      }
    }
    p.mainRoad(1);
    p.scatter(10, [TileId.fir, TileId.oak, TileId.bush]);
  },
};

const hills: ChunkDef = {
  id: 'hills',
  bottom: 'none',
  top: 'none',
  variants: 2,
  paint(p, variant) {
    p.meadow();
    for (let i = 0; i < 6; i++) {
      const left = i % 2 === 0;
      const cx = left ? p.int(0, 3) : p.int(p.cols - 4, p.cols - 1);
      p.blob(cx, p.int(3, LAST - 3), 1.4 + p.rng(), 1.6 + p.rng() * 1.4, TileId.boulder, 0.4, true);
    }
    p.blob(p.int(4, 7), p.int(8, 30), 2.2, 3, TileId.meadowDark, 0.4, true);
    p.blob(p.int(15, 18), p.int(8, 30), 2.2, 3, TileId.meadowDark, 0.4, true);
    if (variant === 1) p.blob(p.int(14, 18), p.int(10, 28), 2, 2.2, TileId.dirt, 0.3, true);
    p.mainRoad(2);
    clumps(p, 4, [TileId.fir, TileId.fir, TileId.oak]);
    p.scatter(10, [TileId.boulder, TileId.bush, TileId.fir]);
  },
};

/** Pond low on the left, stream rising from it off the top edge. */
const streamStart: ChunkDef = {
  id: 'streamStart',
  bottom: 'none',
  top: 'left',
  variants: 1,
  paint(p) {
    p.meadow();
    p.blob(5, 24, 4.2, 5.6, TileId.lake, 0.12);
    p.stream(26, LAST, () => 3);
    p.reedBanks(0.35);
    p.mainRoad(1);
    for (let r = 4; r < LAST - 3; r += p.int(6, 9)) {
      const h = p.int(3, 5);
      p.rect(ROAD_COL + 3, r, p.int(5, 7), h, p.pick(CROPS));
    }
    clumps(p, 3, TREES);
    p.scatter(8, [TileId.flowers, TileId.oak]);
  },
};

/** Stream down the left side, a lake on the right. */
const streamLake: ChunkDef = {
  id: 'streamLake',
  bottom: 'left',
  top: 'left',
  variants: 1,
  paint(p) {
    p.meadow();
    p.stream(0, LAST, (r) => (r > 18 && r < 30 ? 4 : 3));
    p.blob(18.5, 17, 3.8, 5.4, TileId.lake, 0.12);
    p.reedBanks(0.4);
    p.mainRoad(1);
    clumps(p, 5, TREES, 4);
    p.scatter(8, [TileId.flowers, TileId.bush]);
  },
};

/** Stream from the bottom left turns under the road (bridge) into a lake on the right. */
const streamEnd: ChunkDef = {
  id: 'streamEnd',
  bottom: 'left',
  top: 'none',
  variants: 1,
  paint(p) {
    p.meadow();
    p.stream(0, 15, () => 3);
    for (let r = 13; r <= 15; r++) p.hRoad(r, 2, 16, TileId.lake);
    p.blob(18, 15, 3.6, 4.6, TileId.lake, 0.12);
    p.reedBanks(0.3);
    p.mainRoad(0, (r) => (r >= 13 && r <= 15 ? TileId.bridge : TileId.road));
    p.rect(1, 22, 6, 5, TileId.cropWheat);
    p.rect(1, 28, 6, 4, TileId.cropGreen);
    clumps(p, 5, TREES);
    p.scatter(8, [TileId.flowers, TileId.oak, TileId.bush]);
  },
};

export const LAND_A_LIBRARY: readonly ChunkDef[] = [
  meadow,
  farmland,
  village,
  crossroads,
  forest,
  hills,
  streamStart,
  streamLake,
  streamEnd,
];

const DRY = ['meadow', 'farmland', 'village', 'crossroads', 'forest', 'hills'] as const;

export const LAND_A_SPEC: ChunkMapSpec = {
  library: LAND_A_LIBRARY,
  seed: LAND_A_SEED,
  maxRepeats: 2,
  slots: Array.from({ length: LAND_A_CHUNKS }, (_, i) => {
    if (i === 0) return { fixed: 'meadow', variant: 0 };
    if (i === 4) return { fixed: 'streamStart' };
    if (i === 5) return { fixed: 'streamLake' };
    if (i === 6) return { fixed: 'streamEnd' };
    return { pick: DRY };
  }),
};
