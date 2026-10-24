import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  LAND_A_CHUNKS,
  LAND_B_CHUNKS,
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  MAP_TILES_X,
  RIVER_A_CHUNKS,
  STAGE2_WARNING_AT,
  TIEBAO_ENTER_AT,
  TIEBAO_RAIL_X,
  TILE_SIZE,
} from '@/game/config';
import { backgroundFade, scrollDistance } from '@/game/systems/background';
import { TILE_COUNT, TileId } from '@/game/art/tiles';
import { getStage } from '@/game/levels/registry';
import { AIRFIELD_SPINE, LAND_B_LIBRARY, LAND_B_SPEC } from './landB';
import {
  FACTORY_BOSS_LIBRARY,
  FACTORY_BOSS_SPEC,
  FACTORY_RAILS,
  factoryRailScreenX,
} from './factoryBoss';
import { APPROACH_HANDOFF_ROWS, LAND_BOSS_LIBRARY, LAND_BOSS_SPEC } from './landBoss';
import { LAND_A_LIBRARY, LAND_A_SPEC } from './landA';
import { RIVER_A_LIBRARY, RIVER_A_SPEC, RIVER_EDGE_COLS } from './riverA';
import {
  ROAD_COL,
  STREAM_COLS,
  backdropSegments,
  segmentScreenSpan,
  buildMapTrack,
  buildPreviewTrack,
  buildStageRunTrack,
  buildStageTrack,
  chunkEdges,
  composeChunks,
  footprintOn,
  getMap,
  getMapGrid,
  getTileMap,
  isStreamTile,
  listMapPreviews,
  listMaps,
  mirrorSide,
  paintChunk,
  planChunks,
  rowConnectors,
  terrainAt,
  tileTerrain,
  trackFinished,
  TILE_TERRAIN,
  type ChunkDef,
  type ChunkMapSpec,
  type StreamSide,
  type TileGrid,
} from './index';

describe('map registry', () => {
  it('lists the map assets in order', () => {
    expect(listMaps().map((m) => [m.id, m.label, m.kind])).toEqual([
      ['landA', '陆地A', 'tiles'],
      ['landB', '陆地B', 'tiles'],
      ['riverA', '河流A', 'tiles'],
      ['landBoss', '百战要塞', 'tiles'],
      ['factoryBoss', '铁堡厂轨', 'tiles'],
      ['spaceA', '宇宙A', 'starfield'],
    ]);
  });

  it('builds each tile map once, at its declared size', () => {
    for (const map of listMaps()) {
      if (map.kind !== 'tiles') continue;
      const grid = getMapGrid(map.id);
      expect(grid).toHaveLength(map.rows);
      for (const row of grid) expect(row).toHaveLength(MAP_TILES_X);
      expect(getMapGrid(map.id)).toBe(grid);
    }
  });

  it('rejects unknown ids and tile lookups on a starfield', () => {
    expect(() => getMap('nope')).toThrow();
    expect(() => getTileMap('spaceA')).toThrow();
    expect(() => getMapGrid('spaceA')).toThrow();
  });

  it('keeps stage 1 on 陆地A and the boss on 百战要塞', () => {
    expect(getStage('1').maps).toEqual({ run: [{ map: 'landA', at: 0 }], boss: 'landBoss' });
    expect(getTileMap('landBoss').loopFrom).toBe(MAP_CHUNK_ROWS);
  });

  it('gives 陆地B and 河流A cloud shadows and a preview a bit shorter than 陆地A', () => {
    for (const id of ['landB', 'riverA'] as const) {
      const map = getTileMap(id);
      expect(map.cloudShadows).toBe(true);
      expect(map.rows).toBe(9 * MAP_CHUNK_ROWS);
      const seconds = (map.rows * TILE_SIZE - LOGICAL_H) / BG_SCROLL_SPEED;
      const landA = (getTileMap('landA').rows * TILE_SIZE - LOGICAL_H) / BG_SCROLL_SPEED;
      expect(seconds).toBeGreaterThan(100);
      expect(seconds).toBeLessThan(landA);
    }
    expect(getTileMap('landA').cloudShadows).toBe(true);
  });

  it('makes 陆地A long enough for the stage-1 run plus a full screen', () => {
    const land = getTileMap('landA');
    expect(land.rows).toBe(LAND_A_CHUNKS * MAP_CHUNK_ROWS);
    expect(LAND_A_SPEC.slots).toHaveLength(LAND_A_CHUNKS);
    const stage = getStage('1');
    expect(land.rows * TILE_SIZE - LOGICAL_H).toBeGreaterThan(stage.warningAt * BG_SCROLL_SPEED);
  });
});

