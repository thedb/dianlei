import { describe, expect, it } from 'vitest';
import { createInputHandler, FLOATING_IDLE_ALPHA } from './input';
import { createSettingsStore, createMemoryStorage } from '@/game/settings';
import { createFakePlatform } from '@/test/fakes';

function setup(settings: Parameters<ReturnType<typeof createSettingsStore>['update']>[0] = {}) {
  const fake = createFakePlatform();
  const store = createSettingsStore(createMemoryStorage());
  store.update(settings);
  const input = createInputHandler(fake.platform, store);
  return { fake, store, input };
}

describe('floating joystick', () => {
  it('appears where the finger first touches in the left zone', () => {
    const { fake, input } = setup({ joystickMode: 'floating' });
    fake.touchStart([{ id: 1, x: 90, y: 300 }]);
    const view = input.getControlsView();
    expect(view.joystick.active).toBe(true);
    expect(view.joystick.baseX).toBe(90);
    expect(view.joystick.baseY).toBe(300);

    fake.touchMove([{ id: 1, x: 150, y: 300 }]);
    const s = input.getState();
    expect(s.joystickX).toBeCloseTo(1);
    expect(s.joystickY).toBeCloseTo(0);
  });

  it('fades to the idle alpha after release and stays put', () => {
    const { fake, input } = setup({ joystickMode: 'floating' });
    fake.touchStart([{ id: 1, x: 90, y: 300 }]);
    fake.touchEnd([]);
    expect(input.getControlsView().joystick.alpha).toBeCloseTo(1);
    fake.advance(1000);
    const view = input.getControlsView();
    expect(view.joystick.alpha).toBeCloseTo(FLOATING_IDLE_ALPHA);
    expect(view.joystick.baseX).toBe(90);
    expect(input.getState().joystickMagnitude).toBe(0);
  });
});

describe('fixed joystick', () => {
  it('stays at the default position and measures from it', () => {
    const { fake, input } = setup({ joystickMode: 'fixed' });
    const home = input.getControlsView().layout.fixedJoystick;
    fake.touchStart([{ id: 1, x: home.x, y: home.y - 200 }]);
    const view = input.getControlsView();
    expect(view.joystick.baseX).toBe(home.x);
    expect(view.joystick.baseY).toBe(home.y);
    expect(input.getState().joystickY).toBeCloseTo(-1);
    fake.touchEnd([]);
    fake.advance(1000);
    expect(input.getControlsView().joystick.alpha).toBe(1);
  });

  it('switches mode live when settings change', () => {
    const { fake, store, input } = setup({ joystickMode: 'floating' });
    store.update({ joystickMode: 'fixed' });
    fake.touchStart([{ id: 1, x: 90, y: 300 }]);
    const home = input.getControlsView().layout.fixedJoystick;
    expect(input.getControlsView().joystick.baseX).toBe(home.x);
  });
});

describe('A/B buttons', () => {
  it('hit regions follow the height swap setting', () => {
    const { fake, store, input } = setup({ buttonLayout: 'aLow' });
    const { buttonA } = input.getControlsView().layout;
    fake.touchStart([{ id: 1, x: buttonA.x, y: buttonA.y }]);
    expect(input.getState().buttonA).toBe(true);
    fake.touchEnd([]);

    store.update({ buttonLayout: 'aHigh' });
    const swapped = input.getControlsView().layout;
    expect(swapped.buttonA.y).not.toBe(buttonA.y);
    fake.touchStart([{ id: 2, x: swapped.buttonB.x, y: swapped.buttonB.y }]);
    expect(input.getState().buttonB).toBe(true);
    expect(input.getState().buttonA).toBe(false);
  });
});

describe('controls disabled (menus)', () => {
  it('reports taps but does not drive joystick or buttons', () => {
    const { fake, input } = setup();
    input.setControlsEnabled(false);
    const { buttonA } = input.getControlsView().layout;
    fake.touchStart([
      { id: 1, x: 90, y: 300 },
      { id: 2, x: buttonA.x, y: buttonA.y },
    ]);
    input.update();
    const s = input.getState();
    expect(s.taps).toHaveLength(2);
    expect(s.buttonA).toBe(false);
    expect(input.getControlsView().joystick.active).toBe(false);
  });

  it('drops held controls when disabled', () => {
    const { fake, input } = setup();
    const { buttonA } = input.getControlsView().layout;
    fake.touchStart([{ id: 2, x: buttonA.x, y: buttonA.y }]);
    expect(input.getState().buttonA).toBe(true);
    input.setControlsEnabled(false);
    expect(input.getState().buttonA).toBe(false);
  });
});

describe('edge-triggered keys and taps', () => {
  it('fire for exactly one update step', () => {
    const { fake, input } = setup();
    fake.keyDown('Escape');
    fake.touchStart([{ id: 1, x: 300, y: 100 }]);
    input.update();
    expect(input.getState().pausePressed).toBe(true);
    expect(input.getState().menuBack).toBe(true);
    expect(input.getState().taps).toEqual([{ x: 300, y: 100 }]);
    input.update();
    expect(input.getState().pausePressed).toBe(false);
    expect(input.getState().taps).toHaveLength(0);
  });

  it('ignores key auto-repeat while held', () => {
    const { fake, input } = setup();
    fake.keyDown('ArrowDown');
    input.update();
    fake.keyDown('ArrowDown');
    input.update();
    expect(input.getState().menuDown).toBe(false);
    fake.keyUp('ArrowDown');
    fake.keyDown('ArrowDown');
    input.update();
    expect(input.getState().menuDown).toBe(true);
  });
});
