/**
 * Weapon-test rules for playMode 'weaponTest'.
 * The battle scene owns the player, the real loadout, and the projectiles.
 * This module owns the target, the damage log, the top-right hit targets,
 * and the session-only rate / damage tune.
 * P writes state.main, T writes state.sub (homing, or null when off), and B
 * writes state.bombs. P速 / P伤 / T速 / T伤 write a WeaponTestTune object.
 * Holding fire uses the battle scene's stepFireClock / fireVolley path, so
 * missiles spawn and can hit the target. The tune never mutates WEAPONS.
 */

import {
  FIRE_RATE,
  HOMING_DAMAGE,
  HOMING_FIRE_RATE,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_BULLET_DAMAGE,
  WEAPON_TEST_BOMBS_MAX,
  WEAPON_TEST_DAMAGE_MAX,
  WEAPON_TEST_DAMAGE_MIN,
  WEAPON_TEST_DAMAGE_STEP,
  WEAPON_TEST_DPS_WINDOW,
  WEAPON_TEST_RATE_MAX,
  WEAPON_TEST_RATE_MIN,
  WEAPON_TEST_RATE_STEP,
  WEAPON_TEST_SUB_MAX,
  WEAPON_TEST_TARGET_H,
  WEAPON_TEST_TARGET_W,
  WEAPON_TEST_TARGET_X,
  WEAPON_TEST_TARGET_Y,
} from '@/game/config';
import type { WeaponEmitter, WeaponId } from '@/game/systems/playerWeapons';
import { hitRect, type Rect } from '@/game/ui/widgets';

export const WEAPON_TEST_TARGET = {
  x: WEAPON_TEST_TARGET_X,
  y: WEAPON_TEST_TARGET_Y,
  w: WEAPON_TEST_TARGET_W,
  h: WEAPON_TEST_TARGET_H,
} as const;

const STATS_X = 8;
const STATS_Y = 76;
const CTRL_X = 184;
const CTRL_Y = 76;
const SLOT_W = 36;
const SLOT_H = 28;
const SLOT_GAP = 4;
const ROW_STEP = 34;
/** Wide enough for a two-character label (P速) at 12px before the first slot. */
const LABEL_W = 40;
const PAD_TOP = 8;
const PAD_BOTTOM = 10;

/** P速, P伤, T速, T伤 sit under B. Reset is the last row. */
const TUNE_ROW = {
  mainRate: 3,
  mainDamage: 4,
  homingRate: 5,
  homingDamage: 6,
} as const;
const RESET_ROW = 7;

export const WEAPON_TEST_STATS_PANEL: Rect = { x: STATS_X, y: STATS_Y, w: 160, h: 150 };

export const WEAPON_TEST_CTRL_PANEL: Rect = {
  x: CTRL_X,
  y: CTRL_Y,
  w: LABEL_W + 3 * SLOT_W + 2 * SLOT_GAP + 12,
  h: PAD_TOP + RESET_ROW * ROW_STEP + SLOT_H + PAD_BOTTOM,
};

function slot(row: number, col: number): Rect {
  return {
    x: CTRL_X + LABEL_W + col * (SLOT_W + SLOT_GAP),
    y: CTRL_Y + PAD_TOP + row * ROW_STEP,
    w: SLOT_W,
    h: SLOT_H,
  };
}

export function weaponTestRowLabelY(row: number): number {
  return CTRL_Y + PAD_TOP + row * ROW_STEP + SLOT_H / 2;
}

export function weaponTestMainRect(level: 1 | 2 | 3): Rect {
  return slot(0, level - 1);
}

export function weaponTestSubRect(level: 0 | 1 | 2): Rect {
  return slot(1, level);
}

export function weaponTestBombDecRect(): Rect {
  return slot(2, 0);
}

export function weaponTestBombCountRect(): Rect {
  return slot(2, 1);
}

export function weaponTestBombIncRect(): Rect {
  return slot(2, 2);
}

export function weaponTestResetRect(): Rect {
  return {
    x: CTRL_X + LABEL_W,
    y: CTRL_Y + PAD_TOP + RESET_ROW * ROW_STEP,
    w: 3 * SLOT_W + 2 * SLOT_GAP,
    h: SLOT_H,
  };
}

