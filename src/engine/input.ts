/**
 * Multi-touch input handler with virtual joystick and button regions.
 * Control layout and joystick mode follow the player's settings live.
 */

import type { PlatformAdapter, TouchPoint } from '@/platform/types';
import { JOYSTICK_DEADZONE } from '@/game/config';
import type { Settings, SettingsStore } from '@/game/settings';
import {
  computeControlLayout,
  inCircle,
  inJoystickZone,
  BUTTON_TOUCH_SLACK,
  type ControlLayout,
} from '@/game/controls';

export interface Pointer {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export interface InputState {
  // Joystick state (-1 to 1)
  joystickX: number;
  joystickY: number;
  joystickMagnitude: number;

  // Button states
  buttonA: boolean;
  buttonB: boolean;

  // Keyboard state (for H5 testing)
  keyUp: boolean;
  keyDown: boolean;
  keyLeft: boolean;
  keyRight: boolean;
  keyFire: boolean;
  keyBomb: boolean;

  // Edge-triggered this update step
  pausePressed: boolean;
  menuUp: boolean;
  menuDown: boolean;
  menuLeft: boolean;
  menuRight: boolean;
  menuConfirm: boolean;
  menuBack: boolean;
  /** Edge-triggered H5 debug skips (F2 warning, F3 boss). Ignored unless debug is on. */
  debugWarning: boolean;
  debugBoss: boolean;
  /** Touch/click starts this step, in logical pixels */
  taps: ReadonlyArray<{ x: number; y: number }>;
  /** All active pointers, in logical pixels */
  pointers: ReadonlyArray<Pointer>;
}

export interface JoystickView {
  /** Finger is currently driving the joystick */
  active: boolean;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  /** Multiplier on control opacity (floating stick fades when released) */
  alpha: number;
}

export interface ControlsView {
  layout: ControlLayout;
  settings: Readonly<Settings>;
  joystick: JoystickView;
  buttonAPressed: boolean;
  buttonBPressed: boolean;
}

export interface InputHandler {
  getState(): InputState;
  update(): void;
  setScaleFactor(scale: number, offsetX: number, offsetY: number): void;
  /** When disabled (menus), touches are only reported as taps/pointers */
  setControlsEnabled(enabled: boolean): void;
  getControlsView(): ControlsView;
  getDebugInfo(): InputDebugInfo;
}

export interface InputDebugInfo {
  activeTouches: number;
  joystickActive: boolean;
  joystickTouchId: number | null;
  buttonATouchId: number | null;
  buttonBTouchId: number | null;
}

/** Floating joystick idles at this fraction of control opacity once released */
export const FLOATING_IDLE_ALPHA = 0.3;
const FLOATING_FADE_MS = 250;

const PAUSE_KEYS = ['escape', 'p'];
const CONFIRM_KEYS = ['enter', 'z', ' '];
const BACK_KEYS = ['escape', 'backspace'];

export function createInputHandler(
  platform: PlatformAdapter,
  settingsStore: SettingsStore,
  safeArea: { top: number; bottom: number } = { top: 0, bottom: 0 }
): InputHandler {
  const activeTouches = new Map<number, Pointer>();
  let scaleFactor = 1;
  let offsetX = 0;
  let offsetY = 0;
  let controlsEnabled = true;

  let joystickTouchId: number | null = null;
  let buttonATouchId: number | null = null;
  let buttonBTouchId: number | null = null;

  let layout = computeControlLayout(settingsStore.get(), safeArea);
  let floatingBase = { ...layout.fixedJoystick };
  let floatingReleasedAt = -Infinity;
  settingsStore.subscribe((s) => {
    layout = computeControlLayout(s, safeArea);
    if (s.joystickMode === 'fixed' || joystickTouchId === null) {
      floatingBase = { ...layout.fixedJoystick };
    }
  });

  const keys = new Set<string>();
  let queuedKeys: string[] = [];
  let queuedTaps: { x: number; y: number }[] = [];
  let frameKeys = new Set<string>();
  let frameTaps: { x: number; y: number }[] = [];

  function screenToLogical(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - offsetX) / scaleFactor,
      y: (y - offsetY) / scaleFactor,
    };
  }

  function joystickOrigin(): { x: number; y: number } {
    return settingsStore.get().joystickMode === 'fixed' ? layout.fixedJoystick : floatingBase;
  }

  function assignControl(id: number, x: number, y: number): void {
    if (!controlsEnabled) return;
    if (buttonATouchId === null && inCircle(x, y, layout.buttonA, BUTTON_TOUCH_SLACK)) {
      buttonATouchId = id;
    } else if (buttonBTouchId === null && inCircle(x, y, layout.buttonB, BUTTON_TOUCH_SLACK)) {
      buttonBTouchId = id;
    } else if (joystickTouchId === null && inJoystickZone(x, y, layout)) {
      joystickTouchId = id;
      if (settingsStore.get().joystickMode === 'floating') {
        floatingBase = { x, y };
      }
    }
  }

  function handleTouchStart(touches: TouchPoint[]): void {
    for (const touch of touches) {
      if (activeTouches.has(touch.id)) continue;
      const { x, y } = screenToLogical(touch.x, touch.y);
      activeTouches.set(touch.id, { id: touch.id, startX: x, startY: y, x, y });
      queuedTaps.push({ x, y });
      assignControl(touch.id, x, y);
    }
  }

  function handleTouchMove(touches: TouchPoint[]): void {
    for (const touch of touches) {
      const info = activeTouches.get(touch.id);
      if (info) {
        const { x, y } = screenToLogical(touch.x, touch.y);
        info.x = x;
        info.y = y;
      }
    }
  }

  function releaseJoystick(): void {
    joystickTouchId = null;
    floatingReleasedAt = platform.now();
  }

  function handleTouchEnd(touches: TouchPoint[]): void {
    const currentIds = new Set(touches.map((t) => t.id));
    for (const [id] of activeTouches) {
      if (currentIds.has(id)) continue;
      activeTouches.delete(id);
      if (joystickTouchId === id) releaseJoystick();
      if (buttonATouchId === id) buttonATouchId = null;
      if (buttonBTouchId === id) buttonBTouchId = null;
    }
  }

  function handleKeyDown(key: string): void {
    const k = key.toLowerCase();
    if (!keys.has(k)) queuedKeys.push(k);
    keys.add(k);
  }

  function handleKeyUp(key: string): void {
    keys.delete(key.toLowerCase());
  }

  platform.onTouchStart(handleTouchStart);
  platform.onTouchMove(handleTouchMove);
  platform.onTouchEnd(handleTouchEnd);
  platform.onTouchCancel(handleTouchEnd);
  platform.onKeyDown(handleKeyDown);
  platform.onKeyUp(handleKeyUp);

  const pressed = (list: string[]): boolean => list.some((k) => frameKeys.has(k));

  return {
    getState(): InputState {
      let joystickX = 0;
      let joystickY = 0;
      let joystickMagnitude = 0;

      if (joystickTouchId !== null) {
        const info = activeTouches.get(joystickTouchId);
        if (info) {
          const origin = joystickOrigin();
          const dx = info.x - origin.x;
          const dy = info.y - origin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radius = layout.joystickRadius;

          if (dist > JOYSTICK_DEADZONE * radius) {
            const clampedDist = Math.min(dist, radius);
            joystickMagnitude =
              (clampedDist - JOYSTICK_DEADZONE * radius) / (radius * (1 - JOYSTICK_DEADZONE));
            joystickX = (dx / dist) * joystickMagnitude;
            joystickY = (dy / dist) * joystickMagnitude;
          }
        }
      }

      const keyUp = keys.has('arrowup') || keys.has('w');
      const keyDown = keys.has('arrowdown') || keys.has('s');
      const keyLeft = keys.has('arrowleft') || keys.has('a');
      const keyRight = keys.has('arrowright') || keys.has('d');
      const keyFire = keys.has('z') || keys.has(' ');
      const keyBomb = keys.has('x');

      if (keyLeft) joystickX = -1;
      if (keyRight) joystickX = 1;
      if (keyUp) joystickY = -1;
      if (keyDown) joystickY = 1;

      if (keyUp || keyDown || keyLeft || keyRight) {
        joystickMagnitude = Math.sqrt(joystickX * joystickX + joystickY * joystickY);
        if (joystickMagnitude > 1) {
          joystickX /= joystickMagnitude;
          joystickY /= joystickMagnitude;
          joystickMagnitude = 1;
        }
      }

      return {
        joystickX,
        joystickY,
        joystickMagnitude,
        buttonA: buttonATouchId !== null || keyFire,
        buttonB: buttonBTouchId !== null || keyBomb,
        keyUp,
        keyDown,
        keyLeft,
        keyRight,
        keyFire,
        keyBomb,
        pausePressed: pressed(PAUSE_KEYS),
        menuUp: pressed(['arrowup', 'w']),
        menuDown: pressed(['arrowdown', 's']),
        menuLeft: pressed(['arrowleft', 'a']),
        menuRight: pressed(['arrowright', 'd']),
        menuConfirm: pressed(CONFIRM_KEYS),
        menuBack: pressed(BACK_KEYS),
        debugWarning: pressed(['f2']),
        debugBoss: pressed(['f3']),
        taps: frameTaps,
        pointers: [...activeTouches.values()],
      };
    },

    /** Called once per fixed update step: latches key/tap edges for this step */
    update(): void {
      frameKeys = new Set(queuedKeys);
      frameTaps = queuedTaps;
      queuedKeys = [];
      queuedTaps = [];
    },

    setScaleFactor(scale: number, ox: number, oy: number): void {
      scaleFactor = scale;
      offsetX = ox;
      offsetY = oy;
    },

    setControlsEnabled(enabled: boolean): void {
      if (controlsEnabled === enabled) return;
      controlsEnabled = enabled;
      if (!enabled) {
        if (joystickTouchId !== null) releaseJoystick();
        buttonATouchId = null;
        buttonBTouchId = null;
      }
    },

    getControlsView(): ControlsView {
      const settings = settingsStore.get();
      const origin = joystickOrigin();
      let knobX = origin.x;
      let knobY = origin.y;
      const info = joystickTouchId !== null ? activeTouches.get(joystickTouchId) : undefined;
      if (info) {
        const dx = info.x - origin.x;
        const dy = info.y - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const k = dist > layout.joystickRadius ? layout.joystickRadius / dist : 1;
        knobX = origin.x + dx * k;
        knobY = origin.y + dy * k;
      }

      let alpha = 1;
      if (settings.joystickMode === 'floating' && !info) {
        const t = Math.min(1, (platform.now() - floatingReleasedAt) / FLOATING_FADE_MS);
        alpha = 1 - (1 - FLOATING_IDLE_ALPHA) * t;
      }

      return {
        layout,
        settings,
        joystick: { active: !!info, baseX: origin.x, baseY: origin.y, knobX, knobY, alpha },
        buttonAPressed: buttonATouchId !== null,
        buttonBPressed: buttonBTouchId !== null,
      };
    },

    getDebugInfo(): InputDebugInfo {
      return {
        activeTouches: activeTouches.size,
        joystickActive: joystickTouchId !== null,
        joystickTouchId,
        buttonATouchId,
        buttonBTouchId,
      };
    },
  };
}
