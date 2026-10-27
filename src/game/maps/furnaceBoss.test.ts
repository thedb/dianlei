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
import { COLOR, PALETTE } from '@/game/palette';
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

const PORT_TILES: readonly TileId[] = [...HARBOR_TILES, TileId.lake];

/** 河流A's channel, carried through the approach and the whole loop as the canal. */
const CANAL_COLS = [9, 10, 11, 12, 13];

/** First approach row from which every row up to the loop is harbor tiles or water. */
function yardStart(grid: Grid): number {
  for (let r = 1; r < MAP_CHUNK_ROWS; r++) {
    const rest = grid.slice(r, MAP_CHUNK_ROWS);
    if (rest.every((row) => row.every((id) => PORT_TILES.includes(id)))) return r;
  }
  return MAP_CHUNK_ROWS;
}

/** Cells a boat could float through: lake, plus hulls and pilings standing in it. */
function afloat(id: TileId | undefined): boolean {
  return id === TileId.lake || id === TileId.bargeHull || id === TileId.harborPiles;
}

function luminance(index: number): number {
  const hex = PALETTE[index]!;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const WATER_COLORS = new Set<number>([
  COLOR.WATER_DEEP,
  COLOR.WATER_OCEAN,
  COLOR.WATER_MEDIUM,
  COLOR.WATER_SHALLOW,
  COLOR.WATER_FOAM,
]);

function rasterStats(grid: Grid, r0: number, rows: number): { lum: number; water: number } {
  const strip = rasterStrip(grid, r0, rows);
  let lum = 0;
  let water = 0;
  for (const v of strip.data) {
    lum += luminance(v);
    if (WATER_COLORS.has(v)) water++;
  }
  return { lum: lum / strip.data.length, water: water / strip.data.length };
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

  it('starts on 河流A’s last row and keeps the loop seam seamless', () => {
    const river = getMapGrid('riverA');
    expect(grid[0]).toEqual(river[river.length - 1]);
    expect(riverATopRow()).toEqual(river[river.length - 1]);
    const edge = grid[loop - 1]!;
    expect(grid[loop]).toEqual(edge);
    expect(grid[grid.length - 1]).toEqual(edge);
    for (let r = loop; r < grid.length; r++) {
      for (const id of grid[r]!) expect(PORT_TILES).toContain(id);
    }
    expect(yardStart(grid)).toBeLessThan(MAP_CHUNK_ROWS - 8);
  });

  it('carries 河流A’s channel into the harbor and down the whole loop as a canal', () => {
    const river = getMapGrid('riverA');
    const top = river[river.length - 1]!;
    const channel = top.flatMap((id, c) => (tileTerrain(id) === 'water' ? [c] : []));
    expect(channel).toEqual(CANAL_COLS);
    for (let r = loop; r < grid.length; r++) {
      expect(grid[r]![CANAL_COLS[0]!], `canal west bank, row ${r}`).toBe(TileId.lake);
      expect(grid[r]![CANAL_COLS[4]!], `canal east bank, row ${r}`).toBe(TileId.lake);
      for (const c of CANAL_COLS) expect(afloat(grid[r]![c]), `canal ${c},${r}`).toBe(true);
    }
    // One body of water from the river mouth to the top of the loop.
    const seen = new Set<string>();
    const todo: Array<readonly [number, number]> = channel.map((c) => [c, 0] as const);
    for (const [c, r] of todo) seen.add(`${c},${r}`);
    while (todo.length) {
      const [c, r] = todo.pop()!;
      for (const [nc, nr] of [
        [c + 1, r],
        [c - 1, r],
        [c, r + 1],
        [c, r - 1],
      ] as const) {
        const key = `${nc},${nr}`;
        if (seen.has(key) || !afloat(grid[nr]?.[nc])) continue;
        seen.add(key);
        todo.push([nc, nr]);
      }
    }
    for (let r = 0; r < grid.length; r++) {
      expect(
        CANAL_COLS.some((c) => seen.has(`${c},${r}`)),
        `row ${r}`
      ).toBe(true);
    }
    // Side waterways along both screen edges, open on most loop rows.
    const floor = grid.slice(loop);
    const left = floor.filter((row) => row[0] === TileId.lake || row[1] === TileId.lake);
    const right = floor.filter((row) => row[21] === TileId.lake || row[22] === TileId.lake);
    expect(left.length).toBe(MAP_CHUNK_ROWS);
    expect(right.length).toBeGreaterThanOrEqual(MAP_CHUNK_ROWS - 4);
  });

  it('rasters as a bright daytime port with 河流A’s water, not a dark cut', () => {
    const river = rasterStats(getMapGrid('riverA'), 0, getMapGrid('riverA').length);
    const approach = rasterStats(grid, 0, loop);
    const floor = rasterStats(grid, loop, grid.length - loop);
    expect(approach.lum).toBeGreaterThan(river.lum * 0.75);
    expect(floor.lum).toBeGreaterThan(river.lum * 0.85);
    expect(approach.water).toBeGreaterThan(0.3);
    expect(floor.water).toBeGreaterThan(0.3);
  });

  it('is a flooded dockyard, not 铁堡厂轨: pits, barges, slips, cranes, pilings', () => {
    const floor = grid.slice(loop);
    for (const id of FACTORY_TILES) expect(count(grid, id)).toBe(0);
    expect(count(floor, TileId.harborPit)).toBeGreaterThan(50);
    expect(count(floor, TileId.bargeHull)).toBeGreaterThan(40);
    expect(count(floor, TileId.craneFoot)).toBe(2);
    expect(count(floor, TileId.harborPiles)).toBeGreaterThan(3);
    expect(count(floor, TileId.harborQuay)).toBeGreaterThan(MAP_CHUNK_ROWS * 3);
    expect(count(floor, TileId.lake)).toBeGreaterThan(300);
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
    const approach = grid.slice(1, loop);
    expect(count(approach, TileId.lake)).toBeGreaterThan(300);
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
