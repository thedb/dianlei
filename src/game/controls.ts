/**
 * On-screen control layout (design doc §4.1, §4.2), derived from settings.
 * Pure so input hit-testing and rendering always agree.
 */

import {
  LOGICAL_W,
  LOGICAL_H,
  JOYSTICK_RADIUS,
  BTN_A_SIZE,
  BTN_B_SIZE,
  CONTROL_BOTTOM_PAD,
  CONTROL_SIDE_PAD,
} from '@/game/config';
import type { Settings } from '@/game/settings';

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface ControlLayout {
  /** Functional and visual joystick radius (scaled) */
  joystickRadius: number;
  /** Joystick base position in fixed mode */
  fixedJoystick: { x: number; y: number };
  /** Touches starting below this y in the left half drive the joystick */
  joystickZoneTop: number;
  buttonA: Circle;
  buttonB: Circle;
  pauseButton: Circle;
}

/** Extra touch slack around buttons so near-misses still register */
export const BUTTON_TOUCH_SLACK = 14;

/** HUD occupies the top strip; joystick touches start below it */
const HUD_HEIGHT = 40;

/** Vertical offset between the high and the low A/B button centers */
const BUTTON_STAGGER = 36;

export function computeControlLayout(
  settings: Pick<Settings, 'buttonLayout' | 'controlScale'>,
  safeArea: { top: number; bottom: number }
): ControlLayout {
  const s = settings.controlScale;
  const bottom = LOGICAL_H - safeArea.bottom - CONTROL_BOTTOM_PAD;
  const joystickRadius = JOYSTICK_RADIUS * s;
  const aR = (BTN_A_SIZE / 2) * s;
  const bR = (BTN_B_SIZE / 2) * s;

  const aX = LOGICAL_W - CONTROL_SIDE_PAD - aR;
  const bX = aX - aR - bR - 8 * s;
  const lowY = (r: number): number => bottom - r;
  const highY = (r: number): number => bottom - r - BUTTON_STAGGER * s;
  const aLow = settings.buttonLayout === 'aLow';

  return {
    joystickRadius,
    fixedJoystick: {
      x: CONTROL_SIDE_PAD + joystickRadius + 8,
      y: bottom - joystickRadius - 8,
    },
    joystickZoneTop: safeArea.top + HUD_HEIGHT,
    buttonA: { x: aX, y: aLow ? lowY(aR) : highY(aR), r: aR },
    buttonB: { x: bX, y: aLow ? highY(bR) : lowY(bR), r: bR },
    pauseButton: { x: LOGICAL_W - 18, y: safeArea.top + 48, r: 12 },
  };
}

export function inCircle(x: number, y: number, c: Circle, slack = 0): boolean {
  const dx = x - c.x;
  const dy = y - c.y;
  const r = c.r + slack;
  return dx * dx + dy * dy < r * r;
}

export function inJoystickZone(x: number, y: number, layout: ControlLayout): boolean {
  return x < LOGICAL_W / 2 && y > layout.joystickZoneTop;
}
