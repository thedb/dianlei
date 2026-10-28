import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  MAP_CHUNK_ROWS,
  MAP_TILES_X,
  SEA_B_CHUNKS,
  SEA_B_SEED,
  TILE_SIZE,
} from '@/game/config';
import { getTilePixels, TILE_COUNT, TileId } from '@/game/art/tiles';
import { rasterStrip } from '@/game/art/mapRaster';
import { PALETTE } from '@/game/palette';
import { validateBuildingFootprint } from '@/game/entities/building';
import { composeChunks, planChunks } from './chunks';
import { getMapGrid, getTileMap } from './registry';
import {
  isSaucerRim,
  CATAPULT_LANE,
  CATAPULT_MARK_COLS,
  OUR_DECK_LAST_ROW,
  SEA_B_LIBRARY,
  SEA_B_SPEC,
  SEA_CHUNK_EDGES,
  SEA_CHUNK_IDS,
  SEA_FLOAT_ANCHORS,
  SEA_GUN_PADS,
  SEA_HULLS,
  SEA_ISLANDS,
  SEA_PLANE_GROUPS,
  SEA_SALVAGE,
  SEA_SALVAGE_CARGO,
  SEA_SENTRY,
  SEA_WAKE,
  SAUCER_RIM_CENTER,
  SAUCER_RIM_RADIUS,
  STERN_TAPER,
  seaBTopRow,
  sternDeckSpan,
  type SeaChunkId,
} from './seaB';
import { tileTerrain } from './terrain';

type Grid = readonly (readonly TileId[])[];

const ALLOWED: ReadonlySet<TileId> = new Set([
  TileId.water,
  TileId.waterB,
  TileId.carrierDeck,
  TileId.carrierMark,
  TileId.carrierIsland,
  TileId.wake,
  TileId.cruiserHull,
  TileId.cruiserGunDeck,
  TileId.wreckAlloy,
  TileId.wreckBurn,
  TileId.carrierPlaneTL,
  TileId.carrierPlaneTR,
  TileId.carrierPlaneBL,
  TileId.carrierPlaneBR,
]);

const PLANES = new Set<TileId>([
  TileId.carrierPlaneTL,
  TileId.carrierPlaneTR,
  TileId.carrierPlaneBL,
  TileId.carrierPlaneBR,
]);

const WRECK = new Set<TileId>([TileId.wreckAlloy, TileId.wreckBurn]);

