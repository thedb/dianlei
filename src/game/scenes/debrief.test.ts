import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { HIGH_SCORE_KEY, readHighScore } from '@/game/highScore';
import type { SceneContext } from './types';
import { createDebriefScene } from './debrief';

const DT = 1 / 60;

function context(): SceneContext {
  const settings = createSettingsStore(createMemoryStorage());
  const storage = createMemoryStorage();
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  return {
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage,
    run: { report: null },
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

describe('debrief', () => {
  it('adds clear bonuses and saves a new high score', () => {
    const ctx = context();
    ctx.run.report = {
      outcome: 'clear',
      baseScore: 1000,
      kills: 10,
      spawned: 10,
      deaths: 0,
      time: 200,
    };
    const scene = createDebriefScene(ctx, 'clear');
    scene.enter();
    expect(readHighScore(ctx.storage)).toBe(61000);
    expect(ctx.storage.getStorage(HIGH_SCORE_KEY)).toBe(61000);
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBe('battle');
  });

  it('game over keeps the combat score and can return home', () => {
    const ctx = context();
    ctx.storage.setStorage(HIGH_SCORE_KEY, 9000);
    ctx.run.report = {
      outcome: 'gameover',
      baseScore: 500,
      kills: 3,
      spawned: 10,
      deaths: 3,
      time: 40,
    };
    const scene = createDebriefScene(ctx, 'gameover');
    scene.enter();
    expect(readHighScore(ctx.storage)).toBe(9000);
    scene.update(DT, makeInput({ menuDown: true }));
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBe('title');
  });
});
