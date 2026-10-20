import { describe, expect, it, vi } from 'vitest';
import { createBootScene, BOOT_DURATION } from './boot';
import { createTitleScene, SETTINGS_BUTTON } from './title';
import { START_BUTTON } from '@/game/ui/startButton';
import { createSettingsStore, createMemoryStorage } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import { makeInput } from '@/test/fakes';
import type { SceneContext } from './types';

const DT = 1 / 60;

function context(): SceneContext {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  return {
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage: createMemoryStorage(),
    run: { report: null },
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

const center = { x: START_BUTTON.x + START_BUTTON.w / 2, y: START_BUTTON.y + START_BUTTON.h / 2 };

describe('boot screen start button', () => {
  it('first tap on 开始游戏 enters battle immediately', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(boot.update(DT, makeInput({ taps: [center] }))).toBe('battle');
  });

  it('accepts taps slightly outside the drawn button', () => {
    const boot = createBootScene(context());
    boot.enter();
    const edge = { x: START_BUTTON.x - 8, y: START_BUTTON.y + START_BUTTON.h + 8 };
    expect(boot.update(DT, makeInput({ taps: [edge] }))).toBe('battle');
  });

  it('ignores taps elsewhere and hands off to the title screen', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(boot.update(DT, makeInput({ taps: [{ x: 20, y: 20 }] }))).toBeNull();
    let next = null;
    for (let t = 0; t < BOOT_DURATION + 0.1 && !next; t += DT) next = boot.update(DT, makeInput());
    expect(next).toBe('title');
  });

  it('keyboard confirm also starts', () => {
    const boot = createBootScene(context());
    boot.enter();
    expect(boot.update(DT, makeInput({ menuConfirm: true }))).toBe('battle');
  });
});

describe('title screen start button', () => {
  it('first tap on 开始游戏 enters battle', () => {
    const title = createTitleScene(context());
    title.enter();
    expect(title.update(DT, makeInput({ taps: [center] }))).toBe('battle');
  });

  it('sits at the same place as the boot button', () => {
    // Shared rect: a tap during the boot→title hand-off still hits 开始游戏
    const title = createTitleScene(context());
    title.enter();
    expect(
      title.update(DT, makeInput({ taps: [{ x: START_BUTTON.x + 4, y: START_BUTTON.y + 4 }] }))
    ).toBe('battle');
  });

  it('设置 opens settings instead of starting', () => {
    const title = createTitleScene(context());
    title.enter();
    const tap = { x: SETTINGS_BUTTON.x + 10, y: SETTINGS_BUTTON.y + SETTINGS_BUTTON.h / 2 };
    expect(title.update(DT, makeInput({ taps: [tap] }))).toBeNull();
    // Now in settings: tapping where 开始游戏 was must not start the game
    expect(title.update(DT, makeInput({ menuBack: true }))).toBeNull();
    expect(title.update(DT, makeInput({ taps: [center] }))).toBe('battle');
  });
});
