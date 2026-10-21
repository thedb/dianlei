/**
 * Weapon-test rules for playMode 'weaponTest'.
 * The battle scene owns the player, the real loadout, and the projectiles.
 * This module owns the target, the damage log, and the top-right hit targets.
 * P writes state.main, T writes state.sub (homing, or null when off), and B
 * writes state.bombs. Holding fire uses the battle scene's stepFireClock /
 * fireVolley path, so missiles spawn and can hit the target.
 */

import {
  LOGICAL_H,
  LOGICAL_W,
  WEAPON_TEST_BOMBS_MAX,
  WEAPON_TEST_DPS_WINDOW,
  WEAPON_TEST_SUB_MAX,
  WEAPON_TEST_TARGET_H,
  WEAPON_TEST_TARGET_W,
  WEAPON_TEST_TARGET_X,
  WEAPON_TEST_TARGET_Y,
} from '@/game/config';
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
const LABEL_W = 22;

export const WEAPON_TEST_STATS_PANEL: Rect = { x: STATS_X, y: STATS_Y, w: 160, h: 150 };

export const WEAPON_TEST_CTRL_PANEL: Rect = {
  x: CTRL_X,
  y: CTRL_Y,
  w: LABEL_W + 3 * SLOT_W + 2 * SLOT_GAP + 12,
  h: 8 + 4 * ROW_STEP + SLOT_H - ROW_STEP + 10,
};

function slot(row: number, col: number): Rect {
  return {
    x: CTRL_X + LABEL_W + col * (SLOT_W + SLOT_GAP),
    y: CTRL_Y + 8 + row * ROW_STEP,
    w: SLOT_W,
    h: SLOT_H,
  };
}

export function weaponTestRowLabelY(row: number): number {
  return CTRL_Y + 8 + row * ROW_STEP + SLOT_H / 2;
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
    y: CTRL_Y + 8 + 3 * ROW_STEP,
    w: 3 * SLOT_W + 2 * SLOT_GAP,
    h: SLOT_H,
  };
}

export type WeaponTestCommand =
  | { kind: 'main'; level: 1 | 2 | 3 }
  | { kind: 'sub'; level: 0 | 1 | 2 }
  | { kind: 'bombs'; delta: -1 | 1 }
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
  return null;
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
