import { describe, expect, it } from 'vitest';
import {
  LOGICAL_H,
  LOGICAL_W,
  PLANET_LARGE_CLIP,
  PLANET_LARGE_RADIUS,
  PLANET_PARALLAX_LARGE,
  PLANET_PARALLAX_SMALL,
  STAR_SCROLL_SPEEDS,
} from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import type { SpriteData } from './types';
import {
  PLANET_LAYOUT,
  SMALL_PLANET_RADII,
  SMALL_PLANET_RAMPS,
  diskCapFraction,
  largePlanetPixels,
  smallPlanetPixels,
} from './planets';

const BULLETS = new Set<number>([
  COLOR.BULLET_MAGENTA,
  COLOR.BULLET_PINK,
  COLOR.BULLET_DARK,
  COLOR.BULLET_CORE,
]);

const GAS = new Set<number>([
  COLOR.WATER_DEEP,
  COLOR.WATER_OCEAN,
  COLOR.WATER_MEDIUM,
  COLOR.WATER_SHALLOW,
  COLOR.WATER_FOAM,
  COLOR.SHADOW,
]);

function opaque(grid: SpriteData): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell >= 0) n++;
  return n;
}

function colorsOf(grid: SpriteData): Set<number> {
  const used = new Set<number>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell < 0) continue;
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(PALETTE.length);
      expect(BULLETS.has(cell)).toBe(false);
      used.add(cell);
    }
  }
  return used;
}

describe('宇宙A planets', () => {
  it('keeps about a third of the large planet on screen', () => {
    const fraction = diskCapFraction(PLANET_LARGE_CLIP);
    expect(fraction).toBeGreaterThan(0.3);
    expect(fraction).toBeLessThan(0.36);
    const grid = largePlanetPixels();
    const width = grid[0]?.length ?? 0;
    const height = grid.length;
    expect(width).toBeGreaterThan(PLANET_LARGE_RADIUS * 0.5);
    expect(width).toBeLessThan(LOGICAL_W * 0.45);
    expect(width).toBeLessThan(PLANET_LARGE_RADIUS);
    expect(height).toBeGreaterThan(PLANET_LARGE_RADIUS * 1.8);
    const painted = opaque(grid) / (Math.PI * PLANET_LARGE_RADIUS * PLANET_LARGE_RADIUS);
    expect(Math.abs(painted - fraction)).toBeLessThan(0.04);
    const left = grid.filter((row) => (row[0] ?? -1) >= 0).length / height;
    expect(left).toBeGreaterThan(0.6);
    const right = grid.filter((row) => (row[width - 1] ?? -1) >= 0).length;
    expect(right).toBeLessThan(12);
    const used = colorsOf(grid);
    for (const color of used) expect(GAS.has(color)).toBe(true);
    expect(used.size).toBeGreaterThanOrEqual(3);
    expect(used.has(COLOR.WATER_FOAM) || used.has(COLOR.WATER_SHALLOW)).toBe(true);
  });

  it('draws the small planets as whole disks in three colours', () => {
    const grids = smallPlanetPixels();
    expect(grids).toHaveLength(SMALL_PLANET_RADII.length);
    const centers: number[] = [];
    grids.forEach((grid, i) => {
      const radius = SMALL_PLANET_RADII[i]!;
      const ramp = new Set<number>(SMALL_PLANET_RAMPS[i]);
      const width = grid[0]?.length ?? 0;
      expect(width).toBeLessThan(40);
      expect(grid.length).toBeLessThan(40);
      expect(width).toBeGreaterThan(radius);
      expect(opaque(grid) / (Math.PI * radius * radius)).toBeGreaterThan(0.9);
      expect(grid[0]?.[0]).toBe(-1);
      expect(grid[0]?.[width - 1]).toBe(-1);
      for (const color of colorsOf(grid)) expect(ramp.has(color)).toBe(true);
      const mid = grid[Math.floor(grid.length / 2)]?.[Math.floor(width / 2)] ?? -1;
      centers.push(mid);
    });
    expect(new Set(centers).size).toBe(centers.length);
  });

  it('scrolls planets slower than the near stars, large slower than small', () => {
    const far = STAR_SCROLL_SPEEDS[0];
    const near = STAR_SCROLL_SPEEDS[2];
    expect(PLANET_PARALLAX_LARGE * far).toBeLessThan(PLANET_PARALLAX_SMALL * far);
    expect(PLANET_PARALLAX_SMALL).toBeLessThan(1);
    expect(PLANET_PARALLAX_SMALL * far).toBeLessThan(near);
    const pixels = [largePlanetPixels(), ...smallPlanetPixels()];
    const large = PLANET_LAYOUT.filter((item) => item.role === 'large');
    const small = PLANET_LAYOUT.filter((item) => item.role === 'small');
    expect(large).toHaveLength(1);
    expect(small.length).toBeGreaterThanOrEqual(2);
    for (const item of PLANET_LAYOUT) {
      const sprite = pixels[item.sprite];
      expect(sprite).toBeDefined();
      const w = sprite?.[0]?.length ?? 0;
      const h = sprite?.length ?? 0;
      if (item.role === 'large') {
        expect(item.x).toBe(0);
        expect(item.parallax).toBe(PLANET_PARALLAX_LARGE);
      } else {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x + w).toBeLessThanOrEqual(LOGICAL_W);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.y + h).toBeLessThan(LOGICAL_H);
        expect(item.parallax).toBe(PLANET_PARALLAX_SMALL);
      }
      expect(item.span).toBeGreaterThan(LOGICAL_H);
    }
  });
});
