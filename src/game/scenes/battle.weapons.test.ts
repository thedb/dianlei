import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import {
  BOMB_WAVE_TIME,
  BOMBS_START,
  HOMING_FIRE_RATE,
  LOGICAL_H,
  P_OVERFLOW_SCORE,
  POWER_MAX,
} from '@/game/config';
import type { ControlsView } from '@/engine/input';
import type { BattleEntry, SceneContext } from './types';
import { createBattleScene } from './battle';
import { attractInput } from './titleAttract';

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

function setup(playMode: SceneContext['playMode'] = 'play', battleEntry: BattleEntry = 'stage') {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const view: ControlsView = {
    layout,
    settings: settings.get(),
    joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 1 },
    buttonAPressed: false,
    buttonBPressed: false,
  };
  const scene = createBattleScene({
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage: createMemoryStorage(),
    run: { report: null },
    battleEntry,
    playMode,
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  });
  scene.enter();
  return scene;
}

const fire = makeInput({ buttonA: true, keyFire: true });

describe('battle weapon slots', () => {
  it('starts with vulcan Lv1 and an empty sub slot, and fires no missiles', () => {
    const scene = setup();
    const info = scene.getDebugInfo!();
    expect(info.mainWeapon).toBe('vulcan');
    expect(info.power).toBe(1);
    expect(info.subWeapon).toBeNull();
    expect(info.subLevel).toBe(0);
    for (let i = 0; i < 180; i++) scene.update(DT, fire);
    expect(scene.getDebugInfo!().bulletCount).toBeGreaterThan(0);
    expect(scene.getDebugInfo!().missileCount).toBe(0);
  });

  it('T equips the sub slot, fires alongside the main gun, and caps at Lv2', () => {
    const scene = setup();
    for (let i = 0; i < 60; i++) scene.update(DT, makeInput());
    scene.grantItem('T');
    expect(scene.getDebugInfo!().subWeapon).toBe('homing');
    expect(scene.getDebugInfo!().subLevel).toBe(1);
    expect(scene.getDebugInfo!().power).toBe(1);

    let peak = 0;
    for (let i = 0; i < 30; i++) {
      scene.update(DT, fire);
      peak = Math.max(peak, scene.getDebugInfo!().missileCount ?? 0);
    }
    expect(peak).toBe(1);

    scene.grantItem('T');
    expect(scene.getDebugInfo!().subLevel).toBe(2);
    const score = scene.getDebugInfo!().score ?? 0;
    scene.grantItem('T');
    expect(scene.getDebugInfo!().subLevel).toBe(2);
    expect(scene.getDebugInfo!().score).toBe(score + P_OVERFLOW_SCORE);

    for (let i = 0; i < 10; i++) scene.update(DT, makeInput());
    let volleys = 0;
    let last = scene.getDebugInfo!().missileCount ?? 0;
    for (let i = 0; i < Math.ceil(1 / (HOMING_FIRE_RATE * DT)) + 2; i++) {
      scene.update(DT, fire);
      const now = scene.getDebugInfo!().missileCount ?? 0;
      if (now >= last + 2) volleys++;
      last = now;
    }
    expect(volleys).toBeGreaterThanOrEqual(1);
  });

  it('P and T never touch each other’s slot', () => {
    const scene = setup();
    scene.grantItem('P');
    scene.grantItem('P');
    expect(scene.getDebugInfo!().power).toBe(POWER_MAX);
    expect(scene.getDebugInfo!().subWeapon).toBeNull();
    scene.grantItem('T');
    expect(scene.getDebugInfo!().power).toBe(POWER_MAX);
    expect(scene.getDebugInfo!().subLevel).toBe(1);
  });

  it('death drops main and sub one level each; sub can drop to none', () => {
    const scene = setup();
    scene.grantItem('P');
    scene.grantItem('T');
    scene.grantItem('T');
    expect(scene.getDebugInfo!().buildingDrop).toBe('B');

    const dieOnce = (): void => {
      for (let i = 0; i < Math.ceil(30 / DT); i++) {
        const t = scene.getDebugInfo!().gameTime ?? 0;
        scene.update(DT, attractInput(t, 'idle'));
        if (scene.getDebugInfo!().playerDead) return;
      }
      throw new Error('ship never died');
    };
    const respawn = (): void => {
      for (let i = 0; i < Math.ceil(4 / DT); i++) scene.update(DT, makeInput());
    };

    dieOnce();
    expect(scene.getDebugInfo!().power).toBe(1);
    expect(scene.getDebugInfo!().subLevel).toBe(1);
    expect(scene.getDebugInfo!().buildingDrop).toBe('T');
    respawn();
    dieOnce();
    expect(scene.getDebugInfo!().power).toBe(1);
    expect(scene.getDebugInfo!().subWeapon).toBeNull();
    expect(scene.getDebugInfo!().subLevel).toBe(0);
    expect(scene.getDebugInfo!().buildingDrop).toBe('T');
  });

  it('building drop follows the live sub slot, including an empty one', () => {
    const scene = setup();
    expect(scene.getDebugInfo!().buildingDrop).toBe('T');
    scene.grantItem('T');
    expect(scene.getDebugInfo!().subLevel).toBe(1);
    expect(scene.getDebugInfo!().buildingDrop).toBe('T');
    scene.grantItem('T');
    expect(scene.getDebugInfo!().buildingDrop).toBe('B');
    scene.grantItem('T');
    expect(scene.getDebugInfo!().buildingDrop).toBe('B');
  });

  it('the title demo runs the same weapon code as a real run', () => {
    const play = setup('play');
    const demo = setup('attract');
    for (const scene of [play, demo]) {
      scene.grantItem('P');
      scene.grantItem('T');
      scene.grantItem('T');
    }
    let peakMissiles = 0;
    for (let i = 0; i < Math.ceil(10 / DT); i++) {
      const t = play.getDebugInfo!().gameTime ?? 0;
      const input = attractInput(t, 'auto', {
        plan: { routeId: 1, seed: 3 },
        world: play.getBattleView(),
      });
      play.update(DT, input);
      demo.update(DT, input);
      const a = play.getDebugInfo!();
      const b = demo.getDebugInfo!();
      expect(b.power).toBe(a.power);
      expect(b.subWeapon).toBe(a.subWeapon);
      expect(b.subLevel).toBe(a.subLevel);
      expect(b.bulletCount).toBe(a.bulletCount);
      expect(b.missileCount).toBe(a.missileCount);
      expect(b.enemyCount).toBe(a.enemyCount);
      expect(b.buildingCount).toBe(a.buildingCount);
      expect(b.playerDead).toBe(a.playerDead);
      peakMissiles = Math.max(peakMissiles, a.missileCount ?? 0);
    }
    expect(peakMissiles).toBeGreaterThan(0);
    expect(demo.getDebugInfo!().subWeapon).toBe('homing');
  });

  it('boss practice starts the main weapon at max and the sub slot empty', () => {
    const scene = setup('play', 'boss');
    expect(scene.getDebugInfo!().power).toBe(POWER_MAX);
    expect(scene.getDebugInfo!().subWeapon).toBeNull();
  });
});

describe('battle bomb', () => {
  it('clears what is on screen within the ring time and spares ships still above the top', () => {
    const scene = setup();
    const onScreen = (): number =>
      scene.getBattleView().enemies.filter((e) => e.y > 24 && e.y < LOGICAL_H - 24).length;
    let guard = 0;
    while (onScreen() < 3 && guard++ < Math.ceil(40 / DT)) scene.update(DT, makeInput());
    expect(onScreen()).toBeGreaterThanOrEqual(3);

    const before = scene.getDebugInfo!();
    scene.update(DT, makeInput({ buttonB: true, keyBomb: true }));
    expect(scene.getDebugInfo!().bombs).toBe(BOMBS_START - 1);
    for (let i = 0; i < Math.ceil(BOMB_WAVE_TIME / DT) + 2; i++) scene.update(DT, makeInput());
    const after = scene.getDebugInfo!();
    expect(after.score ?? 0).toBeGreaterThan(before.score ?? 0);
    expect(after.enemyCount ?? 0).toBeLessThan(before.enemyCount ?? 0);
  });
});
