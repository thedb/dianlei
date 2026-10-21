import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import {
  BOMBS_START,
  HOMING_DAMAGE,
  LIVES_START,
  PLAYER_BULLET_DAMAGE,
  POWER_MAX,
  RESPAWN_FLYIN_TIME,
  WEAPON_TEST_BOMBS_MAX,
  WEAPON_TEST_DPS_WINDOW,
  WEAPON_TEST_SUB_MAX,
} from '@/game/config';
import { HIGH_SCORE_KEY } from '@/game/highScore';
import { stage1 } from '@/game/levels/stage1';
import type { ControlsView } from '@/engine/input';
import type { SceneContext } from './types';
import { createBattleScene } from './battle';
import {
  bulletHitsWeaponTarget,
  clampWeaponTestBombs,
  clampWeaponTestSub,
  createDamageMeter,
  weaponTargetOnScreen,
  weaponTestBombDecRect,
  weaponTestBombIncRect,
  weaponTestCommandAt,
  weaponTestMainRect,
  weaponTestResetRect,
  weaponTestSubRect,
  WEAPON_TEST_TARGET,
} from './weaponTest';

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
    expect(meter.total()).toBe(11);
    expect(meter.lastHit()).toBe(PLAYER_BULLET_DAMAGE);
    expect(meter.dps(0.25)).toBeCloseTo(11 / WEAPON_TEST_DPS_WINDOW);
    expect(meter.dps(1.25)).toBe(0);
    expect(meter.total()).toBe(11);

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

  it('leaves for the title from pause 返回标题 without a second confirm', () => {
    const { scene, run } = setup();
    scene.update(DT, makeInput({ pausePressed: true }));
    expect(scene.getDebugInfo!().paused).toBe(true);
    scene.update(DT, makeInput({ menuUp: true }));
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBe('title');
    expect(run.report).toBeNull();
  });
});
