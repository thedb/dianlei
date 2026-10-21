import { describe, expect, it } from 'vitest';
import { DEBUG_HOT_SIZE, DEBUG_HOT_TAPS, DEBUG_HOT_WINDOW, LOGICAL_W } from '@/game/config';
import { createDebugHotZone, debugHotZoneRect } from './debugHotZone';

const inside = { x: LOGICAL_W - DEBUG_HOT_SIZE / 2, y: DEBUG_HOT_SIZE / 2 };
const outside = { x: 10, y: 10 };

describe('title debug hot zone', () => {
  it('covers a 48×48 square in the top-right corner', () => {
    expect(debugHotZoneRect()).toEqual({
      x: LOGICAL_W - DEBUG_HOT_SIZE,
      y: 0,
      w: DEBUG_HOT_SIZE,
      h: DEBUG_HOT_SIZE,
    });
  });

  it('opens on the 6th tap inside a 2 second window', () => {
    const zone = createDebugHotZone();
    let opened = false;
    for (let i = 0; i < DEBUG_HOT_TAPS; i++) {
      if (i > 0) zone.advance(0.3);
      opened = zone.tap(inside.x, inside.y);
    }
    expect(opened).toBe(true);
    expect(zone.count()).toBe(0);
  });

  it('keeps the window at exactly 2 seconds and drops it after that', () => {
    const zone = createDebugHotZone();
    zone.tap(inside.x, inside.y);
    zone.advance(DEBUG_HOT_WINDOW);
    expect(zone.count()).toBe(1);
    expect(zone.tap(inside.x, inside.y)).toBe(false);
    expect(zone.count()).toBe(2);

    zone.reset();
    zone.tap(inside.x, inside.y);
    zone.advance(DEBUG_HOT_WINDOW + 0.01);
    expect(zone.count()).toBe(0);
    expect(zone.tap(inside.x, inside.y)).toBe(false);
    expect(zone.count()).toBe(1);
  });

  it('does not count taps outside the zone and does not let them reset the window', () => {
    const zone = createDebugHotZone();
    expect(zone.tap(outside.x, outside.y)).toBe(false);
    expect(zone.count()).toBe(0);

    zone.tap(inside.x, inside.y);
    expect(zone.tap(LOGICAL_W - DEBUG_HOT_SIZE - 1, 0)).toBe(false);
    zone.advance(1.9);
    expect(zone.tap(outside.x, outside.y)).toBe(false);
    expect(zone.count()).toBe(1);
    expect(zone.tap(inside.x, inside.y)).toBe(false);
    expect(zone.count()).toBe(2);
  });

  it('treats the outer corner as inside and ignores a tap just past the edge', () => {
    const zone = createDebugHotZone();
    expect(zone.tap(LOGICAL_W, DEBUG_HOT_SIZE)).toBe(false);
    expect(zone.count()).toBe(1);
    zone.reset();
    expect(zone.tap(LOGICAL_W - DEBUG_HOT_SIZE - 1, 0)).toBe(false);
    expect(zone.tap(LOGICAL_W - 1, DEBUG_HOT_SIZE + 1)).toBe(false);
    expect(zone.count()).toBe(0);
  });

  it('resets a 5-tap run once the window expires, so the next tap is not the sixth', () => {
    const zone = createDebugHotZone();
    zone.tap(inside.x, inside.y);
    for (let i = 0; i < 4; i++) {
      zone.advance(0.4);
      expect(zone.tap(inside.x, inside.y)).toBe(false);
    }
    expect(zone.count()).toBe(5);
    zone.advance(0.5);
    expect(zone.count()).toBe(0);
    expect(zone.tap(inside.x, inside.y)).toBe(false);
    expect(zone.count()).toBe(1);
  });
});
