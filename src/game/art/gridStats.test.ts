import { describe, expect, it } from 'vitest';
import { COLOR } from '@/game/palette';
import {
  aspectIsSkewed,
  aspectSkew,
  gridColorStats,
  heightForWidth,
  paletteLuma,
  widthForHeight,
} from './gridStats';

function fill(count: number, index: number): number[] {
  return Array.from({ length: count }, () => index);
}

describe('grid color stats', () => {
  it('counts palette use, sorts by count, and ignores transparent cells', () => {
    const cells = [...fill(6, COLOR.PLAYER_CYAN), ...fill(3, COLOR.WHITE), -1, -1, COLOR.BLACK];
    const stats = gridColorStats(cells);
    expect(stats.opaque).toBe(10);
    expect(stats.transparent).toBe(2);
    expect(stats.distinct).toBe(3);
    expect(stats.uses.map((use) => use.index)).toEqual([
      COLOR.PLAYER_CYAN,
      COLOR.WHITE,
      COLOR.BLACK,
    ]);
    expect(stats.uses[0]?.share).toBeCloseTo(0.6, 6);
    expect(stats.darkShare).toBeCloseTo(0.1, 6);
    expect(stats.warnings).toEqual([]);
  });

  it('warns when the grid is almost all dark, all one bright color, or empty', () => {
    const dark = [...fill(19, COLOR.BLACK), ...fill(10, COLOR.SHADOW), COLOR.WHITE];
    expect(gridColorStats(dark).warnings).toEqual(['dark']);

    const flat = [...fill(19, COLOR.PLAYER_CYAN), COLOR.WHITE];
    expect(gridColorStats(flat).warnings).toEqual(['dominant']);

    expect(gridColorStats([-1, -1]).warnings).toEqual(['empty']);
  });

  it('keeps the sample body out of the dark warning', () => {
    const body = [...fill(70, COLOR.DARK_GRAY), ...fill(10, COLOR.PLAYER_CYAN)];
    expect(paletteLuma(COLOR.DARK_GRAY)).toBeLessThan(0.2);
    expect(gridColorStats(body).warnings).toEqual([]);
  });
});

describe('aspect checks', () => {
  it('flags the squashed practice wing and accepts a faithful target', () => {
    const squashed = aspectSkew(82, 77, 64, 30);
    expect(squashed).toBeCloseTo(2.0, 1);
    expect(aspectIsSkewed(squashed)).toBe(true);
    expect(aspectIsSkewed(aspectSkew(82, 77, 64, 60))).toBe(false);
    expect(aspectIsSkewed(aspectSkew(30, 64, 32, 32))).toBe(true);
    expect(heightForWidth(82, 77, 64)).toBe(60);
    expect(widthForHeight(82, 77, 60)).toBe(64);
    expect(() => aspectSkew(0, 1, 1, 1)).toThrow(/positive/);
  });
});
