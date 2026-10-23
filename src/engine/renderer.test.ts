import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTERIOR_VOID } from './exterior';
import { calculateScaling, createRenderer, type ViewportSize } from './renderer';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';

describe('calculateScaling', () => {
  it('should calculate correct scale for exact fit', () => {
    // Screen is exactly 2x logical resolution
    const result = calculateScaling(720, 1280, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(2);
    expect(result.canvasWidth).toBe(720);
    expect(result.canvasHeight).toBe(1280);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('should use integer scaling when close to integer', () => {
    // Screen is slightly larger than 2x - should snap to 2
    const result = calculateScaling(750, 1320, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(2);
    expect(result.canvasWidth).toBe(720);
    expect(result.canvasHeight).toBe(1280);
    // Should have letterboxing
    expect(result.offsetX).toBe(Math.floor((750 - 720) / 2));
    expect(result.offsetY).toBe(Math.floor((1320 - 1280) / 2));
  });

  it('should letterbox horizontally for wide screens', () => {
    // Wide screen: 1920x1080 (16:9)
    const result = calculateScaling(1920, 1080, LOGICAL_W, LOGICAL_H);

    // Height is limiting factor: 1080 / 640 = 1.6875
    // Should snap to 1 since 1.6875 - 1 = 0.6875 > 0.2
    // Actually 1.6875 is not close to 1 or 2, so it won't snap
    expect(result.scale).toBeLessThanOrEqual(1080 / LOGICAL_H);

    // Canvas should fit within screen
    expect(result.canvasWidth).toBeLessThanOrEqual(1920);
    expect(result.canvasHeight).toBeLessThanOrEqual(1080);

    // Should have horizontal letterboxing (black bars on sides)
    expect(result.offsetX).toBeGreaterThan(0);
  });

  it('should letterbox vertically for tall screens', () => {
    // Very tall screen
    const result = calculateScaling(400, 2000, LOGICAL_W, LOGICAL_H);

    // Width is limiting factor: 400 / 360 = 1.11
    // Should snap to 1
    expect(result.scale).toBe(1);
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);

    // Should have vertical letterboxing
    expect(result.offsetY).toBeGreaterThan(0);
  });

  it('should handle DPR 1 correctly', () => {
    const result = calculateScaling(360, 640, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(1);
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('should handle DPR 2 screen (e.g., iPhone)', () => {
    // iPhone-like: 375x667 CSS pixels at 2x DPR
    // Note: calculateScaling works with CSS pixels, DPR is handled separately
    const result = calculateScaling(375, 667, LOGICAL_W, LOGICAL_H);

    // Should fit with scale ~1.04
    expect(result.scale).toBe(1); // Snaps to integer
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);
  });

  it('should handle DPR 3 screen (e.g., iPhone Plus)', () => {
    // iPhone Plus-like: 414x736 CSS pixels at 3x DPR
    const result = calculateScaling(414, 736, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(1); // 414/360 = 1.15, snaps to 1
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);
  });

  it('should maintain aspect ratio', () => {
    // Use a screen size that doesn't trigger integer scaling snap
    const result = calculateScaling(800, 1200, LOGICAL_W, LOGICAL_H);

    const canvasAspect = result.canvasWidth / result.canvasHeight;
    const logicalAspect = LOGICAL_W / LOGICAL_H;

    // Aspect ratio is preserved (allowing for integer rounding of dimensions)
    expect(canvasAspect).toBeCloseTo(logicalAspect, 2);
  });

  it('should center canvas with correct offsets', () => {
    const screenW = 1000;
    const screenH = 800;
    const result = calculateScaling(screenW, screenH, LOGICAL_W, LOGICAL_H);

    // Canvas should be centered
    const expectedOffsetX = Math.floor((screenW - result.canvasWidth) / 2);
    const expectedOffsetY = Math.floor((screenH - result.canvasHeight) / 2);

    expect(result.offsetX).toBe(expectedOffsetX);
    expect(result.offsetY).toBe(expectedOffsetY);

    // Verify canvas + offsets equals screen
    expect(result.canvasWidth + result.offsetX * 2).toBeLessThanOrEqual(screenW + 1);
    expect(result.canvasHeight + result.offsetY * 2).toBeLessThanOrEqual(screenH + 1);
  });

  it('keeps a phone frame on a classic iPad landscape size', () => {
    // 768/640 = 1.2, which is inside the 0.2 snap window (and floats just under it).
    const result = calculateScaling(1024, 768, LOGICAL_W, LOGICAL_H);
    expect(result.scale).toBe(1);
    expect(result.canvasWidth).toBe(LOGICAL_W);
    expect(result.canvasHeight).toBe(LOGICAL_H);
    expect(result.offsetX).toBe(332);
    expect(result.offsetY).toBe(64);
  });

  it('letterboxes a wider iPad landscape size without snapping', () => {
    const result = calculateScaling(1194, 834, LOGICAL_W, LOGICAL_H);
    expect(result.scale).toBeGreaterThan(1.2);
    expect(result.scale).toBeLessThan(1.4);
    expect(result.canvasHeight).toBe(834);
    expect(result.canvasWidth).toBeLessThan(1194);
    expect(result.offsetX).toBeGreaterThan(300);
    expect(result.offsetY).toBe(0);
  });

  it('shrinks below 1x when the window is smaller than the playfield', () => {
    const result = calculateScaling(200, 400, LOGICAL_W, LOGICAL_H);
    expect(result.scale).toBeLessThan(1);
    expect(result.canvasWidth).toBeLessThanOrEqual(200);
    expect(result.canvasHeight).toBeLessThanOrEqual(400);
  });
});

interface MockCtx {
  imageSmoothingEnabled: boolean;
  transform: number[];
  fillStyle: unknown;
  fills: number;
  gradients: number;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(): { addColorStop(): void };
}

function makeCanvas() {
  let width = 0;
  let height = 0;
  let widthWrites = 0;
  let heightWrites = 0;
  const ctx: MockCtx = {
    imageSmoothingEnabled: true,
    transform: [1, 0, 0, 1, 0, 0],
    fillStyle: '',
    fills: 0,
    gradients: 0,
    setTransform(a, b, c, d, e, f) {
      this.transform = [a, b, c, d, e, f];
    },
    fillRect() {
      this.fills += 1;
    },
    createLinearGradient() {
      this.gradients += 1;
      return { addColorStop() {} };
    },
  };
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  return {
    style,
    attrs,
    ctx,
    get width() {
      return width;
    },
    set width(v: number) {
      widthWrites += 1;
      width = Math.floor(v);
      ctx.imageSmoothingEnabled = true;
      ctx.transform = [1, 0, 0, 1, 0, 0];
    },
    get height() {
      return height;
    },
    set height(v: number) {
      heightWrites += 1;
      height = Math.floor(v);
      ctx.imageSmoothingEnabled = true;
      ctx.transform = [1, 0, 0, 1, 0, 0];
    },
    getContext(type: string) {
      return type === '2d' ? ctx : null;
    },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
    widthWrites: () => widthWrites,
    heightWrites: () => heightWrites,
  };
}

describe('createRenderer resize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(initial: ViewportSize, getViewport?: () => ViewportSize) {
    const canvases: ReturnType<typeof makeCanvas>[] = [];
    vi.stubGlobal('document', {
      createElement(tag: string) {
        if (tag !== 'canvas') throw new Error(tag);
        const canvas = makeCanvas();
        canvases.push(canvas);
        return canvas;
      },
    });
    const children: unknown[] = [];
    const container = {
      style: {} as { backgroundColor?: string },
      appendChild(el: unknown) {
        children.push(el);
      },
    };
    const renderer = createRenderer({
      screenWidth: initial.width,
      screenHeight: initial.height,
      dpr: initial.dpr,
      container: container as unknown as HTMLElement,
      ...(getViewport ? { getViewport } : {}),
    });
    const backdrop = canvases[0];
    const game = canvases[1];
    if (!backdrop || !game) throw new Error('expected backdrop and playfield canvases');
    return { renderer, backdrop, game, children, container };
  }

  it('letterboxes on resize and keeps nearest-neighbor', () => {
    let view: ViewportSize = { width: 360, height: 640, dpr: 1 };
    const { renderer, backdrop, game, children, container } = setup(view, () => view);

    expect(children).toEqual([backdrop, game]);
    expect(renderer.getCanvas()).toBe(game);
    expect(container.style.backgroundColor).toBe(EXTERIOR_VOID);
    expect(backdrop.style.pointerEvents).toBe('none');
    expect(backdrop.attrs['aria-hidden']).toBe('true');
    expect(backdrop.style.zIndex).toBe('0');
    expect(game.style.zIndex).toBe('1');
    expect(game.style.pointerEvents).toBeUndefined();
    expect(game.style.imageRendering).toBe('pixelated');
    expect(game.ctx.imageSmoothingEnabled).toBe(false);
    expect(backdrop.ctx.imageSmoothingEnabled).toBe(false);
    expect(backdrop.ctx.fills).toBeGreaterThan(1);
    expect(backdrop.ctx.gradients).toBe(2);
    expect(renderer.getScaleInfo()).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });

    const gameWrites = game.widthWrites();
    const plateWrites = backdrop.widthWrites();
    renderer.resize();
    expect(game.widthWrites()).toBe(gameWrites);
    expect(backdrop.widthWrites()).toBe(plateWrites);
    expect(game.ctx.imageSmoothingEnabled).toBe(false);

    view = { width: 1024, height: 768, dpr: 2 };
    renderer.resize();
    const ipad = calculateScaling(1024, 768);
    expect(renderer.getScaleInfo()).toEqual({
      scale: ipad.scale,
      offsetX: ipad.offsetX,
      offsetY: ipad.offsetY,
    });
    expect(game.style.width).toBe(`${ipad.canvasWidth}px`);
    expect(game.style.height).toBe(`${ipad.canvasHeight}px`);
    expect(game.style.left).toBe(`${ipad.offsetX}px`);
    expect(game.style.top).toBe(`${ipad.offsetY}px`);
    expect(game.width).toBe(Math.floor(ipad.canvasWidth * 2));
    expect(game.height).toBe(Math.floor(ipad.canvasHeight * 2));
    expect(game.ctx.transform).toEqual([ipad.scale * 2, 0, 0, ipad.scale * 2, 0, 0]);
    expect(game.ctx.imageSmoothingEnabled).toBe(false);
    expect(backdrop.style.width).toBe('1024px');
    expect(backdrop.style.height).toBe('768px');
    expect(backdrop.width).toBe(2048);
    expect(backdrop.height).toBe(1536);
    expect(backdrop.ctx.transform).toEqual([2, 0, 0, 2, 0, 0]);
    expect(backdrop.ctx.imageSmoothingEnabled).toBe(false);
    expect(backdrop.style.pointerEvents).toBe('none');
    expect(backdrop.ctx.gradients).toBe(4);

    view = { width: 1194, height: 834, dpr: 2 };
    renderer.resize();
    const wide = calculateScaling(1194, 834);
    expect(renderer.getScaleInfo().scale).toBe(wide.scale);
    expect(game.style.left).toBe(`${wide.offsetX}px`);
    expect(game.width).toBe(Math.floor(wide.canvasWidth * 2));
    expect(game.ctx.imageSmoothingEnabled).toBe(false);
    expect(backdrop.style.width).toBe('1194px');
    expect(backdrop.width).toBe(Math.floor(1194 * 2));

    const writes = game.widthWrites();
    view = { width: 0, height: 0, dpr: 2 };
    renderer.resize();
    expect(game.widthWrites()).toBe(writes);
    expect(renderer.getScaleInfo().scale).toBe(wide.scale);
  });

  it('reads the window when getViewport is omitted', () => {
    const { renderer, game } = setup({ width: 360, height: 640, dpr: 1 });
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 1400, devicePixelRatio: 2 });
    renderer.resize();
    const next = calculateScaling(800, 1400);
    expect(renderer.getScaleInfo()).toEqual({
      scale: next.scale,
      offsetX: next.offsetX,
      offsetY: next.offsetY,
    });
    expect(game.width).toBe(Math.floor(next.canvasWidth * 2));
    expect(game.ctx.imageSmoothingEnabled).toBe(false);
    expect(game.ctx.transform[0]).toBe(next.scale * 2);
  });
});
