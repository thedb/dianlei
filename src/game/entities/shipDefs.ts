/**
 * Eagle / Mandy / Jason. `FIRE_RATE`, `PLAYER_SPEED`, `HITBOX_RADIUS`, and the
 * other locked exports stay Eagle. Mandy and Jason read this table.
 * Eagle's volley calls the existing vulcan fire so a run with no `shipId`
 * stays on that path.
 */

import {
  FIRE_RATE,
  HITBOX_RADIUS,
  JASON_BULLET_DAMAGE,
  JASON_BULLET_SPEED,
  JASON_FIRE_RATE,
  JASON_HELIX_AMPLITUDE,
  JASON_HELIX_OMEGA,
  JASON_HELIX_PHASE,
  JASON_MUZZLE_Y,
  MANDY_BULLET_SPEED,
  MANDY_FIRE_RATE,
  MANDY_LANE_X,
  MANDY_MUZZLE_Y,
  MANDY_P3_SHELL_DAMAGE,
  MANDY_SPLIT_RANGE,
  MANDY_THICK_DAMAGE,
  MANDY_THICK_H,
  MANDY_THICK_W,
  MANDY_THIN_DAMAGE,
  MATE_OFFSET_X,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_SPEED,
} from '@/game/config';
import { PLAYER_FLAME_CONFIG, type FlameConfig } from '@/game/art/engineFlame';
import { weaponLevel, type WeaponEmitter } from '@/game/systems/playerWeapons';

export type ShipId = 'eagle' | 'mandy' | 'jason';

export const SHIP_IDS: readonly ShipId[] = ['eagle', 'mandy', 'jason'];

export const DEFAULT_SHIP: ShipId = 'eagle';

export function isShipId(value: unknown): value is ShipId {
  return value === 'eagle' || value === 'mandy' || value === 'jason';
}

export interface ShipDef {
  id: ShipId;
  /** On-screen name. Eagle / Mandy / Jason. */
  name: string;
  /** One-word role under the name plate. */
  role: string;
  /** Select-screen copy. The grade line, not the hit radius. */
  lines: readonly string[];
  /**
   * Eighths on the select screen (2026-11-04). Eagle is 5/8.
   * Speed eighth is `PLAYER_SPEED / 5` (56). Rate eighth is 1 volley/s.
   * Power eighth is 2 Lv1 full-hit DPS. Hit radius is not a grade.
   */
  speedGrade: number;
  powerGrade: number;
  rateGrade: number;
  speed: number;
  /** Kept on the table. The select screen does not draw it. */
  hitRadius: number;
  /** Drawn sheet. Eagle 28×32. Mandy and Jason are the 2026-11-04 G2 lock. */
  spriteW: number;
  spriteH: number;
  /** Main-gun volleys per second. Thin-shell damage is `bulletDamage`. */
  fireRate: number;
  bulletDamage: number;
  /** Mandy P2 thick shell. P3 flies a smaller shell that bursts. Other ships omit this. */
  thickDamage?: number;
  bulletSpeed: number;
  /** Muzzle distance above the ship center. Eagle's shots still use VULCAN_MUZZLE_Y. */
  muzzleY: number;
  mateOffsetX: number;
  /** TEMP: every ship uses Eagle's flame until G4. */
  flame: FlameConfig;
  /** [dx, dy, delay] around the wreck. Eagle's list is the historical one. */
  deathBursts: ReadonlyArray<readonly [number, number, number]>;
  fire(level: number, x: number, y: number, emit: WeaponEmitter): void;
}

const EAGLE_DEATH: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [-7, -5, 0.08],
  [6, 4, 0.14],
  [-4, 7, 0.22],
  [5, -8, 0.3],
];

function mandyShell(
  emit: WeaponEmitter,
  x: number,
  y: number,
  damage: number,
  thick: boolean,
  split: boolean
): void {
  emit.bullet(
    x,
    y,
    0,
    -MANDY_BULLET_SPEED,
    damage,
    thick ? MANDY_THICK_W : undefined,
    thick ? MANDY_THICK_H : undefined,
    split ? { splitRange: MANDY_SPLIT_RANGE } : undefined
  );
}

/**
 * P1 thin dual. P2 the same lanes, thick. P3 thick dual that splits
 * after MANDY_SPLIT_RANGE (the shell damage is the shard, ×6 on an early hit).
 */
function mandyFire(level: number, x: number, y: number, emit: WeaponEmitter): void {
  const by = y - MANDY_MUZZLE_Y;
  const left = x - MANDY_LANE_X;
  const right = x + MANDY_LANE_X;
  if (level >= 3) {
    mandyShell(emit, left, by, MANDY_P3_SHELL_DAMAGE, true, true);
    mandyShell(emit, right, by, MANDY_P3_SHELL_DAMAGE, true, true);
    return;
  }
  if (level === 2) {
    mandyShell(emit, left, by, MANDY_THICK_DAMAGE, true, false);
    mandyShell(emit, right, by, MANDY_THICK_DAMAGE, true, false);
    return;
  }
  mandyShell(emit, left, by, MANDY_THIN_DAMAGE, false, false);
  mandyShell(emit, right, by, MANDY_THIN_DAMAGE, false, false);
}

