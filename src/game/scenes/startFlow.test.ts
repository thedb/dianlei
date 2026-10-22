import { describe, expect, it, vi } from 'vitest';
import type { Renderer } from '@/engine/renderer';
import { createBootScene, BOOT_DURATION } from './boot';
import { createSceneManager } from './index';
import { createTitleScene, SETTINGS_BUTTON } from './title';
import { peekSharedTitleAttract, resetSharedTitleAttractForTests } from './titleAttract';

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
import {
  DIFFICULTY_BACK_BUTTON,
  DIFFICULTY_EASY_BUTTON,
  DIFFICULTY_HARD_BUTTON,
  DIFFICULTY_MEDIUM_BUTTON,
} from '@/game/ui/difficultySelect';
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

function point(rect: { x: number; y: number; w: number; h: number }) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function loadingRenderer(): Renderer & { clears: string[]; images: number } {
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => gradient;
        return () => undefined;
      },
      set() {
        return true;
      },
    }
  );
  const renderer = {
    clears: [] as string[],
    images: 0,
    clear(color: string) {
      this.clears.push(color);
    },
    drawImage() {
      this.images += 1;
    },
    getContext: () => ctx,
  };
  return renderer as unknown as Renderer & { clears: string[]; images: number };
}

function textRenderer(): Renderer & { texts: string[] } {
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => gradient;
        if (prop === 'fillText') return (text: string) => texts.push(text);
        return () => undefined;
      },
      set() {
        return true;
      },
    }
  );
  const renderer = {
    texts,
    clear() {
      return undefined;
    },
    drawImage() {
      return undefined;
    },
    getContext: () => ctx,
  };
  return renderer as unknown as Renderer & { texts: string[] };
}

describe('boot screen', () => {
  it('ignores the start button and confirm, then hands off to the title', () => {
    const ctx = context();
    const boot = createBootScene(ctx);
    boot.enter();
    expect(boot.update(DT, makeInput({ taps: [center], menuConfirm: true }))).toBeNull();
    expect(ctx.playMode).toBeUndefined();
    expect(ctx.difficulty).toBeUndefined();
    expect(ctx.battleEntry).toBe('stage');
    const edge = { x: START_BUTTON.x - 8, y: START_BUTTON.y + START_BUTTON.h + 8 };
    expect(boot.update(DT, makeInput({ taps: [edge] }))).toBeNull();
    expect(boot.update(DT, makeInput({ taps: [{ x: 20, y: 20 }] }))).toBeNull();
    let next = null;
    for (let t = 0; t < BOOT_DURATION + 0.1 && !next; t += DT) {
      next = boot.update(DT, makeInput({ taps: [center], menuConfirm: true }));
    }
    expect(next).toBe('title');
    expect(ctx.difficulty).toBeUndefined();
    expect(ctx.playMode).toBeUndefined();
  });

  it('draws only the game name', () => {
    const boot = createBootScene(context());
    boot.enter();
    const renderer = textRenderer();
    boot.render(renderer, 1);
    expect(renderer.texts).toEqual(['电雷']);
    boot.update(DT, makeInput({ taps: [center], menuConfirm: true }));
    renderer.texts.length = 0;
    boot.render(renderer, 1);
    expect(renderer.texts).toEqual(['电雷']);
  });

  it('does not create or draw the attract demo while the boot screen is up', () => {
    resetSharedTitleAttractForTests();
    const manager = createSceneManager(context());
    manager.start('boot');
    expect(peekSharedTitleAttract()).toBeNull();

    const renderer = loadingRenderer();
    let scene = manager.getCurrentScene();
    expect(scene?.id).toBe('boot');
    for (let i = 0; i < 200 && scene?.id === 'boot'; i++) {
      const next = scene.update(DT, makeInput());
      scene.render(renderer, 1);
      if (next) {
        expect(next).toBe('title');
        expect(peekSharedTitleAttract()).toBeNull();
        manager.transition(next);
        scene = manager.getCurrentScene();
      }
    }

    expect(scene?.id).toBe('title');
    expect(peekSharedTitleAttract()?.isRunning()).toBe(true);
    expect(renderer.clears.length).toBeGreaterThan(0);
    expect(renderer.clears.every((color) => color === '#000')).toBe(true);
    expect(renderer.images).toBe(0);

    manager.transition('battle');
    expect(peekSharedTitleAttract()?.isRunning()).toBe(false);
    manager.transition('title');
    expect(peekSharedTitleAttract()?.isRunning()).toBe(true);
    resetSharedTitleAttractForTests();
  });
});

describe('title screen start button', () => {
  it('first tap on 开始游戏 opens difficulty and does not start battle', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    expect(title.update(DT, makeInput({ taps: [center] }))).toBeNull();
    expect(ctx.playMode).toBeUndefined();
    expect(ctx.difficulty).toBeUndefined();
  });

  it('opens difficulty from the start button', () => {
    const title = createTitleScene(context());
    title.enter();
    expect(
      title.update(DT, makeInput({ taps: [{ x: START_BUTTON.x + 4, y: START_BUTTON.y + 4 }] }))
    ).toBeNull();
  });

  it('Easy, Medium, and Hard start a stage and Back returns to the title', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    title.update(DT, makeInput({ taps: [center] }));
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_BACK_BUTTON)] }))).toBeNull();
    expect(ctx.playMode).toBeUndefined();

    title.update(DT, makeInput({ taps: [center] }));
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_MEDIUM_BUTTON)] }))).toBe('battle');
    expect(ctx.difficulty).toBe('medium');
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.playMode).toBe('play');

    title.enter();
    title.update(DT, makeInput({ taps: [center] }));
    title.update(DT, makeInput({ menuDown: true }));
    title.update(DT, makeInput({ menuDown: true }));
    expect(title.update(DT, makeInput({ menuConfirm: true }))).toBe('battle');
    expect(ctx.difficulty).toBe('hard');
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
    expect(title.update(DT, makeInput({ taps: [center] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_EASY_BUTTON)] }))).toBe('battle');
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.playMode).toBe('play');
    expect(ctx.difficulty).toBe('easy');
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
    expect(title.update(DT, makeInput({ taps: [center] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_EASY_BUTTON)] }))).toBe('battle');
  });

  it('pauses the attract demo while the difficulty overlay is open', () => {
    const title = createTitleScene(context());
    title.enter();
    title.update(DT, makeInput());
    expect(title.update(DT, makeInput({ taps: [center] }))).toBeNull();
    const frozen = peekSharedTitleAttract()?.stats().time ?? -1;
    for (let i = 0; i < 30; i++) title.update(DT, makeInput());
    expect(peekSharedTitleAttract()?.stats().time).toBe(frozen);
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_HARD_BUTTON)] }))).toBe('battle');
  });
});
