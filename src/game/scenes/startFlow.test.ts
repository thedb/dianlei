import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Renderer } from '@/engine/renderer';
import {
  createBootScene,
  BOOT_DURATION,
  BOOT_ENTER_LABEL,
  BOOT_READY_AT,
  BOOT_READY_HOLD,
} from './boot';
import { createSceneManager } from './index';
import { BOSS_RUSH_BUTTON, createTitleScene, SETTINGS_BUTTON } from './title';
import { GAME_TITLE } from '@/game/ui/titleFont';
import { fakeShellImage, resetShellArtForTests, setShellArtForTests } from '@/game/ui/shellArt';
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

beforeEach(() => {
  resetShellArtForTests();
});

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

function textRenderer(): Renderer & { texts: string[]; fonts: string[]; draws: number } {
  const texts: string[] = [];
  const fonts: string[] = [];
  let draws = 0;
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return () => gradient;
        if (prop === 'fillText') return (text: string) => texts.push(text);
        if (prop === 'drawImage')
          return () => {
            draws += 1;
          };
        return () => undefined;
      },
      set(_target, prop, value) {
        if (prop === 'font' && typeof value === 'string') fonts.push(value);
        return true;
      },
    }
  );
  const renderer = {
    texts,
    fonts,
    get draws() {
      return draws;
    },
    clear() {
      return undefined;
    },
    drawImage() {
      return undefined;
    },
    getContext: () => ctx,
  };
  return renderer as unknown as Renderer & { texts: string[]; fonts: string[]; draws: number };
}

