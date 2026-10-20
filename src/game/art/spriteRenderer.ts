/**
 * Sprite renderer - converts palette index arrays to offscreen canvases
 * Design doc §10.1: sprites rendered at boot to be used like bitmaps
 */

import { PALETTE } from '@/game/palette';
import type { SpriteData, SpriteFrame } from './types';

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
 * Render sprite data to an offscreen canvas
 * @param data 2D array of palette indices (-1 = transparent)
 * @param anchorX X anchor point (0-1, default 0.5 = center)
 * @param anchorY Y anchor point (0-1, default 0.5 = center)
 */
export function renderSprite(data: SpriteData, anchorX = 0.5, anchorY = 0.5): SpriteFrame {
  const height = data.length;
  const width = data[0]?.length ?? 0;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  for (let y = 0; y < height; y++) {
    const row = data[y]!;
    for (let x = 0; x < width; x++) {
      const colorIndex = row[x]!;
      if (colorIndex >= 0 && colorIndex < PALETTE.length) {
        const color = PALETTE[colorIndex]!;
        const pixelIndex = (y * width + x) * 4;

        // Parse hex color
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        pixels[pixelIndex] = r;
        pixels[pixelIndex + 1] = g;
        pixels[pixelIndex + 2] = b;
        pixels[pixelIndex + 3] = 255;
      }
      // else transparent (alpha = 0, already initialized)
    }
  }

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
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

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
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

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
