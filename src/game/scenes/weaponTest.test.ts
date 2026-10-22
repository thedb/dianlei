import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import {
  BOMBS_START,
  CONTROL_BOTTOM_PAD,
  CONTROL_SCALE_MAX,
  FIRE_RATE,
  HOMING_DAMAGE,
  HOMING_FIRE_RATE,
  JOYSTICK_RADIUS,
  LIVES_START,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_BULLET_DAMAGE,
  POWER_MAX,
  RESPAWN_FLYIN_TIME,
  WEAPON_TEST_BOMBS_MAX,
  WEAPON_TEST_DAMAGE_MAX,
  WEAPON_TEST_DAMAGE_MIN,
  WEAPON_TEST_DAMAGE_STEP,
  WEAPON_TEST_DPS_WINDOW,
  WEAPON_TEST_RATE_MAX,
  WEAPON_TEST_RATE_MIN,
  WEAPON_TEST_RATE_STEP,
  WEAPON_TEST_SUB_MAX,
} from '@/game/config';
import { HIGH_SCORE_KEY } from '@/game/highScore';
import { getStage } from '@/game/levels/registry';
import { weaponLevel } from '@/game/systems/playerWeapons';
import type { ControlsView } from '@/engine/input';
import type { Rect } from '@/game/ui/widgets';
import type { SceneContext } from './types';
import { createBattleScene } from './battle';
import {
  bulletHitsWeaponTarget,
  clampWeaponTestBombs,
  clampWeaponTestSub,
  createDamageMeter,
  createWeaponTestTune,
  emitWithDamage,
  formatWeaponTestNumber,
  resetWeaponTestTune,
  stepWeaponTestTune,
  weaponTargetOnScreen,
  weaponTestBombDecRect,
  weaponTestBombIncRect,
  weaponTestCommandAt,
  weaponTestMainRect,
  weaponTestMateRect,
  weaponTestResetRect,
  weaponTestSubRect,
  weaponTestTuneDecRect,
  weaponTestTuneIncRect,
  weaponTestTuneValueRect,
  weaponTestVolleyDamage,
  weaponTestVolleyRate,
  WEAPON_TEST_CTRL_PANEL,
  WEAPON_TEST_STATS_PANEL,
  WEAPON_TEST_TARGET,
  WEAPON_TEST_TUNE_FIELDS,
  WEAPON_TEST_TUNE_LABEL,
} from './weaponTest';

const stage1 = getStage('1');

vi.mock('@/game/art', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/game/art')>();
  return { ...actual, createGameAssets: () => ({}) };
});

vi.mock('@/game/systems/audio', () => {
  const sfx = {
    init: () => undefined,
    unlock: () => undefined,
    play: () => undefined,
    setMuted: () => undefined,
    isMuted: () => false,
  };
  return { getAudioSystem: () => sfx, createAudioSystem: () => sfx };
});

const DT = 1 / 60;

function tap(rect: { x: number; y: number; w: number; h: number }) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

