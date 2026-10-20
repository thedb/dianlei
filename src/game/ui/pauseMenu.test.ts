import { describe, expect, it } from 'vitest';
import { createPauseMenu } from './pauseMenu';
import { createSettingsStore, createMemoryStorage } from '@/game/settings';
import { makeInput } from '@/test/fakes';

function menu() {
  const store = createSettingsStore(createMemoryStorage());
  return { pause: createPauseMenu(store), store };
}

describe('pause menu', () => {
  it('opens on the main menu and resumes with Continue', () => {
    const { pause } = menu();
    pause.open();
    expect(pause.getView()).toBe('menu');
    expect(pause.update(makeInput({ menuConfirm: true }))).toBe('resume');
    expect(pause.isOpen()).toBe(false);
  });

  it('Esc / pause key on the main menu resumes', () => {
    const { pause } = menu();
    pause.open();
    expect(pause.update(makeInput({ pausePressed: true, menuBack: true }))).toBe('resume');
  });

  it('exit needs confirmation, cancel returns to the menu', () => {
    const { pause } = menu();
    pause.open();
    pause.update(makeInput({ menuUp: true })); // wrap to 退出
    expect(pause.update(makeInput({ menuConfirm: true }))).toBeNull();
    expect(pause.getView()).toBe('confirmExit');

    // Default focus is 取消
    expect(pause.update(makeInput({ menuConfirm: true }))).toBeNull();
    expect(pause.getView()).toBe('menu');

    pause.update(makeInput({ menuConfirm: true }));
    expect(pause.getView()).toBe('confirmExit');
    pause.update(makeInput({ menuLeft: true }));
    expect(pause.update(makeInput({ menuConfirm: true }))).toBe('exit');
  });

  it('opens settings, applies changes immediately, and goes back', () => {
    const { pause, store } = menu();
    pause.open();
    pause.update(makeInput({ menuDown: true }));
    pause.update(makeInput({ menuConfirm: true }));
    expect(pause.getView()).toBe('settings');

    // First row is joystick mode
    const before = store.get().joystickMode;
    pause.update(makeInput({ menuRight: true }));
    expect(store.get().joystickMode).not.toBe(before);

    pause.update(makeInput({ menuBack: true }));
    expect(pause.getView()).toBe('menu');
  });

  it('adjusts sliders with left/right in steps and clamps', () => {
    const { pause, store } = menu();
    pause.open();
    pause.update(makeInput({ menuDown: true }));
    pause.update(makeInput({ menuConfirm: true }));
    pause.update(makeInput({ menuDown: true }));
    pause.update(makeInput({ menuDown: true })); // opacity row
    pause.update(makeInput({ menuRight: true }));
    expect(store.get().controlOpacity).toBeCloseTo(0.7);
    for (let i = 0; i < 10; i++) pause.update(makeInput({ menuRight: true }));
    expect(store.get().controlOpacity).toBe(1);
  });
});
