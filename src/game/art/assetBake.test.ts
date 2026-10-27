import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/engine/rng';
import { FIXED_DT, FURNACE_ENTER_DURATION, FURNACE_HULL_H, FURNACE_HULL_W } from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { FURNACE } from '@/game/levels/bosses/furnace';
import { COLOR, PALETTE } from '@/game/palette';
import { bossPart, createBoss, resolveBossBullet, updateBoss } from '@/game/systems/boss';
import { FURNACE_POD_IDS, furnaceCoreExposed } from '@/game/systems/furnace';
import { BOSS_ART, createBossAssets, drawBossWorld } from './bossSprite';
import { buildEnemyArt } from './enemySprite';
import {
  buildFurnaceChassis,
  buildFurnaceCore,
  buildFurnacePetal,
  buildFurnacePod,
  buildFurnacePodMark,
} from './furnaceLooks';
import { createGameAssets } from './index';
import { createGrid, plot } from './pixelDraw';
import type { SpriteData } from './types';
import { FakeOffscreenCanvas, fakeContext } from '@/test/fakeCanvas';

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function expectCleanGrid(grid: SpriteData, w: number, h: number, label: string): void {
  expect(grid, label).toHaveLength(h);
  for (const row of grid) {
    expect(row, label).toHaveLength(w);
    for (const cell of row) {
      expect(Number.isInteger(cell), label).toBe(true);
      expect(cell, label).toBeGreaterThanOrEqual(-1);
      expect(cell, label).toBeLessThan(PALETTE.length);
    }
  }
}