describe('boot screen', () => {
  it('stays on boot until the load and the extra hold have elapsed, and a tap', () => {
    const ctx = context();
    const boot = createBootScene(ctx);
    boot.enter();
    expect(BOOT_READY_HOLD).toBe(2);
    expect(BOOT_READY_AT).toBe(BOOT_DURATION + BOOT_READY_HOLD);

    expect(boot.update(BOOT_DURATION, makeInput({ taps: [center], menuConfirm: true }))).toBeNull();
    expect(
      boot.update(BOOT_READY_HOLD - DT, makeInput({ taps: [center], menuConfirm: true }))
    ).toBeNull();
    expect(boot.update(DT, makeInput())).toBeNull();
    expect(ctx.playMode).toBeUndefined();
    expect(ctx.difficulty).toBeUndefined();
    expect(ctx.battleEntry).toBe('stage');

    expect(boot.update(DT, makeInput({ taps: [{ x: 20, y: 20 }] }))).toBe('title');
    expect(ctx.difficulty).toBeUndefined();
    expect(ctx.playMode).toBeUndefined();
  });

  it('does not advance early, then advances on confirm once ready', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(
      boot.update(BOOT_READY_AT - 0.05, makeInput({ taps: [center], menuConfirm: true }))
    ).toBeNull();
    expect(boot.update(0.05, makeInput({ menuConfirm: true }))).toBe('title');
  });

  it('draws the enter prompt only after the gate is ready', () => {
    const boot = createBootScene(context());
    boot.enter();
    const renderer = textRenderer();
    boot.render(renderer, 1);
    expect(renderer.texts).not.toContain(BOOT_ENTER_LABEL);
    expect(renderer.texts).not.toContain(GAME_TITLE);

    boot.update(BOOT_READY_AT, makeInput());
    boot.render(renderer, 1);
    expect(renderer.texts).toContain(BOOT_ENTER_LABEL);
    expect(renderer.texts).toContain(GAME_TITLE);
    expect(renderer.fonts.some((font) => font.includes('Fusion Pixel Font'))).toBe(true);
    expect(renderer.fonts.some((font) => font.includes('PingFang SC'))).toBe(true);
  });

  it('draws the cover and the title mark without throwing once they are ready', () => {
    setShellArtForTests({
      cover: fakeShellImage(720, 1280),
      mark: fakeShellImage(1024, 1024),
    });
    const boot = createBootScene(context());
    boot.enter();
    const renderer = textRenderer();
    expect(() => boot.render(renderer, 1)).not.toThrow();
    expect(renderer.draws).toBe(1);
    boot.update(BOOT_READY_AT, makeInput());
    expect(() => boot.render(renderer, 1)).not.toThrow();
    expect(renderer.draws).toBe(3);
    expect(renderer.texts).toContain(BOOT_ENTER_LABEL);
    expect(renderer.texts).not.toContain(GAME_TITLE);
  });

  it('does not create or draw the attract demo while the boot screen is up', () => {
    resetSharedTitleAttractForTests();
    const manager = createSceneManager(context());
    manager.start('boot');
    expect(peekSharedTitleAttract()).toBeNull();

    const renderer = loadingRenderer();
    let scene = manager.getCurrentScene();
    expect(scene?.id).toBe('boot');
    const frames = Math.ceil((BOOT_READY_AT + 1) / DT);
    for (let i = 0; i < frames && scene?.id === 'boot'; i++) {
      const next = scene.update(DT, makeInput());
      scene.render(renderer, 1);
      expect(next).toBeNull();
    }

    expect(scene?.id).toBe('boot');
    expect(peekSharedTitleAttract()).toBeNull();
    expect(renderer.clears.length).toBeGreaterThan(0);
    expect(renderer.clears.every((color) => color === '#000')).toBe(true);
    expect(renderer.images).toBe(0);
    if (!scene) throw new Error('boot scene missing');

    const next = scene.update(DT, makeInput({ taps: [{ x: 180, y: 320 }] }));
    expect(next).toBe('title');
    expect(peekSharedTitleAttract()).toBeNull();
    if (next !== 'title') throw new Error('expected title');
    manager.transition(next);
    scene = manager.getCurrentScene();
    expect(scene?.id).toBe('title');
    expect(peekSharedTitleAttract()?.isRunning()).toBe(true);

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

  it('the title menu is 开始游戏, Boss连战, and 设置', () => {
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

  it('keyboard down selects Boss连战, then 设置', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    expect(title.update(DT, makeInput({ menuDown: true }))).toBeNull();
    expect(title.update(DT, makeInput({ menuConfirm: true }))).toBeNull();
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.bossRush).toBeUndefined();
    expect(ctx.playMode).toBeUndefined();
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_BACK_BUTTON)] }))).toBeNull();

    expect(title.update(DT, makeInput({ menuDown: true }))).toBeNull();
    expect(title.update(DT, makeInput({ menuConfirm: true }))).toBeNull();
    expect(ctx.playMode).toBeUndefined();
    expect(ctx.bossRush).toBeUndefined();
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

  it('Boss连战 opens difficulty, then starts boss 1 with the rush flag', () => {
    const ctx = context();
    const title = createTitleScene(ctx);
    title.enter();
    const rush = {
      x: BOSS_RUSH_BUTTON.x + BOSS_RUSH_BUTTON.w / 2,
      y: BOSS_RUSH_BUTTON.y + BOSS_RUSH_BUTTON.h / 2,
    };
    expect(BOSS_RUSH_BUTTON.y).toBeGreaterThanOrEqual(START_BUTTON.y + START_BUTTON.h + 12);
    expect(SETTINGS_BUTTON.y).toBeGreaterThanOrEqual(BOSS_RUSH_BUTTON.y + BOSS_RUSH_BUTTON.h + 12);
    expect(title.update(DT, makeInput({ taps: [rush] }))).toBeNull();
    expect(ctx.playMode).toBeUndefined();
    expect(ctx.bossRush).toBeUndefined();
    expect(ctx.battleEntry).toBe('stage');

    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_BACK_BUTTON)] }))).toBeNull();
    expect(ctx.bossRush).toBeUndefined();

    expect(title.update(DT, makeInput({ taps: [rush] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DIFFICULTY_MEDIUM_BUTTON)] }))).toBe('battle');
    expect(ctx.playMode).toBe('play');
    expect(ctx.battleEntry).toBe('boss');
    expect(ctx.bossRush).toBe(true);
    expect(ctx.challengeStage).toBe('1');
    expect(ctx.difficulty).toBe('medium');
    expect(ctx.runStage).toBeUndefined();
    expect(ctx.campaignNext).toBeUndefined();
    expect(ctx.carriedRun).toBeUndefined();

    const renderer = textRenderer();
    createTitleScene(context()).render(renderer, 1);
    expect(renderer.texts).toContain(GAME_TITLE);
    expect(renderer.texts).toContain('DIANLEI PLAN');
    expect(renderer.texts).toContain('Boss连战');
    expect(renderer.texts).toContain('开始游戏');
    expect(renderer.texts).toContain('设置');
  });

  it('draws the centered title mark without throwing', () => {
    setShellArtForTests({ mark: fakeShellImage(1024, 1024) });
    const renderer = textRenderer();
    expect(() => createTitleScene(context()).render(renderer, 1)).not.toThrow();
    expect(renderer.draws).toBeGreaterThan(0);
    expect(renderer.texts).toContain('DIANLEI PLAN');
    expect(renderer.texts).toContain('开始游戏');
    expect(renderer.texts).not.toContain(GAME_TITLE);
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
