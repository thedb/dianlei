/**
 * Enemy definition table (wave table §2). One row per enemy type holds its
 * stats, size class, score, and the per-type look and behavior that the battle
 * scene used to branch on. The sprite lives in `art/enemySprite.ts` (`BUILDERS`,
 * keyed by the same type), and the fire pattern comes from the wave data.
 *
 * Adding an enemy: add the id to `EnemyType`, a row here, and a sprite builder.
 */

import {
  SCORE_BOMBER,
  SCORE_DRONE,
  SCORE_DUAL_TURRET,
  SCORE_INTERCEPTOR,
  SCORE_MEDIUM_FIGHTER,
  SCORE_MISSILE_CAR,
  SCORE_SMALL_FIGHTER,
  SCORE_TANK,
} from '@/game/config';
import type { SizeClass } from './objectClass';

export type EnemyType =
  'small' | 'medium' | 'interceptor' | 'bomber' | 'drone' | 'tank' | 'turret2' | 'missile_car';

/** Extra kill blast: offset from the wreck and delay in seconds. */
export type DeathBurst = readonly [dx: number, dy: number, delay: number];

export interface EnemyDef {
  hp: number;
  score: number;
  /** Sprite footprint before SPRITE_SCALE. */
  width: number;
  height: number;
  hitRadius: number;
  size: SizeClass;
  /** Ground units scroll with the map, draw under aircraft, and never body-kill. */
  category: 'air' | 'ground';
  /** Blasts after the main size-matched explosion. Same explosion kind. */
  deathBursts?: readonly DeathBurst[];
  /** Code-drawn gun barrel over the sprite, rotated to `aimAngle`. */
  barrel?: 'single' | 'twin';
  /** Sprite spins at this many radians per second of move time. */
  spin?: number;
  /** Barrel snaps to the player every frame. Turn-rate tracking comes from the fire pattern. */
  snapAim?: boolean;
  /** River, shallow water, and intact buildings block this unit's ground drive. */
  avoidsWater?: boolean;
}

export const ENEMY_DEFS: Readonly<Record<EnemyType, EnemyDef>> = {
  small: {
    hp: 3,
    score: SCORE_SMALL_FIGHTER,
    width: 24,
    height: 24,
    hitRadius: 10,
    size: 'small',
    category: 'air',
  },
  medium: {
    hp: 24,
    score: SCORE_MEDIUM_FIGHTER,
    width: 36,
    height: 36,
    hitRadius: 15,
    size: 'medium',
    category: 'air',
    deathBursts: [[8, -4, 0.05]],
  },
  interceptor: {
    hp: 6,
    score: SCORE_INTERCEPTOR,
    width: 28,
    height: 28,
    hitRadius: 12,
    size: 'small',
    category: 'air',
  },
  bomber: {
    hp: 60,
    score: SCORE_BOMBER,
    width: 56,
    height: 48,
    hitRadius: 24,
    size: 'medium',
    category: 'air',
    deathBursts: [
      [-16, -6, 0.06],
      [14, 8, 0.12],
    ],
  },
  drone: {
    hp: 4,
    score: SCORE_DRONE,
    width: 20,
    height: 20,
    hitRadius: 8,
    size: 'small',
    category: 'air',
    spin: 2.4,
  },
  tank: {
    hp: 8,
    score: SCORE_TANK,
    width: 24,
    height: 24,
    hitRadius: 10,
    size: 'small',
    category: 'ground',
    barrel: 'single',
    snapAim: true,
    avoidsWater: true,
  },
  turret2: {
    hp: 30,
    score: SCORE_DUAL_TURRET,
    width: 32,
    height: 32,
    hitRadius: 14,
    size: 'medium',
    category: 'ground',
    deathBursts: [[8, -4, 0.05]],
    barrel: 'twin',
  },
  missile_car: {
    hp: 12,
    score: SCORE_MISSILE_CAR,
    width: 24,
    height: 32,
    hitRadius: 12,
    size: 'small',
    category: 'ground',
  },
};

export const ENEMY_TYPES = Object.keys(ENEMY_DEFS) as EnemyType[];

/** Largest hit radius in the table. Broad-phase queries pad by this. */
export const ENEMY_MAX_HIT_RADIUS = Math.max(...ENEMY_TYPES.map((t) => ENEMY_DEFS[t].hitRadius));
