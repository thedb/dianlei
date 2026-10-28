/**
 * Stage 4 map smoke. Waves are empty and the boss is a parked stub, so this
 * only checks that both entries bake, scroll, and draw.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DT, battleContext, seeded } from '@/test/battleHarness';
import { FakeOffscreenCanvas, fakeRenderer } from '@/test/fakeCanvas';
import { makeInput } from '@/test/fakes';
import { OBSIDIAN_ENTER_AT } from '@/game/config';
import type { SceneContext } from './types';
import { createBattleScene } from './battle';

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

function stageRun(): SceneContext {
  return { ...battleContext('stage', 'easy', seeded(4)), runStage: '4' };
}

function challenge(): SceneContext {
  return { ...battleContext('boss', 'easy', seeded(41)), challengeStage: '4' };
}

describe('stage 4 map entry', () => {
  it('starts 航母出击 at t = 0 on an empty run', () => {
    const scene = createBattleScene(stageRun());
    expect(() => scene.enter()).not.toThrow();
    expect(scene.getDebugInfo!().gameTime).toBe(0);
    expect(scene.getDebugInfo!().enemyCount).toBe(0);
    expect(() => scene.render(fakeRenderer(), 0)).not.toThrow();
    expect(() => scene.update(DT, makeInput())).not.toThrow();
    expect(scene.getDebugInfo!().enemyCount).toBe(0);
    scene.exit?.();
  });

  it('opens 挑战 Boss 4 on the enemy deck', () => {
    const scene = createBattleScene(challenge());
    expect(() => scene.enter()).not.toThrow();
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(OBSIDIAN_ENTER_AT);
    expect(info.enemyCount).toBe(0);
    expect(() => scene.render(fakeRenderer(), 0)).not.toThrow();
    scene.update(DT, makeInput());
    expect(scene.getDebugInfo!().bossMaxHp).toBeGreaterThan(0);
    expect(scene.getDebugInfo!().enemyCount).toBe(0);
    scene.exit?.();
  });
});
