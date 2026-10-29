import { describe, expect, it } from 'vitest';
import type { BuildingType, EnemyType } from '@/game/levels/types';
import { ENEMY_STATS, isGroundEnemy } from './enemy';
import { BUILDING_SPECS } from './building';
import { BOSS_CLASS, BUILDING_CLASS, ENEMY_CLASS, buildingClass, enemyClass } from './objectClass';

const ENEMY_SIZES: Record<EnemyType, 'small' | 'medium'> = {
  small: 'small',
  drone: 'small',
  interceptor: 'small',
  tank: 'small',
  missile_car: 'small',
  risk_crate: 'small',
  parked_fighter: 'small',
  medium: 'medium',
  bomber: 'medium',
  carrier_bomber: 'medium',
  turret2: 'medium',
  factory_aa: 'medium',
  strike: 'medium',
};

describe('object size class', () => {
  it('classifies every enemy type', () => {
    const types = Object.keys(ENEMY_STATS) as EnemyType[];
    expect(new Set(Object.keys(ENEMY_CLASS))).toEqual(new Set(types));
    for (const type of types) {
      expect(enemyClass(type).size, type).toBe(ENEMY_SIZES[type]);
    }
  });

  it('tags air and ground enemies, matching the body-collision rule', () => {
    for (const type of Object.keys(ENEMY_STATS) as EnemyType[]) {
      const category = enemyClass(type).category;
      expect(['air', 'ground']).toContain(category);
      expect(category === 'ground', type).toBe(isGroundEnemy(type));
    }
    expect(enemyClass('tank').category).toBe('ground');
    expect(enemyClass('turret2').category).toBe('ground');
    expect(enemyClass('factory_aa').category).toBe('ground');
    expect(enemyClass('missile_car').category).toBe('ground');
    expect(enemyClass('bomber').category).toBe('air');
  });

  it('makes every building small', () => {
    const types = Object.keys(BUILDING_SPECS) as BuildingType[];
    expect(new Set(Object.keys(BUILDING_CLASS))).toEqual(new Set(types));
    for (const type of types) {
      expect(buildingClass(type), type).toEqual({ size: 'small', category: 'building' });
    }
  });

  it('makes the boss large', () => {
    expect(BOSS_CLASS).toEqual({ size: 'large', category: 'boss' });
  });
});
