/**
 * Multi-touch input handler with virtual joystick and button regions
 */

import type { PlatformAdapter, TouchPoint } from '@/platform/types';
import {
  LOGICAL_W,
  LOGICAL_H,
  JOYSTICK_RADIUS,
  JOYSTICK_DEADZONE,
  BTN_A_SIZE,
  BTN_B_SIZE,
  CONTROL_BOTTOM_PAD,
  CONTROL_SIDE_PAD,
} from '@/game/config';

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
}

export interface InputHandler {
  getState(): InputState;
  update(): void;
  setScaleFactor(scale: number, offsetX: number, offsetY: number): void;
  getDebugInfo(): InputDebugInfo;
}

export interface InputDebugInfo {
  activeTouches: number;
  joystickActive: boolean;
  joystickTouchId: number | null;
  buttonATouchId: number | null;
  buttonBTouchId: number | null;
}

interface TouchInfo {
  id: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function createInputHandler(platform: PlatformAdapter, safeBottom = 0): InputHandler {
  const activeTouches = new Map<number, TouchInfo>();
  let scaleFactor = 1;
  let offsetX = 0;
  let offsetY = 0;

  let joystickTouchId: number | null = null;
  let buttonATouchId: number | null = null;
  let buttonBTouchId: number | null = null;

  // Keyboard state
  const keys = new Set<string>();

  // Control regions (in logical pixels)
  const bottomPad = safeBottom + CONTROL_BOTTOM_PAD;

  // Buttons are in the right region (A low, B high by default)
  const btnACenterX = LOGICAL_W - CONTROL_SIDE_PAD - BTN_A_SIZE / 2;
  const btnACenterY = LOGICAL_H - bottomPad - BTN_A_SIZE / 2;
  const btnBCenterX = LOGICAL_W - CONTROL_SIDE_PAD - BTN_B_SIZE / 2 - BTN_A_SIZE - 8;
  const btnBCenterY = LOGICAL_H - bottomPad - BTN_B_SIZE / 2 - 20;

  function screenToLogical(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - offsetX) / scaleFactor,
      y: (y - offsetY) / scaleFactor,
    };
  }

  function isInJoystickRegion(x: number, y: number): boolean {
    return x < LOGICAL_W / 2 && y > LOGICAL_H / 2;
  }

  function isInButtonARegion(x: number, y: number): boolean {
    const dx = x - btnACenterX;
    const dy = y - btnACenterY;
    return Math.sqrt(dx * dx + dy * dy) < BTN_A_SIZE / 2 + 20;
  }

  function isInButtonBRegion(x: number, y: number): boolean {
    const dx = x - btnBCenterX;
    const dy = y - btnBCenterY;
    return Math.sqrt(dx * dx + dy * dy) < BTN_B_SIZE / 2 + 20;
  }

  function handleTouchStart(touches: TouchPoint[]): void {
    for (const touch of touches) {
      const { x, y } = screenToLogical(touch.x, touch.y);

      if (!activeTouches.has(touch.id)) {
        activeTouches.set(touch.id, {
          id: touch.id,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        });

        // Assign touch to control region
        if (joystickTouchId === null && isInJoystickRegion(x, y)) {
          joystickTouchId = touch.id;
        } else if (buttonATouchId === null && isInButtonARegion(x, y)) {
          buttonATouchId = touch.id;
        } else if (buttonBTouchId === null && isInButtonBRegion(x, y)) {
          buttonBTouchId = touch.id;
        }
      }
    }
  }

  function handleTouchMove(touches: TouchPoint[]): void {
    for (const touch of touches) {
      const info = activeTouches.get(touch.id);
      if (info) {
        const { x, y } = screenToLogical(touch.x, touch.y);
        info.currentX = x;
        info.currentY = y;
      }
    }
  }

  function handleTouchEnd(touches: TouchPoint[]): void {
    const currentIds = new Set(touches.map((t) => t.id));

    for (const [id] of activeTouches) {
      if (!currentIds.has(id)) {
        activeTouches.delete(id);

        if (joystickTouchId === id) {
          joystickTouchId = null;
        }
        if (buttonATouchId === id) {
          buttonATouchId = null;
        }
        if (buttonBTouchId === id) {
          buttonBTouchId = null;
        }
      }
    }
  }

  function handleKeyDown(key: string): void {
    keys.add(key.toLowerCase());
  }

  function handleKeyUp(key: string): void {
    keys.delete(key.toLowerCase());
  }

  // Register event handlers
  platform.onTouchStart(handleTouchStart);
  platform.onTouchMove(handleTouchMove);
  platform.onTouchEnd(handleTouchEnd);
  platform.onTouchCancel(handleTouchEnd);
  platform.onKeyDown(handleKeyDown);
  platform.onKeyUp(handleKeyUp);

  return {
    getState(): InputState {
      let joystickX = 0;
      let joystickY = 0;
      let joystickMagnitude = 0;

      // Process joystick touch
      if (joystickTouchId !== null) {
        const info = activeTouches.get(joystickTouchId);
        if (info) {
          const dx = info.currentX - info.startX;
          const dy = info.currentY - info.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > JOYSTICK_DEADZONE * JOYSTICK_RADIUS) {
            const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
            joystickMagnitude =
              (clampedDist - JOYSTICK_DEADZONE * JOYSTICK_RADIUS) /
              (JOYSTICK_RADIUS * (1 - JOYSTICK_DEADZONE));
            joystickX = (dx / dist) * joystickMagnitude;
            joystickY = (dy / dist) * joystickMagnitude;
          }
        }
      }

      // Process keyboard input
      const keyUp = keys.has('arrowup') || keys.has('w');
      const keyDown = keys.has('arrowdown') || keys.has('s');
      const keyLeft = keys.has('arrowleft') || keys.has('a');
      const keyRight = keys.has('arrowright') || keys.has('d');
      const keyFire = keys.has('z') || keys.has(' ');
      const keyBomb = keys.has('x');

      // Combine keyboard with joystick
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
      };
    },

    update(): void {
      // Currently no per-frame input processing needed
    },

    setScaleFactor(scale: number, ox: number, oy: number): void {
      scaleFactor = scale;
      offsetX = ox;
      offsetY = oy;
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
