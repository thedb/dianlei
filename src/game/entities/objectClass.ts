/**
 * Size class and category for everything the player can shoot (design §5.4.1).
 * The bomb and the homing missile read these tables. Enemy rows come from
 * `ENEMY_DEFS` (`size` / `category`); buildings and the boss are listed here.
 * Nothing else may hard-code per-type size checks.
 */

import type { BuildingType } from '@/game/levels/types';
import { ENEMY_DEFS, ENEMY_TYPES, type EnemyType } from './enemyDefs';

export type SizeClass = 'small' | 'medium' | 'large';
export type TargetCategory = 'air' | 'ground' | 'building' | 'boss';

export interface ObjectClass {
  size: SizeClass;
  category: TargetCategory;
}

export const ENEMY_CLASS: Readonly<Record<EnemyType, ObjectClass>> = Object.fromEntries(
  ENEMY_TYPES.map((type) => [
    type,
    { size: ENEMY_DEFS[type].size, category: ENEMY_DEFS[type].category },
  ])
) as Record<EnemyType, ObjectClass>;

export const BUILDING_CLASS: Record<BuildingType, ObjectClass> = {
  pillbox: { size: 'small', category: 'building' },
  fuel_depot: { size: 'small', category: 'building' },
  radar_station: { size: 'small', category: 'building' },
  sea_gun: { size: 'small', category: 'building' },
};

export const BOSS_CLASS: ObjectClass = { size: 'large', category: 'boss' };

/**
 * Risk crate. Small, so a bomb that reaches it destroys shield and body together.
 * It is air for the homing picker, and it never body-kills the player.
 */
export const RISK_CRATE_CLASS: ObjectClass = { size: 'small', category: 'air' };

export function enemyClass(type: EnemyType): ObjectClass {
  return ENEMY_CLASS[type];
}

export function buildingClass(type: BuildingType): ObjectClass {
  return BUILDING_CLASS[type];
}
