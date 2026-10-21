import { describe, expect, it, vi } from 'vitest';
import { createBootScene, BOOT_DURATION } from './boot';
import { createTitleScene, SETTINGS_BUTTON } from './title';

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
    bindBackend: () => undefined,
    setBgmEnabled: () => undefined,
    setBgmVolume: () => undefined,
    tick: () => undefined,
  };
  return { getAudioSystem: () => sfx, createAudioSystem: () => sfx };
});
import { START_BUTTON } from '@/game/ui/startButton';
import { BGM_VOLUME_DEFAULT } from '@/game/config';
import { HIGH_SCORE_KEY } from '@/game/highScore';
import { createSettingsStore, createMemoryStorage } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { makeInput } from '@/test/fakes';
import type { SceneContext } from './types';

const DT = 1 / 60;

function context(): SceneContext {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  return {
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage: createMemoryStorage(),
    run: { report: null },
    battleEntry: 'stage',
    input: {
      setControlsEnabled: vi.fn(),
      getControlsView: () => ({
        layout,
        settings: settings.get(),
        joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 1 },
        buttonAPressed: false,
        buttonBPressed: false,
      }),
    },
  };
}

const center = { x: START_BUTTON.x + START_BUTTON.w / 2, y: START_BUTTON.y + START_BUTTON.h / 2 };

describe('boot screen start button', () => {
  it('first tap on 开始游戏 enters battle immediately', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(boot.update(DT, makeInput({ taps: [center] }))).toBe('battle');
  });

  it('accepts taps slightly outside the drawn button', () => {
    const boot = createBootScene(context());
    boot.enter();
    const edge = { x: START_BUTTON.x - 8, y: START_BUTTON.y + START_BUTTON.h + 8 };
    expect(boot.update(DT, makeInput({ taps: [edge] }))).toBe('battle');
  });

  it('ignores taps elsewhere and hands off to the title screen', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(boot.update(DT, makeInput({ taps: [{ x: 20, y: 20 }] }))).toBeNull();
    let next = null;
    for (let t = 0; t < BOOT_DURATION + 0.1 && !next; t += DT) next = boot.update(DT, makeInput());
    expect(next).toBe('title');
  });

  it('keyboard confirm also starts', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(boot.update(DT, makeInput({ menuConfirm: true }))).toBe('battle');
  });
});

describe('title screen start button', () => {
  it('first tap on 开始游戏 enters battle', () => {
    const title = createTitleScene(context());
    title.enter();
    expect(title.update(DT, makeInput({ taps: [center] }))).toBe('battle');
  });

  it('sits at the same place as the boot button', () => {
    // Shared rect: a tap during the boot→title hand-off still hits 开始游戏
    const title = createTitleScene(context());
    title.enter();
    expect(
      title.update(DT, makeInput({ taps: [{ x: START_BUTTON.x + 4, y: START_BUTTON.y + 4 }] }))
    ).toBe('battle');
  });

  it('the title menu is 开始游戏 and 设置', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    const tap = {
      x: SETTINGS_BUTTON.x + SETTINGS_BUTTON.w / 2,
      y: SETTINGS_BUTTON.y + SETTINGS_BUTTON.h / 2,
    };
    expect(title.update(DT, makeInput({ taps: [tap] }))).toBeNull();
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.playMode).toBeUndefined();

    title.update(DT, makeInput({ menuBack: true }));
    expect(title.update(DT, makeInput({ taps: [center] }))).toBe('battle');
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.playMode).toBe('play');
  });

  it('keyboard down selects 设置', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    expect(title.update(DT, makeInput({ menuDown: true }))).toBeNull();
    expect(title.update(DT, makeInput({ menuConfirm: true }))).toBeNull();
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.playMode).toBeUndefined();
  });

  it('does not change volume or BGM from the title screen', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    expect(ctx.settings.get().bgmEnabled).toBe(false);
    expect(ctx.settings.get().bgmVolume).toBe(BGM_VOLUME_DEFAULT);
    // Former home BGM toggle (y=312) and volume track (x=144..312).
    expect(title.update(DT, makeInput({ taps: [{ x: 40, y: 327 }] }))).toBeNull();
    expect(
      title.update(
        DT,
        makeInput({
          taps: [{ x: 300, y: 327 }],
          pointers: [{ id: 1, x: 310, y: 327, startX: 200, startY: 327 }],
        })
      )
    ).toBeNull();
    expect(ctx.settings.get().bgmEnabled).toBe(false);
    expect(ctx.settings.get().bgmVolume).toBe(BGM_VOLUME_DEFAULT);
    expect(ctx.battleEntry).toBe('stage');
  });

  it('changes BGM only after opening settings', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    title.update(DT, makeInput({ menuDown: true }));
    expect(title.update(DT, makeInput({ menuConfirm: true }))).toBeNull();
    for (let i = 0; i < 5; i++) title.update(DT, makeInput({ menuDown: true }));
    title.update(DT, makeInput({ menuConfirm: true }));
    expect(ctx.settings.get().bgmEnabled).toBe(true);
    title.update(DT, makeInput({ menuDown: true }));
    title.update(DT, makeInput({ menuRight: true }));
    expect(ctx.settings.get().bgmVolume).toBeCloseTo(BGM_VOLUME_DEFAULT + 0.05);
  });

  it('attract demo runs on the title screen without writing score or settings', () => {
    const storage = createMemoryStorage();
    const ctx = context();
    ctx.settings = createSettingsStore(storage);
    const title = createTitleScene(ctx);
    title.enter();
    expect(ctx.settings.get().debugMode).toBe(false);
    for (let i = 0; i < 90; i++) title.update(DT, makeInput());
    expect(storage.getStorage('dianlei.settings.v1')).toBeNull();
    expect(ctx.storage.getStorage(HIGH_SCORE_KEY)).toBeNull();
    expect(ctx.settings.get().debugMode).toBe(false);
    expect(ctx.battleEntry).toBe('stage');
  });

  it('设置 opens settings instead of starting', () => {
    const title = createTitleScene(context());
    title.enter();
    const tap = { x: SETTINGS_BUTTON.x + 10, y: SETTINGS_BUTTON.y + SETTINGS_BUTTON.h / 2 };
    expect(title.update(DT, makeInput({ taps: [tap] }))).toBeNull();
    // Now in settings: tapping where 开始游戏 was must not start the game
    expect(title.update(DT, makeInput({ menuBack: true }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [center] }))).toBe('battle');
  });
});
