import { describe, expect, it } from 'vitest';
import {
  FIRE_RATE,
  HOMING_DAMAGE,
  HOMING_FIRE_RATE,
  HOMING_MAX_LEVEL,
  LV2_GAP,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  POWER_MAX,
  P_OVERFLOW_SCORE,
} from '@/game/config';
import { ITEM_DEFS, type ItemType } from '@/game/entities/item';
import {
  WEAPONS,
  applyDeathPenalty,
  applyWeaponPickup,
  createLoadout,
  stepFireClock,
  weaponForItem,
  weaponLevel,
  type WeaponDef,
  type WeaponEmitter,
  type WeaponId,
} from './playerWeapons';

interface Shot {
  kind: 'bullet' | 'missile';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  angle?: number;
  damage: number;
}

function record(): WeaponEmitter & { shots: Shot[] } {
  const shots: Shot[] = [];
  return {
    shots,
    bullet: (x, y, vx, vy, damage) => shots.push({ kind: 'bullet', x, y, vx, vy, damage }),
    missile: (x, y, angle, damage) => shots.push({ kind: 'missile', x, y, angle, damage }),
  };
}

function volley(id: WeaponId, level: number): Shot[] {
  const emit = record();
  weaponLevel(id, level).fire(180, 560, emit);
  return emit.shots;
}

describe('weapon registry', () => {
  it('maps each weapon letter to one weapon and slot', () => {
    expect(weaponForItem('P')?.id).toBe('vulcan');
    expect(weaponForItem('T')?.id).toBe('homing');
    expect(weaponForItem('B')).toBeUndefined();
    expect(WEAPONS.vulcan.slot).toBe('main');
    expect(WEAPONS.homing.slot).toBe('sub');
    for (const def of Object.values(WEAPONS)) {
      expect(def.levels).toHaveLength(def.maxLevel);
      expect(ITEM_DEFS[def.item].effect).toBe('weapon');
    }
    for (const type of Object.keys(ITEM_DEFS) as ItemType[]) {
      const isWeapon = ITEM_DEFS[type].effect === 'weapon';
      expect(weaponForItem(type) !== undefined, type).toBe(isWeapon);
    }
  });

  it('keeps vulcan P as Lv1–3 with the old bullet layout', () => {
    expect(WEAPONS.vulcan.maxLevel).toBe(POWER_MAX);
    for (let lv = 1; lv <= 3; lv++) {
      expect(weaponLevel('vulcan', lv).rate).toBe(FIRE_RATE);
      expect(weaponLevel('vulcan', lv).damage).toBe(PLAYER_BULLET_DAMAGE);
    }
    expect(volley('vulcan', 1)).toEqual([
      {
        kind: 'bullet',
        x: 180,
        y: 544,
        vx: 0,
        vy: -PLAYER_BULLET_SPEED,
        damage: PLAYER_BULLET_DAMAGE,
      },
    ]);
    expect(PLAYER_BULLET_DAMAGE).toBe(2);
    const lv2 = volley('vulcan', 2);
    expect(lv2.map((s) => s.x)).toEqual([180 - LV2_GAP / 2, 180 + LV2_GAP / 2]);
    for (const s of lv2) expect(s.damage).toBe(2);
    const lv3 = volley('vulcan', 3);
    expect(lv3.map((s) => s.x)).toEqual([180, 176, 184]);
    expect(lv3[1]!.vx).toBeLessThan(0);
    expect(lv3[2]!.vx).toBeGreaterThan(0);
    for (const s of lv3) {
      expect(Math.hypot(s.vx!, s.vy!)).toBeCloseTo(PLAYER_BULLET_SPEED);
      expect(s.damage).toBe(2);
    }
  });

  it('fires T at the pinned 1.5 volleys/s and 2.5 damage', () => {
    expect(HOMING_FIRE_RATE).toBe(1.5);
    expect(HOMING_DAMAGE).toBe(2.5);
    expect(FIRE_RATE).toBe(5);
    expect(HOMING_MAX_LEVEL).toBe(2);
    for (let lv = 1; lv <= HOMING_MAX_LEVEL; lv++) {
      expect(weaponLevel('homing', lv).rate).toBe(HOMING_FIRE_RATE);
      expect(weaponLevel('homing', lv).damage).toBe(HOMING_DAMAGE);
    }
    const one = volley('homing', 1);
    expect(one).toHaveLength(1);
    expect(one[0]!.kind).toBe('missile');
    expect(one[0]!.angle).toBeCloseTo(-Math.PI / 2);
    const two = volley('homing', 2);
    expect(two).toHaveLength(2);
    for (const s of two) {
      expect(s.kind).toBe('missile');
      expect(s.damage).toBe(HOMING_DAMAGE);
    }
    expect(two[0]!.x).toBeLessThan(180);
    expect(two[1]!.x).toBeGreaterThan(180);
  });

  it('holds 5 main volleys and 1.5 sub volleys per second while firing', () => {
    const dt = 1 / 60;
    const count = (rate: number): number => {
      const interval = 1 / rate;
      let clock = interval;
      let fired = 0;
      for (let i = 0; i < 600; i++) clock = stepFireClock(clock, dt, interval, true, () => fired++);
      return fired;
    };
    // 600 frames is 10s. The clock starts charged, and that opening shot sits inside the window: 50 volleys.
    expect(count(weaponLevel('vulcan', 1).rate)).toBe(FIRE_RATE * 10);
    expect(count(weaponLevel('homing', 1).rate)).toBe(16);
  });

  it('fires once on press and never while released', () => {
    let fired = 0;
    let clock = 0.6;
    for (let i = 0; i < 120; i++) clock = stepFireClock(clock, 1 / 60, 0.6, false, () => fired++);
    expect(fired).toBe(0);
    expect(clock).toBe(0.6);
    stepFireClock(clock, 1 / 60, 0.6, true, () => fired++);
    expect(fired).toBe(1);
  });
});

