import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import { ENEMY_STATS } from '@/game/entities/enemy';
import type { EnemyType } from '@/game/levels/types';
import { opaqueCount } from './pixelDraw';
import { buildEnemyArt } from './enemySprite';
import type { SpriteData } from './types';

const TYPES: EnemyType[] = [
  'small',
  'medium',
  'interceptor',
  'bomber',
  'drone',
  'tank',
  'turret2',
  'factory_aa',
  'missile_car',
  'risk_crate',
];

describe('enemy sprites', () => {
  it('matches the wave-table pixel size for every type', () => {
    for (const type of TYPES) {
      const art = buildEnemyArt(type);
      const stats = ENEMY_STATS[type];
      expect(art.pixels).toHaveLength(stats.height);
      for (const row of art.pixels) expect(row).toHaveLength(stats.width);
    }
  });

  it('uses only locked palette indices', () => {
    for (const type of TYPES) {
      for (const row of buildEnemyArt(type).pixels) {
        for (const cell of row) {
          expect(cell === -1 || (cell >= 0 && cell < PALETTE.length)).toBe(true);
        }
      }
    }
  });

  it('draws the medium fighter as its own 36×36 with a red outline', () => {
    const medium = buildEnemyArt('medium');
    const small = buildEnemyArt('small');
    expect(medium.pixels).toHaveLength(36);
    expect(medium.pixels[0]).toHaveLength(36);
    expect(small.pixels).toHaveLength(24);

    let redEdge = 0;
    for (let y = 0; y < 36; y++) {
      for (let x = 0; x < 36; x++) {
        if (medium.pixels[y]![x] !== COLOR.ENEMY_RED) continue;
        const neighbors = [
          medium.pixels[y - 1]?.[x],
          medium.pixels[y + 1]?.[x],
          medium.pixels[y]?.[x - 1],
          medium.pixels[y]?.[x + 1],
        ];
        if (neighbors.some((n) => n === undefined || n < 0)) redEdge++;
      }
    }
    expect(redEdge).toBeGreaterThan(20);

    const dark = medium.pixels.flat().filter((c) => c === COLOR.ENEMY_BLACK).length;
    expect(dark).toBeGreaterThan(40);
  });

  it('keeps a readable silhouette, red rim, and rear nozzles', () => {
    const air: EnemyType[] = ['small', 'medium', 'interceptor', 'bomber'];
    const ground: EnemyType[] = ['tank', 'turret2', 'factory_aa', 'missile_car'];
    const reds = new Set([
      COLOR.ENEMY_BLACK,
      COLOR.ENEMY_DARK_RED,
      COLOR.ENEMY_CRIMSON,
      COLOR.ENEMY_RED,
      COLOR.ENEMY_BRIGHT_RED,
      COLOR.ENEMY_VIVID_RED,
    ]);
    const olives = new Set([
      COLOR.GROUND_DARK_OLIVE,
      COLOR.GROUND_OLIVE,
      COLOR.GROUND_MED_OLIVE,
      COLOR.GROUND_LIGHT_OLIVE,
      COLOR.GROUND_TAN,
    ]);

    for (const type of air) {
      const drawn = buildEnemyArt(type);
      expect(opaqueCount(drawn.pixels)).toBeGreaterThan(drawn.pixels.length * 8);
      expect(rimCount(drawn.pixels, COLOR.ENEMY_RED)).toBeGreaterThan(16);
      expect(countIn(drawn.pixels, reds)).toBeGreaterThan(countIn(drawn.pixels, olives));
      expect(symmetric(drawn.pixels)).toBe(true);
      for (const nozzle of drawn.nozzles) expect(nozzle.y).toBeLessThan(0);
    }

    const smallW = widths(buildEnemyArt('small').pixels);
    const smallMax = Math.max(...smallW);
    expect(smallW.indexOf(smallMax)).toBeLessThan(12);
    expect(smallW[smallW.length - 2]!).toBeLessThan(smallMax / 2);

    const sweep = widths(buildEnemyArt('interceptor').pixels);
    expect(sweep.indexOf(Math.max(...sweep))).toBeLessThan(14);

    const bomber = buildEnemyArt('bomber').pixels;
    expect(bomber.some((row) => (row[3] ?? -1) >= 0)).toBe(true);
    expect(bomber.some((row) => (row[52] ?? -1) >= 0)).toBe(true);
    expect(buildEnemyArt('bomber').nozzles).toHaveLength(4);

    const drone = buildEnemyArt('drone');
    expect(drone.nozzles).toHaveLength(0);
    expect(drone.pixels[4]![4]!).toBeGreaterThanOrEqual(0);
    expect(drone.pixels[4]![15]!).toBeGreaterThanOrEqual(0);
    expect(drone.pixels[15]![4]!).toBeGreaterThanOrEqual(0);
    expect(drone.pixels[15]![15]!).toBeGreaterThanOrEqual(0);
    expect(drone.pixels[10]![10]!).toBeGreaterThanOrEqual(0);
    expect(drone.pixels[1]![10]!).toBeLessThan(0);

    for (const type of ground) {
      const drawn = buildEnemyArt(type);
      expect(rimCount(drawn.pixels, COLOR.ENEMY_RED)).toBeGreaterThan(12);
      expect(countIn(drawn.pixels, olives)).toBeGreaterThan(countIn(drawn.pixels, reds));
      expect(drawn.nozzles).toHaveLength(0);
    }
  });

  it('draws the risk crate as a flat saucer: magenta top, yellow-black ring, cyan lamps, gray belly', () => {
    const art = buildEnemyArt('risk_crate');
    expect(art.pixels).toHaveLength(16);
    expect(art.pixels[0]).toHaveLength(32);
    expect(art.nozzles).toHaveLength(0);
    expect(symmetric(art.pixels)).toBe(true);

    const magenta = new Set<number>([COLOR.BULLET_MAGENTA, COLOR.BULLET_PINK, COLOR.BULLET_DARK]);
    const grays = new Set<number>([
      COLOR.DARK_GRAY,
      COLOR.MEDIUM_GRAY,
      COLOR.GRAY,
      COLOR.LIGHT_GRAY,
      COLOR.PALE_GRAY,
    ]);
    let topMagenta = 0;
    let bellyGray = 0;
    for (let y = 0; y <= 5; y++) {
      for (const cell of art.pixels[y]!) if (magenta.has(cell)) topMagenta++;
    }
    for (let y = 10; y <= 15; y++) {
      for (const cell of art.pixels[y]!) if (grays.has(cell)) bellyGray++;
    }
    expect(topMagenta).toBeGreaterThan(8);
    expect(bellyGray).toBeGreaterThan(8);

    const ring = [...art.pixels[7]!, ...art.pixels[8]!];
    expect(ring.filter((c) => c === COLOR.EXPLOSION_YELLOW).length).toBeGreaterThan(4);
    expect(ring.filter((c) => c === COLOR.BLACK).length).toBeGreaterThan(4);
    expect(
      ring.filter((c) => c === COLOR.PLAYER_CYAN || c === COLOR.PLAYER_MED_CYAN).length
    ).toBeGreaterThanOrEqual(4);
  });

  it('draws factory AA as a concrete pad with a hazard lip, distinct from the dual turret', () => {
    const aa = buildEnemyArt('factory_aa');
    const turret = buildEnemyArt('turret2');
    expect(aa.pixels).toHaveLength(32);
    expect(aa.pixels[0]).toHaveLength(32);
    expect(aa.nozzles).toHaveLength(0);
    expect(symmetric(aa.pixels)).toBe(true);
    let yellow = 0;
    let differ = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (aa.pixels[y]![x] === COLOR.EXPLOSION_YELLOW) yellow++;
        if (aa.pixels[y]![x] !== turret.pixels[y]![x]) differ++;
      }
    }
    expect(yellow).toBeGreaterThan(8);
    expect(differ).toBeGreaterThan(40);
    expect(rimCount(aa.pixels, COLOR.ENEMY_RED)).toBeGreaterThan(12);
  });
});

