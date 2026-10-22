/**
 * 宇宙A planets (P15), drawn behind the existing starfield.
 *
 * The large body is a banded gas giant baked once. Its center sits past the
 * left edge (`PLANET_LARGE_CLIP` radii), so about a third of the disk is on
 * screen and the rest is the off-screen arc. Three small disks sit further
 * away: a grey moon, a tan world, and an olive one.
 *
 * Both layers scroll with the far star accumulator, slower than every star
 * layer. The large limb is slower than the small disks. Nothing here redraws
 * a gradient per frame.
 */

import {
  LOGICAL_H,
  PLANET_LARGE_CLIP,
  PLANET_LARGE_RADIUS,
  PLANET_PARALLAX_LARGE,
  PLANET_PARALLAX_SMALL,
} from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid } from './pixelDraw';
import { renderSprite } from './spriteRenderer';
import type { SpriteData, SpriteFrame } from './types';

const GAS_BANDS = [
  COLOR.WATER_DEEP,
  COLOR.WATER_OCEAN,
  COLOR.WATER_MEDIUM,
  COLOR.WATER_OCEAN,
  COLOR.WATER_DEEP,
  COLOR.WATER_SHALLOW,
  COLOR.WATER_OCEAN,
] as const;

/**
 * Fraction of a unit disk on the side x >= `edge` (edge is in radii).
 * 0 shows half the disk. 1 shows none. ~0.27 shows about a third.
 */
export function diskCapFraction(edge: number): number {
  const x = Math.max(-1, Math.min(1, edge));
  return (Math.acos(x) - x * Math.sqrt(Math.max(0, 1 - x * x))) / Math.PI;
}

function gasColor(nx: number, ny: number, r2: number): number {
  // Light from the right, so the on-screen limb (positive nx) is the day side.
  const lit = 0.78 * nx - 0.42 * ny;
  const bandT = (ny + 1) * 0.5;
  const idx = Math.min(GAS_BANDS.length - 1, Math.max(0, Math.floor(bandT * GAS_BANDS.length)));
  const band = GAS_BANDS[idx] ?? COLOR.WATER_OCEAN;
  if (r2 > 0.9 && lit > 0.35) return COLOR.WATER_FOAM;
  if (lit > 0.55) return band === COLOR.WATER_DEEP ? COLOR.WATER_OCEAN : COLOR.WATER_SHALLOW;
  if (lit > 0.12) return band;
  if (lit > -0.15) return COLOR.WATER_DEEP;
  return COLOR.SHADOW;
}

function rasterDisk(
  radius: number,
  clipAt: number | null,
  colorAt: (nx: number, ny: number, r2: number) => number
): SpriteData {
  const x0 = clipAt === null ? Math.floor(-radius) : Math.floor(clipAt);
  const x1 = Math.ceil(radius);
  const y0 = Math.floor(-radius);
  const y1 = Math.ceil(radius);
  const grid = createGrid(x1 - x0 + 1, y1 - y0 + 1, -1);
  for (let py = 0; py < grid.length; py++) {
    const row = grid[py];
    if (!row) continue;
    for (let px = 0; px < row.length; px++) {
      const x = x0 + px + 0.5;
      const y = y0 + py + 0.5;
      const nx = x / radius;
      const ny = y / radius;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      row[px] = colorAt(nx, ny, r2);
    }
  }
  return grid;
}

/** The on-screen cap of the large planet. Left edge of the sprite is the screen edge. */
export function largePlanetPixels(): SpriteData {
  return rasterDisk(PLANET_LARGE_RADIUS, PLANET_LARGE_CLIP * PLANET_LARGE_RADIUS, gasColor);
}

export const SMALL_PLANET_RADII = [8, 12, 9] as const;

