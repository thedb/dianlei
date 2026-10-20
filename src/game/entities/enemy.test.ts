import { describe, expect, it } from 'vitest';
import { FIXED_DT, SIDE_ARC_RADIUS, TURRET_TURN_RATE } from '@/game/config';
import { ENEMY_STATS, createEnemy, isGroundEnemy, spawnEnemy, updateEnemy } from './enemy';

function step(enemy: ReturnType<typeof createEnemy>, seconds: number, scroll = 0): void {
  const frames = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < frames; i++) updateEnemy(enemy, FIXED_DT, 180, 500, scroll);
}

describe('enemy movement', () => {
  it('treats tanks, turrets and missile cars as ground units', () => {
    expect(isGroundEnemy('tank')).toBe(true);
    expect(isGroundEnemy('turret2')).toBe(true);
    expect(isGroundEnemy('missile_car')).toBe(true);
    expect(isGroundEnemy('small')).toBe(false);
    expect(isGroundEnemy('bomber')).toBe(false);
  });

  it('scrolls ground units by the tile step and not by their own dive speed', () => {
    const enemy = createEnemy();
    spawnEnemy(enemy, 'tank', 72, -12, { kind: 'ground', vx: 20 }, { kind: 'none' });
    updateEnemy(enemy, FIXED_DT, 180, 500, 2);
    expect(enemy.y).toBeCloseTo(-10, 5);
    expect(enemy.x).toBeGreaterThan(72);
  });

  it('leaves a hover ship at stopY, then climbs away', () => {
    const enemy = createEnemy();
    spawnEnemy(enemy, 'medium', 180, -20, { kind: 'hover', stopY: 120, hold: 2 }, { kind: 'none' });
    step(enemy, 1.5);
    expect(enemy.phase).toBe('hold');
    expect(enemy.y).toBeCloseTo(120, 0);
    const yAtHold = enemy.y;
    step(enemy, 2);
    expect(enemy.phase).toBe('exit');
    expect(enemy.y).toBeLessThan(yAtHold);
  });

  it('pushes a bomber down slowly, holds, then leaves downward', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'bomber',
      180,
      0,
      { kind: 'slow_push', stopY: 40, hold: 0.2 },
      { kind: 'none' }
    );
    step(enemy, 0.5);
    expect(enemy.y).toBeGreaterThan(10);
    expect(enemy.y).toBeLessThanOrEqual(40.01);
    step(enemy, 1.2);
    expect(enemy.phase).toBe('exit');
    expect(enemy.y).toBeGreaterThan(40);
  });

  it('turns a side arc onto a downward dive', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'interceptor',
      -16,
      80,
      { kind: 'side_arc', side: 'left', y0: 80, speed: 170 },
      { kind: 'none' }
    );
    const arcTime = ((Math.PI / 2) * SIDE_ARC_RADIUS) / 170;
    step(enemy, arcTime + 0.05);
    expect(enemy.phase).toBe('exit');
    expect(enemy.x).toBeGreaterThan(100);
    expect(enemy.y).toBeGreaterThan(80 + SIDE_ARC_RADIUS - 1);
  });

  it('splits a V dive outward at 45 degrees', () => {
    const left = createEnemy();
    const right = createEnemy();
    spawnEnemy(
      left,
      'small',
      120,
      170,
      { kind: 'v_dive', speed: 120, stopY: 180 },
      { kind: 'none' }
    );
    spawnEnemy(
      right,
      'small',
      240,
      170,
      { kind: 'v_dive', speed: 120, stopY: 180 },
      { kind: 'none' }
    );
    step(left, 1);
    step(right, 1);
    expect(left.x).toBeLessThan(120);
    expect(right.x).toBeGreaterThan(240);
    expect(left.y).toBeGreaterThan(180);
  });

  it('holds an orbit at the requested radius, then drops', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'drone',
      180,
      -20,
      { kind: 'orbit', anchor: { x: 180, y: 150 }, r: 30, period: 2.5, hold: 2 },
      { kind: 'none' }
    );
    step(enemy, 1.6);
    expect(enemy.phase).toBe('hold');
    const dist = Math.hypot(enemy.x - 180, enemy.y - 150);
    expect(dist).toBeCloseTo(30, 0);
    step(enemy, 2);
    expect(enemy.phase).toBe('exit');
    expect(enemy.y).toBeGreaterThan(150);
  });

  it('crosses from the top-left toward the lower right', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'small',
      -12,
      40,
      { kind: 'cross', from: 'topLeft', speed: 160 },
      { kind: 'none' }
    );
    step(enemy, 0.5);
    expect(enemy.x).toBeGreaterThan(-12);
    expect(enemy.y).toBeGreaterThan(40);
  });

  it('limits turret traverse to TURRET_TURN_RATE', () => {
    const enemy = createEnemy();
    spawnEnemy(enemy, 'turret2', 180, 200, { kind: 'ground' }, { kind: 'fixed2', interval: 1.6 });
    const start = enemy.aimAngle;
    updateEnemy(enemy, 1, 400, 200, 0);
    const turned = Math.abs(enemy.aimAngle - start);
    expect(turned).toBeCloseTo((TURRET_TURN_RATE * Math.PI) / 180, 5);
    expect(turned).toBeLessThan(Math.PI / 2);
  });

  it('matches the wave-table size and HP table', () => {
    expect(ENEMY_STATS.small).toMatchObject({ hp: 3, width: 24, height: 24, score: 100 });
    expect(ENEMY_STATS.medium).toMatchObject({ hp: 24, width: 36, height: 36, score: 1000 });
    expect(ENEMY_STATS.interceptor).toMatchObject({ hp: 6, width: 28, height: 28, score: 200 });
    expect(ENEMY_STATS.bomber).toMatchObject({ hp: 60, width: 56, height: 48, score: 2000 });
    expect(ENEMY_STATS.drone).toMatchObject({ hp: 4, width: 20, height: 20, score: 300 });
    expect(ENEMY_STATS.tank).toMatchObject({ hp: 8, width: 24, height: 24, score: 200 });
    expect(ENEMY_STATS.turret2).toMatchObject({ hp: 30, width: 32, height: 32, score: 1000 });
    expect(ENEMY_STATS.missile_car).toMatchObject({ hp: 12, width: 24, height: 32, score: 300 });
  });
});
