import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  FIXED_DT,
  REAR_DIAG_FIRE_X_MIN,
  REAR_DIAG_SPAWN_X_LEFT,
  REAR_DIAG_SPAWN_X_RIGHT,
  SIDE_ARC_RADIUS,
  TANK_DIAG_CLIMB,
  TANK_DIAG_VX,
  TANK_ENTRY_SPEED,
  TURRET_TURN_RATE,
} from '@/game/config';
import {
  ENEMY_STATS,
  createEnemy,
  diveOnceOffset,
  enemyTravelHeading,
  headingSpriteRotation,
  isGroundEnemy,
  rearDiagHeading,
  enemyFireClockHeld,
  shouldEnemyFire,
  spawnEnemy,
  stepSlidePose,
  strafePose,
  updateEnemy,
} from './enemy';

function step(enemy: ReturnType<typeof createEnemy>, seconds: number, scroll = 0): void {
  const frames = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < frames; i++) updateEnemy(enemy, FIXED_DT, 180, 500, scroll);
}

describe('enemy movement', () => {
  it('treats tanks, turrets and missile cars as ground units', () => {
    expect(isGroundEnemy('tank')).toBe(true);
    expect(isGroundEnemy('turret2')).toBe(true);
    expect(isGroundEnemy('factory_aa')).toBe(true);
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

  it('drives tanks slower while bottom-corner tanks still climb on screen', () => {
    expect(TANK_ENTRY_SPEED).toBe(22);
    expect(TANK_DIAG_VX).toBe(19);
    expect(TANK_DIAG_CLIMB).toBe(45);
    expect(TANK_DIAG_CLIMB).toBeGreaterThan(BG_SCROLL_SPEED);

    const side = createEnemy();
    spawnEnemy(side, 'tank', 0, 200, { kind: 'ground', entry: 'left' }, { kind: 'none' });
    updateEnemy(side, 1, 180, 500, 0);
    expect(side.x).toBeCloseTo(TANK_ENTRY_SPEED, 4);
    expect(side.y).toBeCloseTo(200, 4);

    const diag = createEnemy();
    spawnEnemy(diag, 'tank', 40, 600, { kind: 'ground', entry: 'bottomLeft' }, { kind: 'none' });
    updateEnemy(diag, 1, 180, 500, 0);
    expect(diag.x - 40).toBeCloseTo(TANK_DIAG_VX, 4);
    expect(600 - diag.y).toBeCloseTo(TANK_DIAG_CLIMB, 4);

    const held = createEnemy();
    spawnEnemy(held, 'tank', 40, 654, { kind: 'ground', entry: 'bottomLeft' }, { kind: 'none' });
    updateEnemy(held, 1, 180, 500, BG_SCROLL_SPEED);
    expect(654 - held.y).toBeCloseTo(TANK_DIAG_CLIMB - BG_SCROLL_SPEED, 4);

    const turret = createEnemy();
    spawnEnemy(turret, 'turret2', 180, 100, { kind: 'ground' }, { kind: 'none' });
    updateEnemy(turret, 1, 180, 500, 0);
    expect(turret.x).toBeCloseTo(180, 5);

    const plane = createEnemy();
    spawnEnemy(plane, 'small', 0, 0, { kind: 'straight', speed: 150 }, { kind: 'none' });
    updateEnemy(plane, 1, 180, 500, 0);
    expect(plane.y).toBeCloseTo(150, 4);
  });

  it('drives tanks in from the sides and from the bottom corners', () => {
    const left = createEnemy();
    spawnEnemy(left, 'tank', -14, 200, { kind: 'ground', entry: 'left' }, { kind: 'none' });
    updateEnemy(left, 0.4, 180, 500, 0);
    expect(left.x).toBeGreaterThan(-14);
    expect(left.y).toBeCloseTo(200, 5);

    const right = createEnemy();
    spawnEnemy(right, 'tank', 380, 200, { kind: 'ground', entry: 'right' }, { kind: 'none' });
    updateEnemy(right, 0.4, 180, 500, 0);
    expect(right.x).toBeLessThan(380);

    const corner = createEnemy();
    spawnEnemy(corner, 'tank', 72, 660, { kind: 'ground', entry: 'bottomLeft' }, { kind: 'none' });
    updateEnemy(corner, 0.4, 180, 500, 0);
    expect(corner.x).toBeGreaterThan(72);
    expect(corner.y).toBeLessThan(660);
  });

  it('will not drive a tank onto water and leaves the river toward the bank', () => {
    const driver = createEnemy();
    spawnEnemy(
      driver,
      'tank',
      100,
      200,
      { kind: 'ground', entry: 'left', vx: 80 },
      { kind: 'none' }
    );
    const blocks = (x: number): boolean => x >= 120;
    for (let i = 0; i < 40; i++) {
      updateEnemy(driver, FIXED_DT, 180, 500, 0, { blocksTank: (x) => blocks(x) });
    }
    expect(driver.x).toBeGreaterThan(100);
    expect(driver.x).toBeLessThan(120);

    const wet = createEnemy();
    spawnEnemy(wet, 'tank', 40, 200, { kind: 'ground' }, { kind: 'none' });
    updateEnemy(wet, 0.5, 180, 500, 0, { blocksTank: (x) => x < 80 });
    expect(wet.x).toBeGreaterThan(40);
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

  it('climbs rear_diag up and inward from both lower edges', () => {
    expect(REAR_DIAG_SPAWN_X_LEFT).toBe(-16);
    expect(REAR_DIAG_SPAWN_X_RIGHT).toBe(376);
    expect(REAR_DIAG_FIRE_X_MIN).toBe(24);

    const left = createEnemy();
    spawnEnemy(
      left,
      'small',
      REAR_DIAG_SPAWN_X_LEFT,
      620,
      { kind: 'rear_diag', side: 'left', y0: 620, bearing: 28, speed: 170 },
      { kind: 'none' }
    );
    updateEnemy(left, 0.4, 180, 560, 0);
    const vx = Math.sin((28 * Math.PI) / 180) * 170;
    const vy = -Math.cos((28 * Math.PI) / 180) * 170;
    expect(left.x).toBeCloseTo(-16 + vx * 0.4, 4);
    expect(left.y).toBeCloseTo(620 + vy * 0.4, 4);
    expect(left.x).toBeCloseTo(16, 0);
    expect(left.y).toBeCloseTo(560, 0);
    expect(left.y).toBeLessThan(620);

    const right = createEnemy();
    spawnEnemy(
      right,
      'small',
      REAR_DIAG_SPAWN_X_RIGHT,
      620,
      { kind: 'rear_diag', side: 'right', y0: 620, bearing: 28, speed: 170 },
      { kind: 'none' }
    );
    updateEnemy(right, 0.4, 180, 560, 0);
    expect(REAR_DIAG_SPAWN_X_RIGHT - right.x).toBeCloseTo(left.x - REAR_DIAG_SPAWN_X_LEFT, 4);
    expect(right.y).toBeCloseTo(left.y, 4);
    expect(right.x).toBeLessThan(REAR_DIAG_SPAWN_X_RIGHT);
  });

  it('aims the nose-down sprite along the rear_diag climb', () => {
    const left = rearDiagHeading({
      kind: 'rear_diag',
      side: 'left',
      y0: 620,
      bearing: 28,
      speed: 170,
    });
    expect(left).toBe(152);
    const leftRot = headingSpriteRotation(left);
    expect(-Math.sin(leftRot)).toBeGreaterThan(0);
    expect(Math.cos(leftRot)).toBeLessThan(0);

    const right = rearDiagHeading({
      kind: 'rear_diag',
      side: 'right',
      y0: 620,
      bearing: 28,
      speed: 170,
    });
    expect(right).toBe(208);
    const rightRot = headingSpriteRotation(right);
    expect(-Math.sin(rightRot)).toBeLessThan(0);
    expect(Math.cos(rightRot)).toBeLessThan(0);
    expect(headingSpriteRotation(180)).toBeCloseTo(-Math.PI);
  });

  it('holds rear_diag fire until x is on the field, then honors firstDelay', () => {
    const waiting = createEnemy();
    spawnEnemy(
      waiting,
      'small',
      20,
      400,
      { kind: 'rear_diag', side: 'left', y0: 400, bearing: 28, speed: 170 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0 }
    );
    expect(shouldEnemyFire(waiting, 5, 180, 200).shouldFire).toBe(false);
    expect(waiting.fireTimer).toBe(0);
    expect(waiting.shotsFired).toBe(0);

    let guard = 0;
    while (waiting.x < REAR_DIAG_FIRE_X_MIN && guard < 30) {
      updateEnemy(waiting, FIXED_DT, 180, 200, 0);
      guard += 1;
    }
    expect(waiting.x).toBeGreaterThanOrEqual(REAR_DIAG_FIRE_X_MIN);
    expect(waiting.fireTimer).toBe(0);
    expect(shouldEnemyFire(waiting, FIXED_DT, 180, 200).shouldFire).toBe(true);

    const paced = createEnemy();
    spawnEnemy(
      paced,
      'small',
      40,
      400,
      { kind: 'rear_diag', side: 'left', y0: 400, bearing: 28, speed: 160 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0.55 }
    );
    expect(shouldEnemyFire(paced, 0.5, 180, 200).shouldFire).toBe(false);
    expect(shouldEnemyFire(paced, 0.05, 180, 200).shouldFire).toBe(true);
  });

  it('walks step_slide down, then sideways, then down again', () => {
    const right = { kind: 'step_slide' as const, speed: 130, drop: 72, run: 48, steps: 1 as const };
    const downT = 72 / 130;
    const sideT = (72 + 48) / 130;
    const early = stepSlidePose(right, downT - 0.02);
    expect(early.heading).toBe(0);
    expect(early.dx).toBe(0);
    expect(early.dy).toBeCloseTo(72 - 2.6, 4);
    const sliding = stepSlidePose(right, downT + 0.05);
    expect(sliding.heading).toBe(90);
    expect(sliding.dy).toBeCloseTo(72, 5);
    expect(sliding.dx).toBeCloseTo(6.5, 4);
    expect(-Math.sin(headingSpriteRotation(sliding.heading))).toBeGreaterThan(0);
    const after = stepSlidePose(right, sideT + 0.2);
    expect(after.heading).toBe(0);
    expect(after.dx).toBeCloseTo(48, 5);
    expect(after.dy).toBeCloseTo(72 + 26, 4);
    expect(Math.cos(headingSpriteRotation(after.heading))).toBeCloseTo(1, 5);

    const left = { ...right, run: -48 };
    const leftSlide = stepSlidePose(left, downT + 0.05);
    expect(leftSlide.heading).toBe(270);
    expect(leftSlide.dx).toBeCloseTo(-6.5, 4);
    expect(-Math.sin(headingSpriteRotation(leftSlide.heading))).toBeLessThan(0);

    const stair = { kind: 'step_slide' as const, speed: 160, drop: 56, run: 64, steps: 2 as const };
    const secondSide = (56 + 64 + 56 + 64) / 160;
    const atSide = stepSlidePose(stair, secondSide);
    expect(atSide.dx).toBeCloseTo(128, 4);
    expect(atSide.dy).toBeCloseTo(112, 4);
    expect(atSide.heading).toBe(90);
    const leaving = stepSlidePose(stair, secondSide + 0.25);
    expect(leaving.dx).toBeCloseTo(128, 4);
    expect(leaving.dy).toBeCloseTo(112 + 40, 4);
    expect(leaving.heading).toBe(0);

    const enemy = createEnemy();
    spawnEnemy(enemy, 'small', 180, -20, right, { kind: 'none' });
    step(enemy, 0.4);
    expect(enemy.x).toBeCloseTo(180, 4);
    expect(enemy.y).toBeCloseTo(-20 + 52, 4);
    expect(enemyTravelHeading(enemy)).toBe(0);
    step(enemy, 0.3);
    expect(enemy.y).toBeCloseTo(-20 + 72, 4);
    expect(enemy.x).toBeCloseTo(180 + 19, 4);
    expect(enemyTravelHeading(enemy)).toBe(90);
    step(enemy, 0.5);
    expect(enemy.x).toBeCloseTo(180 + 48, 4);
    expect(enemy.y).toBeCloseTo(-20 + 72 + 36, 4);
    expect(enemyTravelHeading(enemy)).toBe(0);
  });

  it('dives once on a fixed heading and does not peel outward', () => {
    const straight = diveOnceOffset({ kind: 'dive_once', speed: 240, angle: 0 }, 0.5);
    expect(straight.dx).toBe(0);
    expect(straight.dy).toBeCloseTo(120, 5);
    expect(straight.heading).toBe(0);

    const angled = { kind: 'dive_once' as const, speed: 200, angle: 18 };
    const enemy = createEnemy();
    spawnEnemy(enemy, 'small', 180, 40, angled, { kind: 'none' });
    step(enemy, 0.5);
    const midX = enemy.x;
    const midY = enemy.y;
    const vx = Math.sin((18 * Math.PI) / 180) * 200;
    const vy = Math.cos((18 * Math.PI) / 180) * 200;
    expect(midX).toBeCloseTo(180 + vx * 0.5, 4);
    expect(midY).toBeCloseTo(40 + vy * 0.5, 4);
    step(enemy, 0.5);
    expect(enemy.x - midX).toBeCloseTo(vx * 0.5, 4);
    expect(enemy.y - midY).toBeCloseTo(vy * 0.5, 4);
    expect(enemy.y).toBeGreaterThan(200);
    expect(enemyTravelHeading(enemy)).toBe(18);
    expect(-Math.sin(headingSpriteRotation(18))).toBeGreaterThan(0);
    expect(Math.cos(headingSpriteRotation(18))).toBeGreaterThan(0);

    const mirror = createEnemy();
    spawnEnemy(mirror, 'small', 180, 40, { ...angled, angle: -18 }, { kind: 'none' });
    step(mirror, 0.5);
    expect(mirror.x).toBeLessThan(180);
    expect(180 - mirror.x).toBeCloseTo(midX - 180, 4);
  });

  it('holds step_slide and dive_once fire off the field, then honors firstDelay', () => {
    const above = createEnemy();
    spawnEnemy(
      above,
      'small',
      180,
      -40,
      { kind: 'dive_once', speed: 180, angle: 0 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0 }
    );
    for (let i = 0; i < 12; i++) {
      expect(shouldEnemyFire(above, FIXED_DT, 180, 400).shouldFire).toBe(false);
      updateEnemy(above, FIXED_DT, 180, 400, 0);
    }
    expect(above.y).toBeLessThan(8);
    expect(above.fireTimer).toBe(0);
    expect(above.shotsFired).toBe(0);
    let guard = 0;
    while (above.y < 8 && guard < 40) {
      updateEnemy(above, FIXED_DT, 180, 400, 0);
      guard += 1;
    }
    expect(above.y).toBeGreaterThanOrEqual(8);
    expect(above.fireTimer).toBe(0);
    expect(shouldEnemyFire(above, FIXED_DT, 180, 400).shouldFire).toBe(true);

    const under = createEnemy();
    spawnEnemy(
      under,
      'small',
      180,
      700,
      { kind: 'dive_once', speed: 220, angle: 0 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0 }
    );
    expect(shouldEnemyFire(under, 3, 180, 400).shouldFire).toBe(false);
    expect(under.fireTimer).toBe(0);
    expect(under.shotsFired).toBe(0);

    const wide = createEnemy();
    spawnEnemy(
      wide,
      'small',
      8,
      200,
      { kind: 'dive_once', speed: 80, angle: -40 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0 }
    );
    expect(shouldEnemyFire(wide, 2, 180, 400).shouldFire).toBe(false);
    expect(wide.fireTimer).toBe(0);

    const ladder = createEnemy();
    spawnEnemy(
      ladder,
      'small',
      0,
      120,
      { kind: 'step_slide', speed: 120, drop: 40, run: 90, steps: 1 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0.2 }
    );
    guard = 0;
    while (ladder.x < REAR_DIAG_FIRE_X_MIN && guard < 80) {
      expect(shouldEnemyFire(ladder, FIXED_DT, 180, 400).shouldFire).toBe(false);
      updateEnemy(ladder, FIXED_DT, 180, 400, 0);
      guard += 1;
    }
    expect(ladder.x).toBeGreaterThanOrEqual(REAR_DIAG_FIRE_X_MIN);
    expect(ladder.y).toBeGreaterThanOrEqual(8);
    expect(ladder.y).toBeLessThanOrEqual(640);
    expect(ladder.fireTimer).toBe(0);
    expect(ladder.shotsFired).toBe(0);
    expect(shouldEnemyFire(ladder, 0.2, 180, 400).shouldFire).toBe(true);

    const leaving = createEnemy();
    spawnEnemy(
      leaving,
      'small',
      180,
      620,
      { kind: 'step_slide', speed: 400, drop: 200, run: 0, steps: 1 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 10 }
    );
    expect(shouldEnemyFire(leaving, 0.05, 180, 400).shouldFire).toBe(false);
    expect(leaving.fireTimer).toBeCloseTo(0.05, 5);
    guard = 0;
    while (leaving.y <= 640 && guard < 40) {
      updateEnemy(leaving, FIXED_DT, 180, 400, 0);
      guard += 1;
    }
    expect(leaving.y).toBeGreaterThan(640);
    const frozen = leaving.fireTimer;
    expect(shouldEnemyFire(leaving, 1, 180, 400).shouldFire).toBe(false);
    expect(leaving.fireTimer).toBe(frozen);
    expect(leaving.shotsFired).toBe(0);
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
    expect(ENEMY_STATS.factory_aa).toMatchObject({
      hp: 40,
      width: 32,
      height: 32,
      score: 1200,
      size: 'medium',
      category: 'ground',
      barrel: 'single',
    });
    expect(ENEMY_STATS.missile_car).toMatchObject({ hp: 12, width: 24, height: 32, score: 300 });
    expect(ENEMY_STATS.risk_crate).toMatchObject({
      hp: 6,
      shield: 12,
      width: 32,
      height: 16,
      score: 500,
    });
  });
});

describe('stage 3 moves', () => {
  it('keeps a planted jet on its map cell: scroll only, no drive', () => {
    const jet = createEnemy();
    spawnEnemy(jet, 'parked_fighter', 204, -16, { kind: 'planted' }, { kind: 'none' });
    for (let i = 0; i < 60; i++) updateEnemy(jet, FIXED_DT, 180, 500, i % 3 === 0 ? 1 : 0);
    expect(jet.x).toBe(204);
    expect(jet.y).toBe(-16 + 20);
    expect(enemyTravelHeading(jet)).toBeNull();
    expect(isGroundEnemy('parked_fighter')).toBe(true);
  });

  it('flies strafe as dive, level run, then exit, with the nose on each leg', () => {
    const move = {
      kind: 'strafe' as const,
      speed: 100,
      levelY: 150,
      run: 120,
      enterAngle: 0,
      exitAngle: 30,
    };
    expect(strafePose(move, -50, 1)).toEqual({ dx: 0, dy: 100, heading: 0, leg: 'enter' });
    const run = strafePose(move, -50, 2.5);
    expect(run.leg).toBe('run');
    expect(run.heading).toBe(90);
    expect(run.dy).toBeCloseTo(200, 6);
    expect(run.dx).toBeCloseTo(50, 6);
    const exit = strafePose(move, -50, 4.2);
    expect(exit.leg).toBe('exit');
    expect(exit.heading).toBe(30);
    expect(exit.dx).toBeCloseTo(120 + 0.5 * 100, 6);
    expect(exit.dy).toBeGreaterThan(200);

    const left = strafePose({ ...move, run: -120, enterAngle: -20 }, -50, 3);
    expect(left.leg).toBe('run');
    expect(left.heading).toBe(270);
    expect(left.dx).toBeLessThan(0);
  });

  it('runs the strafe fire clock only on the level leg', () => {
    const jet = createEnemy();
    spawnEnemy(
      jet,
      'strike',
      64,
      -24,
      { kind: 'strafe', speed: 120, levelY: 150, run: 150, enterAngle: 20, exitAngle: 25 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0.2 }
    );
    let fired = 0;
    let firedLeg = '';
    for (let i = 0; i < 600; i++) {
      if (shouldEnemyFire(jet, FIXED_DT, 180, 560).shouldFire) {
        fired += 1;
        jet.shotsFired += 1;
        if (jet.move.kind === 'strafe')
          firedLeg = strafePose(jet.move, jet.startY, jet.moveTimer).leg;
      }
      updateEnemy(jet, FIXED_DT, 180, 560, 0);
    }
    expect(fired).toBe(1);
    expect(firedLeg).toBe('run');
    expect(jet.y).toBeGreaterThan(150);
  });
});

describe('stage 4 naval moves', () => {
  it('holds wake-climb fire until the climb is on screen, then leaves upward', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'small',
      180,
      672,
      { kind: 'wake_climb', speed: 200, stopY: 400, hold: 0.4 },
      { kind: 'aimed1', maxShots: 1, firstDelay: 0.05, interval: 2 }
    );
    expect(shouldEnemyFire(enemy, FIXED_DT, 180, 500).shouldFire).toBe(false);
    let fired = false;
    for (let i = 0; i < 180 && !fired; i++) {
      updateEnemy(enemy, FIXED_DT, 180, 500, 0);
      fired = shouldEnemyFire(enemy, FIXED_DT, 180, 500).shouldFire;
    }
    expect(fired).toBe(true);
    expect(enemy.y).toBeLessThanOrEqual(632);
    for (let i = 0; i < 240 && enemy.phase !== 'exit'; i++)
      updateEnemy(enemy, FIXED_DT, 180, 500, 0);
    expect(enemy.phase).toBe('exit');
    const y = enemy.y;
    updateEnemy(enemy, FIXED_DT, 180, 500, 0);
    expect(enemy.y).toBeLessThan(y);
  });

  it('holds a water skim until it is inside the field', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'small',
      -40,
      0,
      { kind: 'cross_skim', side: 'left', y: 280, speed: 240 },
      { kind: 'splash', maxShots: 1, firstDelay: 0.05, interval: 1 }
    );
    expect(enemyFireClockHeld(enemy)).toBe(true);
    for (let i = 0; i < 30; i++) updateEnemy(enemy, FIXED_DT, 180, 500, 0);
    expect(enemy.y).toBe(280);
    expect(enemy.x).toBeGreaterThan(12);
    expect(enemyFireClockHeld(enemy)).toBe(false);
  });

  it('paints a radar lock before freezing the volley axis', () => {
    const enemy = createEnemy();
    spawnEnemy(
      enemy,
      'interceptor',
      180,
      20,
      { kind: 'radar_paint', stopY: 140, paint: 0.8, hold: 2 },
      {
        kind: 'pattern',
        pattern: {
          shape: 'fan',
          count: 3,
          spreadDeg: 20,
          aim: 'barrel',
          bullet: 'small',
          speed: 180,
        },
        maxShots: 1,
        firstDelay: 0.02,
        interval: 8,
      }
    );
    let shots = 0;
    for (let i = 0; i < 400 && enemy.phase !== 'hold'; i++) {
      updateEnemy(enemy, FIXED_DT, 300, 500, 0);
      if (shouldEnemyFire(enemy, FIXED_DT, 300, 500).shouldFire) shots += 1;
    }
    expect(enemy.phase).toBe('hold');
    expect(shots).toBe(0);
    for (let i = 0; i < 40; i++) {
      updateEnemy(enemy, FIXED_DT, 300, 500, 0);
      if (shouldEnemyFire(enemy, FIXED_DT, 300, 500).shouldFire) shots += 1;
    }
    expect(enemy.moveTimer).toBeLessThan(0.8);
    expect(shots).toBe(0);
    expect(enemy.lockFrozen).toBe(false);
    for (let i = 0; i < 40 && !enemy.lockFrozen; i++) {
      updateEnemy(enemy, FIXED_DT, 40, 80, 0);
      if (shouldEnemyFire(enemy, FIXED_DT, 40, 80).shouldFire) shots += 1;
    }
    expect(enemy.lockFrozen).toBe(true);
    const frozen = enemy.aimAngle;
    for (let i = 0; i < 10 && shots === 0; i++) {
      updateEnemy(enemy, FIXED_DT, 20, 600, 0);
      if (shouldEnemyFire(enemy, FIXED_DT, 20, 600).shouldFire) shots += 1;
    }
    expect(shots).toBe(1);
    expect(enemy.aimAngle).toBeCloseTo(frozen, 5);
  });
});