describe('chunk plan', () => {
  it('is deterministic for a seed and changes with the seed', () => {
    const a = planChunks(LAND_A_SPEC);
    expect(planChunks(LAND_A_SPEC)).toEqual(a);
    expect(composeChunks(LAND_A_SPEC)).toEqual(getMapGrid('landA'));
    const other = planChunks({ ...LAND_A_SPEC, seed: LAND_A_SPEC.seed + 1 });
    expect(other).not.toEqual(a);
  });

  it('honors fixed slots, never repeats a kind back to back, and caps repeats', () => {
    const plan = planChunks(LAND_A_SPEC);
    LAND_A_SPEC.slots.forEach((slot, i) => {
      if ('fixed' in slot) expect(plan[i]!.chunk).toBe(slot.fixed);
    });
    const counts = new Map<string, number>();
    plan.forEach((inst, i) => {
      if (i > 0) expect(inst.chunk).not.toBe(plan[i - 1]!.chunk);
      counts.set(inst.chunk, (counts.get(inst.chunk) ?? 0) + 1);
    });
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(LAND_A_SPEC.maxRepeats);
  });

  it('uses mirrored chunks and every library kind declares its edges', () => {
    const plan = planChunks(LAND_A_SPEC);
    expect(plan.some((p) => p.flip)).toBe(true);
    expect(LAND_A_LIBRARY.length).toBeGreaterThanOrEqual(8);
    for (const def of LAND_A_LIBRARY) expect(def.variants).toBeGreaterThanOrEqual(1);
  });

  it('throws when a fixed chunk cannot join the one below', () => {
    const spec: ChunkMapSpec = {
      ...LAND_A_SPEC,
      slots: [{ fixed: 'meadow' }, { fixed: 'streamLake' }],
    };
    expect(() => planChunks(spec)).toThrow();
  });
});

describe('chunk edges', () => {
  const grid = getMapGrid('landA');
  const plan = planChunks(LAND_A_SPEC);

  it('runs the main road through ROAD_COL on every chunk edge', () => {
    for (let k = 0; k < plan.length; k++) {
      expect(rowConnectors(grid[k * MAP_CHUNK_ROWS]!).road, `chunk ${k} bottom`).toEqual([
        ROAD_COL,
      ]);
      expect(rowConnectors(grid[(k + 1) * MAP_CHUNK_ROWS - 1]!).road, `chunk ${k} top`).toEqual([
        ROAD_COL,
      ]);
    }
  });

  it('joins road and water columns across every chunk boundary', () => {
    for (let k = 1; k < plan.length; k++) {
      const below = rowConnectors(grid[k * MAP_CHUNK_ROWS - 1]!);
      const above = rowConnectors(grid[k * MAP_CHUNK_ROWS]!);
      expect(above, `boundary ${k}`).toEqual(below);
    }
  });

  it('puts stream water exactly on the declared edge columns', () => {
    plan.forEach((inst, k) => {
      const def = LAND_A_LIBRARY.find((d) => d.id === inst.chunk)!;
      const edges = chunkEdges(def, inst.flip);
      const expectWater = (side: typeof edges.top) =>
        side === 'none' ? [] : [...STREAM_COLS[side]];
      expect(rowConnectors(grid[k * MAP_CHUNK_ROWS]!).water).toEqual(expectWater(edges.bottom));
      expect(rowConnectors(grid[(k + 1) * MAP_CHUNK_ROWS - 1]!).water).toEqual(
        expectWater(edges.top)
      );
    });
  });

  it('keeps every library chunk and variant inside the contract, flipped or not', () => {
    for (const def of LAND_A_LIBRARY) {
      for (let variant = 0; variant < def.variants; variant++) {
        for (const flip of [false, true]) {
          for (const seed of [1, 99, 12345]) {
            const g = paintChunk(LAND_A_LIBRARY, { chunk: def.id, variant, flip, seed });
            const edges = chunkEdges(def, flip);
            const id = `${def.id}/v${variant}${flip ? '/F' : ''}/${seed}`;
            expect(g, id).toHaveLength(MAP_CHUNK_ROWS);
            expect(rowConnectors(g[0]!).road, id).toEqual([ROAD_COL]);
            expect(rowConnectors(g[MAP_CHUNK_ROWS - 1]!).road, id).toEqual([ROAD_COL]);
            const water = (side: typeof edges.top) =>
              side === 'none' ? [] : [...STREAM_COLS[side]];
            expect(rowConnectors(g[0]!).water, id).toEqual(water(edges.bottom));
            expect(rowConnectors(g[MAP_CHUNK_ROWS - 1]!).water, id).toEqual(water(edges.top));
          }
        }
      }
    }
  });
});

