import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import type { SpriteData } from './types';
import { ITEM_SPRITE_H, ITEM_SPRITE_W, bombEnergyPixels, missileEnergyPixels } from './itemSprite';

const bomb = bombEnergyPixels();
const bombFlash = bombEnergyPixels(true);
const missile = missileEnergyPixels();
const missileFlash = missileEnergyPixels(true);

function opaqueRun(row: readonly number[]): number {
  let n = 0;
  for (const cell of row) if (cell >= 0) n++;
  return n;
}

function mask(grid: SpriteData): boolean[][] {
  return grid.map((row) => row.map((cell) => cell >= 0));
}

function countColor(grid: SpriteData, colors: ReadonlySet<number>): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (colors.has(cell)) n++;
  return n;
}

describe('bomb and missile energy icons', () => {
  it('keeps the 16px item width and adds 2px of height for the letter', () => {
    for (const grid of [bomb, bombFlash, missile, missileFlash]) {
      expect(grid).toHaveLength(ITEM_SPRITE_H);
      expect(ITEM_SPRITE_H).toBe(18);
      expect(ITEM_SPRITE_W).toBe(16);
      for (const row of grid) expect(row).toHaveLength(ITEM_SPRITE_W);
    }
  });

  it('uses only locked palette indices', () => {
    for (const grid of [bomb, bombFlash, missile, missileFlash]) {
      for (const row of grid) {
        for (const cell of row) {
          expect(
            cell === -1 || (Number.isInteger(cell) && cell >= 0 && cell < PALETTE.length)
          ).toBe(true);
        }
      }
    }
  });

  it('flashes in place without changing the silhouette', () => {
    expect(mask(bombFlash)).toEqual(mask(bomb));
    expect(mask(missileFlash)).toEqual(mask(missile));
  });

  it('draws a symmetric octagon bomb with a readable B', () => {
    for (const row of bomb) {
      const bits = row.map((cell) => cell >= 0);
      expect(bits).toEqual([...bits].reverse());
    }
    // Top of the badge is narrower than the waist: octagon, not a capsule.
    expect(opaqueRun(bomb[3]!)).toBeLessThan(opaqueRun(bomb[8]!));
    expect(opaqueRun(bomb[17]!)).toBeLessThan(opaqueRun(bomb[8]!));
    // Spark sits above the badge.
    expect(opaqueRun(bomb[0]!)).toBeGreaterThan(0);
    expect(opaqueRun(bomb[0]!)).toBeLessThan(opaqueRun(bomb[3]!));

    // Letter B, rows 6–12, columns 5–10. Bars are white; counters are not.
    for (const y of [6, 9, 12]) {
      for (let x = 5; x <= 10; x++) expect(bomb[y]![x]).toBe(COLOR.WHITE);
    }
    for (const y of [7, 8, 10, 11]) {
      expect(bomb[y]![5]).toBe(COLOR.WHITE);
      expect(bomb[y]![6]).toBe(COLOR.WHITE);
      expect(bomb[y]![7]).not.toBe(COLOR.WHITE);
      expect(bomb[y]![8]).not.toBe(COLOR.WHITE);
      expect(bomb[y]![9]).toBe(COLOR.WHITE);
      expect(bomb[y]![10]).toBe(COLOR.WHITE);
    }
    // Chamfer is long enough that the badge is not a capsule.
    expect(opaqueRun(bomb[5]!)).toBeLessThan(opaqueRun(bomb[8]!));
    expect(opaqueRun(bomb[8]!) - opaqueRun(bomb[3]!)).toBeGreaterThanOrEqual(8);
  });

  it('draws a symmetric finned missile with a readable M', () => {
    for (const row of missile) {
      const bits = row.map((cell) => cell >= 0);
      expect(bits).toEqual([...bits].reverse());
    }
    // Nose is narrower than the fuselage.
    expect(opaqueRun(missile[0]!)).toBeLessThan(opaqueRun(missile[6]!));
    // Side fins leave a gap between the tip and the body.
    expect(missile[14]![0]).toBeGreaterThanOrEqual(0);
    expect(missile[14]![1]).toBe(COLOR.EXPLOSION_ORANGE);
    expect(missile[14]![2]).toBeLessThan(0);
    expect(missile[14]![3]).toBeGreaterThanOrEqual(0);
    // Flame under the nozzle.
    expect(opaqueRun(missile[17]!)).toBeGreaterThan(0);
    expect(opaqueRun(missile[17]!)).toBeLessThan(opaqueRun(missile[6]!));

    // Letter M on the fuselage. Peaks are white; the center gap is gold.
    expect(missile[6]![4]).toBe(COLOR.WHITE);
    expect(missile[6]![5]).toBe(COLOR.WHITE);
    expect(missile[6]![7]).not.toBe(COLOR.WHITE);
    expect(missile[6]![8]).not.toBe(COLOR.WHITE);
    expect(missile[6]![10]).toBe(COLOR.WHITE);
    expect(missile[6]![11]).toBe(COLOR.WHITE);
    // Middle stroke of the M.
    expect(missile[8]![7]).toBe(COLOR.WHITE);
    expect(missile[8]![8]).toBe(COLOR.WHITE);
    expect(missile[8]![6]).not.toBe(COLOR.WHITE);
    expect(missile[8]![9]).not.toBe(COLOR.WHITE);
  });

  it('keeps bomb in steel blue and missile in gold', () => {
    const steel = new Set<number>([
      COLOR.PLAYER_CYAN,
      COLOR.PLAYER_MED_CYAN,
      COLOR.PLAYER_PALE_CYAN,
      COLOR.PLAYER_DARK_CYAN,
      COLOR.WATER_SHALLOW,
      COLOR.WATER_MEDIUM,
      COLOR.WATER_OCEAN,
      COLOR.WATER_DEEP,
    ]);
    const gold = new Set<number>([
      COLOR.EXPLOSION_YELLOW,
      COLOR.EXPLOSION_ORANGE_YELLOW,
      COLOR.EXPLOSION_ORANGE,
    ]);
    expect(countColor(bomb, steel)).toBeGreaterThan(countColor(bomb, gold));
    expect(countColor(missile, gold)).toBeGreaterThan(countColor(missile, steel));
    expect(countColor(missile, new Set([COLOR.BULLET_DARK]))).toBeGreaterThan(8);
    expect(mask(bomb)).not.toEqual(mask(missile));
  });
});
