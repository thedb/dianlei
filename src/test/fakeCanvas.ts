/**
 * Canvas stand-ins for tests that run the real asset bake and draw paths.
 * Every 2D call is a no-op; image data is a real buffer so the bake loop
 * writes every pixel end to end.
 */

import type { Renderer } from '@/engine/renderer';

export function fakeContext(): CanvasRenderingContext2D {
  const image = (w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(Math.max(0, w * h * 4)),
  });
  const target: Record<string | symbol, unknown> = {
    canvas: { width: 360, height: 640 },
    createImageData: (w: number, h: number) => image(w, h),
    getImageData: (_x: number, _y: number, w: number, h: number) => image(w, h),
    measureText: (text: string) => ({ width: String(text).length * 6 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    createPattern: () => ({}),
  };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      if (typeof key === 'symbol') return undefined;
      return () => undefined;
    },
    set(obj, key, value) {
      obj[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number
  ) {}
  getContext(): CanvasRenderingContext2D {
    return fakeContext();
  }
}

export function fakeRenderer(ctx: CanvasRenderingContext2D = fakeContext()): Renderer {
  return new Proxy(
    {},
    {
      get(_t, key) {
        if (key === 'getContext') return () => ctx;
        if (key === 'getScaleInfo') return () => ({ scale: 1, offsetX: 0, offsetY: 0 });
        if (key === 'getCanvas') return () => ({ width: 360, height: 640 });
        return () => undefined;
      },
    }
  ) as Renderer;
}
