import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { FIRE_RATE, RESPAWN_FLYIN_TIME } from '@/game/config';
import type { ControlsView } from '@/engine/input';
import type { SceneContext } from './types';
import { createBattleScene } from './battle';
import { weaponTestMateRect } from './weaponTest';
import type { ShipId } from '@/game/entities/shipDefs';

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

function setup(shipId?: ShipId) {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const view: ControlsView = {
    layout,
    settings: settings.get(),
    joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 1 },
    buttonAPressed: false,
    buttonBPressed: false,
  };
  const ctx: SceneContext = {
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage: createMemoryStorage(),
    run: { report: null },
    battleEntry: 'stage',
    playMode: 'weaponTest',
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  };
  if (shipId) ctx.shipId = shipId;
  const scene = createBattleScene(ctx);
  scene.enter();
  return scene;
}

function flyIn(scene: ReturnType<typeof setup>): void {
  const frames = Math.ceil(RESPAWN_FLYIN_TIME / DT);
  for (let i = 0; i < frames; i++) scene.update(DT, makeInput());
}

function shotsIn(interval: number, frames: number): number {
  let t = interval;
  let n = 0;
  for (let i = 0; i < frames; i++) {
    t += DT;
    while (t >= interval) {
      n += 1;
      t -= interval;
    }
  }
  return n;
}

describe('ship feel in battle', () => {
  it('omitted shipId still fires Eagle at 5 Hz', () => {
    const scene = setup();
    flyIn(scene);
    const frames = 18;
    for (let i = 0; i < frames; i++) scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().bulletCount).toBe(shotsIn(1 / FIRE_RATE, frames));
    expect(scene.getWeaponTestStats()?.mainRate).toBe(FIRE_RATE);
    expect(scene.getWeaponTestStats()?.mainDamage).toBe(2);
  });

  it('Mandy fires two shells at 4 Hz and moves at 224', () => {
    const scene = setup('mandy');
    flyIn(scene);
    expect(scene.getWeaponTestStats()).toMatchObject({ mainRate: 4, mainDamage: 1.75 });
    const frames = 18;
    for (let i = 0; i < frames; i++) scene.update(DT, makeInput({ buttonA: true }));
    expect(scene.getDebugInfo!().bulletCount).toBe(shotsIn(1 / 4, frames) * 2);

    const start = scene.getBattleView().player.x;
    for (let i = 0; i < 10; i++) {
      scene.update(DT, makeInput({ joystickX: 1, joystickMagnitude: 1 }));
    }
    expect(scene.getBattleView().player.x - start).toBeCloseTo(224 * 10 * DT, 5);
  });

  it('Jason fires at 6 Hz and 336, while mates stay on Eagle 5 Hz', () => {
    const scene = setup('jason');
    flyIn(scene);
    expect(scene.getWeaponTestStats()).toMatchObject({ mainRate: 6, mainDamage: 1 });
    scene.update(DT, makeInput());
    const frames = 18;
    const hold = makeInput({ buttonA: true });
    for (let i = 0; i < frames; i++) scene.update(DT, hold);
    const main = shotsIn(1 / 6, frames);
    const mates = shotsIn(1 / FIRE_RATE, frames) * 2;
    expect(scene.getDebugInfo!().bulletCount).toBe(main);
    expect(mates).toBeGreaterThan(0);

    scene.enter();
    flyIn(scene);
    const mateTap = {
      x: weaponTestMateRect(2).x + 4,
      y: weaponTestMateRect(2).y + 4,
    };
    scene.update(DT, makeInput({ taps: [mateTap] }));
    for (let i = 0; i < frames; i++) scene.update(DT, hold);
    expect(scene.getDebugInfo!().bulletCount).toBe(main + mates);

    const start = scene.getBattleView().player.x;
    for (let i = 0; i < 10; i++) {
      scene.update(DT, makeInput({ joystickX: -1, joystickMagnitude: 1 }));
    }
    expect(start - scene.getBattleView().player.x).toBeCloseTo(336 * 10 * DT, 5);
  });
});
