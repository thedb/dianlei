/**
 * Player weapon registry (design §5.3). The ship carries one main weapon and
 * at most one sub weapon at the same time. Each weapon is one definition: its
 * slot, pickup letter, max level, and a rate / damage / fire function per level.
 * A new weapon is a new entry here plus an item letter and an icon.
 */

import {
  DEATH_POWER_LOSS,
  DEATH_SUB_LOSS,
  FIRE_RATE,
  HOMING_DAMAGE,
  HOMING_FIRE_RATE,
  HOMING_LV2_OFFSET_X,
  HOMING_LV2_SPLAY_DEG,
  HOMING_MAX_LEVEL,
  LV2_GAP,
  LV3_SPREAD_DEG,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  POWER_MAX,
  P_OVERFLOW_SCORE,
} from '@/game/config';
import type { ItemType } from '@/game/entities/item';

export type WeaponSlot = 'main' | 'sub';
export type WeaponId = 'vulcan' | 'homing';

/** Where a volley's projectiles go. The battle scene backs these with pools. */
export interface WeaponEmitter {
  bullet(x: number, y: number, vx: number, vy: number, damage: number): void;
  /** `angle` in radians, -PI/2 is straight up. */
  missile(x: number, y: number, angle: number, damage: number): void;
}

export interface WeaponLevelDef {
  /** Volleys per second while firing */
  rate: number;
  /** Damage of each projectile */
  damage: number;
  /** One volley from the ship center (x, y) */
  fire(x: number, y: number, emit: WeaponEmitter): void;
}

export interface WeaponDef {
  id: WeaponId;
  slot: WeaponSlot;
  /** Pickup letter. The item sprite for that letter doubles as the HUD icon. */
  item: ItemType;
  maxLevel: number;
  /** Score for picking this weapon up when it is already at max level */
  overflowScore: number;
  /** Index 0 is Lv1 */
  levels: readonly WeaponLevelDef[];
}

const UP = -Math.PI / 2;
const MUZZLE_Y = 16;

function straight(emit: WeaponEmitter, x: number, y: number): void {
  emit.bullet(x, y, 0, -PLAYER_BULLET_SPEED, PLAYER_BULLET_DAMAGE);
}

const SPREAD_RAD = (LV3_SPREAD_DEG * Math.PI) / 180;
const SPLAY_RAD = (HOMING_LV2_SPLAY_DEG * Math.PI) / 180;

const VULCAN: WeaponDef = {
  id: 'vulcan',
  slot: 'main',
  item: 'P',
  maxLevel: POWER_MAX,
  overflowScore: P_OVERFLOW_SCORE,
  levels: [
    {
      rate: FIRE_RATE,
      damage: PLAYER_BULLET_DAMAGE,
      fire: (x, y, emit) => straight(emit, x, y - MUZZLE_Y),
    },
    {
      rate: FIRE_RATE,
      damage: PLAYER_BULLET_DAMAGE,
      fire: (x, y, emit) => {
        straight(emit, x - LV2_GAP / 2, y - MUZZLE_Y);
        straight(emit, x + LV2_GAP / 2, y - MUZZLE_Y);
      },
    },
    {
      rate: FIRE_RATE,
      damage: PLAYER_BULLET_DAMAGE,
      fire: (x, y, emit) => {
        const by = y - MUZZLE_Y;
        const vx = Math.sin(SPREAD_RAD) * PLAYER_BULLET_SPEED;
        const vy = -Math.cos(SPREAD_RAD) * PLAYER_BULLET_SPEED;
        straight(emit, x, by);
        emit.bullet(x - 4, by, -vx, vy, PLAYER_BULLET_DAMAGE);
        emit.bullet(x + 4, by, vx, vy, PLAYER_BULLET_DAMAGE);
      },
    },
  ],
};