describe('weapon-test damage log and setters', () => {
  it('keeps the target on screen near the top and hits it with a bullet', () => {
    expect(weaponTargetOnScreen()).toBe(true);
    expect(WEAPON_TEST_TARGET.y).toBeLessThan(40);
    const { x, y, w, h } = WEAPON_TEST_TARGET;
    expect(bulletHitsWeaponTarget(x + w / 2, y + h / 2, 4, 12)).toBe(true);
    expect(bulletHitsWeaponTarget(x - 30, y, 4, 12)).toBe(false);
  });

  it('sums session damage, keeps the last hit, and rolls DPS off after one second', () => {
    const meter = createDamageMeter();
    meter.record(0, 10);
    meter.record(0.25, PLAYER_BULLET_DAMAGE);
    const summed = 10 + PLAYER_BULLET_DAMAGE;
    expect(meter.total()).toBe(summed);
    expect(meter.lastHit()).toBe(PLAYER_BULLET_DAMAGE);
    expect(PLAYER_BULLET_DAMAGE).toBe(2);
    expect(meter.dps(0.25)).toBeCloseTo(summed / WEAPON_TEST_DPS_WINDOW);
    expect(meter.dps(1.25)).toBe(0);
    expect(meter.total()).toBe(summed);

    meter.record(1.25, 4);
    expect(meter.dps(1.25)).toBe(4);
    meter.reset();
    expect(meter.total()).toBe(0);
    expect(meter.lastHit()).toBe(0);
    expect(meter.dps(1.25)).toBe(0);
  });

  it('drops a hit once it is exactly one window old', () => {
    const stillInside = createDamageMeter();
    stillInside.record(0, 5);
    expect(stillInside.dps(WEAPON_TEST_DPS_WINDOW - 0.001)).toBeCloseTo(5);

    const aged = createDamageMeter();
    aged.record(0, 5);
    expect(aged.dps(WEAPON_TEST_DPS_WINDOW)).toBe(0);
    expect(aged.total()).toBe(5);
  });

  it('clamps sub weapon T to off–2 and bombs to 0–3', () => {
    expect(clampWeaponTestSub(-1)).toBe(0);
    expect(clampWeaponTestSub(WEAPON_TEST_SUB_MAX + 4)).toBe(WEAPON_TEST_SUB_MAX);
    expect(clampWeaponTestBombs(-2)).toBe(0);
    expect(clampWeaponTestBombs(WEAPON_TEST_BOMBS_MAX + 5)).toBe(WEAPON_TEST_BOMBS_MAX);
    expect(weaponTestCommandAt(tap(weaponTestMainRect(3)).x, tap(weaponTestMainRect(3)).y)).toEqual(
      {
        kind: 'main',
        level: 3,
      }
    );
    expect(weaponTestCommandAt(tap(weaponTestSubRect(0)).x, tap(weaponTestSubRect(0)).y)).toEqual({
      kind: 'sub',
      level: 0,
    });
    expect(weaponTestCommandAt(tap(weaponTestMateRect(2)).x, tap(weaponTestMateRect(2)).y)).toEqual(
      {
        kind: 'mate',
        level: 2,
      }
    );
    expect(
      weaponTestCommandAt(tap(weaponTestBombIncRect()).x, tap(weaponTestBombIncRect()).y)
    ).toEqual({
      kind: 'bombs',
      delta: 1,
    });
    expect(
      weaponTestCommandAt(tap(weaponTestBombDecRect()).x, tap(weaponTestBombDecRect()).y)
    ).toEqual({
      kind: 'bombs',
      delta: -1,
    });
    expect(weaponTestCommandAt(tap(weaponTestResetRect()).x, tap(weaponTestResetRect()).y)).toEqual(
      {
        kind: 'reset',
      }
    );
    expect(weaponTestCommandAt(4, 4)).toBeNull();
  });

  it('steps rate and damage inside the screen and ignores the value cell', () => {
    const joyTop = LOGICAL_H - CONTROL_BOTTOM_PAD - 8 - 2 * JOYSTICK_RADIUS * CONTROL_SCALE_MAX;
    expect(WEAPON_TEST_CTRL_PANEL.x).toBeGreaterThanOrEqual(0);
    expect(WEAPON_TEST_CTRL_PANEL.y).toBeGreaterThan(48 + 12);
    expect(WEAPON_TEST_CTRL_PANEL.x + WEAPON_TEST_CTRL_PANEL.w).toBeLessThanOrEqual(LOGICAL_W);
    expect(WEAPON_TEST_CTRL_PANEL.y + WEAPON_TEST_CTRL_PANEL.h).toBeLessThan(joyTop);
    expect(WEAPON_TEST_STATS_PANEL.x + WEAPON_TEST_STATS_PANEL.w).toBeLessThanOrEqual(
      WEAPON_TEST_CTRL_PANEL.x
    );

    const hitTargets: Rect[] = [
      weaponTestResetRect(),
      weaponTestBombDecRect(),
      weaponTestBombIncRect(),
      ...([1, 2, 3] as const).map((level) => weaponTestMainRect(level)),
      ...([0, 1, 2] as const).map((level) => weaponTestSubRect(level)),
      ...([0, 1, 2] as const).map((level) => weaponTestMateRect(level)),
    ];
    for (const field of WEAPON_TEST_TUNE_FIELDS) {
      const dec = weaponTestTuneDecRect(field);
      const inc = weaponTestTuneIncRect(field);
      const value = weaponTestTuneValueRect(field);
      hitTargets.push(dec, inc);
      expect(weaponTestCommandAt(tap(dec).x, tap(dec).y)).toEqual({ kind: field, delta: -1 });
      expect(weaponTestCommandAt(tap(inc).x, tap(inc).y)).toEqual({ kind: field, delta: 1 });
      expect(weaponTestCommandAt(tap(value).x, tap(value).y)).toBeNull();
      expect(WEAPON_TEST_TUNE_LABEL[field].length).toBeGreaterThan(0);
      for (const rect of [dec, inc, value]) {
        expect(rect.x).toBeGreaterThanOrEqual(WEAPON_TEST_CTRL_PANEL.x);
        expect(rect.y).toBeGreaterThanOrEqual(WEAPON_TEST_CTRL_PANEL.y);
        expect(rect.x + rect.w).toBeLessThanOrEqual(
          WEAPON_TEST_CTRL_PANEL.x + WEAPON_TEST_CTRL_PANEL.w
        );
        expect(rect.y + rect.h).toBeLessThanOrEqual(
          WEAPON_TEST_CTRL_PANEL.y + WEAPON_TEST_CTRL_PANEL.h
        );
      }
    }
    expect(weaponTestResetRect().y).toBeGreaterThan(weaponTestTuneIncRect('homingDamage').y);

    for (let i = 0; i < hitTargets.length; i++) {
      for (let j = i + 1; j < hitTargets.length; j++) {
        const a = hitTargets[i]!;
        const b = hitTargets[j]!;
        const separated =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(separated, `${i} overlaps ${j}`).toBe(true);
      }
    }
  });

  it('defaults to the permanent constants, clamps above zero, and resets', () => {
    expect(formatWeaponTestNumber(10)).toBe('10');
    expect(formatWeaponTestNumber(FIRE_RATE)).toBe('5');
    expect(formatWeaponTestNumber(PLAYER_BULLET_DAMAGE)).toBe('2');
    expect(formatWeaponTestNumber(HOMING_FIRE_RATE)).toBe('1.5');
    expect(formatWeaponTestNumber(HOMING_DAMAGE)).toBe('2.5');

    const tune = createWeaponTestTune();
    expect(tune).toEqual({
      mainRate: FIRE_RATE,
      mainDamage: PLAYER_BULLET_DAMAGE,
      homingRate: HOMING_FIRE_RATE,
      homingDamage: HOMING_DAMAGE,
    });
    expect(weaponTestVolleyRate(false, tune, 'vulcan')).toBeNull();
    expect(weaponTestVolleyDamage(false, tune, 'homing')).toBeNull();
    expect(weaponTestVolleyRate(true, tune, 'vulcan')).toBe(FIRE_RATE);
    expect(weaponTestVolleyDamage(true, tune, 'homing')).toBe(HOMING_DAMAGE);

    stepWeaponTestTune(tune, 'mainRate', 1);
    stepWeaponTestTune(tune, 'mainDamage', -1);
    stepWeaponTestTune(tune, 'homingRate', 1);
    stepWeaponTestTune(tune, 'homingDamage', 1);
    expect(tune.mainRate).toBe(FIRE_RATE + WEAPON_TEST_RATE_STEP);
    expect(tune.mainDamage).toBe(PLAYER_BULLET_DAMAGE - WEAPON_TEST_DAMAGE_STEP);
    expect(tune.homingRate).toBe(HOMING_FIRE_RATE + WEAPON_TEST_RATE_STEP);
    expect(tune.homingDamage).toBe(HOMING_DAMAGE + WEAPON_TEST_DAMAGE_STEP);
    expect(weaponTestVolleyRate(true, tune, 'homing')).toBe(tune.homingRate);
    expect(weaponTestVolleyDamage(true, tune, 'vulcan')).toBe(tune.mainDamage);
    expect(weaponTestVolleyRate(false, tune, 'homing')).toBeNull();

    for (let i = 0; i < 80; i++) stepWeaponTestTune(tune, 'mainRate', -1);
    for (let i = 0; i < 80; i++) stepWeaponTestTune(tune, 'homingDamage', 1);
    expect(tune.mainRate).toBe(WEAPON_TEST_RATE_MIN);
    expect(tune.homingDamage).toBe(WEAPON_TEST_DAMAGE_MAX);
    expect(tune.mainRate).toBeGreaterThan(0);
    expect(tune.homingDamage).toBeGreaterThan(0);

    const shots: number[] = [];
    const emit = emitWithDamage(
      {
        bullet: (_x, _y, _vx, _vy, damage) => shots.push(damage),
        missile: (_x, _y, _angle, damage) => shots.push(damage),
      },
      4
    );
    emit.bullet(0, 0, 0, -1, 1);
    emit.missile(0, 0, 0, 0.5);
    expect(shots).toEqual([4, 4]);

    resetWeaponTestTune(tune);
    expect(tune).toEqual(createWeaponTestTune());
    expect(WEAPON_TEST_RATE_MIN).toBeLessThanOrEqual(WEAPON_TEST_RATE_MAX);
    expect(WEAPON_TEST_DAMAGE_MIN).toBeLessThanOrEqual(WEAPON_TEST_DAMAGE_MAX);
  });
});

