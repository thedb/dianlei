import { describe, expect, it } from 'vitest';
import {
  FIRE_RATE,
  HITBOX_RADIUS,
  LV2_GAP,
  LV3_SPREAD_DEG,
  MATE_OFFSET_X,
  PALETTE_SIZE,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_SPEED,
} from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import { weaponLevel } from '@/game/systems/playerWeapons';
import type { WeaponEmitter } from '@/game/systems/playerWeapons';
import { listShips, shipDef, type ShipId } from './shipDefs';

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  width?: number;
  height?: number;
}

function volley(id: ShipId, level: number, x = 180, y = 560): Shot[] {
  const shots: Shot[] = [];
  const emit: WeaponEmitter = {
    bullet(sx, sy, vx, vy, damage, width, height) {
      const shot: Shot = { x: sx, y: sy, vx, vy, damage };
      if (width !== undefined) shot.width = width;
      if (height !== undefined) shot.height = height;
      shots.push(shot);
    },
    missile() {
      throw new Error('main gun does not fire missiles');
    },
  };
  shipDef(id).fire(level, x, y, emit);
  return shots;
}

describe('ship table', () => {
  it('keeps the original 48 colors and appends Jason purple and gold', () => {
    expect(PALETTE_SIZE).toBe(PALETTE.length);
    expect(PALETTE).toHaveLength(52);
    expect(PALETTE[0]).toBe('#000000');
    expect(PALETTE[10]).toBe('#00e5ff');
    expect(PALETTE[47]).toBe('#ffe0ff');
    expect(COLOR.PLAYER_PURPLE).toBe(48);
    expect(COLOR.PLAYER_GOLD_LIGHT).toBe(51);
    expect(PALETTE[COLOR.PLAYER_PURPLE_MID]).toBe('#552583');
    expect(PALETTE[COLOR.PLAYER_GOLD_LIGHT]).toBe('#fdb927');
    expect(PALETTE[COLOR.PLAYER_GOLD]).not.toBe(PALETTE[COLOR.EXPLOSION_ORANGE_YELLOW]);
    expect(PALETTE[COLOR.PLAYER_PURPLE]).not.toBe(PALETTE[COLOR.BULLET_MAGENTA]);
  });

  it('leaves the locked Eagle exports on the Eagle row', () => {
    const eagle = shipDef(undefined);
    expect(eagle.id).toBe('eagle');
    expect(shipDef(null).speed).toBe(PLAYER_SPEED);
    expect(eagle).toMatchObject({
      name: 'Eagle',
      speed: PLAYER_SPEED,
      hitRadius: HITBOX_RADIUS,
      spriteW: 28,
      spriteH: 32,
      fireRate: FIRE_RATE,
      bulletDamage: PLAYER_BULLET_DAMAGE,
      bulletSpeed: PLAYER_BULLET_SPEED,
      mateOffsetX: MATE_OFFSET_X,
    });
    expect(eagle.speed).toBe(280);
    expect(eagle.fireRate).toBe(5);
    expect(eagle.bulletDamage).toBe(2);
  });

  it('locks Mandy and Jason numbers and copy', () => {
    expect(listShips().map((s) => s.name)).toEqual(['Eagle', 'Mandy', 'Jason']);
    expect(shipDef('mandy')).toMatchObject({
      role: '轰炸',
      speed: 240,
      hitRadius: 3,
      spriteW: 32,
      spriteH: 36,
      fireRate: 4,
      bulletDamage: 1.5,
      thickDamage: 2.5,
      bulletSpeed: 720,
      muzzleY: 18,
      mateOffsetX: 32,
      flame: { baseLength: 10, baseWidth: 5 },
    });
    expect(shipDef('mandy').lines.join('')).toContain('主炮更宽');
    expect(shipDef('jason')).toMatchObject({
      role: '高速',
      speed: 420,
      hitRadius: 2,
      spriteW: 22,
      spriteH: 26,
      fireRate: 10,
      bulletDamage: 1,
      bulletSpeed: 900,
      muzzleY: 13,
      mateOffsetX: 20,
      flame: { baseLength: 12, baseWidth: 6 },
    });
    expect(shipDef('jason').lines.join('')).toContain('炮弹更快');
    expect(shipDef('eagle').lines.join('')).toContain('火力取中');
  });

  it('delegates Eagle volleys to the existing vulcan fire', () => {
    for (const level of [1, 2, 3]) {
      const fromShip = volley('eagle', level);
      const direct: Shot[] = [];
      weaponLevel('vulcan', level).fire(180, 560, {
        bullet(x, y, vx, vy, damage, width, height) {
          const shot: Shot = { x, y, vx, vy, damage };
          if (width !== undefined) shot.width = width;
          if (height !== undefined) shot.height = height;
          direct.push(shot);
        },
        missile() {},
      });
      expect(fromShip).toEqual(direct);
    }
  });

  it('fires Mandy wide and thin, then a thick center shell at Lv3', () => {
    const lv1 = volley('mandy', 1);
    expect(lv1.map((s) => s.x - 180)).toEqual([-12, 12]);
    expect(lv1.every((s) => s.damage === 1.5 && s.vy === -720 && s.vx === 0)).toBe(true);
    expect(lv1.every((s) => s.width === undefined && s.y === 560 - 18)).toBe(true);

    const lv2 = volley('mandy', 2);
    expect(lv2.map((s) => s.x - 180)).toEqual([-12, 0, 12]);
    expect(lv2.every((s) => s.damage === 1.5 && s.width === undefined)).toBe(true);

    const lv3 = volley('mandy', 3);
    expect(lv3.map((s) => s.x - 180)).toEqual([-12, 0, 12]);
    expect(lv3.every((s) => s.damage === 2.5 && s.width === 6 && s.height === 14)).toBe(true);
    expect(4 * 2 * 1.5).toBe(12);
    expect(4 * 3 * 1.5).toBe(18);
    expect(4 * 3 * 2.5).toBe(30);
  });

  it('fires Jason with Eagle spacing, damage 1, and speed 900', () => {
    const lv1 = volley('jason', 1);
    expect(lv1).toHaveLength(1);
    expect(lv1[0]).toMatchObject({ x: 180, y: 560 - 13, vx: 0, vy: -900, damage: 1 });

    const lv2 = volley('jason', 2);
    expect(lv2.map((s) => s.x)).toEqual([180 - LV2_GAP / 2, 180 + LV2_GAP / 2]);
    expect(lv2.every((s) => s.vy === -900 && s.damage === 1)).toBe(true);

    const spread = (LV3_SPREAD_DEG * Math.PI) / 180;
    const lv3 = volley('jason', 3);
    expect(lv3).toHaveLength(3);
    expect(lv3[0]).toMatchObject({ x: 180, vx: 0, vy: -900, damage: 1 });
    expect(lv3[1]!.x).toBe(176);
    expect(lv3[1]!.vx).toBeCloseTo(-Math.sin(spread) * 900);
    expect(lv3[1]!.vy).toBeCloseTo(-Math.cos(spread) * 900);
    expect(lv3[2]!.vx).toBeCloseTo(Math.sin(spread) * 900);
    expect(10 * 1).toBe(10);
    expect(10 * 2 * 1).toBe(20);
    expect(10 * 3 * 1).toBe(30);
  });
});