describe('terrain mask', () => {
  it('classifies every tile id', () => {
    expect(TILE_TERRAIN).toHaveLength(TILE_COUNT);
    expect(tileTerrain(TileId.meadow)).toBe('land');
    expect(tileTerrain(TileId.cropWheat)).toBe('land');
    expect(tileTerrain(TileId.lake)).toBe('water');
    expect(tileTerrain(TileId.water)).toBe('water');
    expect(tileTerrain(TileId.road)).toBe('feature');
    expect(tileTerrain(TileId.bridge)).toBe('feature');
    expect(tileTerrain(TileId.houseRedTL)).toBe('feature');
    expect(tileTerrain(TileId.runway)).toBe('feature');
    expect(tileTerrain(TileId.scorch)).toBe('land');
    expect(tileTerrain(TileId.crater)).toBe('land');
    expect(tileTerrain(TileId.snag)).toBe('land');
    expect(tileTerrain(TileId.trench)).toBe('feature');
    expect(tileTerrain(TileId.wreck)).toBe('feature');
    expect(tileTerrain(TileId.dock)).toBe('feature');
    expect(tileTerrain(TileId.bunker)).toBe('feature');
    expect(tileTerrain(TileId.planeTL)).toBe('feature');
    expect(tileTerrain(TileId.wheel)).toBe('feature');
    expect(tileTerrain(TileId.hut)).toBe('feature');
  });

  it('looks up cells and footprints, null off the grid', () => {
    const grid = [
      [TileId.meadow, TileId.lake, TileId.road],
      [TileId.meadow, TileId.lake, TileId.road],
    ];
    expect(terrainAt(grid, 0, 0)).toBe('land');
    expect(terrainAt(grid, 1, 1)).toBe('water');
    expect(terrainAt(grid, 2, 0)).toBe('feature');
    expect(terrainAt(grid, -1, 0)).toBeNull();
    expect(terrainAt(grid, 3, 0)).toBeNull();
    expect(terrainAt(grid, 0, 2)).toBeNull();
    expect(footprintOn(grid, 'land', 0, 0, 2, 1)).toBe(true);
    expect(footprintOn(grid, 'water', 0, 1, 2, 1)).toBe(true);
    expect(footprintOn(grid, 'land', 0, 0, 2, 2)).toBe(false);
    expect(footprintOn(grid, 'land', 1, 0, 2, 1)).toBe(false);
  });

  it('gives 陆地A open land, a road, and a river with lakes', () => {
    const grid = getMapGrid('landA');
    const counts = { land: 0, water: 0, feature: 0 };
    grid.forEach((row, r) => row.forEach((_, c) => counts[terrainAt(grid, c, r)!]++));
    expect(counts.land).toBeGreaterThan(counts.feature);
    expect(counts.water).toBeGreaterThan(200);
  });
});

function countHouseTiles(grid: TileGrid, r0 = 0, r1 = grid.length): number {
  const ids = [
    TileId.houseRedTL,
    TileId.houseRedTR,
    TileId.houseRedBL,
    TileId.houseRedBR,
    TileId.houseBrownTL,
    TileId.houseBrownTR,
    TileId.houseBrownBL,
    TileId.houseBrownBR,
  ];
  return ids.reduce((n, id) => n + countTile(grid, id, r0, r1), 0);
}

interface PlaneAt {
  c: number;
  r: number;
}

/** Complete 2×2 parked fighters whose lower row is inside `[r0, r1)`. */
function planeAnchors(grid: TileGrid, r0: number, r1: number): PlaneAt[] {
  const found: PlaneAt[] = [];
  for (let r = r0; r < r1 - 1; r++) {
    for (let c = 0; c < MAP_TILES_X - 1; c++) {
      if (grid[r]![c] !== TileId.planeBL) continue;
      if (grid[r]![c + 1] !== TileId.planeBR) continue;
      if (grid[r + 1]![c] !== TileId.planeTL) continue;
      if (grid[r + 1]![c + 1] !== TileId.planeTR) continue;
      found.push({ c, r });
    }
  }
  return found;
}

function countPlanes(grid: TileGrid, r0: number, r1: number): number {
  return planeAnchors(grid, r0, r1).length;
}

/** Fighters on the same row whose columns touch (each sprite is two tiles wide). */
function groupPlanes(planes: readonly PlaneAt[]): PlaneAt[][] {
  const parent = planes.map((_, i) => i);
  const find = (i: number): number => {
    const p = parent[i]!;
    if (p === i) return i;
    const root = find(p);
    parent[i] = root;
    return root;
  };
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i]!;
      const b = planes[j]!;
      if (a.r === b.r && Math.abs(a.c - b.c) === 2) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, PlaneAt[]>();
  planes.forEach((plane, i) => {
    const id = find(i);
    const list = groups.get(id);
    if (list) list.push(plane);
    else groups.set(id, [plane]);
  });
  return [...groups.values()];
}

function countTile(grid: TileGrid, id: TileId, r0 = 0, r1 = grid.length): number {
  let n = 0;
  for (let r = r0; r < r1; r++) {
    for (const cell of grid[r]!) if (cell === id) n++;
  }
  return n;
}

function meadowish(id: TileId): boolean {
  return (
    id === TileId.meadow ||
    id === TileId.meadowB ||
    id === TileId.meadowDark ||
    id === TileId.flowers
  );
}

