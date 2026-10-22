import { describe, expect, it } from 'vitest';
import { EB_SPEED_MISSILE, ENEMY_BULLET_SPEED_SCALE, MISSILE_HOMING_TIME } from '@/game/config';
import { createEnemy, spawnEnemy, updateEnemy } from './enemy';
import { executeFirePattern, updateEnemyBullet, type BulletSpawner } from './enemyBullet';
import { updateEnemyWeapons } from '@/game/systems/weapons';

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  homing: number;
}

function recorder(): { shots: Shot[]; spawner: BulletSpawner } {
  const shots: Shot[] = [];
  return {
    shots,
    spawner: {
      spawnBullet(x, y, vx, vy, type, homing = 0) {
        shots.push({ x, y, vx, vy, type, homing });
      },
      getBulletCount: () => shots.length,
    },
  };
}

describe('enemy fire patterns', () => {
  it('fires a two-arm spiral of small bullets, distinct from an aimed triple', () => {
    const spiral = recorder();
    executeFirePattern(
      { kind: 'spiral', interval: 0.18, arms: 2, rotStep: 22 },
      180,
      120,
      40,
      500,
      spiral.spawner,
      { rotation: 20 }
    );
    expect(spiral.shots).toHaveLength(2);
    expect(spiral.shots.every((s) => s.type === 'small')).toBe(true);
    expect(spiral.shots[0]!.vx).not.toBeCloseTo(spiral.shots[1]!.vx);

    const aimed = recorder();
    executeFirePattern({ kind: 'aimed_fast3', interval: 1.15 }, 180, 120, 40, 500, aimed.spawner);
    expect(aimed.shots).toHaveLength(3);
    expect(aimed.shots.every((s) => s.type === 'small')).toBe(true);
    const spiralSpeed = Math.hypot(spiral.shots[0]!.vx, spiral.shots[0]!.vy);
    const aimedSpeed = Math.hypot(aimed.shots[0]!.vx, aimed.shots[0]!.vy);
    expect(aimedSpeed).toBeGreaterThan(spiralSpeed);
  });

  it('uses an explicit flight speed on spiral and aimed triples', () => {
    const spiral = recorder();
    executeFirePattern(
      { kind: 'spiral', interval: 0.12, arms: 4, rotStep: 22, speed: 180 },
      180,
      120,
      40,
      500,
      spiral.spawner
    );
    expect(spiral.shots).toHaveLength(4);
    expect(Math.hypot(spiral.shots[0]!.vx, spiral.shots[0]!.vy)).toBeCloseTo(180);

    const aimed = recorder();
    executeFirePattern(
      { kind: 'aimed_fast3', interval: 0.75, speed: 228 },
      180,
      120,
      40,
      500,
      aimed.spawner
    );
    expect(aimed.shots).toHaveLength(3);
    expect(Math.hypot(aimed.shots[0]!.vx, aimed.shots[0]!.vy)).toBeCloseTo(228);
  });

  it('fans five small bullets across the spread', () => {
    const { shots, spawner } = recorder();
    executeFirePattern({ kind: 'fan5', spread: 50, interval: 1.8 }, 180, 100, 180, 400, spawner);
    expect(shots).toHaveLength(5);
    expect(shots.every((s) => s.type === 'small')).toBe(true);
  });

  it('fires an 8-bullet ring and advances the rotation', () => {
    const { shots, spawner } = recorder();
    executeFirePattern(
      { kind: 'ring8', interval: 2.2, rotStep: 22.5 },
      180,
      120,
      180,
      400,
      spawner,
      {
        rotation: 22.5,
      }
    );
    expect(shots).toHaveLength(8);
    expect(shots.every((s) => s.type === 'large')).toBe(true);
    const firstAngle = Math.atan2(shots[0]!.vy, shots[0]!.vx);
    expect(firstAngle).toBeCloseTo((22.5 * Math.PI) / 180, 5);
  });

  it('fires fixed2 as a parallel pair separated by 10px', () => {
    const { shots, spawner } = recorder();
    executeFirePattern({ kind: 'fixed2', interval: 1.6 }, 180, 100, 180, 400, spawner, {
      aimAngle: Math.PI / 2,
    });
    expect(shots).toHaveLength(2);
    const dist = Math.hypot(shots[0]!.x - shots[1]!.x, shots[0]!.y - shots[1]!.y);
    expect(dist).toBeCloseTo(10, 5);
    expect(shots[0]!.vx).toBeCloseTo(shots[1]!.vx, 5);
    expect(shots[0]!.vy).toBeCloseTo(shots[1]!.vy, 5);
  });

  it('launches a missile that homes, then flies straight', () => {
    const { shots, spawner } = recorder();
    executeFirePattern({ kind: 'missile', interval: 3 }, 100, 100, 200, 300, spawner);
    expect(shots).toHaveLength(1);
    expect(shots[0]!.type).toBe('missile');
    expect(shots[0]!.homing).toBe(MISSILE_HOMING_TIME);
    const speed = Math.hypot(shots[0]!.vx, shots[0]!.vy);
    expect(speed).toBeCloseTo(EB_SPEED_MISSILE * ENEMY_BULLET_SPEED_SCALE, 4);

    const bullet = {
      active: true,
      x: 100,
      y: 100,
      prevX: 100,
      prevY: 100,
      vx: shots[0]!.vx,
      vy: shots[0]!.vy,
      type: 'missile' as const,
      hitRadius: 3,
      homing: 0.05,
      reset() {
        /* unused */
      },
    };
    const before = Math.atan2(bullet.vy, bullet.vx);
    updateEnemyBullet(bullet, 0.05, { x: 0, y: 100 });
    const after = Math.atan2(bullet.vy, bullet.vx);
    expect(after).not.toBeCloseTo(before, 3);
    expect(bullet.homing).toBe(0);
    const locked = Math.atan2(bullet.vy, bullet.vx);
    updateEnemyBullet(bullet, 0.05, { x: 0, y: 0 });
    expect(Math.atan2(bullet.vy, bullet.vx)).toBeCloseTo(locked, 5);
  });

  it('spaces an aimed3burst across three shots', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'medium',
      180,
      80,
      { kind: 'hover', stopY: 80, hold: 5 },
      { kind: 'aimed3burst', interval: 2, firstDelay: 0 }
    );
    enemy.y = 80;
    const { shots, spawner } = recorder();
    updateEnemyWeapons(enemy, 0.01, 180, 400, spawner, true);
    expect(shots).toHaveLength(1);
    updateEnemyWeapons(enemy, 0.12, 180, 400, spawner, true);
    updateEnemyWeapons(enemy, 0.12, 180, 400, spawner, true);
    expect(shots).toHaveLength(3);
  });

  it('fires a side-arc interceptor once, at the end of the arc', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'interceptor',
      -16,
      80,
      { kind: 'side_arc', side: 'left', y0: 80, speed: 400 },
      { kind: 'aimed1', maxShots: 1 }
    );
    const { shots, spawner } = recorder();
    updateEnemy(enemy, 0.2, 180, 400, 0);
    updateEnemyWeapons(enemy, 0.2, 180, 400, spawner, true);
    expect(enemy.phase).toBe('enter');
    expect(shots).toHaveLength(0);
    updateEnemy(enemy, 2, 180, 400, 0);
    updateEnemyWeapons(enemy, 2, 180, 400, spawner, true);
    expect(enemy.phase).toBe('exit');
    expect(shots).toHaveLength(1);
    updateEnemyWeapons(enemy, 2, 180, 400, spawner, true);
    expect(shots).toHaveLength(1);
  });
});