export type WeaponTestTuneField = 'mainRate' | 'mainDamage' | 'homingRate' | 'homingDamage';

export const WEAPON_TEST_TUNE_FIELDS: readonly WeaponTestTuneField[] = [
  'mainRate',
  'mainDamage',
  'homingRate',
  'homingDamage',
];

export const WEAPON_TEST_TUNE_LABEL: Record<WeaponTestTuneField, string> = {
  mainRate: 'P速',
  mainDamage: 'P伤',
  homingRate: 'T速',
  homingDamage: 'T伤',
};

export function weaponTestTuneRow(field: WeaponTestTuneField): number {
  return TUNE_ROW[field];
}

export function weaponTestTuneDecRect(field: WeaponTestTuneField): Rect {
  return slot(weaponTestTuneRow(field), 0);
}

/** Display only. Tapping the number is not a command. */
export function weaponTestTuneValueRect(field: WeaponTestTuneField): Rect {
  return slot(weaponTestTuneRow(field), 1);
}

export function weaponTestTuneIncRect(field: WeaponTestTuneField): Rect {
  return slot(weaponTestTuneRow(field), 2);
}

export type WeaponTestCommand =
  | { kind: 'main'; level: 1 | 2 | 3 }
  | { kind: 'sub'; level: 0 | 1 | 2 }
  | { kind: 'bombs'; delta: -1 | 1 }
  | { kind: WeaponTestTuneField; delta: -1 | 1 }
  | { kind: 'reset' };

export function weaponTestCommandAt(x: number, y: number): WeaponTestCommand | null {
  if (hitRect(weaponTestResetRect(), x, y)) return { kind: 'reset' };
  for (const level of [1, 2, 3] as const) {
    if (hitRect(weaponTestMainRect(level), x, y)) return { kind: 'main', level };
  }
  for (const level of [0, 1, 2] as const) {
    if (hitRect(weaponTestSubRect(level), x, y)) return { kind: 'sub', level };
  }
  if (hitRect(weaponTestBombDecRect(), x, y)) return { kind: 'bombs', delta: -1 };
  if (hitRect(weaponTestBombIncRect(), x, y)) return { kind: 'bombs', delta: 1 };
  for (const field of WEAPON_TEST_TUNE_FIELDS) {
    if (hitRect(weaponTestTuneDecRect(field), x, y)) return { kind: field, delta: -1 };
    if (hitRect(weaponTestTuneIncRect(field), x, y)) return { kind: field, delta: 1 };
  }
  return null;
}

/** One decimal when needed, so 10 stays "10" and 1.5 stays "1.5". */
export function formatWeaponTestNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Session tune for weapon test. Defaults are the permanent config constants.
 * Battle reads this only while playMode is weaponTest.
 */
export interface WeaponTestTune {
  /** Main vulcan volleys per second. */
  mainRate: number;
  /** Damage of each main bullet. */
  mainDamage: number;
  /** Homing volleys per second. */
  homingRate: number;
  /** Damage of each homing missile. */
  homingDamage: number;
}

export function createWeaponTestTune(): WeaponTestTune {
  return {
    mainRate: FIRE_RATE,
    mainDamage: PLAYER_BULLET_DAMAGE,
    homingRate: HOMING_FIRE_RATE,
    homingDamage: HOMING_DAMAGE,
  };
}

export function resetWeaponTestTune(tune: WeaponTestTune): void {
  const fresh = createWeaponTestTune();
  tune.mainRate = fresh.mainRate;
  tune.mainDamage = fresh.mainDamage;
  tune.homingRate = fresh.homingRate;
  tune.homingDamage = fresh.homingDamage;
}

function tuneBounds(field: WeaponTestTuneField): { step: number; min: number; max: number } {
  if (field === 'mainRate' || field === 'homingRate') {
    return { step: WEAPON_TEST_RATE_STEP, min: WEAPON_TEST_RATE_MIN, max: WEAPON_TEST_RATE_MAX };
  }
  return {
    step: WEAPON_TEST_DAMAGE_STEP,
    min: WEAPON_TEST_DAMAGE_MIN,
    max: WEAPON_TEST_DAMAGE_MAX,
  };
}

