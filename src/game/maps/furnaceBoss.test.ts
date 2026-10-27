import { describe, expect, it } from 'vitest';
import {
  FURNACE_ENTER_AT,
  FURNACE_MAP_LOOK,
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  RIVER_A_CHUNKS,
  STAGE3_WARNING_AT,
  TILE_SIZE,
} from '@/game/config';
import { TILE_COUNT, TileId } from '@/game/art/tiles';
import { rasterStrip } from '@/game/art/mapRaster';
import { PALETTE } from '@/game/palette';
import { getStage } from '@/game/levels/registry';
import { backgroundFade, scrollDistance } from '@/game/systems/background';
import { composeChunks, planChunks } from './chunks';
import {
  FURNACE_APPROACH,
  FURNACE_BOSS_LIBRARY,
  FURNACE_BOSS_LOOP_ROW,
  FURNACE_BOSS_SPEC,
  FURNACE_LEGEND,
  FURNACE_LOOP,
  FURNACE_SEAM,
  riverATopRow,
} from './furnaceBoss';
import { getMapGrid, getTileMap } from './registry';
import { tileTerrain } from './terrain';
import { buildStageTrack } from './track';

const RUINS: readonly TileId[] = [
  TileId.scorch,
  TileId.crater,
  TileId.trench,
  TileId.wreck,
  TileId.snag,
];

const HARBOR_TILES: readonly TileId[] = [
  TileId.harborMud,
  TileId.harborSlab,
  TileId.harborQuay,
  TileId.harborPit,
  TileId.bargeHull,
  TileId.craneBoomNE,
  TileId.craneBoomNW,
  TileId.craneFoot,
  TileId.harborPiles,
  TileId.harborScrap,
  TileId.harborBurn,
];

const FACTORY_TILES: readonly TileId[] = [
  TileId.factoryFloor,
  TileId.factoryWall,
  TileId.factoryWindow,
  TileId.factoryRailW,
  TileId.factoryRailC,
  TileId.factoryRailE,
];

type Grid = readonly (readonly TileId[])[];

/** First approach row from which every row up to the loop is harbor tiles only. */
function yardStart(grid: Grid): number {
  for (let r = 1; r < MAP_CHUNK_ROWS; r++) {
    const rest = grid.slice(r, MAP_CHUNK_ROWS);
    if (rest.every((row) => row.every((id) => HARBOR_TILES.includes(id)))) return r;
  }
  return MAP_CHUNK_ROWS;
}

function count(rows: Grid, id: TileId): number {
  return rows.reduce((n, row) => n + row.filter((t) => t === id).length, 0);
}