/** Grey moon, tan world, olive world. Each ramp is highlight, mid, shade, limb. */
export const SMALL_PLANET_RAMPS = [
  [COLOR.PALE_GRAY, COLOR.LIGHT_GRAY, COLOR.GRAY, COLOR.DARK_GRAY],
  [COLOR.GROUND_TAN, COLOR.TERRAIN_LIGHT_BROWN, COLOR.TERRAIN_BROWN, COLOR.TERRAIN_DARK_BROWN],
  [COLOR.GROUND_LIGHT_OLIVE, COLOR.GROUND_MED_OLIVE, COLOR.GROUND_OLIVE, COLOR.GROUND_DARK_OLIVE],
] as const;

function smallColor(nx: number, ny: number, r2: number, ramp: readonly number[]): number {
  const lit = -0.7 * nx - 0.5 * ny;
  const hi = ramp[0] ?? COLOR.PALE_GRAY;
  const mid = ramp[1] ?? COLOR.LIGHT_GRAY;
  const shade = ramp[2] ?? COLOR.GRAY;
  const edge = ramp[3] ?? COLOR.DARK_GRAY;
  if (r2 > 0.82) return lit > 0.2 ? hi : edge;
  if (lit > 0.35) return hi;
  if (lit > -0.05) return mid;
  if (lit > -0.4) return shade;
  return edge;
}

export function smallPlanetPixels(): SpriteData[] {
  return SMALL_PLANET_RADII.map((radius, i) => {
    const ramp = SMALL_PLANET_RAMPS[i] ?? SMALL_PLANET_RAMPS[0];
    return rasterDisk(radius, null, (nx, ny, r2) => smallColor(nx, ny, r2, ramp));
  });
}

export interface PlanetLayout {
  role: 'large' | 'small';
  /** Index into `[large, ...small]`. */
  sprite: number;
  x: number;
  y: number;
  parallax: number;
  span: number;
}

/**
 * Tops at scroll 0. The large limb starts on the left and drifts slowly.
 * Small disks start in the open sky and on the lower field so a map preview
 * shows them before they wrap.
 */
export const PLANET_LAYOUT: readonly PlanetLayout[] = [
  {
    role: 'large',
    sprite: 0,
    x: 0,
    y: 48,
    parallax: PLANET_PARALLAX_LARGE,
    span: LOGICAL_H * 2 + 480,
  },
  {
    role: 'small',
    sprite: 1,
    x: 200,
    y: 72,
    parallax: PLANET_PARALLAX_SMALL,
    span: LOGICAL_H + 120,
  },
  {
    role: 'small',
    sprite: 2,
    x: 250,
    y: 280,
    parallax: PLANET_PARALLAX_SMALL,
    span: LOGICAL_H + 120,
  },
  {
    role: 'small',
    sprite: 3,
    x: 86,
    y: 430,
    parallax: PLANET_PARALLAX_SMALL,
    span: LOGICAL_H + 120,
  },
];

export interface BakedPlanet {
  frame: SpriteFrame;
  role: PlanetLayout['role'];
  x: number;
  y: number;
  parallax: number;
  span: number;
}

export function createPlanetLayer(): BakedPlanet[] {
  const pixels = [largePlanetPixels(), ...smallPlanetPixels()];
  return PLANET_LAYOUT.map((item) => {
    const data = pixels[item.sprite];
    if (!data) throw new Error(`planet sprite ${item.sprite} missing`);
    return {
      frame: renderSprite(data, 0, 0),
      role: item.role,
      x: item.x,
      y: item.y,
      parallax: item.parallax,
      span: item.span,
    };
  });
}

/**
 * Blit planets. `farScroll` is star layer 0. Caller sets `globalAlpha`.
 * Planets are behind the star points.
 */
export function drawPlanets(
  ctx: CanvasRenderingContext2D,
  planets: readonly BakedPlanet[],
  farScroll: number
): void {
  for (const planet of planets) {
    let y = (planet.y + farScroll * planet.parallax) % planet.span;
    if (y < 0) y += planet.span;
    ctx.drawImage(planet.frame.canvas, planet.x, Math.round(y));
  }
}
