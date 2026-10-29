import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import type { BuildingType } from '@/game/levels/types';
import { buildingSize } from '@/game/entities/building';
import { buildBuildingArt } from './buildingSprite';
import type { SpriteData } from './types';

const TYPES: BuildingType[] = ['pillbox', 'fuel_depot', 'radar_station', 'sea_gun', 'cruiser_gun'];
const FOAM = new Set<number>([COLOR.WATER_FOAM, COLOR.WATER_SHALLOW]);

/** Solid pixels touching transparency or foam, matching the rim rule. */
function boundary(g: SpriteData): number[] {
  const h = g.length;
  const w = g[0]!.length;
  const open = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h || g[y]![x]! < 0 || FOAM.has(g[y]![x]!);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (open(x, y)) continue;
      if (open(x + 1, y) || open(x - 1, y) || open(x, y + 1) || open(x, y - 1)) out.push(g[y]![x]!);
    }
  }
  return out;
}

describe('building sprites', () => {
  it('match the documented sizes and footprints', () => {
    const want: Record<BuildingType, [number, number]> = {
      pillbox: [32, 32],
      fuel_depot: [48, 32],
      radar_station: [32, 32],
      sea_gun: [32, 32],
      cruiser_gun: [32, 32],
    };
    for (const type of TYPES) {
      const { intact, wreck } = buildBuildingArt(type);
      const size = buildingSize(type);
      for (const g of [intact, wreck]) {
        expect(g[0]!.length).toBe(want[type][0]);
        expect(g.length).toBe(want[type][1]);
        expect(g[0]!.length).toBe(size.width);
        expect(g.length).toBe(size.height);
      }
    }
  });

  it('use palette indices only', () => {
    for (const type of TYPES) {
      const { intact, wreck } = buildBuildingArt(type);
      for (const g of [intact, wreck]) {
        for (const row of g) {
          for (const c of row) {
            expect(Number.isInteger(c)).toBe(true);
            expect(c).toBeGreaterThanOrEqual(-1);
            expect(c).toBeLessThan(PALETTE.length);
          }
        }
      }
    }
  });

  it('outline intact frames in red and wrecks in black', () => {
    for (const type of TYPES) {
      const { intact, wreck } = buildBuildingArt(type);
      const rimIntact = boundary(intact);
      const rimWreck = boundary(wreck);
      expect(rimIntact.length).toBeGreaterThan(40);
      expect(rimIntact.every((c) => c === COLOR.ENEMY_RED)).toBe(true);
      expect(rimWreck.every((c) => c === COLOR.BLACK)).toBe(true);
    }
  });

  it('gives each wreck different pixels from its intact frame', () => {
    for (const type of TYPES) {
      const { intact, wreck } = buildBuildingArt(type);
      let diff = 0;
      intact.forEach((row, y) => row.forEach((c, x) => (diff += c === wreck[y]![x] ? 0 : 1)));
      expect(diff).toBeGreaterThan(100);
    }
  });

  it('keeps the sea gun wake ring', () => {
    const { intact } = buildBuildingArt('sea_gun');
    const foam = intact.flat().filter((c) => c === COLOR.WATER_FOAM).length;
    expect(foam).toBeGreaterThan(30);
  });

  it('bakes the same art every time', () => {
    for (const type of TYPES) {
      expect(buildBuildingArt(type)).toEqual(buildBuildingArt(type));
    }
  });
});
