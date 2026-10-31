/**
 * Shell chrome for the boot cover and the title mark.
 * Battle sprites stay code pixels. These two bitmaps live in `public/ui/`
 * and load like `public/fonts`: a relative URL, so Vite H5 (`base: './'`)
 * and a WeChat package root both resolve `ui/...`.
 *
 * Fusion Pixel (`titleFont.ts`) draws 「电雷计划」 only when the title bitmap
 * has not loaded. Near-black pixels in that bitmap are punched out so the
 * coast cover and the title attract show through the glow.
 */

import { LOGICAL_H, LOGICAL_W } from '@/game/config';

/** Coast splash. Full-bleed on the 360×640 boot frame. No baked logo. */
export const BOOT_COVER_PATH = 'ui/boot-cover.jpg';

/** 「电雷计划」 impact type. No plane, no lightning. */
export const TITLE_MARK_PATH = 'ui/title-mark.jpg';

/**
 * Pixels at or under this channel value become transparent.
 * The glow sits well above it; the field behind the letters is black.
 */
export const TITLE_MARK_KEY = 16;

/** Ready-gate mark: centered, upper-mid so 「点击进入」 keeps the bottom. */
export const BOOT_MARK_MAX_W = 280;
export const BOOT_MARK_CY = 250;

/** Title-scene mark. Horizontally centered in the upper band, above the menu. */
export const TITLE_MARK_MAX_W = 220;
export const TITLE_MARK_CY = 96;

/** Subtitle sits under the mark. The old y=82 collided with the bitmap. */
export const TITLE_SUB_Y = 214;

type SizedSource = CanvasImageSource & { width: number; height: number };

interface BitmapHost {
  Image?: new () => HTMLImageElement;
  document?: Document;
  wx?: {
    createImage?: () => HTMLImageElement;
    createOffscreenCanvas?: (options: {
      type: '2d';
      width: number;
      height: number;
    }) => HTMLCanvasElement;
  };
}

let started = false;
let pinned = false;
let cover: CanvasImageSource | null = null;
let mark: CanvasImageSource | null = null;

function host(): BitmapHost {
  return globalThis as BitmapHost;
}

function createBitmap(): HTMLImageElement | null {
  const api = host();
  if (typeof api.Image === 'function') return new api.Image();
  return api.wx?.createImage?.() ?? null;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  const api = host();
  if (api.document?.createElement) {
    const canvas = api.document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
  return api.wx?.createOffscreenCanvas?.({ type: '2d', width: w, height: h }) ?? null;
}

function bitmapSize(img: CanvasImageSource): { w: number; h: number } | null {
  const rec = img as {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  };
  const w = rec.naturalWidth || rec.width || 0;
  const h = rec.naturalHeight || rec.height || 0;
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

/** object-fit: cover. The rect may start outside the frame; the canvas clips it. */
export function coverFrame(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number
): { x: number; y: number; w: number; h: number } {
  const scale = Math.max(destW / srcW, destH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (destW - w) / 2, y: (destH - h) / 2, w, h };
}

function punchNearBlack(img: HTMLImageElement): CanvasImageSource {
  const size = bitmapSize(img);
  if (!size) return img;
  const canvas = makeCanvas(size.w, size.h);
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return img;
  ctx.drawImage(img, 0, 0);
  try {
    const image = ctx.getImageData(0, 0, size.w, size.h);
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] ?? 0;
      const g = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;
      if (r <= TITLE_MARK_KEY && g <= TITLE_MARK_KEY && b <= TITLE_MARK_KEY) {
        px[i + 3] = 0;
      }
    }
    ctx.putImageData(image, 0, 0);
  } catch {
    return img;
  }
  return canvas;
}

function loadBitmap(path: string, onLoad: (img: HTMLImageElement) => void): void {
  const img = createBitmap();
  if (!img) return;
  img.onload = () => onLoad(img);
  img.onerror = () => undefined;
  img.src = path;
}

/** Start both loads once. Safe in Node tests, where no bitmap factory exists. */
export function ensureShellArt(): void {
  if (started) return;
  started = true;
  loadBitmap(BOOT_COVER_PATH, (img) => {
    if (!pinned) cover = img;
  });
  loadBitmap(TITLE_MARK_PATH, (img) => {
    if (!pinned) mark = punchNearBlack(img);
  });
}

export function shellCoverReady(): boolean {
  return cover !== null;
}

export function shellMarkReady(): boolean {
  return mark !== null;
}

/** @returns whether the cover was drawn. A miss leaves the caller’s clear. */
export function drawBootCover(ctx: CanvasRenderingContext2D): boolean {
  if (!cover) return false;
  const size = bitmapSize(cover);
  if (!size) return false;
  const dest = coverFrame(size.w, size.h, LOGICAL_W, LOGICAL_H);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cover, dest.x, dest.y, dest.w, dest.h);
  ctx.restore();
  return true;
}

/**
 * Draw the title bitmap centered on `(cx, cy)`, fitted inside a `maxW` square.
 * @returns false when the bitmap is missing; the caller draws Fusion Pixel.
 */
export function drawTitleMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  maxW: number
): boolean {
  if (!mark) return false;
  const size = bitmapSize(mark);
  if (!size) return false;
  const scale = maxW / Math.max(size.w, size.h);
  const w = size.w * scale;
  const h = size.h * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mark, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  ctx.restore();
  return true;
}

/** Pin bitmaps so a late network load cannot replace a test double. */
export function setShellArtForTests(next: {
  cover?: CanvasImageSource | null;
  mark?: CanvasImageSource | null;
}): void {
  pinned = true;
  started = true;
  if (next.cover !== undefined) cover = next.cover;
  if (next.mark !== undefined) mark = next.mark;
}

export function resetShellArtForTests(): void {
  pinned = false;
  started = false;
  cover = null;
  mark = null;
}

/** Test double with a known pixel size. Drawing it must not throw. */
export function fakeShellImage(w: number, h: number): SizedSource {
  return { width: w, height: h } as SizedSource;
}
