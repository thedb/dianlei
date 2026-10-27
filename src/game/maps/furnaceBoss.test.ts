import { describe, expect, it } from 'vitest';
import {
  FURNACE_ENTER_AT,
  LOGICAL_H,
  MAP_CHUNK_ROWS,
  RIVER_A_CHUNKS,
  STAGE3_WARNING_AT,
  TILE_SIZE,
} from '@/game/config';
import { TileId } from '@/game/art/tiles';
import { getStage } from '@/game/levels/registry';
import { backgroundFade, scrollDistance } from '@/game/systems/background';
import { composeChunks, planChunks } from './chunks';
import {
  FURNACE_BOSS_LIBRARY,
  FURNACE_BOSS_LOOP_ROW,
  FURNACE_BOSS_SPEC,
  FURNACE_CHASSIS_ROW,
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

const FURNACE_TILES: readonly TileId[] = [
  TileId.furnacePlate,
  TileId.furnaceRib,
  TileId.furnaceStrip,
  TileId.furnaceVoid,
];

describe('炉心浮台', () => {
  const grid = getMapGrid('furnaceBoss');
  const loop = FURNACE_BOSS_LOOP_ROW;

  it('is one approach chunk then a looping chassis, with no cloud sheet', () => {
    expect(FURNACE_BOSS_LIBRARY.map((c) => c.id)).toEqual(['approach', 'chassis']);
    expect(planChunks(FURNACE_BOSS_SPEC).map((p) => p.chunk)).toEqual(['approach', 'chassis']);
    expect(planChunks(FURNACE_BOSS_SPEC).some((p) => p.flip)).toBe(false);
    expect(loop).toBe(MAP_CHUNK_ROWS);
    expect(grid).toHaveLength(MAP_CHUNK_ROWS * 2);
    expect(getTileMap('furnaceBoss').loopFrom).toBe(loop);
    expect(getTileMap('furnaceBoss').cloudShadows).toBeFalsy();
    expect(getTileMap('furnaceBoss').label).toBe('炉心浮台');
    expect(composeChunks(FURNACE_BOSS_SPEC)).toEqual(grid);
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
        expect(FURNACE_TILES).toContain(id);
      }
    }
    for (let r = FURNACE_CHASSIS_ROW; r < loop; r++) {
      for (const id of grid[r]!) expect(FURNACE_TILES).toContain(id);
    }
    const strips = grid
      .slice(loop)
      .reduce((n, row) => n + row.filter((id) => id === TileId.furnaceStrip).length, 0);
    expect(strips).toBeGreaterThan(40);
  });

  it('dresses the approach with scorch and a fort gate before the chassis', () => {
    const approach = grid.slice(1, FURNACE_CHASSIS_ROW);
    const count = (id: TileId) =>
      approach.reduce((n, row) => n + row.filter((t) => t === id).length, 0);
    expect(count(TileId.scorch)).toBeGreaterThan(0);
    expect(count(TileId.fortWall)).toBeGreaterThan(0);
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
