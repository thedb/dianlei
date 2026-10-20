import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import { ENEMY_STATS } from '@/game/entities/enemy';
import type { EnemyType } from '@/game/levels/types';
import { buildEnemyArt } from './enemySprite';

const TYPES: EnemyType[] = [
  'small',
  'medium',
  'interceptor',
  'bomber',
  'drone',
  'tank',
  'turret2',
  'missile_car',
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
});
