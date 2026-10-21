import { describe, expect, it, vi } from 'vitest';
import { DEBUG_HOT_SIZE, DEBUG_HOT_TAPS, LOGICAL_W } from '@/game/config';
import { computeControlLayout } from '@/game/controls';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { makeInput } from '@/test/fakes';
import {
  DEBUG_BOSS_BUTTON,
  DEBUG_CLOSE_BUTTON,
  DEBUG_MODE_BUTTON,
  DEBUG_WEAPON_BUTTON,
  createDebugPanel,
} from '@/game/ui/debugPanel';
import { START_BUTTON } from '@/game/ui/startButton';
import { createTitleScene } from './title';
import type { TitleAttract } from './titleAttract';
import type { SceneContext } from './types';

const DT = 1 / 60;
const hot = { x: LOGICAL_W - DEBUG_HOT_SIZE / 2, y: DEBUG_HOT_SIZE / 2 };
const outside = { x: 12, y: 12 };

function point(rect: { x: number; y: number; w: number; h: number }) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

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

function stubAttract(): TitleAttract & { updates: () => number } {
  let running = false;
  let updates = 0;
  return {
    start: () => {
      running = true;
    },
    stop: () => {
      running = false;
    },
    isRunning: () => running,
    updates: () => updates,
    update: () => {
      updates += 1;
    },
    render: () => undefined,
    stats: () => ({
      time: 0,
      spawned: 0,
      bullets: 0,
      enemies: 0,
      enemyBullets: 0,
      playerDead: false,
      explosions: 0,
      lives: 3,
      bombs: 2,
      fade: 0,
      sceneId: 'battle',
    }),
    plan: () => ({ routeId: 0, seed: 1 }),
    pilotView: () => ({ player: { x: 0, y: 0 }, enemies: [], bullets: [] }),
  };
}

function openPanel(title: ReturnType<typeof createTitleScene>): void {
  for (let i = 0; i < DEBUG_HOT_TAPS; i++) {
    expect(title.update(DT, makeInput({ taps: [hot] }))).toBeNull();
  }
}

describe('debug panel actions', () => {
  it('maps the four entries', () => {
    const panel = createDebugPanel();
    panel.open();
    expect(panel.update(makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBe('boss');
    expect(panel.update(makeInput({ taps: [point(DEBUG_MODE_BUTTON)] }))).toBe('toggleDebug');
    expect(panel.update(makeInput({ taps: [point(DEBUG_WEAPON_BUTTON)] }))).toBe('weaponTest');
    expect(panel.update(makeInput({ taps: [point(DEBUG_CLOSE_BUTTON)] }))).toBe('close');
    panel.open();
    expect(panel.update(makeInput({ menuBack: true }))).toBe('close');
  });
});

describe('title debug entry', () => {
  it('opens on six hot-zone taps and keeps the attract demo updating', () => {
    const ctx = context();
    const attract = stubAttract();
    const title = createTitleScene(ctx, attract);
    title.enter();
    openPanel(title);
    const calls = attract.updates();
    expect(title.update(DT, makeInput())).toBeNull();
    expect(attract.updates()).toBe(calls + 1);

    expect(title.update(DT, makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBe('battle');
    expect(ctx.battleEntry).toBe('boss');
    expect(ctx.playMode).toBe('play');
  });

  it('toggles debug mode without leaving the title', () => {
    const ctx = context();
    const title = createTitleScene(ctx, stubAttract());
    title.enter();
    openPanel(title);
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_MODE_BUTTON)] }))).toBeNull();
    expect(ctx.settings.get().debugMode).toBe(true);
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_MODE_BUTTON)] }))).toBeNull();
    expect(ctx.settings.get().debugMode).toBe(false);
    expect(ctx.playMode).toBeUndefined();
  });

  it('starts weapon test from the panel and a normal start stays a full stage', () => {
    const ctx = context();
    const title = createTitleScene(ctx, stubAttract());
    title.enter();
    openPanel(title);
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_WEAPON_BUTTON)] }))).toBe('battle');
    expect(ctx.playMode).toBe('weaponTest');
    expect(ctx.battleEntry).toBe('stage');

    title.enter();
    const start = { x: START_BUTTON.x + 8, y: START_BUTTON.y + 8 };
    expect(title.update(DT, makeInput({ taps: [start] }))).toBe('battle');
    expect(ctx.playMode).toBe('play');
    expect(ctx.battleEntry).toBe('stage');
  });

  it('closes from the button and from Esc, then Start still works', () => {
    const ctx = context();
    const title = createTitleScene(ctx, stubAttract());
    title.enter();
    openPanel(title);
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_CLOSE_BUTTON)] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBeNull();

    openPanel(title);
    expect(title.update(DT, makeInput({ menuBack: true }))).toBeNull();
    const start = {
      x: START_BUTTON.x + START_BUTTON.w / 2,
      y: START_BUTTON.y + START_BUTTON.h / 2,
    };
    expect(title.update(DT, makeInput({ taps: [start] }))).toBe('battle');
    expect(ctx.playMode).toBe('play');
  });

  it('ignores taps outside the zone and resets when the 2 second window expires', () => {
    const ctx = context();
    const title = createTitleScene(ctx, stubAttract());
    title.enter();
    for (let i = 0; i < DEBUG_HOT_TAPS - 1; i++) {
      expect(title.update(DT, makeInput({ taps: [hot] }))).toBeNull();
    }
    expect(title.update(DT, makeInput({ taps: [outside] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBeNull();

    expect(title.update(DT, makeInput({ taps: [hot] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBe('battle');

    title.enter();
    for (let i = 0; i < DEBUG_HOT_TAPS - 1; i++) {
      title.update(DT, makeInput({ taps: [hot] }));
    }
    title.update(2.1, makeInput());
    expect(title.update(DT, makeInput({ taps: [hot] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBeNull();
    for (let i = 0; i < DEBUG_HOT_TAPS - 2; i++) {
      expect(title.update(DT, makeInput({ taps: [hot] }))).toBeNull();
    }
    expect(title.update(DT, makeInput({ taps: [hot] }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [point(DEBUG_BOSS_BUTTON)] }))).toBe('battle');
  });
});
