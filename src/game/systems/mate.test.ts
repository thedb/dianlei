import { describe, expect, it } from 'vitest';
import {
  DEATH_MATE_LOSS,
  EB_HIT_RADIUS_LARGE,
  HITBOX_RADIUS,
  MATE_MAX_LEVEL,
  MATE_MUZZLE_Y,
  MATE_OFFSET_X,
  MATE_OFFSET_Y,
  MATE_SCALE,
  PLAYER_BULLET_DAMAGE,
  PLAYER_BULLET_SPEED,
  VULCAN_MUZZLE_Y,
} from '@/game/config';
import { PLAYER_SPRITE_H, PLAYER_SPRITE_W } from '@/game/art/playerSprite';
import { checkPlayerBulletCollision, checkPlayerEnemyCollision } from '@/game/systems/collision';
import {
  applyDeathPenalty,
  applyWeaponPickup,
  createLoadout,
  weaponLevel,
  type WeaponEmitter,
} from '@/game/systems/playerWeapons';
import {
  applyMateDeath,
  applyMatePickup,
  fireMates,
  mateCount,
  mateLevel,
  matePixels,
  matePlacements,
} from './mate';

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
}

function record(): WeaponEmitter & { shots: Shot[] } {
  const shots: Shot[] = [];
  return {
    shots,
    bullet: (x, y, vx, vy, damage) => shots.push({ x, y, vx, vy, damage }),
    missile: () => {
      throw new Error('wingmen do not fire missiles');
    },
  };
}