function jasonHelix(emit: WeaponEmitter, x: number, y: number, phase: number): void {
  emit.bullet(x, y, 0, -JASON_BULLET_SPEED, JASON_BULLET_DAMAGE, undefined, undefined, {
    helixAmp: JASON_HELIX_AMPLITUDE,
    helixOmega: JASON_HELIX_OMEGA,
    helixPhase: phase,
  });
}

/**
 * P1 one straight shot. P2 two helix streams half a cycle apart.
 * P3 adds the straight center stream. The volley clock stays JASON_FIRE_RATE.
 */
function jasonFire(level: number, x: number, y: number, emit: WeaponEmitter): void {
  const by = y - JASON_MUZZLE_Y;
  if (level <= 1) {
    emit.bullet(x, by, 0, -JASON_BULLET_SPEED, JASON_BULLET_DAMAGE);
    return;
  }
  if (level >= 3) {
    emit.bullet(x, by, 0, -JASON_BULLET_SPEED, JASON_BULLET_DAMAGE);
  }
  jasonHelix(emit, x, by, 0);
  jasonHelix(emit, x, by, JASON_HELIX_PHASE);
}

/** Select row: 速度 a/8 · 火力 b/8 · 攻击频率 c/8. No hitbox term. */
export function shipGradeLine(
  ship: Pick<ShipDef, 'speedGrade' | 'powerGrade' | 'rateGrade'>
): string {
  return `速度 ${ship.speedGrade}/8 · 火力 ${ship.powerGrade}/8 · 攻击频率 ${ship.rateGrade}/8`;
}

const EAGLE: ShipDef = {
  id: 'eagle',
  name: 'Eagle',
  role: '均衡',
  speedGrade: 5,
  powerGrade: 5,
  rateGrade: 5,
  lines: [],
  speed: PLAYER_SPEED,
  hitRadius: HITBOX_RADIUS,
  spriteW: 28,
  spriteH: 32,
  fireRate: FIRE_RATE,
  bulletDamage: PLAYER_BULLET_DAMAGE,
  bulletSpeed: PLAYER_BULLET_SPEED,
  muzzleY: 16,
  mateOffsetX: MATE_OFFSET_X,
  flame: PLAYER_FLAME_CONFIG,
  deathBursts: EAGLE_DEATH,
  fire(level, x, y, emit) {
    weaponLevel('vulcan', level).fire(x, y, emit);
  },
};
EAGLE.lines = [shipGradeLine(EAGLE)];

const MANDY: ShipDef = {
  id: 'mandy',
  name: 'Mandy',
  role: '轰炸',
  speedGrade: 4,
  powerGrade: 7,
  rateGrade: 4,
  lines: [],
  speed: 224,
  hitRadius: 3,
  spriteW: 48,
  spriteH: 32,
  fireRate: MANDY_FIRE_RATE,
  bulletDamage: MANDY_THIN_DAMAGE,
  thickDamage: MANDY_THICK_DAMAGE,
  bulletSpeed: MANDY_BULLET_SPEED,
  muzzleY: MANDY_MUZZLE_Y,
  mateOffsetX: 32,
  flame: PLAYER_FLAME_CONFIG,
  deathBursts: [
    [0, 0, 0],
    [-8, -6, 0.08],
    [7, 5, 0.14],
    [-5, 8, 0.22],
    [6, -9, 0.3],
  ],
  fire: mandyFire,
};
MANDY.lines = [shipGradeLine(MANDY)];

const JASON: ShipDef = {
  id: 'jason',
  name: 'Jason',
  role: '高速',
  speedGrade: 6,
  powerGrade: 3,
  rateGrade: 6,
  lines: [],
  speed: 336,
  hitRadius: 2,
  spriteW: 26,
  spriteH: 30,
  fireRate: JASON_FIRE_RATE,
  bulletDamage: JASON_BULLET_DAMAGE,
  bulletSpeed: JASON_BULLET_SPEED,
  muzzleY: JASON_MUZZLE_Y,
  mateOffsetX: 20,
  flame: PLAYER_FLAME_CONFIG,
  deathBursts: [
    [0, 0, 0],
    [-5, -4, 0.08],
    [4, 3, 0.14],
    [-3, 5, 0.22],
    [4, -6, 0.3],
  ],
  fire: jasonFire,
};
JASON.lines = [shipGradeLine(JASON)];

const SHIPS: Readonly<Record<ShipId, ShipDef>> = {
  eagle: EAGLE,
  mandy: MANDY,
  jason: JASON,
};

/** Unknown or omitted ids are Eagle, including attract and old replays. */
export function shipDef(id: ShipId | undefined | null): ShipDef {
  if (id && isShipId(id)) return SHIPS[id];
  return EAGLE;
}

export function listShips(): readonly ShipDef[] {
  return SHIP_IDS.map((id) => SHIPS[id]);
}