const HOMING: WeaponDef = {
  id: 'homing',
  slot: 'sub',
  item: 'T',
  maxLevel: HOMING_MAX_LEVEL,
  overflowScore: P_OVERFLOW_SCORE,
  levels: [
    {
      rate: HOMING_FIRE_RATE,
      damage: HOMING_DAMAGE,
      fire: (x, y, emit) => emit.missile(x, y - 8, UP, HOMING_DAMAGE),
    },
    {
      rate: HOMING_FIRE_RATE,
      damage: HOMING_DAMAGE,
      fire: (x, y, emit) => {
        emit.missile(x - HOMING_LV2_OFFSET_X, y - 4, UP - SPLAY_RAD, HOMING_DAMAGE);
        emit.missile(x + HOMING_LV2_OFFSET_X, y - 4, UP + SPLAY_RAD, HOMING_DAMAGE);
      },
    },
  ],
};

export const WEAPONS: Readonly<Record<WeaponId, WeaponDef>> = {
  vulcan: VULCAN,
  homing: HOMING,
};

/** Main weapon a fresh ship starts with */
export const DEFAULT_MAIN_WEAPON: WeaponId = 'vulcan';

export function weaponForItem(item: ItemType): WeaponDef | undefined {
  for (const def of Object.values(WEAPONS)) if (def.item === item) return def;
  return undefined;
}

/** Level stats, clamped to the weapon's range. */
export function weaponLevel(id: WeaponId, level: number): WeaponLevelDef {
  const def = WEAPONS[id];
  const index = Math.max(1, Math.min(def.maxLevel, Math.floor(level))) - 1;
  return def.levels[index]!;
}

export interface EquippedWeapon {
  id: WeaponId;
  level: number;
}

export interface Loadout {
  main: EquippedWeapon;
  sub: EquippedWeapon | null;
}

export function createLoadout(): Loadout {
  return { main: { id: DEFAULT_MAIN_WEAPON, level: 1 }, sub: null };
}

export function resetLoadout(loadout: Loadout): void {
  loadout.main = { id: DEFAULT_MAIN_WEAPON, level: 1 };
  loadout.sub = null;
}

export type PickupResult = 'equip' | 'levelUp' | 'switch' | 'overflow';

/**
 * Pick up a weapon item. Only the weapon's own slot changes.
 * Same weapon: +1 level up to its max, then overflow (score).
 * Different weapon of that slot: switch, keeping the level clamped to its max.
 * Empty sub slot: equip at Lv1.
 */
export function applyWeaponPickup(
  loadout: Loadout,
  id: WeaponId,
  registry: Readonly<Record<WeaponId, WeaponDef>> = WEAPONS
): PickupResult {
  const def = registry[id];
  const current = def.slot === 'main' ? loadout.main : loadout.sub;
  if (!current) {
    loadout.sub = { id, level: 1 };
    return 'equip';
  }
  if (current.id !== id) {
    current.id = id;
    current.level = Math.max(1, Math.min(def.maxLevel, current.level));
    return 'switch';
  }
  if (current.level < def.maxLevel) {
    current.level++;
    return 'levelUp';
  }
  return 'overflow';
}

/** Death: main loses DEATH_POWER_LOSS (never below Lv1); sub loses DEATH_SUB_LOSS and may empty. */
export function applyDeathPenalty(loadout: Loadout): void {
  loadout.main.level = Math.max(1, loadout.main.level - DEATH_POWER_LOSS);
  if (loadout.sub) {
    const level = loadout.sub.level - DEATH_SUB_LOSS;
    loadout.sub = level >= 1 ? { id: loadout.sub.id, level } : null;
  }
}

/** Raise a slot to its weapon's max (boss practice starts at full main power). */
export function maxOut(weapon: EquippedWeapon): void {
  weapon.level = WEAPONS[weapon.id].maxLevel;
}

/**
 * Advance one weapon's fire clock. Fires once immediately on press, then at
 * `interval`. Returns the new elapsed time.
 */
export function stepFireClock(
  elapsed: number,
  dt: number,
  interval: number,
  held: boolean,
  onVolley: () => void
): number {
  let t = elapsed + dt;
  if (held) {
    while (t >= interval) {
      onVolley();
      t -= interval;
    }
  } else if (t > interval) {
    t = interval;
  }
  return t;
}
