import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import type { SpriteData } from './types';
import {
  ITEM_PIXELS,
  ITEM_SPRITE_H,
  ITEM_SPRITE_W,
  bombEnergyPixels,
  homingEnergyPixels,
  mateEnergyPixels,
  missileEnergyPixels,
} from './itemSprite';
import { ITEM_DEFS } from '@/game/entities/item';

const bomb = bombEnergyPixels();
const bombFlash = bombEnergyPixels(true);
const missile = missileEnergyPixels();
const missileFlash = missileEnergyPixels(true);
const homing = homingEnergyPixels();
const homingFlash = homingEnergyPixels(true);

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

describe('T homing capsule', () => {
  it('has a sprite pair for every item letter', () => {
    expect(new Set(Object.keys(ITEM_PIXELS))).toEqual(new Set(Object.keys(ITEM_DEFS)));
    expect(ITEM_PIXELS.T.idle).toBe(homing);
    expect(ITEM_PIXELS.T.flash).toBe(homingFlash);
  });

  it('fits the item grid with palette colors and flashes in place', () => {
    for (const grid of [homing, homingFlash]) {
      expect(grid).toHaveLength(ITEM_SPRITE_H);
      for (const row of grid) {
        expect(row).toHaveLength(ITEM_SPRITE_W);
        for (const cell of row) {
          expect(cell === -1 || (Number.isInteger(cell) && cell < PALETTE.length)).toBe(true);
        }
      }
    }
    expect(mask(homingFlash)).toEqual(mask(homing));
  });

  it('is a symmetric straight-sided capsule, not the octagon or the missile', () => {
    for (const row of homing) {
      const bits = row.map((cell) => cell >= 0);
      expect(bits).toEqual([...bits].reverse());
    }
    // Straight sides: every body row from 2 to 15 is the same width.
    for (let y = 2; y <= 15; y++) expect(opaqueRun(homing[y]!)).toBe(12);
    // Round ends, no spark or flame.
    expect(opaqueRun(homing[0]!)).toBeLessThan(opaqueRun(homing[1]!));
    expect(opaqueRun(homing[17]!)).toBeLessThan(opaqueRun(homing[16]!));
    expect(mask(homing)).not.toEqual(mask(bomb));
    expect(mask(homing)).not.toEqual(mask(missile));
  });

  it('draws a readable white T', () => {
    for (let y = 3; y <= 4; y++) {
      for (let x = 5; x <= 10; x++) expect(homing[y]![x]).toBe(COLOR.WHITE);
      expect(homing[y]![4]).not.toBe(COLOR.WHITE);
      expect(homing[y]![11]).not.toBe(COLOR.WHITE);
    }
    for (let y = 5; y <= 12; y++) {
      expect(homing[y]![7]).toBe(COLOR.WHITE);
      expect(homing[y]![8]).toBe(COLOR.WHITE);
      expect(homing[y]![5]).not.toBe(COLOR.WHITE);
      expect(homing[y]![10]).not.toBe(COLOR.WHITE);
    }
  });

  it('reads teal: cyan body with a green rim, no gold', () => {
    const cyan = new Set<number>([COLOR.PLAYER_MED_CYAN, COLOR.PLAYER_DARK_CYAN]);
    const green = new Set<number>([COLOR.TERRAIN_LIGHT_GRASS]);
    const gold = new Set<number>([
      COLOR.EXPLOSION_YELLOW,
      COLOR.EXPLOSION_ORANGE_YELLOW,
      COLOR.EXPLOSION_ORANGE,
    ]);
    expect(countColor(homing, cyan)).toBeGreaterThan(60);
    expect(countColor(homing, green)).toBeGreaterThan(10);
    expect(countColor(homing, gold)).toBe(0);
    expect(countColor(bomb, green)).toBe(0);
  });
});

describe('M wingman badge', () => {
  const mate = mateEnergyPixels();
  const mateFlash = mateEnergyPixels(true);

  it('fits the item grid, stays on the palette, and flashes in place', () => {
    expect(ITEM_PIXELS.M.idle).toBe(mate);
    expect(ITEM_PIXELS.M.flash).toBe(mateFlash);
    for (const grid of [mate, mateFlash]) {
      expect(grid).toHaveLength(ITEM_SPRITE_H);
      for (const row of grid) {
        expect(row).toHaveLength(ITEM_SPRITE_W);
        for (const cell of row) {
          expect(
            cell === -1 || (Number.isInteger(cell) && cell >= 0 && cell < PALETTE.length)
          ).toBe(true);
        }
      }
    }
    expect(mask(mateFlash)).toEqual(mask(mate));
    for (const y of [7, 8, 10, 12]) {
      expect(mateFlash[y]![5]).toBe(COLOR.WHITE);
      expect(mateFlash[y]![10]).toBe(COLOR.WHITE);
    }
  });

  it('is a symmetric winged shield, not the missile, octagon, or capsule', () => {
    for (const row of mate) {
      const bits = row.map((cell) => cell >= 0);
      expect(bits).toEqual([...bits].reverse());
    }
    expect(opaqueRun(mate[2]!)).toBe(6);
    expect(opaqueRun(mate[7]!)).toBe(16);
    expect(opaqueRun(mate[14]!)).toBe(4);
    expect(opaqueRun(mate[7]!)).toBeGreaterThan(opaqueRun(mate[2]!));
    expect(mask(mate)).not.toEqual(mask(bomb));
    expect(mask(mate)).not.toEqual(mask(missile));
    expect(mask(mate)).not.toEqual(mask(homing));
    // The missile's fins leave a hole. The wing row is solid.
    expect(mate[7]!.every((cell) => cell >= 0)).toBe(true);
  });

  it('draws a white M on a teal body with gold wings', () => {
    for (const y of [7, 8]) {
      expect(mate[y]![5]).toBe(COLOR.WHITE);
      expect(mate[y]![6]).toBe(COLOR.WHITE);
      expect(mate[y]![7]).not.toBe(COLOR.WHITE);
      expect(mate[y]![8]).not.toBe(COLOR.WHITE);
      expect(mate[y]![9]).toBe(COLOR.WHITE);
      expect(mate[y]![10]).toBe(COLOR.WHITE);
    }
    expect(mate[9]![5]).toBe(COLOR.WHITE);
    expect(mate[9]![6]).not.toBe(COLOR.WHITE);
    expect(mate[9]![7]).toBe(COLOR.WHITE);
    expect(mate[9]![8]).toBe(COLOR.WHITE);
    expect(mate[9]![9]).not.toBe(COLOR.WHITE);
    expect(mate[9]![10]).toBe(COLOR.WHITE);
    for (const y of [10, 11, 12]) {
      expect(mate[y]![5]).toBe(COLOR.WHITE);
      expect(mate[y]![10]).toBe(COLOR.WHITE);
      expect(mate[y]![7]).not.toBe(COLOR.WHITE);
      expect(mate[y]![8]).not.toBe(COLOR.WHITE);
    }

    const teal = new Set<number>([COLOR.PLAYER_CYAN, COLOR.TERRAIN_LIGHT_GRASS]);
    const gold = new Set<number>([COLOR.EXPLOSION_YELLOW, COLOR.EXPLOSION_ORANGE]);
    expect(countColor(mate, teal)).toBeGreaterThan(20);
    expect(countColor(mate, gold)).toBeGreaterThan(10);
    expect(mate[7]![0]).toBe(COLOR.EXPLOSION_ORANGE);
    expect(mate[7]![1]).toBe(COLOR.EXPLOSION_YELLOW);
  });
});
