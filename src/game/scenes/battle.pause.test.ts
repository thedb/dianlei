import { describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createSettingsStore, createMemoryStorage } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
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

function setup() {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const setControlsEnabled = vi.fn();
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
    input: { setControlsEnabled, getControlsView: () => view },
  });
  scene.enter();
  return { scene, layout, setControlsEnabled };
}

const DT = 1 / 60;

describe('battle pause', () => {
  it('freezes gameplay while paused and resumes on Continue', () => {
    const { scene, setControlsEnabled } = setup();
    const fire = makeInput({ buttonA: true, keyFire: true, joystickX: 1, joystickMagnitude: 1 });
    for (let i = 0; i < 30; i++) scene.update(DT, fire);
    const before = scene.getDebugInfo!();
    expect(before.bulletCount).toBeGreaterThan(0);

    scene.update(DT, makeInput({ pausePressed: true }));
    expect(scene.getDebugInfo!().paused).toBe(true);
    expect(setControlsEnabled).toHaveBeenLastCalledWith(false);

    const frozen = scene.getDebugInfo!();
    for (let i = 0; i < 600; i++) scene.update(DT, fire);
    const after = scene.getDebugInfo!();
    expect(after.gameTime).toBe(frozen.gameTime);
    expect(after.bulletCount).toBe(frozen.bulletCount);
    expect(after.enemyCount).toBe(frozen.enemyCount);
    expect(after.score).toBe(frozen.score);

    scene.update(DT, makeInput({ menuConfirm: true }));
    expect(scene.getDebugInfo!().paused).toBe(false);
    expect(setControlsEnabled).toHaveBeenLastCalledWith(true);
    scene.update(DT, fire);
    expect(scene.getDebugInfo!().gameTime).toBeGreaterThan(frozen.gameTime!);
  });

  it('opens from the on-screen pause button and from backgrounding', () => {
    const { scene, layout } = setup();
    const { x, y } = layout.pauseButton;
    scene.update(DT, makeInput({ taps: [{ x, y }] }));
    expect(scene.getDebugInfo!().paused).toBe(true);

    scene.update(DT, makeInput({ menuBack: true }));
    expect(scene.getDebugInfo!().paused).toBe(false);

    scene.onHide!();
    expect(scene.getDebugInfo!().paused).toBe(true);
  });

  it('exit to title only after confirmation', () => {
    const { scene } = setup();
    scene.update(DT, makeInput({ pausePressed: true }));
    scene.update(DT, makeInput({ menuUp: true }));
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBeNull();
    scene.update(DT, makeInput({ menuLeft: true }));
    expect(scene.update(DT, makeInput({ menuConfirm: true }))).toBe('title');
  });
});
