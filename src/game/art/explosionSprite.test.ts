import { describe, expect, it } from 'vitest';
import { COLOR, PALETTE } from '@/game/palette';
import {
  BOSS_CLASS,
  BUILDING_CLASS,
  ENEMY_CLASS,
  type SizeClass,
} from '@/game/entities/objectClass';
import type { BuildingType, EnemyType } from '@/game/levels/types';
import { opaqueCount } from './pixelDraw';
import type { SpriteData } from './types';
import {
  EXPLOSION_POOL_SIZE,
  HIT_SPARK_FRAME_COUNT,
  HIT_SPARK_POOL_SIZE,
  LARGE_EXPLOSION_FRAME_COUNT,
  LARGE_EXPLOSION_SIZE,
  MEDIUM_EXPLOSION_FRAME_COUNT,
  MEDIUM_EXPLOSION_SIZE,
  PLAYER_DEATH_EXPLOSION,
  SMALL_EXPLOSION_FRAME_COUNT,
  SMALL_EXPLOSION_SIZE,
  buildExplosionFrameSets,
  explosionDrawKey,
  explosionFrameCount,
  explosionKindForSize,
  registerExplosionFrames,
} from './explosionSprite';

const BANNED = new Set<number>([
  COLOR.PLAYER_PALE_CYAN,
  COLOR.PLAYER_CYAN,
  COLOR.PLAYER_MED_CYAN,
  COLOR.PLAYER_DARK_CYAN,
  COLOR.PLAYER_BLUE,
  COLOR.BULLET_MAGENTA,
  COLOR.BULLET_PINK,
  COLOR.BULLET_DARK,
  COLOR.BULLET_CORE,
]);

const SMOKE = new Set<number>([COLOR.GRAY, COLOR.DARK_GRAY, COLOR.MEDIUM_GRAY]);

function smokeCount(grid: SpriteData): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (SMOKE.has(cell)) n++;
  return n;
}

describe('explosion frame sets', () => {
  const sets = buildExplosionFrameSets();
  const registered = registerExplosionFrames(sets);

  it('registers small, medium, large, and the hit spark under the draw keys', () => {
    expect(registered[explosionDrawKey('small')]).toBe(sets.small);
    expect(registered[explosionDrawKey('medium')]).toBe(sets.medium);
    expect(registered[explosionDrawKey('large')]).toBe(sets.large);
    expect(registered.hitSpark).toBe(sets.hitSpark);
    expect(Object.keys(registered).sort()).toEqual([
      'hitSpark',
      'largeExplosion',
      'mediumExplosion',
      'smallExplosion',
    ]);
  });

  it('keeps the design frame counts and distinct pixel sizes', () => {
    expect(sets.small).toHaveLength(SMALL_EXPLOSION_FRAME_COUNT);
    expect(sets.medium).toHaveLength(MEDIUM_EXPLOSION_FRAME_COUNT);
    expect(sets.large).toHaveLength(LARGE_EXPLOSION_FRAME_COUNT);
    expect(sets.hitSpark).toHaveLength(HIT_SPARK_FRAME_COUNT);
    expect(explosionFrameCount('small')).toBe(sets.small.length);
    expect(explosionFrameCount('medium')).toBe(sets.medium.length);
    expect(explosionFrameCount('large')).toBe(sets.large.length);

    expect(sets.small[0]).toHaveLength(SMALL_EXPLOSION_SIZE);
    expect(sets.small[0]?.[0]).toHaveLength(SMALL_EXPLOSION_SIZE);
    expect(sets.medium[0]).toHaveLength(MEDIUM_EXPLOSION_SIZE);
    expect(sets.medium[0]?.[0]).toHaveLength(MEDIUM_EXPLOSION_SIZE);
    expect(sets.large[0]).toHaveLength(LARGE_EXPLOSION_SIZE);
    expect(sets.large[0]?.[0]).toHaveLength(LARGE_EXPLOSION_SIZE);
    expect(sets.hitSpark[0]).toHaveLength(8);
    expect(sets.hitSpark[0]?.[0]).toHaveLength(8);

    expect(MEDIUM_EXPLOSION_SIZE).toBeGreaterThan(SMALL_EXPLOSION_SIZE);
    expect(LARGE_EXPLOSION_SIZE).toBeGreaterThan(MEDIUM_EXPLOSION_SIZE);
    expect(opaqueCount(sets.large[0]!)).toBeGreaterThan(opaqueCount(sets.medium[0]!));
    expect(opaqueCount(sets.medium[0]!)).toBeGreaterThan(opaqueCount(sets.small[0]!));
  });

  it('uses palette fire and smoke, and the last blast frame is smokier than the first', () => {
    for (const frames of [sets.small, sets.medium, sets.large, sets.hitSpark]) {
      for (const grid of frames) {
        expect(opaqueCount(grid)).toBeGreaterThan(0);
        for (const row of grid) {
          for (const cell of row) {
            expect(cell === -1 || (cell >= 0 && cell < PALETTE.length)).toBe(true);
            expect(BANNED.has(cell)).toBe(false);
          }
        }
      }
    }
    for (const frames of [sets.small, sets.medium, sets.large]) {
      expect(smokeCount(frames[frames.length - 1]!)).toBeGreaterThan(smokeCount(frames[0]!));
    }
  });

  it('maps size class onto the frame set, and keeps the player death on small', () => {
    const seen = new Set<SizeClass>();
    for (const type of Object.keys(ENEMY_CLASS) as EnemyType[]) {
      const size = ENEMY_CLASS[type].size;
      seen.add(size);
      expect(explosionKindForSize(size)).toBe(size);
    }
    for (const type of Object.keys(BUILDING_CLASS) as BuildingType[]) {
      expect(BUILDING_CLASS[type].size).toBe('small');
      expect(explosionKindForSize(BUILDING_CLASS[type].size)).toBe('small');
    }
    expect(BOSS_CLASS.size).toBe('large');
    expect(explosionKindForSize(BOSS_CLASS.size)).toBe('large');
    expect(seen).toEqual(new Set(['small', 'medium']));
    expect(PLAYER_DEATH_EXPLOSION).toBe('small');
    expect(explosionFrameCount(PLAYER_DEATH_EXPLOSION)).toBe(SMALL_EXPLOSION_FRAME_COUNT);
  });

  it('keeps the explosion pool and gives sparks their own pool', () => {
    expect(EXPLOSION_POOL_SIZE).toBeGreaterThanOrEqual(48);
    expect(HIT_SPARK_POOL_SIZE).toBeGreaterThanOrEqual(16);
  });
});
