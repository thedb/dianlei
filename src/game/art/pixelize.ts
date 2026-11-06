/**
 * Turn an RGBA image into a palette-index grid.
 *
 * Same image bytes and the same `GridPixelizeParams` always yield the same
 * cells. There is no `Math.random`.
 *
 * Sample `nearest` — target cell (tx, ty) reads one source pixel:
 *   sx = floor(((2*tx+1) * sourceWidth) / (2 * targetWidth))
 *   sy = floor(((2*ty+1) * sourceHeight) / (2 * targetHeight))
 * That is the source pixel under the center of the cell.
 *
 * Sample `box` — the target cell covers source x in
 * [tx * sourceWidth, (tx+1) * sourceWidth) measured in units of
 * 1/targetWidth of a source pixel. Source pixel sx covers
 * [sx * targetWidth, (sx+1) * targetWidth) in that same unit.
 * Coverage weights are exact integers. RGB is averaged premultiplied
 * (transparent source pixels do not tint the color). Channels round
 * half up. Every target cell's weights sum to sourceWidth * sourceHeight.
 *
 * Quantize `nearest` — Euclidean RGB distance to `paletteRgb`. The lowest
 * index wins a tie. Alpha <= `alphaCutoff` is transparent and is not quantized.
 *
 * Quantize `dither` — Floyd–Steinberg, left to right, top to bottom, no
 * serpentine. Error is a IEEE-754 double. Strength scales the classic
 * 7/16, 3/16, 5/16, 1/16 split. Transparent cells are not quantized and
 * do not spread error. Strength is ignored when quantize is `nearest`.
 */

import { PALETTE, paletteRgb } from '@/game/palette';
import {
  GRID_MAX_SIDE,
  GRID_MAX_SOURCE_SIDE,
  GRID_TRANSPARENT,
  buildGrid,
  type GridPixelizeParams,
  type PaletteGridFile,
} from './gridFile';

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major RGBA, 4 bytes per pixel. Length must be width * height * 4. */
  data: Uint8ClampedArray;
}

const PALETTE_RGB = PALETTE.map((_, index) => paletteRgb(index));

export function pixelize(
  image: RgbaImage,
  params: GridPixelizeParams,
  sourceName: string
): PaletteGridFile {
  assertImage(image, params);
  const sampled = sampleImage(image, params);
  const cells = quantize(sampled, params);
  return buildGrid(params.targetWidth, params.targetHeight, cells, {
    name: sourceName,
    params: { ...params },
  });
}

/** Lowest palette index at the Euclidean minimum. Distance 0 is exact. */
export function nearestPaletteIndex(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < PALETTE_RGB.length; i++) {
    const rgb = PALETTE_RGB[i]!;
    const dr = r - rgb[0];
    const dg = g - rgb[1];
    const db = b - rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function assertImage(image: RgbaImage, params: GridPixelizeParams): void {
  const { width, height, data } = image;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > GRID_MAX_SOURCE_SIDE ||
    height > GRID_MAX_SOURCE_SIDE
  ) {
    throw new Error('source image size is out of range');
  }
  if (data.length !== width * height * 4) throw new Error('RGBA buffer length does not match');
  if (params.sourceWidth !== width || params.sourceHeight !== height) {
    throw new Error('source size does not match the image');
  }
  if (
    params.targetWidth < 1 ||
    params.targetHeight < 1 ||
    params.targetWidth > GRID_MAX_SIDE ||
    params.targetHeight > GRID_MAX_SIDE
  ) {
    throw new Error('target size is out of range');
  }
}

function sampleImage(image: RgbaImage, params: GridPixelizeParams): Uint8ClampedArray {
  const dstW = params.targetWidth;
  const dstH = params.targetHeight;
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  for (let ty = 0; ty < dstH; ty++) {
    for (let tx = 0; tx < dstW; tx++) {
      const [r, g, b, a] =
        params.sample === 'box'
          ? sampleBox(image, tx, ty, dstW, dstH)
          : sampleNearest(image, tx, ty, dstW, dstH);
      const i = (ty * dstW + tx) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    }
  }
  return out;
}

function sampleNearest(
  image: RgbaImage,
  tx: number,
  ty: number,
  dstW: number,
  dstH: number
): readonly [number, number, number, number] {
  const sx = Math.floor(((2 * tx + 1) * image.width) / (2 * dstW));
  const sy = Math.floor(((2 * ty + 1) * image.height) / (2 * dstH));
  const i = (sy * image.width + sx) * 4;
  return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, image.data[i + 3]!];
}