function ratio(grid: TileGrid, r0: number, r1: number, pred: (id: TileId) => boolean): number {
  let hit = 0;
  let total = 0;
  for (let r = r0; r < r1; r++) {
    for (const cell of grid[r]!) {
      total++;
      if (pred(cell)) hit++;
    }
  }
  return hit / total;
}

function wet(id: TileId): boolean {
  return tileTerrain(id) === 'water' || id === TileId.bridge;
}

/** Every wet cell is reachable from the bottom edge, including the top edge. */
function assertOneWaterway(grid: TileGrid): void {
  const cells: Array<[number, number]> = [];
  grid.forEach((row, r) =>
    row.forEach((id, c) => {
      if (wet(id)) cells.push([c, r]);
    })
  );
  expect(cells.length).toBeGreaterThan(0);
  const key = (c: number, r: number) => r * MAP_TILES_X + c;
  const wetSet = new Set(cells.map(([c, r]) => key(c, r)));
  const stack = cells.filter(([, r]) => r === 0);
  expect(stack.length).toBeGreaterThan(0);
  const seen = new Set<number>();
  while (stack.length) {
    const [c, r] = stack.pop()!;
    const k = key(c, r);
    if (seen.has(k) || !wetSet.has(k)) continue;
    seen.add(k);
    stack.push([c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]);
  }
  expect(seen.size).toBe(cells.length);
  expect(grid[grid.length - 1]!.some((id) => wet(id))).toBe(true);
}

function expectSpine(
  library: readonly ChunkDef[],
  spec: ChunkMapSpec,
  roadFor: (edges: { bottom: StreamSide; top: StreamSide }, which: 'bottom' | 'top') => number[],
  waterFor: (edges: { bottom: StreamSide; top: StreamSide }, which: 'bottom' | 'top') => number[]
): void {
  const grid = composeChunks(spec);
  const plan = planChunks(spec);
  for (let k = 0; k < plan.length; k++) {
    const inst = plan[k]!;
    const def = library.find((d) => d.id === inst.chunk)!;
    const edges = chunkEdges(def, inst.flip);
    const bottom = rowConnectors(grid[k * MAP_CHUNK_ROWS]!);
    const top = rowConnectors(grid[(k + 1) * MAP_CHUNK_ROWS - 1]!);
    expect(bottom.road, `${inst.chunk} bottom road`).toEqual(roadFor(edges, 'bottom'));
    expect(top.road, `${inst.chunk} top road`).toEqual(roadFor(edges, 'top'));
    expect(bottom.water, `${inst.chunk} bottom water`).toEqual(waterFor(edges, 'bottom'));
    expect(top.water, `${inst.chunk} top water`).toEqual(waterFor(edges, 'top'));
  }
  for (let k = 1; k < plan.length; k++) {
    expect(rowConnectors(grid[k * MAP_CHUNK_ROWS]!), `join ${k}`).toEqual(
      rowConnectors(grid[k * MAP_CHUNK_ROWS - 1]!)
    );
  }
  for (const def of library) {
    for (let variant = 0; variant < def.variants; variant++) {
      for (const flip of [false, true]) {
        for (const seed of [1, 99, 12345]) {
          const g = paintChunk(library, { chunk: def.id, variant, flip, seed });
          const edges = chunkEdges(def, flip);
          const id = `${def.id}/v${variant}${flip ? '/F' : ''}/${seed}`;
          expect(g, id).toHaveLength(MAP_CHUNK_ROWS);
          expect(rowConnectors(g[0]!).road, id).toEqual(roadFor(edges, 'bottom'));
          expect(rowConnectors(g[MAP_CHUNK_ROWS - 1]!).road, id).toEqual(roadFor(edges, 'top'));
          expect(rowConnectors(g[0]!).water, id).toEqual(waterFor(edges, 'bottom'));
          expect(rowConnectors(g[MAP_CHUNK_ROWS - 1]!).water, id).toEqual(waterFor(edges, 'top'));
        }
      }
    }
  }
}

