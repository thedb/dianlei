import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  LAND_A_CHUNKS,
  LAND_B_CHUNKS,
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  MAP_TILES_X,
  SEA_A_CHUNKS,
  TILE_SIZE,
} from '@/game/config';
import { TILE_COUNT, TileId } from '@/game/art/tiles';
import { getStage } from '@/game/levels/registry';
import { AIRFIELD_SPINE, LAND_B_LIBRARY, LAND_B_SPEC } from './landB';
import { LAND_A_LIBRARY, LAND_A_SPEC } from './landA';
import { SEA_A_LIBRARY, SEA_A_SPEC, SEA_EDGE_COLS } from './seaA';
import {
  ROAD_COL,
  STREAM_COLS,
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
  it('lists the four stage-1 map assets in order', () => {
    expect(listMaps().map((m) => [m.id, m.label, m.kind])).toEqual([
      ['landA', '陆地A', 'tiles'],
      ['landB', '陆地B', 'tiles'],
      ['seaA', '海面A', 'tiles'],
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

  it('keeps stage 1 on 陆地A and the boss on 宇宙A', () => {
    expect(getStage('1').maps).toEqual({ run: [{ map: 'landA', at: 0 }], boss: 'spaceA' });
  });

  it('gives 陆地B and 海面A cloud shadows and a preview a bit shorter than 陆地A', () => {
    for (const id of ['landB', 'seaA'] as const) {
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

  it('tells outskirts, then the airfield, then the ruins', () => {
    expect(LAND_B_SPEC.slots).toHaveLength(LAND_B_CHUNKS);
    expect(planChunks(LAND_B_SPEC).map((p) => `${p.chunk}${p.flip ? ':flip' : ''}`)).toEqual([
      'fenceLine',
      'guardPosts:flip',
      'taxiIn',
      'runwayHangars',
      'towerApron',
      'runwayBatteries',
      'craterApron',
      'trenchLine:flip',
      'battlefield',
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
    expect(grid.some((row) => row.some((id) => wet(id)))).toBe(false);
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

  it('keeps the airfield props and the ruin props', () => {
    expect(countTile(grid, TileId.runway)).toBeGreaterThan(200);
    expect(countTile(grid, TileId.hangar, 120, 240)).toBeGreaterThan(40);
    expect(countTile(grid, TileId.wall)).toBeGreaterThan(20);
    expect(countTile(grid, TileId.radar)).toBeGreaterThan(2);
    expect(countTile(grid, TileId.bunker)).toBeGreaterThan(4);
    expect(countTile(grid, TileId.crater, 240, 360)).toBeGreaterThan(15);
    expect(countTile(grid, TileId.trench, 240, 360)).toBeGreaterThan(10);
    expect(countTile(grid, TileId.wreck, 240, 360)).toBeGreaterThan(6);
    expect(countTile(grid, TileId.snag, 240, 360)).toBeGreaterThan(8);
    expect(countTile(grid, TileId.bush, 0, 120)).toBeGreaterThan(8);
  });
});

describe('海面A canal', () => {
  const grid = getMapGrid('seaA');

  it('runs forest mouth, bends, docks and a lake, then back to center', () => {
    expect(SEA_A_SPEC.slots).toHaveLength(SEA_A_CHUNKS);
    expect(planChunks(SEA_A_SPEC).map((p) => p.chunk)).toEqual([
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
    expect(composeChunks(SEA_A_SPEC)).toEqual(grid);
    const edges = planChunks(SEA_A_SPEC).map((inst) => {
      const def = SEA_A_LIBRARY.find((d) => d.id === inst.chunk)!;
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
    expect(SEA_EDGE_COLS.left).toHaveLength(5);
    expect(SEA_EDGE_COLS.right).toEqual(
      [...SEA_EDGE_COLS.left].map((c) => MAP_TILES_X - 1 - c).reverse()
    );
    expectSpine(
      SEA_A_LIBRARY,
      SEA_A_SPEC,
      () => [],
      (edges, which) => {
        const side = which === 'bottom' ? edges.bottom : edges.top;
        return side === 'none' ? [] : [...SEA_EDGE_COLS[side]];
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

  it('lines the canal with forest, docks, a bridge and a gun pit', () => {
    expect(countTile(grid, TileId.forest)).toBeGreaterThan(100);
    expect(countTile(grid, TileId.oak)).toBeGreaterThan(8);
    expect(countTile(grid, TileId.dock)).toBeGreaterThan(4);
    expect(countTile(grid, TileId.bridge)).toBeGreaterThan(6);
    expect(countTile(grid, TileId.bunker)).toBeGreaterThan(1);
    expect(grid.some((row) => row.some((id) => isStreamTile(id)))).toBe(true);
  });
});

describe('tracks', () => {
  it('builds stage 1 from 陆地A with no handovers', () => {
    const track = buildStageTrack(getStage('1'));
    expect(track.layers.map((l) => [l.map.id, l.origin, l.inAt, l.outAt])).toEqual([
      ['landA', 0, null, null],
    ]);
    expect(track.warningAt).toBe(150);
    expect(trackFinished(track, 1e6)).toBe(false);
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

  it('lists every map and then 第一关全程 for 地图预览', () => {
    expect(listMapPreviews()).toEqual([
      { target: 'map:landA', label: '陆地A' },
      { target: 'map:landB', label: '陆地B' },
      { target: 'map:seaA', label: '海面A' },
      { target: 'map:spaceA', label: '宇宙A' },
      { target: 'stage:1', label: '第一关全程' },
    ]);
    expect(buildPreviewTrack('map:seaA').layers[0]!.map.id).toBe('seaA');
    expect(buildPreviewTrack('stage:1').label).toBe('第一关全程');
    expect(buildPreviewTrack(undefined).label).toBe('第一关全程');
  });
});
