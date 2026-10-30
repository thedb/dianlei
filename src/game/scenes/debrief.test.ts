import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { HIGH_SCORE_KEY, readHighScore } from '@/game/highScore';
import type { SceneContext } from './types';
import { assignClearHandoff } from '@/game/battle/campaign';
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

  it('holds a black card for 3s, then starts stage 2 with the clear total', () => {
    const ctx = context();
    ctx.campaignNext = '2';
    ctx.carriedRun = {
      score: 1000,
      lives: 2,
      bombs: 4,
      deaths: 0,
      main: { id: 'vulcan', level: 3 },
      sub: null,
      mate: 1,
      nextExtendScore: 100000,
    };
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
    expect(ctx.carriedRun?.score).toBe(61000);
    expect(scene.update(2.99, makeInput({ menuConfirm: true }))).toBeNull();
    expect(ctx.runStage).toBeUndefined();
    expect(scene.update(0.02, makeInput())).toBe('battle');
    expect(ctx.battleEntry).toBe('stage');
    expect(ctx.runStage).toBe('2');
    expect(ctx.campaignNext).toBeUndefined();
    expect(ctx.challengeStage).toBeUndefined();
    expect(ctx.carriedRun?.lives).toBe(2);
    expect(ctx.carriedRun?.main.level).toBe(3);
  });

  it('Boss连战 clear of boss 1 hands off to boss 2, and boss 4 does not chain', () => {
    const carried = {
      score: 1000,
      lives: 2,
      bombs: 4,
      deaths: 0,
      main: { id: 'vulcan' as const, level: 3 as const },
      sub: { id: 'homing' as const, level: 1 as const },
      mate: 1,
      nextExtendScore: 100000,
    };
    const report = {
      outcome: 'clear' as const,
      baseScore: 1000,
      kills: 1,
      spawned: 1,
      deaths: 0,
      time: 40,
    };

    const ctx = context();
    ctx.bossRush = true;
    ctx.battleEntry = 'boss';
    ctx.challengeStage = '1';
    ctx.run.report = report;
    assignClearHandoff(ctx, '1', carried);
    expect(ctx.campaignNext).toBe('2');
    const scene = createDebriefScene(ctx, 'clear');
    scene.enter();
    expect(scene.update(2.99, makeInput({ menuConfirm: true }))).toBeNull();
    expect(ctx.challengeStage).toBe('1');
    expect(scene.update(0.02, makeInput())).toBe('battle');
    expect(ctx.battleEntry).toBe('boss');
    expect(ctx.bossRush).toBe(true);
    expect(ctx.challengeStage).toBe('2');
    expect(ctx.runStage).toBeUndefined();
    expect(ctx.campaignNext).toBeUndefined();
    expect(ctx.carriedRun?.lives).toBe(2);
    expect(ctx.carriedRun?.bombs).toBe(4);
    expect(ctx.carriedRun?.sub?.level).toBe(1);

    const end = context();
    end.bossRush = true;
    end.battleEntry = 'boss';
    end.challengeStage = '4';
    end.run.report = report;
    assignClearHandoff(end, '4', carried);
    expect(end.campaignNext).toBeUndefined();
    expect(end.carriedRun).toBeUndefined();
    const result = createDebriefScene(end, 'clear');
    result.enter();
    expect(result.update(DT, makeInput({ menuConfirm: true }))).toBe('battle');
    expect(end.battleEntry).toBe('boss');
    expect(end.bossRush).toBe(true);
    expect(end.challengeStage).toBe('4');

    const practice = context();
    practice.battleEntry = 'boss';
    practice.challengeStage = '2';
    assignClearHandoff(practice, '2', carried);
    expect(practice.campaignNext).toBeUndefined();
    expect(practice.bossRush).toBeUndefined();
  });
});
