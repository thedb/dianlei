import { describe, expect, it } from 'vitest';
import { computeControlLayout, inJoystickZone } from './controls';
import { BTN_A_SIZE, BTN_B_SIZE, JOYSTICK_RADIUS, LOGICAL_W } from './config';

const safe = { top: 0, bottom: 0 };

describe('computeControlLayout', () => {
  it('defaults to A low / B high', () => {
    const l = computeControlLayout({ buttonLayout: 'aLow', controlScale: 1 }, safe);
    expect(l.buttonA.y).toBeGreaterThan(l.buttonB.y);
  });

  it('swaps heights for A high / B low', () => {
    const l = computeControlLayout({ buttonLayout: 'aHigh', controlScale: 1 }, safe);
    expect(l.buttonA.y).toBeLessThan(l.buttonB.y);
  });

  it('scales buttons and joystick with control size', () => {
    const l = computeControlLayout({ buttonLayout: 'aLow', controlScale: 1.3 }, safe);
    expect(l.buttonA.r).toBeCloseTo((BTN_A_SIZE / 2) * 1.3);
    expect(l.buttonB.r).toBeCloseTo((BTN_B_SIZE / 2) * 1.3);
    expect(l.joystickRadius).toBeCloseTo(JOYSTICK_RADIUS * 1.3);
  });

  it('keeps buttons on the right half at every size', () => {
    for (const s of [0.8, 1, 1.3]) {
      const l = computeControlLayout({ buttonLayout: 'aLow', controlScale: s }, safe);
      expect(l.buttonB.x).toBeGreaterThan(LOGICAL_W / 2);
      expect(l.buttonA.x + l.buttonA.r).toBeLessThanOrEqual(LOGICAL_W);
    }
  });

  it('respects the bottom safe area', () => {
    const a = computeControlLayout({ buttonLayout: 'aLow', controlScale: 1 }, safe);
    const b = computeControlLayout(
      { buttonLayout: 'aLow', controlScale: 1 },
      { top: 0, bottom: 30 }
    );
    expect(a.buttonA.y - b.buttonA.y).toBe(30);
  });

  it('joystick zone is the left half below the HUD', () => {
    const l = computeControlLayout({ buttonLayout: 'aLow', controlScale: 1 }, safe);
    expect(inJoystickZone(60, 300, l)).toBe(true);
    expect(inJoystickZone(260, 300, l)).toBe(false);
    expect(inJoystickZone(60, 10, l)).toBe(false);
  });
});
