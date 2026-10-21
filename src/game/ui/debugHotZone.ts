/**
 * Hidden title-screen hot zone.
 * Six taps inside the top-right square within DEBUG_HOT_WINDOW open the debug panel.
 * Taps outside the square do not count and do not reset the window.
 */

import { DEBUG_HOT_SIZE, DEBUG_HOT_TAPS, DEBUG_HOT_WINDOW, LOGICAL_W } from '@/game/config';
import { hitRect, type Rect } from './widgets';

export function debugHotZoneRect(): Rect {
  return {
    x: LOGICAL_W - DEBUG_HOT_SIZE,
    y: 0,
    w: DEBUG_HOT_SIZE,
    h: DEBUG_HOT_SIZE,
  };
}

export interface DebugHotZone {
  reset(): void;
  /** Move the clock forward. An open window older than DEBUG_HOT_WINDOW drops to 0. */
  advance(dt: number): void;
  /**
   * Count one tap. Outside taps return false and leave the counter alone.
   * The sixth tap inside the window returns true and clears the counter.
   */
  tap(x: number, y: number): boolean;
  count(): number;
}

export function createDebugHotZone(): DebugHotZone {
  let now = 0;
  let count = 0;
  /** Clock time of the first tap in the current window. Negative when idle. */
  let windowStart = -1;

  function expire(): void {
    if (windowStart >= 0 && now - windowStart > DEBUG_HOT_WINDOW) {
      count = 0;
      windowStart = -1;
    }
  }

  return {
    reset(): void {
      now = 0;
      count = 0;
      windowStart = -1;
    },

    advance(dt: number): void {
      now += dt;
      expire();
    },

    tap(x: number, y: number): boolean {
      if (!hitRect(debugHotZoneRect(), x, y)) return false;
      expire();
      if (windowStart < 0) {
        count = 0;
        windowStart = now;
      }
      count += 1;
      if (count >= DEBUG_HOT_TAPS) {
        count = 0;
        windowStart = -1;
        return true;
      }
      return false;
    },

    count: () => count,
  };
}