describe('wingman slot M', () => {
  it('starts at 0 and clamps to 0–2', () => {
    expect(createLoadout().mate).toBe(0);
    expect(MATE_MAX_LEVEL).toBe(2);
    expect(mateLevel(0)).toBe(0);
    expect(mateLevel(1)).toBe(1);
    expect(mateLevel(2)).toBe(2);
    expect(mateLevel(9)).toBe(2);
    expect(mateLevel(-3)).toBe(0);
    expect(mateLevel(Number.NaN)).toBe(0);
    expect(applyMatePickup(0)).toEqual({ level: 1, result: 'levelUp' });
    expect(applyMatePickup(1)).toEqual({ level: 2, result: 'levelUp' });
    expect(applyMatePickup(2)).toEqual({ level: 2, result: 'overflow' });
    expect(applyMatePickup(9)).toEqual({ level: 2, result: 'overflow' });
    expect(mateCount(0)).toBe(0);
    expect(mateCount(1)).toBe(1);
    expect(mateCount(2)).toBe(2);
    expect(mateCount(4)).toBe(2);
  });

  it('places one ship on the left at M=1 and one on each side at M=2', () => {
    expect(matePlacements(0)).toEqual([]);
    expect(matePlacements(1)).toEqual([{ side: 'left', dx: -MATE_OFFSET_X, dy: MATE_OFFSET_Y }]);
    expect(MATE_OFFSET_X).toBe(25.6);
    expect(MATE_OFFSET_X).toBeCloseTo(32 * 0.8);
    expect(MATE_OFFSET_Y).toBe(0);
    const both = matePlacements(2);
    expect(both.map((p) => p.side)).toEqual(['left', 'right']);
    expect(both.map((p) => p.dx)).toEqual([-MATE_OFFSET_X, MATE_OFFSET_X]);
    expect(both.every((p) => p.dy === 0)).toBe(true);
  });

  it('draws the player sprite at about one third', () => {
    expect(MATE_SCALE).toBeCloseTo(1 / 3);
    expect(matePixels(PLAYER_SPRITE_W)).toBe(9);
    expect(matePixels(PLAYER_SPRITE_H)).toBe(11);
    expect(Math.abs(matePixels(PLAYER_SPRITE_W) / PLAYER_SPRITE_W - 1 / 3)).toBeLessThan(0.02);
    expect(Math.abs(matePixels(PLAYER_SPRITE_H) / PLAYER_SPRITE_H - 1 / 3)).toBeLessThan(0.02);
  });

  it('fires one straight base-damage bullet per wingman', () => {
    const none = record();
    fireMates(0, 180, 560, none);
    expect(none.shots).toEqual([]);

    const left = record();
    fireMates(1, 180, 560, left);
    expect(left.shots).toEqual([
      {
        x: 180 - MATE_OFFSET_X,
        y: 560 - MATE_MUZZLE_Y,
        vx: 0,
        vy: -PLAYER_BULLET_SPEED,
        damage: PLAYER_BULLET_DAMAGE,
      },
    ]);
    expect(PLAYER_BULLET_DAMAGE).toBe(2);
    expect(MATE_MUZZLE_Y).toBeCloseTo(VULCAN_MUZZLE_Y * MATE_SCALE);

    const both = record();
    fireMates(2, 100, 400, both);
    expect(both.shots).toHaveLength(2);
    expect(both.shots.map((s) => s.x)).toEqual([100 - MATE_OFFSET_X, 100 + MATE_OFFSET_X]);
    for (const shot of both.shots) {
      expect(shot.vx).toBe(0);
      expect(shot.vy).toBe(-PLAYER_BULLET_SPEED);
      expect(shot.damage).toBe(PLAYER_BULLET_DAMAGE);
      expect(shot.y).toBeCloseTo(400 - MATE_MUZZLE_Y);
    }
  });

  it('does not take the vulcan pattern or its damage when P levels up', () => {
    const loadout = createLoadout();
    loadout.mate = 2;
    expect(applyWeaponPickup(loadout, 'vulcan')).toBe('levelUp');
    expect(applyWeaponPickup(loadout, 'vulcan')).toBe('levelUp');
    expect(applyWeaponPickup(loadout, 'homing')).toBe('equip');
    expect(loadout.main.level).toBe(3);
    expect(loadout.mate).toBe(2);

    const mates = record();
    fireMates(loadout.mate, 180, 560, mates);
    expect(mates.shots).toHaveLength(2);
    for (const shot of mates.shots) {
      expect(shot.damage).toBe(PLAYER_BULLET_DAMAGE);
      expect(shot.vx).toBe(0);
    }

    const vulcan = record();
    weaponLevel('vulcan', loadout.main.level).fire(180, 560, vulcan);
    expect(vulcan.shots).toHaveLength(3);
    expect(vulcan.shots.some((s) => s.vx !== 0)).toBe(true);
    expect(mates.shots).toHaveLength(2);
  });

  it('drops one level on death and stops at 0, independent of P and T', () => {
    expect(DEATH_MATE_LOSS).toBe(1);
    const loadout = createLoadout();
    loadout.main.level = 3;
    loadout.mate = 2;
    applyWeaponPickup(loadout, 'homing');
    applyWeaponPickup(loadout, 'homing');

    applyDeathPenalty(loadout);
    expect(loadout.mate).toBe(1);
    expect(loadout.main.level).toBe(2);
    expect(loadout.sub).toEqual({ id: 'homing', level: 1 });

    applyDeathPenalty(loadout);
    expect(loadout.mate).toBe(0);
    expect(loadout.main.level).toBe(1);
    expect(loadout.sub).toBeNull();

    applyDeathPenalty(loadout);
    expect(loadout.mate).toBe(0);
    expect(applyMateDeath(0)).toBe(0);
  });

  it('is not a collision target: a hit on the wingman misses the player', () => {
    const halfSprite = matePixels(PLAYER_SPRITE_W) / 2;
    const bulletReach = HITBOX_RADIUS + EB_HIT_RADIUS_LARGE;
    expect(MATE_OFFSET_X).toBeGreaterThan(bulletReach + halfSprite);

    for (const place of matePlacements(2)) {
      expect(checkPlayerBulletCollision(0, 0, place.dx, place.dy, EB_HIT_RADIUS_LARGE)).toBe(false);
      // A body the size of the drawn wingman still misses the player. Wingmen are not colliders.
      expect(checkPlayerEnemyCollision(0, 0, place.dx, place.dy, halfSprite)).toBe(false);
      const innerX = place.dx - Math.sign(place.dx) * halfSprite;
      expect(checkPlayerBulletCollision(0, 0, innerX, place.dy, EB_HIT_RADIUS_LARGE)).toBe(false);
    }
    expect(matePlacements(0)).toHaveLength(0);
  });
});