function setup(
  playMode: SceneContext['playMode'] = 'weaponTest',
  battleEntry: SceneContext['battleEntry'] = 'stage'
) {
  const storage = createMemoryStorage();
  const settings = createSettingsStore(storage);
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const view: ControlsView = {
    layout,
    settings: settings.get(),
    joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 1 },
    buttonAPressed: false,
    buttonBPressed: false,
  };
  const run = { report: null };
  const scene = createBattleScene({
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage,
    run,
    battleEntry,
    playMode,
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  });
  scene.enter();
  return { scene, run, storage };
}

function flyIn(scene: ReturnType<typeof setup>['scene']): void {
  const frames = Math.ceil(RESPAWN_FLYIN_TIME / DT) + 2;
  for (let i = 0; i < frames; i++) scene.update(DT, makeInput());
}

describe('weapon-test battle', () => {
  it('does not scroll, spawn, or enter the boss, and ignores a boss battle entry', () => {
    const { scene } = setup('weaponTest', 'boss');
    const frames = Math.ceil(3 / DT);
    for (let i = 0; i < frames; i++) scene.update(DT, makeInput());
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBeGreaterThan(2.5);
    expect(info.gameTime).toBeLessThan(stage1.warningAt);
    expect(info.enemyCount).toBe(0);
    expect(info.buildingCount).toBe(0);
    expect(info.waveSpawned).toBe(0);
    expect(info.bossPhase).toBeUndefined();
    expect(info.power).toBe(1);
    expect(scene.getWeaponTestStats()?.mainLevel).toBe(1);
    expect(scene.getWeaponTestStats()?.mateLevel).toBe(0);
    expect(info.mateLevel).toBe(0);
  });

  it('writes the real main weapon and records vulcan damage', () => {
    const { scene } = setup();
    flyIn(scene);
    scene.update(DT, makeInput({ taps: [tap(weaponTestMainRect(1))] }));
    expect(scene.getDebugInfo!()).toMatchObject({
      mainWeapon: 'vulcan',
      power: 1,
      subWeapon: null,
    });

    scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().bulletCount).toBe(1);
    expect(scene.getDebugInfo!().missileCount).toBe(0);

    const travel = Math.ceil(1.2 / DT);
    for (let i = 0; i < travel; i++) scene.update(DT, makeInput({ buttonA: true }));
    const stats = scene.getWeaponTestStats()!;
    expect(stats.totalDamage).toBeGreaterThan(0);
    expect(stats.lastHit).toBe(PLAYER_BULLET_DAMAGE);
    expect(stats.dps).toBeGreaterThan(0);

    for (let i = 0; i < Math.ceil(2 / DT); i++) scene.update(DT, makeInput());
    expect(scene.getWeaponTestStats()!.totalDamage).toBeGreaterThan(0);
    scene.update(DT, makeInput({ taps: [tap(weaponTestResetRect())] }));
    expect(scene.getWeaponTestStats()).toMatchObject({
      totalDamage: 0,
      lastHit: 0,
      dps: 0,
      mainLevel: 1,
      subLevel: 0,
    });

    scene.update(DT, makeInput({ taps: [tap(weaponTestMainRect(3))] }));
    for (let i = 0; i < 8; i++) scene.update(DT, makeInput());
    const before = scene.getDebugInfo!().bulletCount;
    scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().bulletCount - before).toBe(3);
    expect(scene.getWeaponTestStats()?.mainLevel).toBe(POWER_MAX);
    expect(scene.getDebugInfo!().subWeapon).toBeNull();
  });

  it('T1 and T2 fire homing missiles that add target damage', () => {
    const { scene } = setup();
    flyIn(scene);

    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(1))] }));
    expect(scene.getDebugInfo!()).toMatchObject({ subWeapon: 'homing', subLevel: 1, power: 1 });
    scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().missileCount).toBe(1);

    let sawMissileHit = false;
    for (let i = 0; i < Math.ceil(2.5 / DT); i++) {
      scene.update(DT, makeInput({ buttonA: true }));
      if (scene.getWeaponTestStats()?.lastHit === HOMING_DAMAGE) sawMissileHit = true;
    }
    expect(sawMissileHit).toBe(true);
    expect(scene.getWeaponTestStats()!.totalDamage).toBeGreaterThan(PLAYER_BULLET_DAMAGE);
    expect(scene.getWeaponTestStats()!.dps).toBeGreaterThan(0);

    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(2))] }));
    expect(scene.getDebugInfo!()).toMatchObject({ subWeapon: 'homing', subLevel: 2 });
    for (let i = 0; i < Math.ceil(2.6 / DT); i++) scene.update(DT, makeInput());
    expect(scene.getDebugInfo!().missileCount).toBe(0);
    scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().missileCount).toBe(2);

    let sawLv2Hit = false;
    for (let i = 0; i < Math.ceil(2.5 / DT); i++) {
      scene.update(DT, makeInput({ buttonA: true }));
      if (scene.getWeaponTestStats()?.lastHit === HOMING_DAMAGE) sawLv2Hit = true;
    }
    expect(sawLv2Hit).toBe(true);
    expect(scene.getWeaponTestStats()?.subLevel).toBe(2);
  });

  it('sets bomb stock from 0 to 3 without damaging the immortal target', () => {
    const { scene } = setup();
    flyIn(scene);
    expect(scene.getWeaponTestStats()?.bombs).toBe(BOMBS_START);
    scene.update(DT, makeInput({ taps: [tap(weaponTestBombIncRect())] }));
    expect(scene.getWeaponTestStats()?.bombs).toBe(WEAPON_TEST_BOMBS_MAX);
    scene.update(DT, makeInput({ taps: [tap(weaponTestBombIncRect())] }));
    expect(scene.getWeaponTestStats()?.bombs).toBe(WEAPON_TEST_BOMBS_MAX);

    for (let i = 0; i < WEAPON_TEST_BOMBS_MAX + 2; i++) {
      scene.update(DT, makeInput({ taps: [tap(weaponTestBombDecRect())] }));
    }
    expect(scene.getWeaponTestStats()?.bombs).toBe(0);
    scene.update(DT, makeInput({ buttonB: true }));
    expect(scene.getWeaponTestStats()?.totalDamage).toBe(0);
    expect(scene.getDebugInfo!().bombs).toBe(0);

    scene.update(DT, makeInput({ taps: [tap(weaponTestBombIncRect())] }));
    scene.update(DT, makeInput({ buttonB: true }));
    expect(scene.getWeaponTestStats()?.totalDamage).toBe(0);
    expect(scene.getDebugInfo!().bombs).toBe(0);
  });

  it('returns to the title on death and does not publish a result', () => {
    const { scene, run, storage } = setup();
    flyIn(scene);
    expect(scene.applyTestDeath()).toBe(true);
    expect(scene.getDebugInfo!().playerDead).toBe(true);
    expect(scene.getDebugInfo!().lives).toBe(LIVES_START - 1);
    expect(run.report).toBeNull();
    expect(scene.update(DT, makeInput())).toBe('title');
    expect(run.report).toBeNull();
    expect(storage.getStorage(HIGH_SCORE_KEY)).toBeNull();
  });

  it('does not let a normal run use the weapon-test kill seam', () => {
    const { scene, run } = setup('play');
    flyIn(scene);
    expect(scene.applyTestDeath()).toBe(false);
    expect(scene.getDebugInfo!().playerDead).toBe(false);
    expect(scene.getWeaponTestStats()).toBeNull();
    expect(scene.update(DT, makeInput())).toBeNull();
    expect(run.report).toBeNull();
  });

  it('applies live vulcan and homing damage on the immortal target', () => {
    const { scene } = setup();
    flyIn(scene);
    expect(scene.getWeaponTestStats()).toMatchObject({
      mainRate: FIRE_RATE,
      mainDamage: PLAYER_BULLET_DAMAGE,
      homingRate: HOMING_FIRE_RATE,
      homingDamage: HOMING_DAMAGE,
    });

    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('mainDamage'))] }));
    const vulcan = PLAYER_BULLET_DAMAGE + WEAPON_TEST_DAMAGE_STEP;
    expect(scene.getWeaponTestStats()?.mainDamage).toBe(vulcan);
    scene.update(DT, makeInput({ buttonA: true }));
    for (let i = 0; i < 70; i++) scene.update(DT, makeInput());
    expect(scene.getWeaponTestStats()?.lastHit).toBe(vulcan);
    expect(scene.getWeaponTestStats()?.totalDamage).toBe(vulcan);

    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('homingDamage'))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(1))] }));
    const homing = HOMING_DAMAGE + WEAPON_TEST_DAMAGE_STEP;
    expect(scene.getWeaponTestStats()?.homingDamage).toBe(homing);
    const before = scene.getWeaponTestStats()!.totalDamage;
    scene.update(DT, makeInput({ buttonA: true }));
    for (let i = 0; i < Math.ceil(2.2 / DT); i++) scene.update(DT, makeInput());
    const after = scene.getWeaponTestStats()!;
    expect(after.lastHit).toBe(homing);
    expect(after.totalDamage - before).toBeCloseTo(vulcan + homing);
    expect(weaponLevel('vulcan', 1).damage).toBe(PLAYER_BULLET_DAMAGE);
    expect(weaponLevel('homing', 1).damage).toBe(HOMING_DAMAGE);
    expect(weaponLevel('vulcan', 1).rate).toBe(FIRE_RATE);
    expect(weaponLevel('homing', 1).rate).toBe(HOMING_FIRE_RATE);
  });

  it('applies live fire rates while A is held', () => {
    const { scene } = setup();
    flyIn(scene);
    const steps = Math.round((FIRE_RATE - 2) / WEAPON_TEST_RATE_STEP);
    for (let i = 0; i < steps; i++) {
      scene.update(DT, makeInput({ taps: [tap(weaponTestTuneDecRect('mainRate'))] }));
    }
    expect(scene.getWeaponTestStats()?.mainRate).toBe(2);

    const gaps: number[] = [];
    let last = -1;
    let prev = scene.getDebugInfo!().bulletCount;
    for (let i = 0; i < 90; i++) {
      scene.update(DT, makeInput({ buttonA: true }));
      const now = scene.getDebugInfo!().bulletCount;
      if (now > prev) {
        if (last >= 0) gaps.push(i - last);
        last = i;
      }
      prev = now;
    }
    expect(gaps[0]).toBe(30);
    expect(gaps[1]).toBe(30);

    for (let i = 0; i < Math.ceil(1 / DT); i++) scene.update(DT, makeInput());
    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('homingRate'))] }));
    expect(scene.getWeaponTestStats()?.homingRate).toBeCloseTo(
      HOMING_FIRE_RATE + WEAPON_TEST_RATE_STEP
    );
    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(1))] }));
    const missileGaps: number[] = [];
    last = -1;
    prev = scene.getDebugInfo!().missileCount ?? 0;
    for (let i = 0; i < 70; i++) {
      scene.update(DT, makeInput({ buttonA: true }));
      const now = scene.getDebugInfo!().missileCount ?? 0;
      if (now > prev) {
        if (last >= 0) missileGaps.push(i - last);
        last = i;
      }
      prev = now;
    }
    expect(missileGaps[0]).toBe(30);
    expect(weaponLevel('homing', 1).rate).toBe(HOMING_FIRE_RATE);
  });

  it('reset restores the tune and the damage meter without touching P, T, or bombs', () => {
    const { scene } = setup();
    flyIn(scene);
    scene.update(DT, makeInput({ taps: [tap(weaponTestMainRect(3))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(2))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(2))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestBombIncRect())] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('mainRate'))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneDecRect('homingDamage'))] }));
    scene.update(DT, makeInput({ buttonA: true }));
    for (let i = 0; i < 70; i++) scene.update(DT, makeInput());
    expect(scene.getWeaponTestStats()!.totalDamage).toBeGreaterThan(0);

    const bombs = scene.getWeaponTestStats()!.bombs;
    scene.update(DT, makeInput({ taps: [tap(weaponTestResetRect())] }));
    expect(scene.getWeaponTestStats()).toMatchObject({
      totalDamage: 0,
      lastHit: 0,
      dps: 0,
      mainLevel: POWER_MAX,
      subLevel: 2,
      mateLevel: 2,
      bombs,
      mainRate: FIRE_RATE,
      mainDamage: PLAYER_BULLET_DAMAGE,
      homingRate: HOMING_FIRE_RATE,
      homingDamage: HOMING_DAMAGE,
    });
  });

  it('clears the tune on exit and again when the mode is entered', () => {
    const { scene } = setup();
    flyIn(scene);
    scene.update(DT, makeInput({ taps: [tap(weaponTestMainRect(2))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(1))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('mainDamage'))] }));
    scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getWeaponTestStats()?.mainDamage).toBe(
      PLAYER_BULLET_DAMAGE + WEAPON_TEST_DAMAGE_STEP
    );

    scene.exit();
    expect(scene.getWeaponTestStats()).toMatchObject({
      totalDamage: 0,
      mainLevel: 2,
      mateLevel: 1,
      mainDamage: PLAYER_BULLET_DAMAGE,
      mainRate: FIRE_RATE,
      homingDamage: HOMING_DAMAGE,
      homingRate: HOMING_FIRE_RATE,
    });

    scene.enter();
    expect(scene.getWeaponTestStats()).toMatchObject({
      totalDamage: 0,
      mainLevel: 1,
      subLevel: 0,
      mateLevel: 0,
      mainDamage: PLAYER_BULLET_DAMAGE,
      mainRate: FIRE_RATE,
      homingDamage: HOMING_DAMAGE,
      homingRate: HOMING_FIRE_RATE,
    });
  });

  it('starts a stage and boss practice at M = 0', () => {
    expect(setup('play').scene.getDebugInfo!().mateLevel).toBe(0);
    const boss = setup('play', 'boss');
    expect(boss.scene.getDebugInfo!().mateLevel).toBe(0);
    expect(boss.scene.getDebugInfo!().power).toBe(POWER_MAX);
  });

  it('adds one straight shot per wingman on the main gun beat, not the P pattern', () => {
    const { scene } = setup();
    flyIn(scene);

    const fireDelta = (): { bullets: number; missiles: number } => {
      const beforeB = scene.getDebugInfo!().bulletCount ?? 0;
      const beforeM = scene.getDebugInfo!().missileCount ?? 0;
      scene.update(DT, makeInput({ buttonA: true }));
      return {
        bullets: (scene.getDebugInfo!().bulletCount ?? 0) - beforeB,
        missiles: (scene.getDebugInfo!().missileCount ?? 0) - beforeM,
      };
    };
    const clearShots = (): void => {
      for (let i = 0; i < 90; i++) scene.update(DT, makeInput());
      expect(scene.getDebugInfo!().bulletCount).toBe(0);
      expect(scene.getDebugInfo!().missileCount).toBe(0);
    };

    expect(fireDelta()).toEqual({ bullets: 1, missiles: 0 });
    const held = scene.getDebugInfo!().bulletCount ?? 0;
    scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().bulletCount).toBe(held);

    clearShots();
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(1))] }));
    expect(scene.getWeaponTestStats()?.mateLevel).toBe(1);
    expect(fireDelta()).toEqual({ bullets: 2, missiles: 0 });

    clearShots();
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(2))] }));
    expect(fireDelta()).toEqual({ bullets: 3, missiles: 0 });

    clearShots();
    scene.update(DT, makeInput({ taps: [tap(weaponTestMainRect(3))] }));
    expect(fireDelta()).toEqual({ bullets: 5, missiles: 0 });

    clearShots();
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(1))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(2))] }));
    expect(fireDelta()).toEqual({ bullets: 4, missiles: 2 });
    expect(scene.getDebugInfo!().subLevel).toBe(2);
    expect(scene.getWeaponTestStats()?.mateLevel).toBe(1);
  });

  it('keeps wingman damage at the base vulcan value when P伤 is raised', () => {
    const { scene } = setup();
    flyIn(scene);
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(1))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('mainDamage'))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestTuneIncRect('mainDamage'))] }));
    const tuned = PLAYER_BULLET_DAMAGE + 2 * WEAPON_TEST_DAMAGE_STEP;
    expect(scene.getWeaponTestStats()?.mainDamage).toBe(tuned);

    let sawPlayer = false;
    let sawMate = false;
    for (let i = 0; i < Math.ceil(1.1 / DT); i++) {
      scene.update(DT, makeInput({ buttonA: true }));
      const stats = scene.getWeaponTestStats()!;
      if (!sawPlayer && stats.totalDamage === tuned && stats.lastHit === tuned) sawPlayer = true;
      if (
        sawPlayer &&
        stats.totalDamage === tuned + PLAYER_BULLET_DAMAGE &&
        stats.lastHit === PLAYER_BULLET_DAMAGE
      ) {
        sawMate = true;
        break;
      }
    }
    expect(sawPlayer).toBe(true);
    expect(sawMate).toBe(true);
  });

  it('drops M one level when the ship is destroyed', () => {
    const { scene } = setup();
    flyIn(scene);
    scene.update(DT, makeInput({ taps: [tap(weaponTestMateRect(2))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestMainRect(3))] }));
    scene.update(DT, makeInput({ taps: [tap(weaponTestSubRect(2))] }));
    expect(scene.applyTestDeath()).toBe(true);
    expect(scene.getWeaponTestStats()).toMatchObject({
      mateLevel: 1,
      mainLevel: 2,
      subLevel: 1,
    });
    expect(scene.getDebugInfo!().mateLevel).toBe(1);
  });

  it('leaves for the title from pause 返回标题 without a second confirm', () => {
    const { scene, run } = setup();
    scene.update(DT, makeInput({ pausePressed: true }));
    expect(scene.getDebugInfo!().paused).toBe(true);
    scene.update(DT, makeInput({ menuUp: true }));
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBe('title');
    expect(run.report).toBeNull();
  });
});