/** Step one live value and clamp it. Stays above 0. */
export function stepWeaponTestTune(
  tune: WeaponTestTune,
  field: WeaponTestTuneField,
  delta: -1 | 1
): void {
  const { step, min, max } = tuneBounds(field);
  const next = Math.round((tune[field] + delta * step) * 10) / 10;
  tune[field] = Math.min(max, Math.max(min, next));
}

/**
 * Volleys per second while weapon test is active. Null means "use the weapon def",
 * which is what stage, boss practice, and the title demo do.
 */
export function weaponTestVolleyRate(
  active: boolean,
  tune: WeaponTestTune,
  id: WeaponId
): number | null {
  if (!active) return null;
  return id === 'homing' ? tune.homingRate : tune.mainRate;
}

/** Damage of each projectile while weapon test is active. Null keeps the weapon def. */
export function weaponTestVolleyDamage(
  active: boolean,
  tune: WeaponTestTune,
  id: WeaponId
): number | null {
  if (!active) return null;
  return id === 'homing' ? tune.homingDamage : tune.mainDamage;
}

/** Emitter that stamps one damage onto every projectile. Does not edit WEAPONS. */
export function emitWithDamage(emit: WeaponEmitter, damage: number): WeaponEmitter {
  return {
    bullet: (x, y, vx, vy) => emit.bullet(x, y, vx, vy, damage),
    missile: (x, y, angle) => emit.missile(x, y, angle, damage),
  };
}

/** Weapon-test bomb stock. Independent of the stage cap BOMBS_MAX. */
export function clampWeaponTestBombs(count: number): number {
  return Math.max(0, Math.min(WEAPON_TEST_BOMBS_MAX, count));
}

export function clampWeaponTestSub(level: number): number {
  return Math.max(0, Math.min(WEAPON_TEST_SUB_MAX, level));
}

export interface WeaponTestStats {
  totalDamage: number;
  dps: number;
  lastHit: number;
  mainLevel: number;
  /** 0 means sub weapon T is off. */
  subLevel: number;
  bombs: number;
  /** Live tune. Equals the config constants until a stepper or reset changes it. */
  mainRate: number;
  mainDamage: number;
  homingRate: number;
  homingDamage: number;
}

export interface DamageMeter {
  record(time: number, damage: number): void;
  reset(): void;
  total(): number;
  lastHit(): number;
  /** Sum of damage in the open window (now - window, now], divided by the window. */
  dps(now: number): number;
}

interface Sample {
  time: number;
  damage: number;
}

export function createDamageMeter(windowSec: number = WEAPON_TEST_DPS_WINDOW): DamageMeter {
  let samples: Sample[] = [];
  let total = 0;
  let last = 0;

  function prune(now: number): void {
    const cutoff = now - windowSec;
    if (samples.length === 0 || samples[0]!.time > cutoff) return;
    samples = samples.filter((s) => s.time > cutoff);
  }

  return {
    record(time: number, damage: number): void {
      if (!(damage > 0)) return;
      samples.push({ time, damage });
      total += damage;
      last = damage;
      prune(time);
    },

    reset(): void {
      samples = [];
      total = 0;
      last = 0;
    },

    total: () => total,
    lastHit: () => last,

    dps(now: number): number {
      prune(now);
      let sum = 0;
      const cutoff = now - windowSec;
      for (const sample of samples) {
        if (sample.time > cutoff && sample.time <= now) sum += sample.damage;
      }
      return windowSec > 0 ? sum / windowSec : 0;
    },
  };
}

/** Player bullet vs the fixed target. Positions are bullet centers, matching combat. */
export function bulletHitsWeaponTarget(
  x: number,
  y: number,
  w: number,
  h: number,
  target: { x: number; y: number; w: number; h: number } = WEAPON_TEST_TARGET
): boolean {
  const left = x - w / 2;
  const top = y - h / 2;
  return (
    left < target.x + target.w &&
    left + w > target.x &&
    top < target.y + target.h &&
    top + h > target.y
  );
}

/** The target sits near the top and stays inside the 360×640 screen. */
export function weaponTargetOnScreen(): boolean {
  const t = WEAPON_TEST_TARGET;
  return t.x >= 0 && t.y >= 0 && t.x + t.w <= LOGICAL_W && t.y + t.h <= LOGICAL_H && t.y < 40;
}