function sampleBox(
  image: RgbaImage,
  tx: number,
  ty: number,
  dstW: number,
  dstH: number
): readonly [number, number, number, number] {
  const srcW = image.width;
  const srcH = image.height;
  const x0 = tx * srcW;
  const x1 = (tx + 1) * srcW;
  const y0 = ty * srcH;
  const y1 = (ty + 1) * srcH;
  const sx0 = Math.floor(x0 / dstW);
  const sx1 = Math.min(srcW, Math.ceil(x1 / dstW));
  const sy0 = Math.floor(y0 / dstH);
  const sy1 = Math.min(srcH, Math.ceil(y1 / dstH));
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumA = 0;
  for (let sy = sy0; sy < sy1; sy++) {
    const oy = overlap(y0, y1, sy * dstH, (sy + 1) * dstH);
    if (oy === 0) continue;
    for (let sx = sx0; sx < sx1; sx++) {
      const ox = overlap(x0, x1, sx * dstW, (sx + 1) * dstW);
      if (ox === 0) continue;
      const w = ox * oy;
      const i = (sy * srcW + sx) * 4;
      const a = image.data[i + 3]!;
      sumA += a * w;
      sumR += image.data[i]! * a * w;
      sumG += image.data[i + 1]! * a * w;
      sumB += image.data[i + 2]! * a * w;
    }
  }
  const total = srcW * srcH;
  const a = divRoundPos(sumA, total);
  if (sumA === 0) return [0, 0, 0, a];
  return [divRoundPos(sumR, sumA), divRoundPos(sumG, sumA), divRoundPos(sumB, sumA), a];
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  const left = a0 > b0 ? a0 : b0;
  const right = a1 < b1 ? a1 : b1;
  return right > left ? right - left : 0;
}

/** Positive integers only. Half rounds away from zero, which is half up. */
function divRoundPos(n: number, d: number): number {
  return Math.floor((n + Math.floor(d / 2)) / d);
}

function quantize(sampled: Uint8ClampedArray, params: GridPixelizeParams): number[] {
  const w = params.targetWidth;
  const h = params.targetHeight;
  const cells = new Array<number>(w * h);
  if (params.quantize === 'dither') return dither(sampled, cells, w, h, params);
  for (let i = 0; i < cells.length; i++) {
    const o = i * 4;
    cells[i] = quantizePixel(
      sampled[o]!,
      sampled[o + 1]!,
      sampled[o + 2]!,
      sampled[o + 3]!,
      params
    );
  }
  return cells;
}

function quantizePixel(
  r: number,
  g: number,
  b: number,
  a: number,
  params: GridPixelizeParams
): number {
  if (a <= params.alphaCutoff) return GRID_TRANSPARENT;
  return nearestPaletteIndex(r, g, b);
}

function dither(
  sampled: Uint8ClampedArray,
  cells: number[],
  w: number,
  h: number,
  params: GridPixelizeParams
): number[] {
  const errR = new Float64Array(w * h);
  const errG = new Float64Array(w * h);
  const errB = new Float64Array(w * h);
  const k = params.ditherStrength;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const a = sampled[o + 3]!;
      if (a <= params.alphaCutoff) {
        cells[i] = GRID_TRANSPARENT;
        continue;
      }
      const r = clampByte(sampled[o]! + errR[i]!);
      const g = clampByte(sampled[o + 1]! + errG[i]!);
      const b = clampByte(sampled[o + 2]! + errB[i]!);
      const index = nearestPaletteIndex(r, g, b);
      cells[i] = index;
      const rgb = PALETTE_RGB[index]!;
      spread(errR, w, h, x, y, (r - rgb[0]) * k);
      spread(errG, w, h, x, y, (g - rgb[1]) * k);
      spread(errB, w, h, x, y, (b - rgb[2]) * k);
    }
  }
  return cells;
}

function spread(
  err: Float64Array,
  w: number,
  h: number,
  x: number,
  y: number,
  delta: number
): void {
  addErr(err, w, h, x + 1, y, (delta * 7) / 16);
  addErr(err, w, h, x - 1, y + 1, (delta * 3) / 16);
  addErr(err, w, h, x, y + 1, (delta * 5) / 16);
  addErr(err, w, h, x + 1, y + 1, (delta * 1) / 16);
}

function addErr(
  err: Float64Array,
  w: number,
  h: number,
  x: number,
  y: number,
  value: number
): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  err[y * w + x] = err[y * w + x]! + value;
}

function clampByte(n: number): number {
  const r = Math.round(n);
  if (r < 0) return 0;
  if (r > 255) return 255;
  return r;
}
