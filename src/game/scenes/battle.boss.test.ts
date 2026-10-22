import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { BOMBS_START, LIVES_START, POWER_MAX } from '@/game/config';
import { prepareBossConfig, type Difficulty } from '@/game/difficulty';
import { stage1 } from '@/game/levels/stage1';
import type { BattleEntry } from './types';
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

function setup(battleEntry: BattleEntry = 'stage', difficulty?: Difficulty) {
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
    expect(info.lives).toBe(LIVES_START);
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
    expect(info.bossMaxHp).toBeCloseTo(parts + (prepared.phase3?.hp ?? 0));
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
