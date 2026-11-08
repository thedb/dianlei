import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import {
  BOMBS_RUSH_START,
  BOMBS_START,
  EXTEND_OVERFLOW_SCORE,
  LIVES_START,
  POWER_MAX,
} from '@/game/config';
import { prepareBossConfig, startingLives, type Difficulty } from '@/game/difficulty';
import { getStage } from '@/game/levels/registry';
import { bossPhaseDef } from '@/game/systems/boss';
import type { BattleEntry, CarriedRun, SceneContext } from './types';
import type { ControlsView } from '@/engine/input';
import { createBattleScene } from './battle';

const stage1 = getStage('1');

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

function setup(
  battleEntry: BattleEntry = 'stage',
  difficulty?: Difficulty,
  extra?: Partial<SceneContext>
) {
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
    ...(difficulty !== undefined ? { difficulty } : {}),
    ...(battleEntry === 'boss' ? { challengeStage: '1' } : {}),
    ...extra,
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  });
  scene.enter();
  return scene;
}

describe('battle boss practice', () => {
  it('挑战 Boss parks at the entrance with Lv3 and spawns no mid-stage ships', () => {
    const scene = setup('boss');
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(stage1.boss.enterAt);
    expect(info.bossPhase).toBe('enter');
    expect(info.power).toBe(POWER_MAX);
    expect(info.lives).toBe(startingLives('easy'));
    expect(info.bombs).toBe(BOMBS_START);
    expect(info.enemyCount).toBe(0);

    const frames = Math.ceil(stage1.boss.enterDuration / DT) + 1;
    for (let i = 0; i < frames; i++) scene.update(DT, makeInput());
    const later = scene.getDebugInfo!();
    expect(later.enemyCount).toBe(0);
    expect(later.bossPhase).toBe('phase1');
    expect(later.gameTime).toBeGreaterThan(stage1.boss.enterAt + stage1.boss.enterDuration);
  });

  it('普通 boss practice keeps Easy HP and two phases', () => {
    const scene = setup('boss', 'easy');
    const info = scene.getDebugInfo!();
    const parts = prepareBossConfig(stage1.boss, 'easy').parts.reduce(
      (sum, part) => sum + part.hp,
      0
    );
    expect(info.bossPhase3).toBe(false);
    expect(info.bossMaxHp).toBeCloseTo(parts);
  });

  it('困难 boss practice scales HP and arms phase 3', () => {
    const scene = setup('boss', 'hard');
    const info = scene.getDebugInfo!();
    const prepared = prepareBossConfig(stage1.boss, 'hard');
    const parts = prepared.parts.reduce((sum, part) => sum + part.hp, 0);
    expect(info.bossPhase3).toBe(true);
    expect(info.bossMaxHp).toBeCloseTo(parts + (bossPhaseDef(prepared, 'phase3').segmentHp ?? 0));
  });

  it('easy starts with 10 lives; 菜鸟 starts with 99; medium and hard stay at 3', () => {
    expect(setup('stage', 'rookie').getDebugInfo!().lives).toBe(99);
    expect(setup('stage', 'rookie').getDebugInfo!().lives).toBe(startingLives('rookie'));
    expect(setup('stage', 'rookie').getDebugInfo!().bombs).toBe(BOMBS_START);
    expect(setup('stage', 'easy').getDebugInfo!().lives).toBe(startingLives('easy'));
    expect(setup('stage', 'easy').getDebugInfo!().lives).toBe(10);
    expect(setup('stage', 'easy').getDebugInfo!().bombs).toBe(BOMBS_START);
    expect(setup('stage', 'medium').getDebugInfo!().lives).toBe(LIVES_START);
    expect(setup('stage', 'medium').getDebugInfo!().bombs).toBe(BOMBS_START);
    expect(setup('stage', 'hard').getDebugInfo!().lives).toBe(LIVES_START);
    expect(setup('stage', 'hard').getDebugInfo!().bombs).toBe(BOMBS_START);
    expect(setup('boss', 'easy').getDebugInfo!().bombs).toBe(BOMBS_START);
    expect(setup('boss', 'hard').getDebugInfo!().lives).toBe(LIVES_START);
  });

  it('菜鸟 boss HP matches Easy and does not arm phase 3', () => {
    const rookie = setup('boss', 'rookie').getDebugInfo!();
    const easy = setup('boss', 'easy').getDebugInfo!();
    expect(rookie.lives).toBe(99);
    expect(rookie.bossPhase3).toBe(false);
    expect(easy.bossPhase3).toBe(false);
    expect(rookie.bossMaxHp).toBeCloseTo(easy.bossMaxHp!);
    expect(rookie.bombs).toBe(BOMBS_START);
  });

  it('菜鸟 keeps 99 and can extend back to 99; Easy still caps at 10', () => {
    const stock = (lives: number): CarriedRun => ({
      score: 100000,
      lives,
      bombs: 2,
      deaths: 0,
      main: { id: 'vulcan', level: 1 },
      sub: null,
      mate: 0,
      nextExtendScore: 100000,
    });

    const rookieCap = setup('stage', 'rookie', { carriedRun: stock(99) });
    rookieCap.update(DT, makeInput());
    expect(rookieCap.getDebugInfo!().lives).toBe(99);
    expect(rookieCap.getDebugInfo!().score).toBe(100000 + EXTEND_OVERFLOW_SCORE);

    const rookieBelow = setup('stage', 'rookie', { carriedRun: stock(98) });
    rookieBelow.update(DT, makeInput());
    expect(rookieBelow.getDebugInfo!().lives).toBe(99);
    expect(rookieBelow.getDebugInfo!().score).toBe(100000);

    const easyCap = setup('stage', 'easy', { carriedRun: stock(10) });
    easyCap.update(DT, makeInput());
    expect(easyCap.getDebugInfo!().lives).toBe(10);
    expect(easyCap.getDebugInfo!().score).toBe(100000 + EXTEND_OVERFLOW_SCORE);

    const easyBelow = setup('stage', 'easy', { carriedRun: stock(9) });
    easyBelow.update(DT, makeInput());
    expect(easyBelow.getDebugInfo!().lives).toBe(10);
    expect(easyBelow.getDebugInfo!().score).toBe(100000);
  });

  it('a fresh Boss连战 starts with 5 bombs and still uses the difficulty life stock', () => {
    for (const difficulty of ['rookie', 'easy', 'medium', 'hard'] as const) {
      const info = setup('boss', difficulty, { bossRush: true }).getDebugInfo!();
      expect(info.bombs).toBe(BOMBS_RUSH_START);
      expect(info.lives).toBe(startingLives(difficulty));
    }
  });

  it('a Boss连战 handoff keeps the carried bombs and lives', () => {
    const info = setup('boss', 'easy', {
      bossRush: true,
      challengeStage: '2',
      carriedRun: {
        score: 12000,
        lives: 4,
        bombs: 1,
        deaths: 1,
        main: { id: 'vulcan', level: 3 },
        sub: null,
        mate: 0,
        nextExtendScore: 100000,
      },
    }).getDebugInfo!();
    expect(info.lives).toBe(4);
    expect(info.bombs).toBe(1);
    expect(info.score).toBe(12000);
    expect(info.power).toBe(POWER_MAX);
  });

  it('holds fire during the fly-in, then shoots', () => {
    const scene = setup();
    const fire = makeInput({ buttonA: true, keyFire: true });
    for (let i = 0; i < 20; i++) scene.update(DT, fire);
    expect(scene.getDebugInfo!().bulletCount).toBe(0);
    for (let i = 0; i < 40; i++) scene.update(DT, fire);
    expect(scene.getDebugInfo!().bulletCount).toBeGreaterThan(0);
  });
});
