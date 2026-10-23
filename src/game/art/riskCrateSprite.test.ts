import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import { RISK_CRATE_SIZE } from '@/game/config';
import type { SpriteData } from './types';
import { riskCrateDiscPixels, riskCrateShieldPixels } from './riskCrateSprite';

const intact = riskCrateDiscPixels(false);
const wreck = riskCrateDiscPixels(true);
const shield = riskCrateShieldPixels();

const CYAN = new Set<number>([
  COLOR.PLAYER_PALE_CYAN,
  COLOR.PLAYER_CYAN,
  COLOR.PLAYER_MED_CYAN,
  COLOR.PLAYER_DARK_CYAN,
]);
const MAGENTA = new Set<number>([
  COLOR.BULLET_MAGENTA,
  COLOR.BULLET_PINK,
  COLOR.BULLET_DARK,
  COLOR.BULLET_CORE,
]);
const GREY = new Set<number>([COLOR.MEDIUM_GRAY, COLOR.GRAY, COLOR.LIGHT_GRAY, COLOR.PALE_GRAY]);

function count(grid: SpriteData, colors: ReadonlySet<number>): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (colors.has(cell)) n++;
  return n;
}

function bounds(grid: SpriteData): { w: number; h: number } {
  let minX = grid[0]!.length;
  let maxX = -1;
  let minY = grid.length;
  let maxY = -1;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      if (grid[y]![x]! < 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1 };
}

function symmetric(grid: SpriteData): boolean {
  const w = grid[0]!.length;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y]![x] !== grid[y]![w - 1 - x]) return false;
    }
  }
  return true;
}

describe('risk crate sprite', () => {
  it('is a 28px flat disc with the locked UFO colors', () => {
    for (const grid of [intact, wreck, shield]) {
      expect(grid).toHaveLength(RISK_CRATE_SIZE);
      for (const row of grid) {
        expect(row).toHaveLength(RISK_CRATE_SIZE);
        for (const cell of row)
          expect(cell === -1 || (cell >= 0 && cell < PALETTE.length)).toBe(true);
      }
    }
    const box = bounds(intact);
    expect(box.w).toBeGreaterThan(box.h + 4);
    expect(count(intact, MAGENTA)).toBeGreaterThan(10);
    expect(count(intact, new Set([COLOR.EXPLOSION_YELLOW]))).toBeGreaterThan(4);
    expect(count(intact, new Set([COLOR.BLACK]))).toBeGreaterThan(4);
    expect(count(intact, CYAN)).toBeGreaterThanOrEqual(4);
    expect(count(intact, GREY)).toBeGreaterThan(30);
    expect(count(intact, new Set([COLOR.ENEMY_VIVID_RED]))).toBeGreaterThan(10);
    expect(symmetric(intact)).toBe(true);
  });

  it('wrecks the hull and drops the running lights', () => {
    expect(intact).not.toEqual(wreck);
    expect(count(wreck, CYAN)).toBe(0);
    expect(count(wreck, new Set([COLOR.BLACK]))).toBeGreaterThan(
      count(intact, new Set([COLOR.BLACK]))
    );
  });

  it('draws the shield as a cyan ring around an empty center', () => {
    expect(count(shield, CYAN)).toBeGreaterThan(20);
    for (const row of shield) {
      for (const cell of row) {
        expect(cell < 0 || CYAN.has(cell)).toBe(true);
      }
    }
    for (let y = 11; y <= 16; y++) {
      for (let x = 11; x <= 16; x++) expect(shield[y]![x]).toBe(-1);
    }
  });
});