describe('陆地B airfield', () => {
  const grid = getMapGrid('landB');

  it('tells outskirts, then the runway, then forest', () => {
    expect(LAND_B_SPEC.slots).toHaveLength(LAND_B_CHUNKS);
    expect(planChunks(LAND_B_SPEC).map((p) => `${p.chunk}${p.flip ? ':flip' : ''}`)).toEqual([
      'fenceLine',
      'guardPosts:flip',
      'taxiIn',
      'runwayHangars',
      'towerApron',
      'runwayBatteries',
      'hutWoods:flip',
      'deepWoods',
      'ruinWoods',
    ]);
    expect(composeChunks(LAND_B_SPEC)).toEqual(grid);
    expect(planChunks(LAND_B_SPEC).some((p) => p.flip)).toBe(true);
  });

  it('keeps the five-column spine and no water on every edge', () => {
    expect(mirrorSide('center')).toBe('center');
    expectSpine(
      LAND_B_LIBRARY,
      LAND_B_SPEC,
      () => [...AIRFIELD_SPINE],
      () => []
    );
    expect(countTile(grid, TileId.lake, 0, 200)).toBe(0);
    expect(countTile(grid, TileId.lake, 240, 360)).toBe(0);
    let widest = 0;
    for (let r = 200; r < 240; r++) {
      let n = 0;
      for (const id of grid[r]!) if (id === TileId.lake) n++;
      if (r % MAP_CHUNK_ROWS === 0 || r % MAP_CHUNK_ROWS === MAP_CHUNK_ROWS - 1) {
        expect(n, `edge row ${r}`).toBe(0);
      }
      widest = Math.max(widest, n);
    }
    expect(widest).toBeGreaterThanOrEqual(18);
    expect(countTile(grid, TileId.lake, 200, 240)).toBeGreaterThan(70);
  });

  it('is meadow outside, concrete in the core, and scorched at the end', () => {
    const outskirts = ratio(grid, 0, 120, meadowish);
    const core = ratio(grid, 120, 240, meadowish);
    expect(core).toBeLessThan(outskirts);
    expect(core).toBeLessThan(0.55);
    expect(countTile(grid, TileId.scorch, 0, 120)).toBe(0);
    expect(countTile(grid, TileId.crater, 0, 120)).toBe(0);
    expect(countTile(grid, TileId.scorch, 240, 360)).toBeGreaterThan(
      countTile(grid, TileId.scorch, 120, 240)
    );
  });

  it('parks complete fighters on the apron and keeps them off the forest', () => {
    expect(countPlanes(grid, 80, 240)).toBeGreaterThanOrEqual(12);
    expect(countPlanes(grid, 240, 360)).toBe(0);
    expect(tileTerrain(TileId.planeBL)).toBe('feature');
  });

  it('parks fighters in side-by-side rows with a gap before the next row', () => {
    const planes = planeAnchors(grid, 0, grid.length);
    expect(planes).toHaveLength(24);
    const tiles = [TileId.planeTL, TileId.planeTR, TileId.planeBL, TileId.planeBR].reduce(
      (n, id) => n + countTile(grid, id),
      0
    );
    expect(tiles).toBe(planes.length * 4);
    const spine = new Set<number>(AIRFIELD_SPINE);
    for (const plane of planes) {
      expect(spine.has(plane.c) || spine.has(plane.c + 1)).toBe(false);
    }
    const groups = groupPlanes(planes);
    expect(groups).toHaveLength(8);
    for (const group of groups) {
      expect(group).toHaveLength(3);
      const row = group[0]!.r;
      const cols = group.map((plane) => plane.c).sort((a, b) => a - b);
      for (const plane of group) expect(plane.r).toBe(row);
      expect(cols[1]! - cols[0]!).toBe(2);
      expect(cols[2]! - cols[1]!).toBe(2);
    }
    for (let chunk = 0; chunk < LAND_B_CHUNKS; chunk++) {
      const inChunk = groups.filter((group) => Math.floor(group[0]!.r / MAP_CHUNK_ROWS) === chunk);
      if (chunk >= 2 && chunk <= 5) {
        expect(inChunk, `chunk ${chunk}`).toHaveLength(2);
        const sorted = [...inChunk].sort((a, b) => a[0]!.r - b[0]!.r);
        const gap = sorted[1]![0]!.r - (sorted[0]![0]!.r + 2);
        expect(gap, `chunk ${chunk} gap`).toBeGreaterThanOrEqual(10);
      } else {
        expect(inChunk, `chunk ${chunk}`).toHaveLength(0);
      }
    }
  });

  it('keeps the airfield props, and the forest third free of orderly buildings', () => {
    expect(countTile(grid, TileId.runway)).toBeGreaterThan(200);
    expect(countTile(grid, TileId.hangar, 120, 240)).toBeGreaterThan(40);
    expect(countTile(grid, TileId.wall)).toBeGreaterThan(20);
    expect(countTile(grid, TileId.radar)).toBeGreaterThan(2);
    expect(countTile(grid, TileId.bunker)).toBeGreaterThan(4);
    expect(countTile(grid, TileId.bush, 0, 120)).toBeGreaterThan(8);
    const military = [
      TileId.hangar,
      TileId.hangarRoof,
      TileId.barracks,
      TileId.bunker,
      TileId.radar,
      TileId.wall,
      TileId.gate,
      TileId.street,
      TileId.pad,
      TileId.runway,
    ];
    for (const id of military) expect(countTile(grid, id, 240, 360), `tile ${id}`).toBe(0);
    expect(countTile(grid, TileId.forest, 240, 360)).toBeGreaterThan(500);
    expect(countTile(grid, TileId.hut, 240, 360)).toBeGreaterThanOrEqual(5);
    expect(countHouseTiles(grid, 240, 360)).toBeGreaterThanOrEqual(8);
    expect(countTile(grid, TileId.crater, 240, 360)).toBeGreaterThan(12);
    expect(countTile(grid, TileId.wreck, 240, 360)).toBeGreaterThan(6);
    expect(countTile(grid, TileId.snag, 240, 360)).toBeGreaterThan(8);
    const spine = new Set<number>(AIRFIELD_SPINE);
    let offSpine = 0;
    for (let r = 241; r < 359; r++) {
      if (r % MAP_CHUNK_ROWS === 0 || r % MAP_CHUNK_ROWS === MAP_CHUNK_ROWS - 1) continue;
      let roads = 0;
      for (let c = 0; c < MAP_TILES_X; c++) {
        if (grid[r]![c] !== TileId.road && grid[r]![c] !== TileId.street) continue;
        roads++;
        if (!spine.has(c)) offSpine++;
      }
      expect(roads, `row ${r}`).toBeLessThan(12);
    }
    expect(offSpine).toBeGreaterThan(15);
  });
});

