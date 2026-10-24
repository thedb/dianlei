import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { TIEBAO_ENTER_AT, TIEBAO_ENTER_DURATION } from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
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

function setup(difficulty: Difficulty) {
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
    challengeStage: '2',
    difficulty,
    input: { setControlsEnabled: vi.fn(), getControlsView: () => view },
  });
  scene.enter();
  return scene;
}

describe('challenge boss 2', () => {
  it('seeks 铁堡 on the factory approach with no mid-stage ships', () => {
    const random = vi.spyOn(Math, 'random');
    const scene = setup('easy');
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(TIEBAO_ENTER_AT);
    expect(info.bossPhase).toBe('enter');
    expect(info.enemyCount).toBe(0);
    expect(info.bossPhase3).toBe(false);
    expect(info.bossMaxHp).toBe(840);

    const frames = Math.ceil((TIEBAO_ENTER_DURATION + 0.5) / DT);
    for (let i = 0; i < frames; i++) scene.update(DT, makeInput());
    const later = scene.getDebugInfo!();
    expect(later.bossPhase).toBe('main');
    expect(later.enemyCount).toBe(0);
    expect(later.enemyBulletCount).toBeGreaterThan(0);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('arms the overload segment on Hard only', () => {
    const easy = setup('easy').getDebugInfo!();
    const hard = setup('hard').getDebugInfo!();
    expect(easy.bossPhase3).toBe(false);
    expect(easy.bossMaxHp).toBe(840);
    expect(hard.bossPhase3).toBe(true);
    expect(hard.bossMaxHp).toBeCloseTo(1404);
  });
});
