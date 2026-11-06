/**
 * Side-by-side compare in the part dialog (P2).
 * The pixelized side uses the same blit as the single preview. The reference
 * is the source image, nearest-neighbor scaled to that same grid.
 */

import { EXTERIOR_VOID } from '@/engine/exterior';
import { gridToSpriteData, parsePaletteGrid, type PaletteGridFile } from '@/game/art/gridFile';
import { gridCellDiff, pixelizeWithPreset } from '@/game/art/pixelizePreset';
import { blitSprite, renderSprite } from '@/game/art/spriteRenderer';
import type { RgbaImage } from '@/game/art/pixelize';
import type { PixelHost } from './pixelHost';
import { listPresets, onPresetsChanged } from './presets';

const OVERLAY_ALPHA = 0.55;

let host: PixelHost | null = null;
let otherGrid: PaletteGridFile | null = null;
let otherLabel = '';

export function mountCompare(next: PixelHost): void {
  host = next;
  must(HTMLInputElement, 'compare-on').addEventListener('change', () => {
    refreshCompare();
  });
  for (const id of ['compare-overlay', 'compare-diff']) {
    must(HTMLInputElement, id).addEventListener('change', () => {
      refreshCompare();
    });
  }
  must(HTMLSelectElement, 'compare-kind').addEventListener('change', () => {
    syncKind();
    refreshCompare();
  });
  must(HTMLSelectElement, 'compare-preset').addEventListener('change', () => {
    refreshCompare();
  });
  must(HTMLInputElement, 'compare-grid').addEventListener('change', () => {
    const input = must(HTMLInputElement, 'compare-grid');
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    file
      .text()
      .then((text) => {
        otherGrid = parsePaletteGrid(text);
        otherLabel = file.name;
        refreshCompare();
      })
      .catch((error: unknown) => {
        otherGrid = null;
        otherLabel = '';
        must(HTMLElement, 'compare-b-cap').textContent =
          error instanceof Error ? error.message : '网格读取失败';
      });
  });
  onPresetsChanged(() => {
    refreshCompare();
  });
  syncKind();
}

export function refreshCompare(): void {
  if (!host) return;
  const open = must(HTMLInputElement, 'compare-on').checked;
  must(HTMLElement, 'compare-box').hidden = !open;
  if (!open) return;
  syncKind();
  const grid = host.grid();
  const image = host.image();
  const refCap = must(HTMLElement, 'compare-ref-cap');
  const pix = must(HTMLCanvasElement, 'compare-pix');
  if (!image || !grid) {
    refCap.textContent = '先载入参考图。';
    clearCanvas(must(HTMLCanvasElement, 'compare-ref'));
    clearCanvas(pix);
    clearCanvas(must(HTMLCanvasElement, 'compare-b'));
    return;
  }
  const scale = viewScale(grid.width, grid.height);
  paintReference(must(HTMLCanvasElement, 'compare-ref'), image, grid.width, grid.height, scale);
  paintGrid(pix, grid, scale);
  refCap.textContent = must(HTMLInputElement, 'compare-overlay').checked
    ? '参考图叠当前网格'
    : `参考图 ${image.width}×${image.height}`;
  if (must(HTMLInputElement, 'compare-overlay').checked) {
    const ctx = must(HTMLCanvasElement, 'compare-ref').getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = OVERLAY_ALPHA;
      ctx.drawImage(pix, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
  paintOther(grid, scale);
}

function paintOther(grid: PaletteGridFile, scale: number): void {
  const figure = must(HTMLElement, 'compare-b-fig');
  const canvas = must(HTMLCanvasElement, 'compare-b');
  const caption = must(HTMLElement, 'compare-b-cap');
  const other = resolveOther();
  figure.hidden = other === null;
  if (!other) return;
  const diffOn = must(HTMLInputElement, 'compare-diff').checked;
  const diff = gridCellDiff(grid, other.grid);
  if (diffOn && diff === null) {
    caption.textContent = `${other.label}：尺寸不同（${grid.width}×${grid.height} 与 ${other.grid.width}×${other.grid.height}），不能逐格对比`;
    paintGrid(canvas, other.grid, viewScale(other.grid.width, other.grid.height));
    return;
  }
  if (diffOn && diff !== null) {
    const cells = other.grid.cells.map((cell, index) => (cell === grid.cells[index] ? -1 : cell));
    paintGrid(canvas, { ...other.grid, cells }, scale);
    caption.textContent = `${other.label}：不同 ${diff} / ${other.grid.cells.length} 格`;
    return;
  }
  paintGrid(canvas, other.grid, scale);
  caption.textContent = `${other.label} ${other.grid.width}×${other.grid.height}`;
}

function resolveOther(): { grid: PaletteGridFile; label: string } | null {
  if (!host) return null;
  const kind = must(HTMLSelectElement, 'compare-kind').value;
  if (kind === 'preset') {
    const image = host.image();
    const preset = listPresets().find(
      (item) => item.id === must(HTMLSelectElement, 'compare-preset').value
    );
    if (!image || !preset) return null;
    try {
      return {
        grid: pixelizeWithPreset(image, host.sourceName() || 'preset.png', preset),
        label: preset.name,
      };
    } catch (error) {
      must(HTMLElement, 'compare-b-cap').textContent =
        error instanceof Error ? error.message : '对照预设失败';
      return null;
    }
  }
  if (kind === 'file') {
    return otherGrid ? { grid: otherGrid, label: otherLabel || '另一份网格' } : null;
  }
  return null;
}

function syncKind(): void {
  const kind = must(HTMLSelectElement, 'compare-kind').value;
  must(HTMLSelectElement, 'compare-preset').hidden = kind !== 'preset';
  must(HTMLInputElement, 'compare-grid').hidden = kind !== 'file';
  must(HTMLLabelElement, 'compare-diff-label').hidden = kind === 'none';
}

function paintReference(
  canvas: HTMLCanvasElement,
  image: RgbaImage,
  targetWidth: number,
  targetHeight: number,
  scale: number
): void {
  const source = document.createElement('canvas');
  source.width = image.width;
  source.height = image.height;
  const sourceCtx = source.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!sourceCtx || !ctx) return;
  const pixels = sourceCtx.createImageData(image.width, image.height);
  pixels.data.set(image.data);
  sourceCtx.putImageData(pixels, 0, 0);
  canvas.width = targetWidth * scale;
  canvas.height = targetHeight * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = EXTERIOR_VOID;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
}

function paintGrid(canvas: HTMLCanvasElement, grid: PaletteGridFile, scale: number): void {
  const frame = renderSprite(gridToSpriteData(grid));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = frame.width * scale;
  canvas.height = frame.height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = EXTERIOR_VOID;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  blitSprite(ctx, frame, 0, 0, frame.width * scale, frame.height * scale);
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1;
  canvas.height = 1;
}

function viewScale(width: number, height: number): number {
  return Math.max(1, Math.min(8, Math.floor(200 / Math.max(width, height, 1))));
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) throw new Error(`missing #${id}`);
  return element;
}