describe('河流A channel', () => {
  const grid = getMapGrid('riverA');

  it('runs forest mouth, bends, docks and a lake, then back to center', () => {
    expect(RIVER_A_SPEC.slots).toHaveLength(RIVER_A_CHUNKS);
    expect(planChunks(RIVER_A_SPEC).map((p) => p.chunk)).toEqual([
      'forestMouth',
      'lakeCenter',
      'bendLeft',
      'dockLeft',
      'bridgeLeft',
      'bendRight',
      'batteryRight',
      'lakeRight',
      'forestHead',
    ]);
    expect(composeChunks(RIVER_A_SPEC)).toEqual(grid);
    const edges = planChunks(RIVER_A_SPEC).map((inst) => {
      const def = RIVER_A_LIBRARY.find((d) => d.id === inst.chunk)!;
      return chunkEdges(def, inst.flip);
    });
    expect(edges).toEqual([
      { bottom: 'center', top: 'center' },
      { bottom: 'center', top: 'center' },
      { bottom: 'center', top: 'left' },
      { bottom: 'left', top: 'left' },
      { bottom: 'left', top: 'left' },
      { bottom: 'left', top: 'right' },
      { bottom: 'right', top: 'right' },
      { bottom: 'right', top: 'right' },
      { bottom: 'right', top: 'center' },
    ]);
  });

  it('joins the canal on the five-tile slots and keeps one waterway', () => {
    expect(RIVER_EDGE_COLS.left).toEqual([1, 2, 3, 4, 5]);
    expect(RIVER_EDGE_COLS.center).toEqual([9, 10, 11, 12, 13]);
    expect(RIVER_EDGE_COLS.right).toEqual([17, 18, 19, 20, 21]);
    expect(RIVER_EDGE_COLS.right).toEqual(
      [...RIVER_EDGE_COLS.left].map((c) => MAP_TILES_X - 1 - c).reverse()
    );
    expectSpine(
      RIVER_A_LIBRARY,
      RIVER_A_SPEC,
      () => [],
      (edges, which) => {
        const side = which === 'bottom' ? edges.bottom : edges.top;
        return side === 'none' ? [] : [...RIVER_EDGE_COLS[side]];
      }
    );
    assertOneWaterway(grid);
    expect(grid.some((row) => row.some((id) => id === TileId.water || id === TileId.shallow))).toBe(
      false
    );
    const mouth = countTile(grid, TileId.lake, 0, 40);
    const lake = countTile(grid, TileId.lake, 280, 320);
    expect(lake).toBeGreaterThan(mouth);
  });

  it('lines the river with forest, docks, a bridge, hamlets, wheels and fields', () => {
    expect(countTile(grid, TileId.forest)).toBeGreaterThan(100);
    expect(countTile(grid, TileId.oak)).toBeGreaterThan(8);
    expect(countTile(grid, TileId.dock)).toBeGreaterThan(4);
    expect(countTile(grid, TileId.bridge)).toBeGreaterThan(6);
    expect(countTile(grid, TileId.bunker)).toBeGreaterThan(1);
    expect(countHouseTiles(grid)).toBeGreaterThanOrEqual(24);
    expect(countTile(grid, TileId.wheel)).toBeGreaterThanOrEqual(4);
    expect(countTile(grid, TileId.shed)).toBeGreaterThanOrEqual(2);
    const crops =
      countTile(grid, TileId.cropGreen) +
      countTile(grid, TileId.cropWheat) +
      countTile(grid, TileId.cropPlowed);
    expect(crops).toBeGreaterThan(40);
    grid.forEach((row, r) =>
      row.forEach((id, c) => {
        if (id !== TileId.wheel) return;
        const touch =
          grid[r]![c - 1] === TileId.lake ||
          grid[r]![c + 1] === TileId.lake ||
          grid[r - 1]?.[c] === TileId.lake ||
          grid[r + 1]?.[c] === TileId.lake;
        expect(touch, `wheel ${c},${r}`).toBe(true);
      })
    );
    expect(grid.some((row) => row.some((id) => isStreamTile(id)))).toBe(true);
  });
});