describe('weapon pickup rules', () => {
  it('levels the same main weapon up to its max, then pays the overflow score', () => {
    const l = createLoadout();
    expect(l).toEqual({ main: { id: 'vulcan', level: 1 }, sub: null });
    expect(applyWeaponPickup(l, 'vulcan')).toBe('levelUp');
    expect(applyWeaponPickup(l, 'vulcan')).toBe('levelUp');
    expect(l.main.level).toBe(3);
    expect(applyWeaponPickup(l, 'vulcan')).toBe('overflow');
    expect(l.main.level).toBe(3);
    expect(WEAPONS.vulcan.overflowScore).toBe(P_OVERFLOW_SCORE);
    expect(l.sub).toBeNull();
  });

  it('equips T into the empty sub slot, levels it to 2, then overflows', () => {
    const l = createLoadout();
    expect(applyWeaponPickup(l, 'homing')).toBe('equip');
    expect(l.sub).toEqual({ id: 'homing', level: 1 });
    expect(applyWeaponPickup(l, 'homing')).toBe('levelUp');
    expect(l.sub?.level).toBe(2);
    expect(applyWeaponPickup(l, 'homing')).toBe('overflow');
    expect(l.sub?.level).toBe(2);
    expect(WEAPONS.homing.overflowScore).toBe(P_OVERFLOW_SCORE);
  });

  it('keeps the two slots independent', () => {
    const l = createLoadout();
    applyWeaponPickup(l, 'homing');
    expect(l.main).toEqual({ id: 'vulcan', level: 1 });
    applyWeaponPickup(l, 'vulcan');
    applyWeaponPickup(l, 'vulcan');
    applyWeaponPickup(l, 'vulcan');
    expect(l.sub).toEqual({ id: 'homing', level: 1 });
    expect(l.main.level).toBe(3);
  });

  it('switches to a different weapon of the same slot and clamps the level', () => {
    const laser: WeaponDef = { ...WEAPONS.vulcan, id: 'laser' as WeaponId, item: 'P', maxLevel: 2 };
    const registry = { ...WEAPONS, laser } as Record<WeaponId, WeaponDef>;
    const l = createLoadout();
    l.main.level = 3;
    applyWeaponPickup(l, 'homing', registry);
    applyWeaponPickup(l, 'homing', registry);
    expect(applyWeaponPickup(l, 'laser' as WeaponId, registry)).toBe('switch');
    expect(l.main).toEqual({ id: 'laser', level: 2 });
    expect(l.sub).toEqual({ id: 'homing', level: 2 });
    expect(applyWeaponPickup(l, 'vulcan', registry)).toBe('switch');
    expect(l.main).toEqual({ id: 'vulcan', level: 2 });
  });
});

describe('weapon death rules', () => {
  it('drops main one level, never below Lv1', () => {
    const l = createLoadout();
    l.main.level = 3;
    applyDeathPenalty(l);
    expect(l.main.level).toBe(2);
    applyDeathPenalty(l);
    applyDeathPenalty(l);
    expect(l.main.level).toBe(1);
  });

  it('drops sub one level and empties the slot from Lv1', () => {
    const l = createLoadout();
    applyWeaponPickup(l, 'homing');
    applyWeaponPickup(l, 'homing');
    applyDeathPenalty(l);
    expect(l.sub).toEqual({ id: 'homing', level: 1 });
    applyDeathPenalty(l);
    expect(l.sub).toBeNull();
    applyDeathPenalty(l);
    expect(l.sub).toBeNull();
    expect(applyWeaponPickup(l, 'homing')).toBe('equip');
  });
});