function widths(pixels: SpriteData): number[] {
  return pixels.map((row) => {
    let left = -1;
    let right = -1;
    row.forEach((cell, x) => {
      if (cell < 0) return;
      if (left < 0) left = x;
      right = x;
    });
    return right < 0 ? 0 : right - left + 1;
  });
}

function rimCount(pixels: SpriteData, color: number): number {
  let n = 0;
  for (let y = 0; y < pixels.length; y++) {
    const row = pixels[y]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== color) continue;
      const neighbors = [pixels[y - 1]?.[x], pixels[y + 1]?.[x], row[x - 1], row[x + 1]];
      if (neighbors.some((cell) => cell === undefined || cell < 0)) n++;
    }
  }
  return n;
}

function countIn(pixels: SpriteData, colors: Set<number>): number {
  let n = 0;
  for (const row of pixels) {
    for (const cell of row) if (colors.has(cell)) n++;
  }
  return n;
}

function symmetric(pixels: SpriteData): boolean {
  const w = pixels[0]?.length ?? 0;
  for (const row of pixels) {
    for (let x = 0; x < w; x++) {
      const a = (row[x] ?? -1) >= 0;
      const b = (row[w - 1 - x] ?? -1) >= 0;
      if (a !== b) return false;
    }
  }
  return true;
}