describe('asset bake', () => {
  it('ignores fractional cells instead of indexing past the grid', () => {
    const grid = createGrid(4, 4);
    expect(() => plot(grid, 1.5, 121.21, 3)).not.toThrow();
    expect(grid.flat().every((cell) => cell === -1)).toBe(true);
  });

  it('bakes every furnace sprite as a whole-pixel palette grid', () => {
    expectCleanGrid(buildFurnaceChassis(false), FURNACE_HULL_W, FURNACE_HULL_H, 'chassis');
    expectCleanGrid(buildFurnaceChassis(true), FURNACE_HULL_W, FURNACE_HULL_H, 'chassis open');
    expectCleanGrid(buildFurnacePod('intact'), 28, 28, 'pod');
    expectCleanGrid(buildFurnacePod('active'), 28, 28, 'pod active');
    expectCleanGrid(buildFurnacePodMark(), 28, 28, 'pod mark');
    expectCleanGrid(buildFurnacePod('wrecked'), 28, 28, 'pod wrecked');
    expectCleanGrid(buildFurnacePetal(), 24, 24, 'petal');
    expectCleanGrid(buildFurnaceCore(), 32, 32, 'core');
  });

  it('draws the pod as a hex seat with a barrel, cracked while active, then an empty ring', () => {
    const intact = buildFurnacePod('intact');
    const damaged = buildFurnacePod('active');
    const wrecked = buildFurnacePod('wrecked');
    const span = (grid: SpriteData, y: number) => {
      const xs = grid[y]!.flatMap((v, x) => (v >= 0 ? [x] : []));
      return xs.length ? xs[xs.length - 1]! - xs[0]! + 1 : 0;
    };
    // Hex seat: wide at the points, flat and narrower on top; not a disc.
    expect(span(intact, 11)).toBeGreaterThanOrEqual(22);
    expect(span(intact, 2)).toBeLessThanOrEqual(14);
    // The barrel runs past the seat to a warm muzzle.
    expect(span(intact, 24)).toBeLessThanOrEqual(8);
    expect(intact[26]![13]).toBe(COLOR.EXPLOSION_ORANGE_YELLOW);
    const colors = (grid: SpriteData) => new Set(grid.flat());
    expect(colors(intact).has(COLOR.PLAYER_CYAN)).toBe(true);
    expect(colors(damaged).has(COLOR.PLAYER_CYAN)).toBe(false);
    expect(colors(damaged).has(COLOR.ENEMY_DARK_RED)).toBe(true);
    expect(colors(damaged).has(COLOR.EXPLOSION_RED_ORANGE)).toBe(true);
    // Wreck: black hole in the seat, barrel snapped well short of the muzzle.
    expect(wrecked[11]![14]).toBe(COLOR.BLACK);
    expect(wrecked.slice(25).every((row) => row.every((v) => v < 0))).toBe(true);
    expect(colors(wrecked).has(COLOR.PLAYER_CYAN)).toBe(false);
    expect(colors(wrecked).has(COLOR.EXPLOSION_ORANGE_YELLOW)).toBe(false);
  });

  it('rings the active pod in yellow just outside its outline, strips included', () => {
    const active = buildFurnacePod('active');
    const mark = buildFurnacePodMark();
    const lit = mark.flatMap((row, y) => row.flatMap((v, x) => (v >= 0 ? [{ x, y, v }] : [])));
    expect(lit.length).toBeGreaterThan(60);
    expect(new Set(lit.map((c) => c.v))).toEqual(
      new Set([COLOR.EXPLOSION_YELLOW, COLOR.EXPLOSION_ORANGE_YELLOW])
    );
    // The inner ring touches the black outline on every side of the silhouette.
    const yellow = lit.filter((c) => c.v === COLOR.EXPLOSION_YELLOW);
    for (const c of yellow) {
      if (active[c.y]![c.x]! >= 0) continue;
      const near = [
        [c.x + 1, c.y],
        [c.x - 1, c.y],
        [c.x, c.y + 1],
        [c.x, c.y - 1],
      ].some(([x, y]) => active[y!]?.[x!] === COLOR.BLACK);
      expect(near, `ring at ${c.x},${c.y}`).toBe(true);
    }
    // Ring cells sit on transparent pod cells, apart from the two side strips.
    const onPod = lit.filter((c) => active[c.y]![c.x]! >= 0);
    expect(onPod.map((c) => [c.x, c.y])).toEqual(
      [9, 10, 11, 12, 13]
        .flatMap((y) => [
          [6, y],
          [21, y],
        ])
        .sort((a, b) => a[1]! - b[1]! || a[0]! - b[0]!)
    );
  });

  it('bakes the stage 3 enemies at their table size', () => {
    expectCleanGrid(buildEnemyArt('parked_fighter').pixels, 32, 32, 'parked_fighter');
    expect(buildEnemyArt('parked_fighter').nozzles).toEqual([]);
    expectCleanGrid(buildEnemyArt('strike').pixels, 40, 36, 'strike');
    expect(buildEnemyArt('strike').nozzles.length).toBe(2);
  });

  it('runs the real boot bake (every boss, enemy, tile, and map raster) without throwing', () => {
    expect(Object.keys(BOSS_ART)).toContain('furnace');
    const bosses = createBossAssets();
    expect(Object.keys(bosses.furnace!.parts).sort()).toEqual([
      'core',
      'petal',
      'pod',
      'podActive',
      'podMark',
      'podWrecked',
    ]);
    expect(bosses.furnace!.hull.width).toBe(FURNACE_HULL_W);
    expect(() => createGameAssets()).not.toThrow();
  });

  it('draws 炉心 through enter, pods, iris, and death without throwing', () => {
    const bosses = createBossAssets();
    const ctx = fakeContext();
    const draw = { drawImage: () => undefined };
    const around = { playerX: 180, playerY: 560, rng: createRng(5) };
    const boss = createBoss(prepareBossConfig(FURNACE, 'hard'), { gates: ['hard'] });
    const frame = (t: number) => drawBossWorld(ctx, draw, boss, bosses, t);
    let t = 0;
    const run = (seconds: number, shoot = false) => {
      for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
        if (shoot && furnaceCoreExposed(boss)) {
          const core = bossPart(boss, 'core')!;
          resolveBossBullet(boss, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, 40);
        }
        updateBoss(boss, FIXED_DT, around);
        t += FIXED_DT;
        expect(() => frame(t)).not.toThrow();
      }
    };
    run(FURNACE_ENTER_DURATION + 0.5);
    for (const id of FURNACE_POD_IDS) {
      const pod = bossPart(boss, id)!;
      resolveBossBullet(boss, { x: pod.worldX, y: pod.worldY, w: 4, h: 12 }, pod.maxHp * 0.6);
    }
    run(1.5);
    const first = bossPart(boss, FURNACE_POD_IDS[0])!;
    resolveBossBullet(boss, { x: first.worldX, y: first.worldY, w: 4, h: 12 }, 100000);
    run(1);
    for (const id of FURNACE_POD_IDS) {
      const pod = bossPart(boss, id)!;
      if (pod.alive) resolveBossBullet(boss, { x: pod.worldX, y: pod.worldY, w: 4, h: 12 }, 100000);
    }
    run(12, true);
    run(12, true);
    expect(['death', 'clear', 'done']).toContain(boss.stage);
  });
});
