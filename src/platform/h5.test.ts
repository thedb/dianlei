import { afterEach, describe, expect, it, vi } from 'vitest';
import { createH5Platform } from './h5';

describe('H5 touch scale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('updates the scale on the same canvas without stacking listeners', () => {
    const windowListeners = new Map<string, number>();
    vi.stubGlobal('window', {
      addEventListener(type: string) {
        windowListeners.set(type, (windowListeners.get(type) ?? 0) + 1);
      },
    });

    const canvasListeners = new Map<string, Array<(event: unknown) => void>>();
    const rect = { left: 8, top: 16, width: 720, height: 1280 };
    const canvas = {
      addEventListener(type: string, fn: (event: unknown) => void) {
        const list = canvasListeners.get(type) ?? [];
        list.push(fn);
        canvasListeners.set(type, list);
      },
      getBoundingClientRect: () => rect,
    };

    const platform = createH5Platform({} as HTMLElement);
    const points: { id: number; x: number; y: number }[] = [];
    platform.onTouchStart((touches) => {
      points.push(...touches);
    });

    platform.setCanvas(canvas as unknown as HTMLCanvasElement, 2);
    platform.setCanvas(canvas as unknown as HTMLCanvasElement, 4);

    expect(canvasListeners.get('touchstart')?.length).toBe(1);
    expect(windowListeners.get('mousemove')).toBe(1);

    const start = canvasListeners.get('touchstart')?.[0];
    start?.({
      preventDefault() {},
      touches: [{ identifier: 3, clientX: 8 + 100, clientY: 16 + 40 }],
    });
    expect(points).toEqual([{ id: 3, x: 25, y: 10 }]);

    const down = canvasListeners.get('mousedown')?.[0];
    const mice: { id: number; x: number; y: number }[][] = [];
    platform.onTouchStart((touches) => {
      mice.push(touches);
    });
    down?.({
      clientX: 8 + 80,
      clientY: 16 + 40,
    });
    expect(mice[0]).toEqual([{ id: -1, x: 20, y: 10 }]);
  });
});
