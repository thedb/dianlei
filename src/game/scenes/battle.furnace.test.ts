/**
 * Stage 3 smoke runs on the real boot bake: every sprite, tile, map chunk,
 * and boss sprite is baked into fake canvases, and the battle scene draws
 * every few frames. The #52 build died while baking boss art at scene enter,
 * which the stubbed render replays could not see.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DT, battleContext, dodgePilot, seeded } from '@/test/battleHarness';
import { FakeOffscreenCanvas, fakeRenderer } from '@/test/fakeCanvas';
import { makeInput } from '@/test/fakes';
import { FURNACE_ENTER_AT, STAGE3_WARNING_AT } from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
import type { SceneContext } from './types';
import { createBattleScene, type BattleScene } from './battle';

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

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Ships and ground units the stage 3 table spawns per difficulty in the stage 3 wave table. */
const SPAWNED = { easy: 125, hard: 192 } as const;

function challenge(difficulty: Difficulty): SceneContext {
  return { ...battleContext('boss', difficulty, seeded(31)), challengeStage: '3' };
}

function stageRun(difficulty: Difficulty): SceneContext {
  return {
    ...battleContext('stage', difficulty, seeded(47)),
    runStage: '3',
    carriedRun: {
      score: 0,
      lives: 9,
      bombs: 3,
      deaths: 0,
      main: { id: 'vulcan', level: 3 },
      sub: { id: 'homing', level: 2 },
      mate: 2,
      nextExtendScore: 100000,
    },
  };
}

function play(scene: BattleScene, seconds: number, seed: number, every = 6): number {
  const renderer = fakeRenderer();
  let maxEnemies = 0;
  const frames = Math.round(seconds / DT);
  for (let frame = 0; frame < frames; frame++) {
    const next = scene.update(DT, dodgePilot(scene, seed, frame));
    maxEnemies = Math.max(maxEnemies, scene.getDebugInfo!().enemyCount ?? 0);
    if (frame % every === 0 || next) scene.render(renderer, 0.5);
    if (next) break;
  }
  return maxEnemies;
}

describe('stage 3 on real assets', () => {
  it('opens 挑战 Boss 3 on the 炉心 approach with no waves', () => {
    const scene = createBattleScene(challenge('easy'));
    expect(() => scene.enter()).not.toThrow();
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBeGreaterThanOrEqual(FURNACE_ENTER_AT);
    expect(info.enemyCount).toBe(0);
    expect(() => scene.render(fakeRenderer(), 0)).not.toThrow();
    scene.update(DT, makeInput());
    expect(scene.getDebugInfo!().bossMaxHp).toBeCloseTo(560, 6);
    expect(scene.getDebugInfo!().bossPhase3).toBe(false);
    expect(() => play(scene, 30, 3)).not.toThrow();
    scene.exit?.();
  });

  it('arms the Hard overload bar and runs the fight', () => {
    const scene = createBattleScene(challenge('hard'));
    scene.enter();
    scene.update(DT, makeInput());
    const info = scene.getDebugInfo!();
    expect(info.bossPhase3).toBe(true);
    expect(info.bossMaxHp).toBeCloseTo(728 + 234, 6);
    expect(() => play(scene, 40, 9)).not.toThrow();
    scene.exit?.();
  });

  it.each(['easy', 'hard'] as const)('plays the %s run from t=0 into the boss', (difficulty) => {
    const scene = createBattleScene(stageRun(difficulty));
    scene.enter();
    expect(scene.getDebugInfo!().gameTime).toBe(0);
    let maxEnemies = 0;
    expect(() => {
      maxEnemies = play(scene, FURNACE_ENTER_AT + 6, difficulty === 'easy' ? 5 : 13);
    }).not.toThrow();
    const info = scene.getDebugInfo!();
    expect(maxEnemies).toBeGreaterThan(5);
    expect(info.waveSpawned).toBe(SPAWNED[difficulty]);
    expect(info.gameTime).toBeGreaterThan(STAGE3_WARNING_AT);
    expect(info.bossPhase).toBe('pods');
    expect(info.bossPhase3).toBe(difficulty === 'hard');
    scene.exit?.();
  });
});