describe('tracks', () => {
  it('builds stage 1 from 陆地A plus a looping land boss', () => {
    const stage = getStage('1');
    const track = buildStageTrack(stage);
    expect(track.handoff).toBe('tiles');
    expect(
      track.layers.map((l) => [l.map.id, l.origin, l.inAt, l.outAt, l.role, l.loopFrom])
    ).toEqual([
      ['landA', 0, null, null, 'run', null],
      ['landBoss', getTileMap('landA').rows * TILE_SIZE, null, null, 'boss', MAP_CHUNK_ROWS],
    ]);
    expect(track.warningAt).toBe(150);
    expect(trackFinished(track, 1e6)).toBe(false);
  });

  it('keeps a starfield boss off the tile layers', () => {
    const stage = getStage('1');
    const track = buildStageTrack({ ...stage, maps: { run: stage.maps.run, boss: 'spaceA' } });
    expect(track.handoff).toBe('starfield');
    expect(track.layers.map((l) => l.map.id)).toEqual(['landA']);
  });

  it('ends a map preview when the last row reaches the top of the screen', () => {
    const land = buildMapTrack('landA');
    const end = (getTileMap('landA').rows * TILE_SIZE - LOGICAL_H) / BG_SCROLL_SPEED;
    expect(land.endAt).toBe(end);
    expect(trackFinished(land, end - 0.01)).toBe(false);
    expect(trackFinished(land, end)).toBe(true);
    const space = buildMapTrack('spaceA');
    expect(space.starsOnly).toBe(true);
    expect(space.layers).toEqual([]);
    expect(space.endAt).toBeGreaterThan(0);
  });

  it('plays a stage run up to the warning, with no warning sequence', () => {
    const stage = getStage('1');
    const run = buildStageRunTrack(stage, '第一关全程');
    expect(run.warningAt).toBeNull();
    expect(run.endAt).toBe(stage.warningAt);
    expect(run.layers.map((l) => l.map.id)).toEqual(['landA']);
  });

  it('lists every map for 地图预览 and omits the stage run', () => {
    expect(listMapPreviews()).toEqual([
      { target: 'map:landA', label: '陆地A' },
      { target: 'map:landB', label: '陆地B' },
      { target: 'map:riverA', label: '河流A' },
      { target: 'map:landBoss', label: '百战要塞' },
      { target: 'map:factoryBoss', label: '铁堡厂轨' },
      { target: 'map:spaceA', label: '宇宙A' },
    ]);
    const bossPreview = buildMapTrack('landBoss');
    expect(bossPreview.layers[0]!.loopFrom).toBe(MAP_CHUNK_ROWS);
    expect(bossPreview.endAt).toBeGreaterThan(0);
    expect(bossPreview.starsOnly).toBe(false);
    expect(buildPreviewTrack('map:riverA').layers[0]!.map.id).toBe('riverA');
    expect(buildPreviewTrack('stage:1').label).toBe('第一关全程');
    expect(buildPreviewTrack(undefined).label).toBe('第一关全程');
  });
});

describe('百战要塞', () => {
  const grid = getMapGrid('landBoss');
  const loop = MAP_CHUNK_ROWS;

  it('is the approach chunk then the courtyard, built once', () => {
    expect(LAND_BOSS_LIBRARY.map((c) => c.id)).toEqual(['approach', 'courtyard']);
    expect(planChunks(LAND_BOSS_SPEC).map((p) => p.chunk)).toEqual(['approach', 'courtyard']);
    expect(grid).toHaveLength(loop * 2);
    expect(composeChunks(LAND_BOSS_SPEC)).toEqual(grid);
  });

  it('stitches onto 陆地A through the handoff band', () => {
    const land = getMapGrid('landA');
    const top = land[land.length - 1]!;
    const bottom = grid[0]!;
    expect(rowConnectors(top).road).toEqual([ROAD_COL]);
    expect(rowConnectors(top).water).toEqual([]);
    expect(rowConnectors(bottom).road).toEqual([ROAD_COL]);
    expect(rowConnectors(bottom).water).toEqual([]);
    expect(countTile(grid, TileId.scorch, 0, APPROACH_HANDOFF_ROWS)).toBeLessThan(
      countTile(grid, TileId.scorch, APPROACH_HANDOFF_ROWS, loop)
    );
    expect(grid[APPROACH_HANDOFF_ROWS]![ROAD_COL]).not.toBe(TileId.lake);
  });

  it('has no water, keeps the land road on the bottom, and matches the loop seam', () => {
    for (const row of grid) {
      for (const id of row) expect(tileTerrain(id)).not.toBe('water');
    }
    expect(rowConnectors(grid[0]!).road).toEqual([ROAD_COL]);
    expect(rowConnectors(grid[0]!).water).toEqual([]);
    const edge = grid[loop - 1];
    expect(grid[loop]).toEqual(edge);
    expect(grid[grid.length - 1]).toEqual(edge);
    expect(edge![0]).toBe(TileId.fortWall);
    expect(edge![ROAD_COL]).toBe(TileId.scorch);
  });

  it('scorches toward the gate and walls the courtyard', () => {
    expect(countTile(grid, TileId.scorch, 24, loop)).toBeGreaterThan(
      countTile(grid, TileId.scorch, 0, 12)
    );
    expect(countTile(grid, TileId.fortWall, loop, grid.length)).toBeGreaterThan(100);
    expect(countTile(grid, TileId.crater, loop, grid.length)).toBeGreaterThan(0);
    expect(countTile(grid, TileId.bunker, loop, grid.length)).toBeGreaterThan(0);
    expect(grid[loop + 20]![0]).toBe(TileId.fortWall);
  });
});

