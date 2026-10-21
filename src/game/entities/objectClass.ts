/**
 * Size class and category for everything the player can shoot (design §5.4.1).
 * The bomb and the homing missile read these tables; a new enemy, building or
 * mini-boss only has to add its row here.
 */

import type { BuildingType, EnemyType } from '@/game/levels/types';

export type SizeClass = 'small' | 'medium' | 'large';
export type TargetCategory = 'air' | 'ground' | 'building' | 'boss';

export interface ObjectClass {
  size: SizeClass;
  category: TargetCategory;
}

export const ENEMY_CLASS: Record<EnemyType, ObjectClass> = {
  small: { size: 'small', category: 'air' },
  drone: { size: 'small', category: 'air' },
  interceptor: { size: 'small', category: 'air' },
  medium: { size: 'medium', category: 'air' },
  bomber: { size: 'medium', category: 'air' },
  tank: { size: 'small', category: 'ground' },
  missile_car: { size: 'small', category: 'ground' },
  turret2: { size: 'medium', category: 'ground' },
};

export const BUILDING_CLASS: Record<BuildingType, ObjectClass> = {
  pillbox: { size: 'small', category: 'building' },
  fuel_depot: { size: 'small', category: 'building' },
  radar_station: { size: 'small', category: 'building' },
  sea_gun: { size: 'small', category: 'building' },
};

export const BOSS_CLASS: ObjectClass = { size: 'large', category: 'boss' };

export function enemyClass(type: EnemyType): ObjectClass {
  return ENEMY_CLASS[type];
}

export function buildingClass(type: BuildingType): ObjectClass {
  return BUILDING_CLASS[type];
}
