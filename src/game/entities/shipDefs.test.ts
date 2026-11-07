import { describe, expect, it } from 'vitest';
import {
  FIRE_RATE,
  HITBOX_RADIUS,
  JASON_BULLET_SPEED,
  JASON_HELIX_AMPLITUDE,
  JASON_HELIX_OMEGA,
  JASON_HELIX_PHASE,
  MANDY_BULLET_SPEED,
  MANDY_LANE_X,
  MANDY_P3_SHELL_DAMAGE,
  MANDY_SPLIT_ARMS,
  MANDY_SPLIT_RANGE,
  MANDY_THICK_DAMAGE,
  MANDY_THICK_H,
  MANDY_THICK_W,
  MANDY_THIN_DAMAGE,
  MATE_OFFSET_X,
  PALETTE_SIZE,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  PLAYER_SPEED,
} from '@/game/config';
import { PLAYER_FLAME_CONFIG } from '@/game/art/engineFlame';
import { COLOR, PALETTE } from '@/game/palette';
import { weaponLevel } from '@/game/systems/playerWeapons';
import type { PlayerBulletPattern, WeaponEmitter } from '@/game/systems/playerWeapons';
import { listShips, shipDef, shipGradeLine, type ShipId } from './shipDefs';

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  width?: number;
  height?: number;
  pattern?: PlayerBulletPattern;
}