function luminance(index: number): number {
  const hex = PALETTE[index]!;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function meanLum(grid: Grid, r0: number, rows: number): number {
  const strip = rasterStrip(grid, r0, rows);
  let lum = 0;
  for (const v of strip.data) lum += luminance(v);
  return lum / strip.data.length;
}

function cell(grid: Grid, col: number, row: number): TileId {
  return grid[row]![col]!;
}

function inRect(
  col: number,
  row: number,
  rect: { r0: number; r1: number; c0: number; c1: number }
): boolean {
  return row >= rect.r0 && row <= rect.r1 && col >= rect.c0 && col <= rect.c1;
}

function indicesOf(id: TileId): Set<number> {
  const found = new Set<number>();
  for (const row of getTilePixels()[id] ?? []) {
    for (const v of row) if (v >= 0) found.add(v);
  }
  return found;
}

describe('海面B', () => {
  const grid = getMapGrid('seaB');

  it('is nine fixed chunks, seed 37, no mirror, with cloud shadows', () => {
    expect(SEA_CHUNK_IDS).toHaveLength(SEA_B_CHUNKS);
    expect(SEA_B_LIBRARY.map((chunk) => chunk.id)).toEqual([...SEA_CHUNK_IDS]);
    expect(planChunks(SEA_B_SPEC).map((slot) => slot.chunk)).toEqual([...SEA_CHUNK_IDS]);
    expect(planChunks(SEA_B_SPEC).some((slot) => slot.flip)).toBe(false);
    expect(SEA_B_SPEC.seed).toBe(SEA_B_SEED);
    expect(grid).toHaveLength(SEA_B_CHUNKS * MAP_CHUNK_ROWS);
    expect(getTileMap('seaB').loopFrom).toBeUndefined();
    expect(getTileMap('seaB').cloudShadows).toBe(true);
    expect(getTileMap('seaB').label).toBe('海面B');
    expect(composeChunks(SEA_B_SPEC)).toEqual(grid);
  });

  it('starts new tiles at 87 and stops at deckSpot 101', () => {
    expect(TileId.harborBurn).toBe(86);
    expect(TileId.carrierDeck).toBe(87);
    expect(TileId.deckSpot).toBe(101);
    expect(TILE_COUNT).toBe(102);
    expect(tileTerrain(TileId.cruiserGunDeck)).toBe('water');
    expect(tileTerrain(TileId.cruiserHull)).toBe('feature');
    expect(tileTerrain(TileId.carrierDeck)).toBe('feature');
    expect(tileTerrain(TileId.enemyDeck)).toBe('feature');
    expect(tileTerrain(TileId.wake)).toBe('feature');
  });

  it('uses only sea, our deck, escorts, and wreck tiles', () => {
    grid.forEach((row, r) => {
      row.forEach((id, c) => {
        expect(ALLOWED.has(id), `${id} at ${c},${r}`).toBe(true);
      });
    });
    expect(grid.some((row) => row.includes(TileId.enemyDeck))).toBe(false);
    expect(grid.some((row) => row.includes(TileId.enemyMark))).toBe(false);
    expect(grid.some((row) => row.includes(TileId.deckSpot))).toBe(false);
  });

  it('seals every chunk edge and leaves the last row as open water', () => {
    for (const id of SEA_CHUNK_IDS) {
      const index = SEA_CHUNK_IDS.indexOf(id);
      const [bottom, top] = SEA_CHUNK_EDGES[id];
      expectEdge(grid, index * MAP_CHUNK_ROWS, bottom, id);
      expectEdge(grid, index * MAP_CHUNK_ROWS + MAP_CHUNK_ROWS - 1, top, id);
    }
    const last = grid[grid.length - 1]!;
    expect(last.every((id) => id === TileId.water)).toBe(true);
    expect(seaBTopRow()).toEqual(last);
  });

  it('lets our deck leave the bottom of the screen at 25.6s', () => {
    let lastDeck = -1;
    grid.forEach((row, r) => {
      if (row.includes(TileId.carrierDeck)) lastDeck = r;
    });
    expect(lastDeck).toBe(OUR_DECK_LAST_ROW);
    expect(OUR_DECK_LAST_ROW).toBe(63);
    const seconds = ((OUR_DECK_LAST_ROW + 1) * TILE_SIZE) / BG_SCROLL_SPEED;
    expect(seconds).toBeCloseTo(25.6, 5);
    expect(seconds).toBeGreaterThanOrEqual(25);
    expect(seconds).toBeLessThanOrEqual(28);
    for (let r = 80; r < grid.length; r++) {
      expect(grid[r]!.includes(TileId.carrierDeck), `row ${r}`).toBe(false);
    }
  });

  it('parks bright fighters only on the stern, noses up', () => {
    const expected = new Set<string>();
    for (const group of SEA_PLANE_GROUPS) {
      for (const col of group.cols) {
        expected.add(`${col},${group.row},BL`);
        expected.add(`${col + 1},${group.row},BR`);
        expected.add(`${col},${group.row + 1},TL`);
        expected.add(`${col + 1},${group.row + 1},TR`);
      }
    }
    const quad: Partial<Record<TileId, string>> = {
      [TileId.carrierPlaneBL]: 'BL',
      [TileId.carrierPlaneBR]: 'BR',
      [TileId.carrierPlaneTL]: 'TL',
      [TileId.carrierPlaneTR]: 'TR',
    };
    let seen = 0;
    grid.forEach((row, r) => {
      row.forEach((id, c) => {
        if (!PLANES.has(id)) return;
        seen++;
        expect(expected.has(`${c},${r},${quad[id]}`), `${c},${r}`).toBe(true);
      });
    });
    expect(seen).toBe(24);
    expect(SEA_PLANE_GROUPS.map((group) => group.row)).toEqual([46, 50]);
    grid.forEach((row, r) => {
      row.forEach((id, c) => {
        if (!PLANES.has(id)) return;
        const offLane = c < CATAPULT_LANE.c0 || c > CATAPULT_LANE.c1;
        expect(offLane, `${c},${r} is on the catapult`).toBe(true);
      });
    });
  });

  it('keeps the catapult lane clear and lined from the opening deck through the stern', () => {
    for (let r = 1; r <= MAP_CHUNK_ROWS - 2; r++) {
      for (const col of CATAPULT_MARK_COLS) {
        expect(cell(grid, col, r), `${col},${r}`).toBe(TileId.carrierMark);
      }
      for (let c = CATAPULT_LANE.c0; c <= CATAPULT_LANE.c1; c++) {
        const id = cell(grid, c, r);
        expect(id === TileId.carrierMark || id === TileId.carrierDeck, `${c},${r}`).toBe(true);
      }
    }
    for (let r = MAP_CHUNK_ROWS + 1; r <= OUR_DECK_LAST_ROW; r++) {
      const span = sternDeckSpan(r);
      expect(span, `row ${r}`).not.toBeNull();
      for (const col of CATAPULT_MARK_COLS) {
        if (col < span!.c0 || col > span!.c1) continue;
        expect(cell(grid, col, r), `${col},${r}`).toBe(TileId.carrierMark);
      }
      for (let c = CATAPULT_LANE.c0; c <= CATAPULT_LANE.c1; c++) {
        const id = cell(grid, c, r);
        expect(PLANES.has(id), `${c},${r}`).toBe(false);
        if (c >= span!.c0 && c <= span!.c1) {
          expect(id === TileId.carrierMark || id === TileId.carrierDeck, `${c},${r}`).toBe(true);
        }
      }
    }
  });

  it('tapers the stern the way the obsidian bow narrows into the sea', () => {
    expect(STERN_TAPER.map((step) => [step.c0, step.c1])).toEqual([
      [2, 20],
      [4, 18],
      [6, 16],
      [8, 14],
      [10, 12],
    ]);
    for (let i = 1; i < STERN_TAPER.length; i++) {
      const prev = STERN_TAPER[i - 1]!;
      const step = STERN_TAPER[i]!;
      expect(step.c0 - prev.c0).toBe(2);
      expect(prev.c1 - step.c1).toBe(2);
    }
    const island = SEA_ISLANDS[1]!;
    expect(island.r1).toBeLessThanOrEqual(STERN_TAPER[0]!.r1);
    expect(island.c1).toBeLessThanOrEqual(STERN_TAPER[0]!.c1);
    for (let r = MAP_CHUNK_ROWS + 1; r <= OUR_DECK_LAST_ROW; r++) {
      const span = sternDeckSpan(r)!;
      for (let c = 0; c < MAP_TILES_X; c++) {
        const id = cell(grid, c, r);
        const onDeck = c >= span.c0 && c <= span.c1;
        if (!onDeck) {
          expect([TileId.water, TileId.waterB]).toContain(id);
        }
      }
    }
    expect(cell(grid, 2, 52)).toBe(TileId.carrierDeck);
    expect(cell(grid, 2, 53)).not.toBe(TileId.carrierDeck);
    expect(cell(grid, 11, OUR_DECK_LAST_ROW)).toBe(TileId.carrierDeck);
    expect(cell(grid, 8, OUR_DECK_LAST_ROW)).not.toBe(TileId.carrierDeck);
    expect(cell(grid, 2, OUR_DECK_LAST_ROW)).not.toBe(TileId.carrierDeck);
  });

  it('keeps both islands on the starboard side', () => {
    expect(SEA_ISLANDS).toHaveLength(2);
    grid.forEach((row, r) => {
      row.forEach((id, c) => {
        if (id !== TileId.carrierIsland) return;
        expect(c).toBeGreaterThanOrEqual(16);
        expect(SEA_ISLANDS.some((island) => inRect(c, r, island))).toBe(true);
      });
    });
    for (const island of SEA_ISLANDS) {
      for (let r = island.r0; r <= island.r1; r++) {
        for (let c = island.c0; c <= island.c1; c++) {
          expect(cell(grid, c, r)).toBe(TileId.carrierIsland);
        }
      }
    }
  });

  it('paints wake only inside the stern and the short open-water run', () => {
    grid.forEach((row, r) => {
      row.forEach((id, c) => {
        if (id !== TileId.wake) return;
        expect(
          SEA_WAKE.some((wake) => inRect(c, r, wake)),
          `${c},${r}`
        ).toBe(true);
        expect(r % MAP_CHUNK_ROWS).not.toBe(0);
        expect(r % MAP_CHUNK_ROWS).not.toBe(MAP_CHUNK_ROWS - 1);
      });
    });
  });

  it('holds six water-masked gun pads inside the escort hulls', () => {
    expect(SEA_GUN_PADS).toHaveLength(6);
    let gunCells = 0;
    for (const pad of SEA_GUN_PADS) {
      const hull = SEA_HULLS.find(
        (entry) =>
          pad.row >= entry.r0 &&
          pad.row + 1 <= entry.r1 &&
          pad.col >= entry.c0 &&
          pad.col + 1 <= entry.c1
      );
      expect(hull, pad.id).toBeDefined();
      for (let r = pad.row; r < pad.row + 2; r++) {
        for (let c = pad.col; c < pad.col + 2; c++) {
          gunCells++;
          expect(cell(grid, c, r), pad.id).toBe(TileId.cruiserGunDeck);
          expect(r % MAP_CHUNK_ROWS).not.toBe(0);
          expect(r % MAP_CHUNK_ROWS).not.toBe(MAP_CHUNK_ROWS - 1);
        }
      }
      expect(
        validateBuildingFootprint(grid, {
          id: pad.id,
          type: 'sea_gun',
          map: 'seaB',
          row: pad.row,
          col: pad.col,
        })
      ).toBe(true);
    }
    expect(gunCells).toBe(24);
    for (const hull of SEA_HULLS) {
      for (let r = hull.r0; r <= hull.r1; r++) {
        for (let c = hull.c0; c <= hull.c1; c++) {
          const id = cell(grid, c, r);
          expect([TileId.cruiserHull, TileId.cruiserGunDeck]).toContain(id);
        }
      }
    }
  });

  it('leaves eight water anchors and an unarmed sentry', () => {
    expect(SEA_FLOAT_ANCHORS).toHaveLength(8);
    for (const anchor of SEA_FLOAT_ANCHORS) {
      expect([TileId.water, TileId.waterB]).toContain(cell(grid, anchor.col, anchor.row));
      expect(anchor.row % MAP_CHUNK_ROWS).not.toBe(0);
      expect(anchor.row % MAP_CHUNK_ROWS).not.toBe(MAP_CHUNK_ROWS - 1);
    }
    for (let r = SEA_SENTRY.r0; r <= SEA_SENTRY.r1; r++) {
      for (let c = SEA_SENTRY.c0; c <= SEA_SENTRY.c1; c++) {
        expect(cell(grid, c, r)).toBe(TileId.cruiserHull);
      }
    }
    const chunk2 = grid.slice(2 * MAP_CHUNK_ROWS, 3 * MAP_CHUNK_ROWS);
    expect(chunk2.some((row) => row.includes(TileId.cruiserGunDeck))).toBe(false);
    const swell = grid.slice(6 * MAP_CHUNK_ROWS, 7 * MAP_CHUNK_ROWS);
    expect(swell.some((row) => row.includes(TileId.cruiserHull))).toBe(false);
  });

  it('keeps wreckage off the first seven chunks and under the area caps', () => {
    for (let chunk = 0; chunk <= 6; chunk++) {
      const slice = grid.slice(chunk * MAP_CHUNK_ROWS, (chunk + 1) * MAP_CHUNK_ROWS);
      expect(
        slice.some((row) => row.some((id) => WRECK.has(id))),
        `chunk ${chunk}`
      ).toBe(false);
    }
    expect(wreckShare(grid, 7)).toBeLessThanOrEqual(0.18);
    expect(wreckShare(grid, 8)).toBeLessThanOrEqual(0.28);
    expect(wreckShare(grid, 8)).toBeGreaterThan(wreckShare(grid, 7));
  });

  it('shows a salvage hull and a saucer-rim fragment', () => {
    for (let r = SEA_SALVAGE.r0; r <= SEA_SALVAGE.r1; r++) {
      for (let c = SEA_SALVAGE.c0; c <= SEA_SALVAGE.c1; c++) {
        const edge =
          r === SEA_SALVAGE.r0 ||
          r === SEA_SALVAGE.r1 ||
          c === SEA_SALVAGE.c0 ||
          c === SEA_SALVAGE.c1;
        const id = cell(grid, c, r);
        if (edge) expect(id).toBe(TileId.cruiserHull);
        expect(id).not.toBe(TileId.cruiserGunDeck);
      }
    }
    for (const [c, r] of SEA_SALVAGE_CARGO) expect(cell(grid, c, r)).toBe(TileId.wreckAlloy);
    let rim = 0;
    for (let r = 336; r <= 354; r++) {
      for (let c = 0; c < MAP_TILES_X; c++) {
        if (!isSaucerRim(c, r)) continue;
        rim++;
        expect(cell(grid, c, r)).toBe(TileId.wreckAlloy);
        const dx = c + 0.5 - SAUCER_RIM_CENTER.col;
        const dy = r + 0.5 - SAUCER_RIM_CENTER.row;
        expect(Math.abs(Math.hypot(dx, dy) - SAUCER_RIM_RADIUS)).toBeLessThanOrEqual(1.15);
        expect(SEA_FLOAT_ANCHORS.some((anchor) => anchor.col === c && anchor.row === r)).toBe(
          false
        );
      }
    }
    expect(rim).toBeGreaterThan(12);
  });

  it('stays at least as bright as the existing water tile', () => {
    const water = meanLum([Array.from({ length: MAP_TILES_X }, () => TileId.water)], 0, 1);
    const chunk = (index: number) => meanLum(grid, index * MAP_CHUNK_ROWS, MAP_CHUNK_ROWS);
    expect(chunk(0)).toBeGreaterThanOrEqual(water * 0.9);
    expect(chunk(1)).toBeGreaterThanOrEqual(water * 0.85);
    expect(chunk(2)).toBeGreaterThanOrEqual(water * 0.9);
    expect(chunk(6)).toBeGreaterThanOrEqual(water * 0.9);
    expect(chunk(7)).toBeGreaterThanOrEqual(chunk(6) * 0.75);
    expect(chunk(8)).toBeGreaterThanOrEqual(chunk(6) * 0.75);
    for (let i = 0; i < SEA_B_CHUNKS; i++) {
      expect(chunk(i), `chunk ${i}`).toBeGreaterThanOrEqual(water * 0.7);
    }
  });

  it('keeps palette 0, 1, and player cyan out of the new sea tiles', () => {
    for (let id = TileId.carrierDeck; id <= TileId.deckSpot; id++) {
      const colors = indicesOf(id as TileId);
      expect(colors.has(0), `tile ${id}`).toBe(false);
      expect(colors.has(1), `tile ${id}`).toBe(false);
    }
    const body = [
      TileId.carrierDeck,
      TileId.wreckAlloy,
      TileId.wreckBurn,
      TileId.enemyDeck,
      TileId.carrierPlaneTL,
      TileId.carrierPlaneTR,
      TileId.carrierPlaneBL,
      TileId.carrierPlaneBR,
    ];
    for (const id of body) {
      const colors = indicesOf(id);
      for (const banned of [10, 11, 12, 13])
        expect(colors.has(banned), `${id} uses ${banned}`).toBe(false);
    }
    const planes = new Set<number>();
    for (const id of [
      TileId.carrierPlaneTL,
      TileId.carrierPlaneTR,
      TileId.carrierPlaneBL,
      TileId.carrierPlaneBR,
    ]) {
      for (const color of indicesOf(id)) planes.add(color);
    }
    expect(planes.has(8)).toBe(true);
    expect(planes.has(9)).toBe(true);
    const mark = indicesOf(TileId.enemyMark);
    expect(mark.has(17)).toBe(true);
    for (const hot of [40, 41, 42, 43]) expect(mark.has(hot)).toBe(false);
  });
});

function expectEdge(grid: Grid, row: number, edge: 'deck' | 'sea', id: SeaChunkId): void {
  const line = grid[row]!;
  if (edge === 'sea') {
    expect(
      line.every((cellId) => cellId === TileId.water),
      `${id} row ${row}`
    ).toBe(true);
    return;
  }
  line.forEach((cellId, col) => {
    const deck = col >= 2 && col <= 20;
    expect(cellId, `${id} ${col},${row}`).toBe(deck ? TileId.carrierDeck : TileId.water);
  });
}

function wreckShare(grid: Grid, chunk: number): number {
  const r0 = chunk * MAP_CHUNK_ROWS + 1;
  const r1 = (chunk + 1) * MAP_CHUNK_ROWS - 2;
  let wreck = 0;
  let cells = 0;
  for (let r = r0; r <= r1; r++) {
    for (const id of grid[r]!) {
      cells++;
      if (WRECK.has(id)) wreck++;
    }
  }
  return wreck / cells;
}
