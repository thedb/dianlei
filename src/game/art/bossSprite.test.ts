import { describe, expect, it } from 'vitest';
import { BOSS_HULL_H, BOSS_HULL_W, BOSS_TURRET_SIZE, PALETTE_SIZE } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import { opaqueCount } from './pixelDraw';
import { buildBossHull, buildBossTurret, tiebaoTailLampsFlash } from './bossSprite';

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
  it('draws no second pair unless the ram warn is on a bright frame', () => {
    expect(tiebaoTailLampsFlash(false, 0)).toBe(false);
    expect(tiebaoTailLampsFlash(false, 0.2)).toBe(false);
    expect(tiebaoTailLampsFlash(true, 0)).toBe(true);
    expect(tiebaoTailLampsFlash(true, 1 / 16)).toBe(false);
    expect(tiebaoTailLampsFlash(true, 2 / 16)).toBe(true);
  });
});
