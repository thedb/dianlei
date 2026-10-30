import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { BOMB_COOLDOWN, RESPAWN_FLYIN_TIME, TIEBAO_ENTER_AT } from '@/game/config';
import { getStage } from '@/game/levels/registry';
import type { ControlsView } from '@/engine/input';
import { createBattleScene } from './battle';

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

function setup(runStage: string) {
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
    battleEntry: 'stage',
    runStage,
    difficulty: 'easy',
    carriedRun: {
      score: 5000,
      lives: 2,
      bombs: 4,
      deaths: 1,
      main: { id: 'vulcan', level: 3 },
      sub: { id: 'homing', level: 1 },
      mate: 1,
      nextExtendScore: 100000,
    },
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  });
  scene.enter();
  return scene;
}

describe('stage 2 entry', () => {
  it('starts the mid-stage at t=0 and keeps the carried stock', () => {
    const scene = setup('2');
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(0);
    expect(info.bossPhase).toBeUndefined();
    expect(info.waveSpawned).toBe(0);
    expect(info.score).toBe(5000);
    expect(info.lives).toBe(2);
    expect(info.bombs).toBe(4);
    expect(info.power).toBe(3);
    expect(info.subLevel).toBe(1);
    expect(info.mateLevel).toBe(1);

    const frames = Math.ceil(7 / DT);
    for (let i = 0; i < frames; i++) scene.update(DT, makeInput());
    const later = scene.getDebugInfo!();
    expect(later.gameTime).toBeGreaterThan(6);
    expect(later.gameTime).toBeLessThan(TIEBAO_ENTER_AT);
    expect(later.waveSpawned).toBeGreaterThan(0);
    expect(later.bossPhase).toBeUndefined();
  });
});

describe('boss rush entry', () => {
  it('seeks boss 1 at Lv3 and keeps the carried stock, then spends a bomb', () => {
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
      battleEntry: 'boss',
      bossRush: true,
      challengeStage: '1',
      difficulty: 'medium',
      carriedRun: {
        score: 8000,
        lives: 2,
        bombs: 4,
        deaths: 1,
        main: { id: 'vulcan', level: 2 },
        sub: { id: 'homing', level: 2 },
        mate: 1,
        nextExtendScore: 100000,
      },
      input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
    });
    scene.enter();
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(getStage('1').boss.enterAt);
    expect(info.power).toBe(3);
    expect(info.subLevel).toBe(2);
    expect(info.mateLevel).toBe(1);
    expect(info.lives).toBe(2);
    expect(info.bombs).toBe(4);
    expect(info.score).toBe(8000);

    const flyIn = Math.ceil(RESPAWN_FLYIN_TIME / DT) + 2;
    for (let i = 0; i < flyIn; i++) scene.update(DT, makeInput());
    scene.update(DT, makeInput({ buttonB: true, keyBomb: true }));
    expect(scene.getDebugInfo!().bombs).toBe(3);
    expect(scene.getDebugInfo!().bombCooldown).toBe(BOMB_COOLDOWN);
  });
});
