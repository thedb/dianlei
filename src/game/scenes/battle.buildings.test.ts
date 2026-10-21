import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { BG_SCROLL_SPEED } from '@/game/config';
import { stage1 } from '@/game/levels/stage1';
import { buildingSpawnScroll } from '@/game/entities/building';
import type { ControlsView } from '@/engine/input';
import type { BattleEntry, SceneContext } from './types';
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

function setup(battleEntry: BattleEntry, playMode: SceneContext['playMode'] = 'play') {
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
    playMode,
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  });
  scene.enter();
  return scene;
}

function runUntil(scene: ReturnType<typeof setup>, seconds: number): void {
  while ((scene.getDebugInfo!().gameTime ?? 0) < seconds) scene.update(DT, makeInput());
}

const firstSpawn = Math.min(...stage1.buildings.map(buildingSpawnScroll)) / BG_SCROLL_SPEED;

describe('battle buildings', () => {
  it('spawns the first building when the map scrolls it in', () => {
    const scene = setup('stage');
    runUntil(scene, firstSpawn - 0.1);
    expect(scene.getDebugInfo!().buildingCount).toBe(0);
    runUntil(scene, firstSpawn + 0.2);
    expect(scene.getDebugInfo!().buildingCount).toBe(1);
  });

  it('shows the same buildings in the title attract demo', () => {
    const play = setup('stage');
    const demo = setup('stage', 'attract');
    runUntil(play, firstSpawn + 6);
    runUntil(demo, firstSpawn + 6);
    expect(demo.getDebugInfo!().buildingCount).toBeGreaterThan(0);
    expect(demo.getDebugInfo!().buildingCount).toBe(play.getDebugInfo!().buildingCount);
  });

  it('has none in boss practice', () => {
    const scene = setup('boss');
    for (let i = 0; i < 300; i++) scene.update(DT, makeInput());
    expect(scene.getDebugInfo!().buildingCount).toBe(0);
  });
});
