import { describe, expect, it, vi } from 'vitest';
import { dodgePilot } from '@/test/battleHarness';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import type { Difficulty } from '@/game/difficulty';
import type { ControlsView } from '@/engine/input';
import * as riskCrate from '@/game/entities/riskCrate';
import type { BattleEntry, SceneContext } from './types';
import { createBattleScene, type BattleScene } from './battle';

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

function setup(difficulty: Difficulty, battleEntry: BattleEntry = 'stage') {
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
    difficulty,
    ...(battleEntry === 'boss' ? { challengeStage: '1' as const } : {}),
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  } satisfies SceneContext);
  scene.enter();
  return scene;
}

/** Ids actually passed to spawnRiskCrate. The pilot may shoot the disc down afterwards. */
function spawned(scene: BattleScene, seconds: number): string[] {
  const spy = vi.spyOn(riskCrate, 'spawnRiskCrate');
  let frame = 0;
  while ((scene.getDebugInfo!().gameTime ?? 0) < seconds && frame < 20000) {
    const next = scene.update(DT, dodgePilot(scene, 24, frame));
    frame++;
    if (next) break;
  }
  const ids = spy.mock.calls.map((call) => call[1].id);
  spy.mockRestore();
  return ids;
}

describe('risk crates in a run', () => {
  it('spawns none on easy, R1 then R2 on medium, and R1, R3, R2 on hard', () => {
    const easy = setup('easy');
    expect(spawned(easy, 110)).toEqual([]);
    expect(easy.getDebugInfo!().gameTime ?? 0).toBeGreaterThanOrEqual(110);

    const medium = setup('medium');
    expect(spawned(medium, 101)).toEqual(['R1', 'R2']);
    expect(medium.getDebugInfo!().gameTime ?? 0).toBeGreaterThanOrEqual(101);

    const hard = setup('hard');
    expect(spawned(hard, 101)).toEqual(['R1', 'R3', 'R2']);
    expect(hard.getDebugInfo!().gameTime ?? 0).toBeGreaterThanOrEqual(101);
  });

  it('does not bring skipped crates into a boss practice fight', () => {
    const scene = setup('hard', 'boss');
    const spy = vi.spyOn(riskCrate, 'spawnRiskCrate');
    for (let frame = 0; frame < 180; frame++) scene.update(DT, dodgePilot(scene, 24, frame));
    expect(spy).not.toHaveBeenCalled();
    expect(scene.getDebugInfo!().crateCount).toBe(0);
    spy.mockRestore();
  });
});
