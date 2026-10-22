import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  LAND_A_CHUNKS,
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  MAP_TILES_X,
  TILE_SIZE,
} from '@/game/config';
import { TILE_COUNT, TileId } from '@/game/art/tiles';
import { getStage } from '@/game/levels/registry';
import { LAND_A_LIBRARY, LAND_A_SPEC } from './landA';
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
  listMapPreviews,
  listMaps,
  paintChunk,
  planChunks,
  rowConnectors,
  terrainAt,
  tileTerrain,
  trackFinished,
  TILE_TERRAIN,
  type ChunkMapSpec,
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

  it('keeps 陆地B and 海面A on their original painters', () => {
    const base = getMapGrid('landB');
    const coast = getMapGrid('seaA');
    expect(base.some((row) => row.includes(TileId.runway))).toBe(true);
    expect(base.some((row) => row.includes(TileId.hangar))).toBe(true);
    expect(base.some((row) => row.includes(TileId.wall))).toBe(true);
    expect(coast.some((row) => row.includes(TileId.water))).toBe(true);
    expect(coast.some((row) => row.includes(TileId.dock))).toBe(true);
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