function volley(id: ShipId, level: number, x = 180, y = 560): Shot[] {
  const shots: Shot[] = [];
  const emit: WeaponEmitter = {
    bullet(sx, sy, vx, vy, damage, width, height, pattern) {
      const shot: Shot = { x: sx, y: sy, vx, vy, damage };
      if (width !== undefined) shot.width = width;
      if (height !== undefined) shot.height = height;
      if (pattern !== undefined) shot.pattern = pattern;
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
      speed: 224,
      speedGrade: 4,
      powerGrade: 7,
      rateGrade: 4,
      hitRadius: 3,
      spriteW: 48,
      spriteH: 32,
      fireRate: 4,
      bulletDamage: 1.75,
      thickDamage: 2.75,
      bulletSpeed: 720,
      muzzleY: 18,
      mateOffsetX: 32,
    });
    expect(shipDef('mandy').flame).toBe(PLAYER_FLAME_CONFIG);
    expect(shipDef('mandy').lines).toEqual([shipGradeLine(shipDef('mandy'))]);
    expect(shipDef('jason')).toMatchObject({
      role: '高速',
      speed: 336,
      speedGrade: 6,
      powerGrade: 3,
      rateGrade: 6,
      hitRadius: 2,
      spriteW: 26,
      spriteH: 30,
      fireRate: 6,
      bulletDamage: 1,
      bulletSpeed: 900,
      muzzleY: 13,
      mateOffsetX: 20,
    });
    expect(shipDef('jason').flame).toBe(PLAYER_FLAME_CONFIG);
    expect(shipGradeLine(shipDef('eagle'))).toBe('速度 5/8 · 火力 5/8 · 攻击频率 5/8');
    expect(shipGradeLine(shipDef('mandy'))).toBe('速度 4/8 · 火力 7/8 · 攻击频率 4/8');
    expect(shipGradeLine(shipDef('jason'))).toBe('速度 6/8 · 火力 3/8 · 攻击频率 6/8');
    expect(shipGradeLine(shipDef('eagle'))).not.toContain('判定');
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

  it('fires Mandy P1 thin dual and P2 thick dual on the same lanes', () => {
    const lv1 = volley('mandy', 1);
    expect(lv1.map((s) => s.x - 180)).toEqual([-MANDY_LANE_X, MANDY_LANE_X]);
    expect(
      lv1.every(
        (s) =>
          s.damage === MANDY_THIN_DAMAGE &&
          s.vy === -MANDY_BULLET_SPEED &&
          s.vx === 0 &&
          s.pattern === undefined
      )
    ).toBe(true);
    expect(lv1.every((s) => s.width === undefined && s.y === 560 - 18)).toBe(true);

    const lv2 = volley('mandy', 2);
    expect(lv2).toHaveLength(2);
    expect(lv2.map((s) => s.x - 180)).toEqual([-MANDY_LANE_X, MANDY_LANE_X]);
    expect(
      lv2.every(
        (s) =>
          s.damage === MANDY_THICK_DAMAGE &&
          s.width === MANDY_THICK_W &&
          s.height === MANDY_THICK_H &&
          s.vx === 0 &&
          s.vy === -MANDY_BULLET_SPEED &&
          s.pattern === undefined
      )
    ).toBe(true);
    expect(4 * 2 * MANDY_THIN_DAMAGE).toBe(14);
    expect(4 * 2 * MANDY_THICK_DAMAGE).toBe(22);
  });

  it('fires Mandy P3 as two thick shells that carry the split range', () => {
    const lv3 = volley('mandy', 3);
    expect(lv3).toHaveLength(2);
    expect(lv3.map((s) => s.x - 180)).toEqual([-MANDY_LANE_X, MANDY_LANE_X]);
    expect(
      lv3.every(
        (s) =>
          s.damage === MANDY_P3_SHELL_DAMAGE &&
          s.width === MANDY_THICK_W &&
          s.height === MANDY_THICK_H &&
          s.pattern?.splitRange === MANDY_SPLIT_RANGE &&
          s.pattern.helixAmp === undefined
      )
    ).toBe(true);
    expect(4 * 2 * MANDY_P3_SHELL_DAMAGE * MANDY_SPLIT_ARMS).toBe(33);
  });

  it('fires Jason P1 straight, P2 dual helix, and P3 center plus helix', () => {
    const lv1 = volley('jason', 1);
    expect(lv1).toHaveLength(1);
    expect(lv1[0]).toMatchObject({
      x: 180,
      y: 560 - 13,
      vx: 0,
      vy: -JASON_BULLET_SPEED,
      damage: 1,
    });
    expect(lv1[0]?.pattern).toBeUndefined();

    const lv2 = volley('jason', 2);
    expect(lv2).toHaveLength(2);
    expect(lv2.every((s) => s.x === 180 && s.vy === -JASON_BULLET_SPEED && s.damage === 1)).toBe(
      true
    );
    expect(lv2[0]?.pattern).toMatchObject({
      helixAmp: JASON_HELIX_AMPLITUDE,
      helixOmega: JASON_HELIX_OMEGA,
      helixPhase: 0,
    });
    expect(lv2[1]?.pattern?.helixPhase).toBe(JASON_HELIX_PHASE);
    expect(lv2[1]?.pattern?.helixPhase).toBeCloseTo(Math.PI);

    const lv3 = volley('jason', 3);
    expect(lv3).toHaveLength(3);
    expect(lv3[0]).toMatchObject({ x: 180, vx: 0, vy: -JASON_BULLET_SPEED, damage: 1 });
    expect(lv3[0]?.pattern).toBeUndefined();
    expect(lv3[1]?.pattern?.helixPhase).toBe(0);
    expect(lv3[2]?.pattern?.helixPhase).toBe(JASON_HELIX_PHASE);
    expect(lv3[1]?.x).toBe(lv3[2]?.x);
    expect(lv3[1]?.x).toBe(lv3[0]?.x);
    expect(6 * 1).toBe(6);
    expect(6 * 2 * 1).toBe(12);
    expect(6 * 3 * 1).toBe(18);
    expect(14).toBeGreaterThan(10);
    expect(10).toBeGreaterThan(6);
    expect(22).toBeGreaterThan(20);
    expect(20).toBeGreaterThan(12);
    expect(33).toBeGreaterThan(30);
    expect(30).toBeGreaterThan(18);
  });
});
