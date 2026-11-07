/**
 * Yoan's locked SFX map (2026-11-07). Pure data: no AudioContext.
 * Files live in `assets/sfx/` and are fetched as relative URLs, then decoded
 * on the platform WebAudio context. A missing buffer falls back to synth.
 */

import {
  SFX_BOSS_VOICES,
  SFX_ELITE_VOICES,
  SFX_EXPLODE_VOICES,
  SFX_SHOOT_VOICES,
} from '@/game/config';
import type { BuildingType } from '@/game/levels/types';
import type { EnemyType } from '@/game/entities/enemyDefs';
import type { ShipId } from '@/game/entities/shipDefs';

export type SfxSampleId =
  | 'shoot_eagle'
  | 'shoot_mandy'
  | 'shoot_jason'
  | 'explode_n1'
  | 'explode_n2'
  | 'explode_n3'
  | 'explode_n4'
  | 'explode_boss_b2';

/** Relative to the page or the mini-game root. Vite copies these into `dist/assets/sfx/`. */
export const SFX_SAMPLE_URL: Readonly<Record<SfxSampleId, string>> = {
  shoot_eagle: 'assets/sfx/shoot_eagle.ogg',
  shoot_mandy: 'assets/sfx/shoot_mandy.ogg',
  shoot_jason: 'assets/sfx/shoot_jason.ogg',
  explode_n1: 'assets/sfx/explode_n1.ogg',
  explode_n2: 'assets/sfx/explode_n2.ogg',
  explode_n3: 'assets/sfx/explode_n3.ogg',
  explode_n4: 'assets/sfx/explode_n4.ogg',
  explode_boss_b2: 'assets/sfx/explode_boss_b2.ogg',
};

export const SFX_SAMPLE_IDS = Object.keys(SFX_SAMPLE_URL) as SfxSampleId[];

/**
 * Normal enemies and turrets share this pool. Each play draws one.
 * N2 is the dry hit, N3 is duller, N4 is the firework crack.
 */
export const NORMAL_EXPLODE_POOL: readonly SfxSampleId[] = [
  'explode_n2',
  'explode_n3',
  'explode_n4',
];

export type ExplodeTier = 'normal' | 'turret' | 'elite' | 'boss';

export type SampleSlot = 'shoot' | 'explode' | 'elite' | 'boss';

/**
 * Elites are the heavier aircraft. Turrets and factory AA stay on the
 * normal pool even when their size class is medium. Buildings with a gun
 * are turrets; depots and radars are normal. Both of those tiers draw
 * `NORMAL_EXPLODE_POOL`.
 */
export const ENEMY_EXPLODE_TIER: Readonly<Record<EnemyType, ExplodeTier>> = {
  small: 'normal',
  interceptor: 'normal',
  drone: 'normal',
  tank: 'normal',
  missile_car: 'normal',
  risk_crate: 'normal',
  parked_fighter: 'normal',
  turret2: 'turret',
  factory_aa: 'turret',
  medium: 'elite',
  bomber: 'elite',
  strike: 'elite',
  torpedo: 'elite',
};

export const BUILDING_EXPLODE_TIER: Readonly<Record<BuildingType, ExplodeTier>> = {
  pillbox: 'turret',
  sea_gun: 'turret',
  aa_gun: 'turret',
  fuel_depot: 'normal',
  radar_station: 'normal',
};

/** Eagle when the run has not chosen a ship. Mandy is J1, not an M-column sample. */
export function shootSample(shipId: ShipId | undefined): SfxSampleId {
  if (shipId === 'mandy') return 'shoot_mandy';
  if (shipId === 'jason') return 'shoot_jason';
  return 'shoot_eagle';
}

export function explodeTierForEnemy(type: EnemyType): ExplodeTier {
  return ENEMY_EXPLODE_TIER[type];
}

export function explodeTierForBuilding(type: BuildingType): ExplodeTier {
  return BUILDING_EXPLODE_TIER[type];
}

export function sampleSlot(id: SfxSampleId): SampleSlot {
  if (id === 'shoot_eagle' || id === 'shoot_mandy' || id === 'shoot_jason') return 'shoot';
  if (id === 'explode_n1') return 'elite';
  if (id === 'explode_boss_b2') return 'boss';
  return 'explode';
}

export function voiceLimit(slot: SampleSlot): number {
  switch (slot) {
    case 'shoot':
      return SFX_SHOOT_VOICES;
    case 'elite':
      return SFX_ELITE_VOICES;
    case 'boss':
      return SFX_BOSS_VOICES;
    default:
      return SFX_EXPLODE_VOICES;
  }
}

/**
 * Voices to stop before starting one more in this slot.
 * Shoot and boss always clear the slot first (interrupt / retrigger) so rapid
 * fire and the death sequence never stack. Explosion slots steal the oldest
 * voice only after the cap.
 */
export function voicesToStop(slot: SampleSlot, live: number): number {
  if (slot === 'shoot' || slot === 'boss') return Math.max(0, live);
  return Math.max(0, live + 1 - voiceLimit(slot));
}

/** One B2 id per large death blast. Empty when the frame has none. */
export function bossDeathCues(largeBlasts: number): SfxSampleId[] {
  const n = Number.isFinite(largeBlasts) ? Math.max(0, Math.floor(largeBlasts)) : 0;
  return Array.from({ length: n }, () => 'explode_boss_b2' as const);
}

/** Large blasts are the boss death sequence. Anything else is a single normal explode. */
export function bossExplosionVoices(explosions: readonly { size: string }[]): {
  bossBlasts: number;
  otherBlasts: number;
} {
  let bossBlasts = 0;
  for (const boom of explosions) {
    if (boom.size === 'large') bossBlasts++;
  }
  return { bossBlasts, otherBlasts: explosions.length - bossBlasts };
}

export function pickPoolSample(pool: readonly SfxSampleId[], rng: () => number): SfxSampleId {
  const n = pool.length;
  const roll = rng();
  const index = Math.min(n - 1, Math.max(0, Math.floor(roll * n)));
  const picked = pool[index];
  if (!picked) throw new Error('empty sfx pool');
  return picked;
}

/** Boss and elite do not draw. Normal and turret draw `NORMAL_EXPLODE_POOL`. */
export function explodeSampleForTier(tier: ExplodeTier, rng: () => number): SfxSampleId {
  if (tier === 'boss') return 'explode_boss_b2';
  if (tier === 'elite') return 'explode_n1';
  return pickPoolSample(NORMAL_EXPLODE_POOL, rng);
}