describe('炉心浮台', () => {
  const grid = getMapGrid('furnaceBoss');
  const loop = FURNACE_BOSS_LOOP_ROW;

  it('is one approach chunk then a looping dockyard, with no cloud sheet', () => {
    expect(FURNACE_MAP_LOOK).toBe('C');
    expect(FURNACE_BOSS_LIBRARY.map((c) => c.id)).toEqual(['approach', 'dockyard']);
    expect(planChunks(FURNACE_BOSS_SPEC).map((p) => p.chunk)).toEqual(['approach', 'dockyard']);
    expect(planChunks(FURNACE_BOSS_SPEC).some((p) => p.flip)).toBe(false);
    expect(loop).toBe(MAP_CHUNK_ROWS);
    expect(grid).toHaveLength(MAP_CHUNK_ROWS * 2);
    expect(getTileMap('furnaceBoss').loopFrom).toBe(loop);
    expect(getTileMap('furnaceBoss').cloudShadows).toBeFalsy();
    expect(getTileMap('furnaceBoss').label).toBe('炉心浮台');
    expect(composeChunks(FURNACE_BOSS_SPEC)).toEqual(grid);
  });

  it('writes both layouts as full-width rows of known cells', () => {
    expect(FURNACE_LOOP).toHaveLength(MAP_CHUNK_ROWS);
    expect(FURNACE_APPROACH).toHaveLength(MAP_CHUNK_ROWS - 1);
    for (const line of [...FURNACE_LOOP, ...FURNACE_APPROACH]) {
      expect(line).toHaveLength(23);
      for (const ch of line) expect(FURNACE_LEGEND[ch], `cell '${ch}'`).toBeDefined();
    }
    expect(FURNACE_LOOP[0]).toBe(FURNACE_SEAM);
    expect(FURNACE_LOOP[MAP_CHUNK_ROWS - 1]).toBe(FURNACE_SEAM);
    expect(FURNACE_APPROACH[0]).toBe(FURNACE_SEAM);
  });

  it('starts on 河流A’s last row and keeps the loop seam seamless and dry', () => {
    const river = getMapGrid('riverA');
    expect(grid[0]).toEqual(river[river.length - 1]);
    expect(riverATopRow()).toEqual(river[river.length - 1]);
    const edge = grid[loop - 1]!;
    expect(grid[loop]).toEqual(edge);
    expect(grid[grid.length - 1]).toEqual(edge);
    for (let r = loop; r < grid.length; r++) {
      for (const id of grid[r]!) {
        expect(tileTerrain(id)).not.toBe('water');
        expect(HARBOR_TILES).toContain(id);
      }
    }
    expect(yardStart(grid)).toBeLessThan(MAP_CHUNK_ROWS - 8);
  });

  it('is a flooded dockyard, not 铁堡厂轨: pits, a stranded barge, cranes, pilings', () => {
    const floor = grid.slice(loop);
    for (const id of FACTORY_TILES) expect(count(grid, id)).toBe(0);
    expect(count(floor, TileId.harborPit)).toBeGreaterThan(80);
    expect(count(floor, TileId.bargeHull)).toBeGreaterThan(10);
    expect(count(floor, TileId.craneFoot)).toBe(2);
    expect(count(floor, TileId.harborPiles)).toBeGreaterThan(3);
    expect(count(floor, TileId.harborQuay)).toBe(MAP_CHUNK_ROWS * 2);
  });

  it('runs every crane boom diagonally down to a crane foot', () => {
    for (const [id, dc] of [
      [TileId.craneBoomNE, -1],
      [TileId.craneBoomNW, 1],
    ] as const) {
      grid.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell !== id) return;
          const below = grid[r - 1]?.[c + dc];
          expect([id, TileId.craneFoot], `boom at ${c},${r}`).toContain(below);
        });
      });
    }
  });

  it('floods the approach basin with a half-sunk barge and burns the banks', () => {
    const approach = grid.slice(1, yardStart(grid));
    expect(count(approach, TileId.lake)).toBeGreaterThan(120);
    expect(count(approach, TileId.bargeHull)).toBeGreaterThan(6);
    expect(count(approach, TileId.harborBurn)).toBeGreaterThan(10);
    expect(count(approach, TileId.harborPiles)).toBeGreaterThan(3);
    grid.forEach((row, r) => {
      if (r >= loop) return;
      row.forEach((cell, c) => {
        if (cell !== TileId.bargeHull) return;
        const sides = [grid[r + 1]?.[c], grid[r - 1]?.[c], row[c - 1], row[c + 1]];
        expect(sides.every((n) => n === TileId.lake || n === TileId.bargeHull)).toBe(true);
      });
    });
  });

  it('keeps pilings and booms either in water or off the lake edge', () => {
    const standing: readonly TileId[] = [
      TileId.harborPiles,
      TileId.craneBoomNE,
      TileId.craneBoomNW,
    ];
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!standing.includes(cell)) return;
        const sides = [grid[r + 1]?.[c], grid[r - 1]?.[c], row[c - 1], row[c + 1]];
        const lake = sides.filter((n) => n === TileId.lake).length;
        const wet = sides.filter(
          (n) => n === TileId.lake || (n !== undefined && standing.includes(n))
        ).length;
        expect(lake === 0 || wet >= 2, `${cell} at ${c},${r}`).toBe(true);
      });
    });
  });

  it('rasters to palette indices only', () => {
    expect(TILE_COUNT).toBeGreaterThan(TileId.harborBurn);
    const strip = rasterStrip(grid, 0, grid.length);
    for (const v of strip.data) expect(v).toBeLessThan(PALETTE.length);
  });

  it('hands off from 河流A with opaque tiles, no warning clouds, no space cut', () => {
    const stage = getStage('3');
    const track = buildStageTrack(stage);
    expect(track.handoff).toBe('tiles');
    expect(track.layers.map((layer) => layer.map.id)).toEqual(['riverA', 'furnaceBoss']);
    const origin = RIVER_A_CHUNKS * MAP_CHUNK_ROWS * TILE_SIZE;
    expect(track.layers[1]!.origin).toBe(origin);
    expect(STAGE3_WARNING_AT * 40 + LOGICAL_H).toBeLessThan(origin);
    const scroll = scrollDistance(FURNACE_ENTER_AT, STAGE3_WARNING_AT, 'tiles');
    expect(scroll - origin).toBeCloseTo(120, 0);
    const fade = backgroundFade(STAGE3_WARNING_AT + 1, track);
    expect(fade.clouds).toBe(0);
    expect(fade.stars).toBe(0);
  });
});

describe('河流A scorch decor (stage 3)', () => {
  const river = getMapGrid('riverA');

  it('puts ruin tiles only on interior bank rows of lakeRight and forestHead', () => {
    const lakeRight = 7;
    const forestHead = 8;
    const seen = new Set<number>();
    river.forEach((row, r) => {
      row.forEach((id) => {
        if (!RUINS.includes(id)) return;
        const chunk = Math.floor(r / MAP_CHUNK_ROWS);
        const local = r % MAP_CHUNK_ROWS;
        expect([lakeRight, forestHead]).toContain(chunk);
        expect(local).toBeGreaterThan(0);
        expect(local).toBeLessThan(MAP_CHUNK_ROWS - 1);
        expect(tileTerrain(id) === 'water').toBe(false);
        seen.add(chunk);
      });
    });
    expect([...seen].sort()).toEqual([lakeRight, forestHead]);
  });
});
