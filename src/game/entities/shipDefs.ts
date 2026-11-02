/**
 * Eagle / Mandy / Jason. `FIRE_RATE`, `PLAYER_SPEED`, `HITBOX_RADIUS`, and the
 * other locked exports stay Eagle. Mandy and Jason read this table.
 * Eagle's volley calls the existing vulcan fire so a run with no `shipId`
 * stays on that path.
 */

import {
  FIRE_RATE,
  HITBOX_RADIUS,
  LV2_GAP,
  LV3_SPREAD_DEG,
  MATE_OFFSET_X,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_SPEED,
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
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
  /** Confirmed blurb, already broken for the 156px column. */
  lines: readonly string[];
  speed: number;
  hitRadius: number;
  spriteW: number;
  spriteH: number;
  /** Main-gun volleys per second. Thin-shell damage is `bulletDamage`. */
  fireRate: number;
  bulletDamage: number;
  /** Mandy Lv3 only. Other ships leave this unset. */
  thickDamage?: number;
  bulletSpeed: number;
  /** Muzzle distance above the ship center. Eagle's shots still use VULCAN_MUZZLE_Y. */
  muzzleY: number;
  mateOffsetX: number;
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

const MANDY_THIN = 1.5;
const MANDY_THICK = 2.5;
const MANDY_SPEED = 720;
const MANDY_MUZZLE_Y = 18;
const JASON_SPEED = 900;
const JASON_MUZZLE_Y = 13;
const JASON_DAMAGE = 1;
const SPREAD_RAD = (LV3_SPREAD_DEG * Math.PI) / 180;

function mandyFire(level: number, x: number, y: number, emit: WeaponEmitter): void {
  const xs = level <= 1 ? [-12, 12] : [-12, 0, 12];
  const thick = level >= 3;
  const damage = thick ? MANDY_THICK : MANDY_THIN;
  const by = y - MANDY_MUZZLE_Y;
  for (const dx of xs) {
    emit.bullet(x + dx, by, 0, -MANDY_SPEED, damage, thick ? 6 : undefined, thick ? 14 : undefined);
  }
}

function jasonFire(level: number, x: number, y: number, emit: WeaponEmitter): void {
  const by = y - JASON_MUZZLE_Y;
  const speed = JASON_SPEED;
  const straight = (sx: number) => emit.bullet(sx, by, 0, -speed, JASON_DAMAGE);
  if (level <= 1) {
    straight(x);
    return;
  }
  if (level === 2) {
    straight(x - LV2_GAP / 2);
    straight(x + LV2_GAP / 2);
    return;
  }
  const vx = Math.sin(SPREAD_RAD) * speed;
  const vy = -Math.cos(SPREAD_RAD) * speed;
  straight(x);
  emit.bullet(x - 4, by, -vx, vy, JASON_DAMAGE);
  emit.bullet(x + 4, by, vx, vy, JASON_DAMAGE);
}

const EAGLE: ShipDef = {
  id: 'eagle',
  name: 'Eagle',
  role: '均衡',
  lines: ['速度、判定和火力取中。'],
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

const MANDY: ShipDef = {
  id: 'mandy',
  name: 'Mandy',
  role: '轰炸',
  lines: ['机身更大，移速更低。', '主炮更宽，射速更慢。'],
  speed: 240,
  hitRadius: 3,
  spriteW: 32,
  spriteH: 36,
  fireRate: 4,
  bulletDamage: MANDY_THIN,
  thickDamage: MANDY_THICK,
  bulletSpeed: MANDY_SPEED,
  muzzleY: MANDY_MUZZLE_Y,
  mateOffsetX: 32,
  flame: {
    ...PLAYER_FLAME_CONFIG,
    baseLength: 10,
    baseWidth: 5,
    flickerAmount: 2,
  },
  deathBursts: [
    [0, 0, 0],
    [-8, -6, 0.08],
    [7, 5, 0.14],
    [-5, 8, 0.22],
    [6, -9, 0.3],
  ],
  fire: mandyFire,
};

const JASON: ShipDef = {
  id: 'jason',
  name: 'Jason',
  role: '高速',
  lines: ['机身更小，走位更快。', '连射更密，炮弹更快。'],
  speed: 420,
  hitRadius: 2,
  spriteW: 22,
  spriteH: 26,
  fireRate: 10,
  bulletDamage: JASON_DAMAGE,
  bulletSpeed: JASON_SPEED,
  muzzleY: JASON_MUZZLE_Y,
  mateOffsetX: 20,
  flame: {
    baseLength: 12,
    baseWidth: 6,
    flickerAmount: 2,
    coreColor: PALETTE[COLOR.PLAYER_GOLD_LIGHT],
    outerColor: PALETTE[COLOR.PLAYER_PURPLE_MID],
    glowColor: 'rgba(253, 185, 39, 0.35)',
  },
  deathBursts: [
    [0, 0, 0],
    [-5, -4, 0.08],
    [4, 3, 0.14],
    [-3, 5, 0.22],
    [4, -6, 0.3],
  ],
  fire: jasonFire,
};

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
