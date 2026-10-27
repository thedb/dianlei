import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/engine/rng';
import { FIXED_DT, FURNACE_ENTER_DURATION, FURNACE_HULL_H, FURNACE_HULL_W } from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { FURNACE } from '@/game/levels/bosses/furnace';
import { PALETTE } from '@/game/palette';
import { bossPart, createBoss, resolveBossBullet, updateBoss } from '@/game/systems/boss';
import { FURNACE_POD_IDS, furnaceCoreExposed } from '@/game/systems/furnace';
import { BOSS_ART, createBossAssets, drawBossWorld } from './bossSprite';
import { buildEnemyArt } from './enemySprite';
import {
  buildFurnaceChassis,
  buildFurnaceCore,
  buildFurnacePetal,
  buildFurnacePod,
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
    expectCleanGrid(buildFurnacePod(false), 28, 28, 'pod');
    expectCleanGrid(buildFurnacePod(true), 28, 28, 'pod broken');
    expectCleanGrid(buildFurnacePetal(), 24, 24, 'petal');
    expectCleanGrid(buildFurnaceCore(), 32, 32, 'core');
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
      'podBroken',
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
      resolveBossBullet(boss, { x: pod.worldX, y: pod.worldY, w: 4, h: 12 }, 100000);
    }
    run(12, true);
    run(12, true);
    expect(['death', 'clear', 'done']).toContain(boss.stage);
  });
});
