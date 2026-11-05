/**
 * Sprite renderer - converts palette index arrays to offscreen canvases
 * Design doc §10.1: sprites rendered at boot to be used like bitmaps
 */

import { PALETTE, paletteRgb } from '@/game/palette';
import type { SpriteData, SpriteFrame } from './types';

/**
 * Write one palette-index sprite into an RGBA buffer.
 * The buffer must already be zeroed: -1 and out-of-range indices stay transparent.
 * Bytes match `paletteRgb` (the locked `#rrggbb` entries, alpha 255).
 */
export function writePalettePixels(data: SpriteData, pixels: Uint8ClampedArray): void {
  const height = data.length;
  const width = data[0]?.length ?? 0;
  for (let y = 0; y < height; y++) {
    const row = data[y]!;
    for (let x = 0; x < width; x++) {
      const colorIndex = row[x];
      if (colorIndex === undefined || colorIndex < 0 || colorIndex >= PALETTE.length) continue;
      const [r, g, b] = paletteRgb(colorIndex);
      const pixelIndex = (y * width + x) * 4;
      pixels[pixelIndex] = r;
      pixels[pixelIndex + 1] = g;
      pixels[pixelIndex + 2] = b;
      pixels[pixelIndex + 3] = 255;
    }
  }
}

/**
 * Create an offscreen canvas, fallback to regular canvas for non-browser environments
 */
function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * `getContext('2d')` on `OffscreenCanvas | HTMLCanvasElement` is a wide union.
 * Keep the branch that can actually bake palette pixels.
 */
function context2d(
  canvas: OffscreenCanvas | HTMLCanvasElement
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (ctx && 'createImageData' in ctx) return ctx;
  throw new Error('Failed to get 2D context');
}

/**
 * Render sprite data to an offscreen canvas
 * @param data 2D array of palette indices (-1 = transparent)
 * @param anchorX X anchor point (0-1, default 0.5 = center)
 * @param anchorY Y anchor point (0-1, default 0.5 = center)
 */
export function renderSprite(data: SpriteData, anchorX = 0.5, anchorY = 0.5): SpriteFrame {
  const height = data.length;
  const width = data[0]?.length ?? 0;

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);

  const imageData = ctx.createImageData(width, height);
  writePalettePixels(data, imageData.data);
  ctx.putImageData(imageData, 0, 0);

  return {
    canvas,
    width,
    height,
    anchorX: Math.floor(width * anchorX),
    anchorY: Math.floor(height * anchorY),
  };
}

/**
 * Nearest-neighbor sprite blit.
 * Matches `Renderer.drawImage`: smoothing stays off, and the origin is floored.
 * The game canvas also sets `imageRendering = 'pixelated'` on the element.
 */
export function blitSprite(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  w?: number,
  h?: number
): void {
  ctx.imageSmoothingEnabled = false;
  const dx = Math.floor(x);
  const dy = Math.floor(y);
  if (w !== undefined && h !== undefined) {
    ctx.drawImage(frame.canvas, dx, dy, w, h);
  } else {
    ctx.drawImage(frame.canvas, dx, dy);
  }
}

/**
 * Place a baked frame the way a boss part is drawn (`drawPartSprite`), then optionally enlarge it.
 * The pivot is `frame.anchorX/Y` in source pixels. `scale` is an integer ≥ 1: each source
 * pixel becomes a `scale`×`scale` block. Smoothing stays off.
 * Angle 0 uses the straight floored blit (enlarged with a destination size when `scale` ≠ 1),
 * so a zero angle does not shift by a subpixel.
 * Any other angle translates to `(x, y)`, rotates (canvas y-down, positive clockwise),
 * scales about that pivot, then blits at `-anchor`. A rotated edge may cover part of a
 * screen pixel; it is not snapped onto the grid and it is not filtered.
 */
export function blitPlacedSprite(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  angle: number,
  scale = 1
): void {
  if (!Number.isInteger(scale) || scale < 1) throw new Error('scale must be an integer >= 1');
  if (angle === 0 && scale === 1) {
    blitSprite(ctx, frame, x - frame.anchorX, y - frame.anchorY);
    return;
  }
  if (angle === 0) {
    blitSprite(
      ctx,
      frame,
      x - frame.anchorX * scale,
      y - frame.anchorY * scale,
      frame.width * scale,
      frame.height * scale
    );
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (scale !== 1) ctx.scale(scale, scale);
  blitSprite(ctx, frame, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

/**
 * Render sprite with horizontal mirror (for left bank frames)
 */
export function renderSpriteMirrored(data: SpriteData, anchorX = 0.5, anchorY = 0.5): SpriteFrame {
  const mirrored: SpriteData = data.map((row) => [...row].reverse());
  return renderSprite(mirrored, 1 - anchorX, anchorY);
}

/**
 * Apply white hit flash to a sprite frame
 * Returns a new canvas with all non-transparent pixels set to white
 */
export function createHitFlashSprite(frame: SpriteFrame): SpriteFrame {
  const canvas = createCanvas(frame.width, frame.height);
  const ctx = context2d(canvas);

  // Draw original
  ctx.drawImage(frame.canvas, 0, 0);

  // Get image data and set all non-transparent pixels to white
  const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]! > 0) {
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    canvas,
    width: frame.width,
    height: frame.height,
    anchorX: frame.anchorX,
    anchorY: frame.anchorY,
  };
}

/**
 * Create a tinted version of a sprite
 * @param hueShift Amount to shift hue (0-360)
 * @param satMul Saturation multiplier
 * @param valMul Value/brightness multiplier
 */
export function createTintedSprite(
  frame: SpriteFrame,
  hueShift: number,
  satMul = 1,
  valMul = 1
): SpriteFrame {
  const canvas = createCanvas(frame.width, frame.height);
  const ctx = context2d(canvas);

  ctx.drawImage(frame.canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]! > 0) {
      const [h, s, v] = rgbToHsv(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
      const [r, g, b] = hsvToRgb(
        (h + hueShift) % 360,
        Math.min(1, s * satMul),
        Math.min(1, v * valMul)
      );
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    canvas,
    width: frame.width,
    height: frame.height,
    anchorX: frame.anchorX,
    anchorY: frame.anchorY,
  };
}

/** RGB to HSV conversion */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return [h, s, v];
}

/** HSV to RGB conversion */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
