import { describe, expect, it } from 'vitest';
import {
  BOSS_HULL_H,
  BOSS_HULL_W,
  BOSS_TURRET_SIZE,
  PALETTE_SIZE,
  TIEBAO_MINE_BLINK,
  TIEBAO_RAM_WARN,
  TIEBAO_RAM_WARN_FAST,
  TIEBAO_RAM_WARN_SLOW,
} from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import { opaqueCount } from './pixelDraw';
import {
  buildBossHull,
  buildBossTurret,
  tiebaoMineBlink,
  tiebaoTailLampsFlash,
} from './bossSprite';

function expectPalette(grid: number[][]): void {
  expect(grid.length).toBeGreaterThan(0);
  for (const row of grid) {
    for (const cell of row) {
      expect(cell === -1 || (cell >= 0 && cell < PALETTE.length && cell < PALETTE_SIZE)).toBe(true);
    }
  }
}

describe('boss sprites', () => {
  it('draws a 220×140 hull and a 40×40 turret on the locked palette', () => {
    const closed = buildBossHull(false);
    const open = buildBossHull(true);
    const turret = buildBossTurret();
    expect(closed).toHaveLength(BOSS_HULL_H);
    expect(closed[0]).toHaveLength(BOSS_HULL_W);
    expect(open).toHaveLength(BOSS_HULL_H);
    expect(turret).toHaveLength(BOSS_TURRET_SIZE);
    expect(turret[0]).toHaveLength(BOSS_TURRET_SIZE);
    expectPalette(closed);
    expectPalette(open);
    expectPalette(turret);
    expect(open).not.toEqual(closed);
  });

  it('paints gray armor and magenta energy, and opens a bright core', () => {
    const closed = buildBossHull(false);
    const open = buildBossHull(true);
    const used = new Set<number>();
    for (const row of closed) for (const cell of row) if (cell >= 0) used.add(cell);
    expect(used.has(COLOR.DARK_GRAY)).toBe(true);
    expect(used.has(COLOR.BULLET_MAGENTA)).toBe(true);
    expect(used.has(COLOR.BULLET_DARK)).toBe(true);
    expect(opaqueCount(closed)).toBeGreaterThan(4000);
    const core = open[80]?.[110];
    expect([COLOR.BULLET_CORE, COLOR.WHITE, COLOR.BULLET_PINK, COLOR.BULLET_MAGENTA]).toContain(
      core
    );
    expect(core).not.toBe(closed[80]?.[110]);
  });
});

describe('铁堡尾灯', () => {
  it('leaves the baked pair alone unless the ram warning runs', () => {
    expect(tiebaoTailLampsFlash(null)).toBeNull();
  });

  it('blinks yellow/white at 4 Hz, red/white at 8 Hz, then holds white', () => {
    expect(TIEBAO_RAM_WARN).toBe(0.9);
    expect(TIEBAO_RAM_WARN_SLOW).toBe(0.5);
    expect(TIEBAO_RAM_WARN_FAST).toBe(0.85);
    const slow: number[] = [];
    for (let t = 0; t < TIEBAO_RAM_WARN_SLOW; t += 1 / 120) slow.push(tiebaoTailLampsFlash(t)!);
    expect(new Set(slow)).toEqual(new Set([COLOR.EXPLOSION_YELLOW, COLOR.WHITE]));
    expect(tiebaoTailLampsFlash(0)).toBe(COLOR.EXPLOSION_YELLOW);
    expect(tiebaoTailLampsFlash(0.13)).toBe(COLOR.WHITE);
    expect(tiebaoTailLampsFlash(0.26)).toBe(COLOR.EXPLOSION_YELLOW);
    expect(tiebaoTailLampsFlash(0.5)).toBe(COLOR.ENEMY_BRIGHT_RED);
    expect(tiebaoTailLampsFlash(0.5 + 1 / 16 + 0.001)).toBe(COLOR.WHITE);
    expect(tiebaoTailLampsFlash(0.5 + 2 / 16 + 0.001)).toBe(COLOR.ENEMY_BRIGHT_RED);
    const changes = (from: number, to: number): number => {
      let flips = 0;
      let last = tiebaoTailLampsFlash(from);
      for (let t = from; t < to; t += 1 / 240) {
        const c = tiebaoTailLampsFlash(t);
        if (c !== last) flips++;
        last = c;
      }
      return flips;
    };
    expect(changes(0.5, 0.85)).toBeGreaterThan(changes(0, 0.35));
    for (let t = TIEBAO_RAM_WARN_FAST; t < TIEBAO_RAM_WARN; t += 0.01) {
      expect(tiebaoTailLampsFlash(t)).toBe(COLOR.WHITE);
    }
  });

  it('blinks the mine core only over the last part of the fuse', () => {
    expect(tiebaoMineBlink(1)).toBe(false);
    expect(tiebaoMineBlink(TIEBAO_MINE_BLINK + 0.01)).toBe(false);
    const late = [0.29, 0.25, 0.2, 0.15, 0.1, 0.05].map(tiebaoMineBlink);
    expect(late).toContain(true);
    expect(late).toContain(false);
  });
});