describe('铁堡厂轨', () => {
  const grid = getMapGrid('factoryBoss');
  const loop = MAP_CHUNK_ROWS;

  it('is the approach chunk then the factory floor', () => {
    expect(FACTORY_BOSS_LIBRARY.map((c) => c.id)).toEqual(['approach', 'floor']);
    expect(planChunks(FACTORY_BOSS_SPEC).map((p) => p.chunk)).toEqual(['approach', 'floor']);
    expect(planChunks(FACTORY_BOSS_SPEC).some((p) => p.flip)).toBe(false);
    expect(grid).toHaveLength(loop * 2);
    expect(getTileMap('factoryBoss').loopFrom).toBe(loop);
    expect(getTileMap('factoryBoss').cloudShadows).toBeFalsy();
    expect(composeChunks(FACTORY_BOSS_SPEC)).toEqual(grid);
  });

  it('puts the three rails on screen X 72 / 180 / 288', () => {
    expect(FACTORY_RAILS.map((rail) => rail.x)).toEqual([...TIEBAO_RAIL_X]);
    for (const rail of FACTORY_RAILS) {
      expect(factoryRailScreenX(rail.col, rail.pixel)).toBe(rail.x);
    }
  });

  it('stitches onto 陆地B and keeps the rails aligned across the loop seam', () => {
    const land = getMapGrid('landB');
    const top = land[land.length - 1]!;
    expect(rowConnectors(top).road).toEqual([...AIRFIELD_SPINE]);
    expect(rowConnectors(top).water).toEqual([]);
    expect(rowConnectors(grid[0]!).road).toEqual([...AIRFIELD_SPINE]);
    expect(rowConnectors(grid[0]!).water).toEqual([]);
    for (const row of grid) {
      for (const id of row) expect(tileTerrain(id)).not.toBe('water');
    }
    const edge = grid[loop - 1]!;
    expect(grid[loop]).toEqual(edge);
    expect(grid[grid.length - 1]).toEqual(edge);
    expect(edge[0]).toBe(TileId.factoryWall);
    for (const rail of FACTORY_RAILS) expect(edge[rail.col]).toBe(rail.tile);
    for (let r = loop; r < grid.length; r++) {
      for (const rail of FACTORY_RAILS) expect(grid[r]![rail.col]).toBe(rail.tile);
    }
  });

  it('hands off from 陆地B with opaque tiles and no warning clouds', () => {
    const stage = getStage('2');
    const track = buildStageTrack(stage);
    expect(track.handoff).toBe('tiles');
    expect(track.layers.map((layer) => layer.map.id)).toEqual(['landB', 'factoryBoss']);
    const origin = LAND_B_CHUNKS * MAP_CHUNK_ROWS * TILE_SIZE;
    expect(track.layers[1]!.origin).toBe(origin);
    const scroll = scrollDistance(TIEBAO_ENTER_AT, STAGE2_WARNING_AT, 'tiles');
    expect(scroll - origin).toBeCloseTo(120, 0);
    const fade = backgroundFade(STAGE2_WARNING_AT + 1, track);
    expect(fade.clouds).toBe(0);
    expect(fade.stars).toBe(0);
  });
});

describe('backdrop segments', () => {
  it('clips a finite map to the view', () => {
    expect(backdropSegments(100, 7040, null, LOGICAL_H)).toEqual([
      { local: 100, y0: 100, y1: 740 },
    ]);
  });

  it('lets a layer enter from the top when its local scroll is still negative', () => {
    expect(backdropSegments(-340, 1280, 640, LOGICAL_H)).toEqual([{ local: -340, y0: 0, y1: 300 }]);
    expect(segmentScreenSpan({ local: -340, y0: 0, y1: 300 })).toEqual({ top: 0, bottom: 300 });
    expect(backdropSegments(-700, 1280, 640, LOGICAL_H)).toEqual([]);
  });

  it('splits a looping arena when the seam is on screen', () => {
    expect(backdropSegments(1000, 1280, 640, LOGICAL_H)).toEqual([
      { local: 1000, y0: 1000, y1: 1280 },
      { local: 360, y0: 640, y1: 1000 },
    ]);
    expect(backdropSegments(640, 1280, 640, LOGICAL_H)).toEqual([
      { local: 640, y0: 640, y1: 1280 },
    ]);
  });
});
