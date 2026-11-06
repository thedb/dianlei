/**
 * Part pixelizer. Its canvas lives in the part dialog and only draws the current grid
 * (`renderSprite` + `blitSprite`). The assembly canvas lives in `assembly.ts`.
 */

import { LOGICAL_W } from '@/game/config';
import { EXTERIOR_VOID } from '@/engine/exterior';
import {
  gridToSpriteData,
  serializePaletteGrid,
  type GridPixelizeParams,
  type GridQuantize,
  type GridSample,
  type PaletteGridFile,
} from '@/game/art/gridFile';
import { pixelize, type RgbaImage } from '@/game/art/pixelize';
import type { PixelizePreset } from '@/game/art/pixelizePreset';
import { decodePngRgba } from '@/game/art/pngRgba';
import { blitSprite, renderSprite } from '@/game/art/spriteRenderer';
import { heightForWidth, widthForHeight } from '@/game/art/gridStats';
import { mountAssembly } from './assembly';
import { mountBatch } from './batch';
import { aspectLine, renderColorStats } from './colorStats';
import { mountCompare, refreshCompare } from './compare';
import { mountGuide } from './guide';
import { mountPresets } from './presets';

document.body.style.margin = '0';
document.body.style.backgroundColor = EXTERIOR_VOID;
document.body.style.color = '#e8f4f8';

const fileInput = must(HTMLInputElement, 'file');
const fixtureButton = must(HTMLButtonElement, 'fixture');
const widthInput = must(HTMLInputElement, 'tw');
const heightInput = must(HTMLInputElement, 'th');
const sampleInput = must(HTMLSelectElement, 'sample');
const quantizeInput = must(HTMLSelectElement, 'quantize');
const alphaInput = must(HTMLInputElement, 'alpha');
const ditherInput = must(HTMLInputElement, 'dither');
const exportButton = must(HTMLButtonElement, 'export');
const status = must(HTMLParagraphElement, 'status');
const view = must(HTMLCanvasElement, 'view');
const lockRatio = must(HTMLInputElement, 'lock-ratio');
const aspectNote = must(HTMLParagraphElement, 'part-aspect');
const colorBox = must(HTMLDivElement, 'part-colors');
const colorWarn = must(HTMLParagraphElement, 'part-warn');
const moveButton = must(HTMLButtonElement, 'asm-move');
const clearButton = must(HTMLButtonElement, 'part-clear');
const emptyNote = must(HTMLParagraphElement, 'part-empty');
const EMPTY_STATUS = '先点「载入示例」，或选一张 PNG。上面是这张零件。';

let image: RgbaImage | null = null;
let sourceName = '';
let grid: PaletteGridFile | null = null;
let fixtureText: string | null = null;
let assemblyBusy = false;

clearButton.addEventListener('click', () => {
  clearMaterial();
});
fixtureButton.addEventListener('click', () => {
  if (fixtureButton.disabled) return;
  loadFixture().catch((error: unknown) => report(error));
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  loadFile(file).catch((error: unknown) => report(error));
});
widthInput.addEventListener('input', () => {
  if (!lockRatio.checked || !image) return;
  const width = Number(widthInput.value);
  if (Number.isInteger(width) && width >= 1) {
    heightInput.value = String(Math.min(512, heightForWidth(image.width, image.height, width)));
  }
});
heightInput.addEventListener('input', () => {
  if (!lockRatio.checked || !image) return;
  const height = Number(heightInput.value);
  if (Number.isInteger(height) && height >= 1) {
    widthInput.value = String(Math.min(512, widthForHeight(image.width, image.height, height)));
  }
});
must(HTMLButtonElement, 'fit-ratio').addEventListener('click', () => {
  if (!image) return;
  const width = Number(widthInput.value);
  if (!Number.isInteger(width) || width < 1) return;
  heightInput.value = String(Math.min(512, heightForWidth(image.width, image.height, width)));
  redraw();
});
for (const input of [
  widthInput,
  heightInput,
  sampleInput,
  quantizeInput,
  alphaInput,
  ditherInput,
]) {
  input.addEventListener('input', () => redraw());
}
exportButton.addEventListener('click', () => {
  if (!grid) return;
  const text = serializePaletteGrid(grid);
  download(downloadName(grid.source.name), text);
});
mountAssembly({
  currentGrid: () => grid,
  download,
  assetUrl,
  assemblyBusy: (busy) => {
    assemblyBusy = busy;
    syncPartButtons();
  },
});
const pixelHost = {
  image: () => image,
  sourceName: () => sourceName,
  grid: () => grid,
  readDraft: () => ({
    targetWidth: readInt(widthInput, '目标宽', 1, 512),
    targetHeight: readInt(heightInput, '目标高', 1, 512),
    sample: readSample(sampleInput.value),
    quantize: readQuantize(quantizeInput.value),
    alphaCutoff: readInt(alphaInput, '透明阈值', 0, 255),
    ditherStrength: readUnit(ditherInput.value),
    lockRatio: lockRatio.checked,
  }),
  write: (preset: PixelizePreset, size: { width: number; height: number }) => {
    widthInput.value = String(size.width);
    heightInput.value = String(size.height);
    sampleInput.value = preset.sample;
    quantizeInput.value = preset.quantize;
    alphaInput.value = String(preset.alphaCutoff);
    ditherInput.value = String(preset.ditherStrength);
    lockRatio.checked = preset.lockRatio;
  },
  redraw: () => {
    redraw();
  },
  decode,
  downloadText: download,
  downloadBytes,
};
mountPresets(pixelHost);
mountCompare(pixelHost);
mountBatch(pixelHost);
mountGuide();
mountPartDialog();
paint(null);
syncPartButtons();

loadFixtureText().catch(() => {
  fixtureText = null;
});

function mountPartDialog(): void {
  const dialog = must(HTMLDialogElement, 'part-dialog');
  must(HTMLButtonElement, 'part-open').addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  must(HTMLButtonElement, 'part-close').addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) throw new Error(`missing #${id}`);
  return el;
}

async function loadFixture(): Promise<void> {
  const response = await fetch(assetUrl('sample.png'));
  if (!response.ok) throw new Error('示例 PNG 读取失败');
  const bytes = new Uint8Array(await response.arrayBuffer());
  widthInput.value = '8';
  heightInput.value = '8';
  sampleInput.value = 'nearest';
  quantizeInput.value = 'nearest';
  alphaInput.value = '0';
  ditherInput.value = '1';
  acceptDecoded(await decode(bytes), 'sample.png');
}

async function loadFixtureText(): Promise<void> {
  const response = await fetch(assetUrl('sample.grid.json'));
  if (!response.ok) return;
  fixtureText = await response.text();
  if (grid) redraw();
}

async function loadFile(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.split(/[/\\]/).pop() || 'image.png';
  const decoded = await decode(bytes);
  const fitted = fitTarget(decoded.width, decoded.height);
  widthInput.value = String(fitted.width);
  heightInput.value = String(fitted.height);
  acceptDecoded(decoded, name);
}

function acceptDecoded(decoded: RgbaImage, name: string): void {
  image = decoded;
  sourceName = name;
  redraw();
}

function redraw(): void {
  if (image) {
    try {
      grid = pixelize(image, readParams(image), sourceName);
      const text = serializePaletteGrid(grid);
      const matched = fixtureText !== null && text === fixtureText;
      const transparent = grid.cells.filter((cell) => cell < 0).length;
      status.textContent = [
        `${grid.width}×${grid.height}，源 ${image.width}×${image.height}`,
        `不透明 ${grid.cells.length - transparent}，透明 ${transparent}`,
        matched ? '与 fixtures/sample.grid.json 一致' : '参数已写入导出',
      ].join('\n');
      const aspect = aspectLine(image.width, image.height, grid.width, grid.height);
      aspectNote.textContent = aspect.text;
      aspectNote.classList.toggle('warn', aspect.skewed);
      renderColorStats(colorBox, colorWarn, grid.cells);
    } catch (error) {
      report(error);
    }
  }
  paint(grid);
  syncPartButtons();
}

/**
 * 载入示例 only while the dialog holds no material and the assembly has no parts.
 * Export and 移入装配 only once a grid exists. 清空当前素材 once anything is loaded.
 */
function syncPartButtons(): void {
  const hasMaterial = image !== null;
  fixtureButton.disabled = hasMaterial || assemblyBusy;
  fixtureButton.title = hasMaterial
    ? '弹窗里已有素材。先点「清空当前素材」再载入示例。'
    : assemblyBusy
      ? '装配里已有零件。先点「清空装配」再载入示例。'
      : '打开仓库自带的 8×8 样例图，练手用，不是游戏正式资产。';
  exportButton.disabled = grid === null;
  moveButton.disabled = grid === null;
  clearButton.disabled = !hasMaterial;
}

function clearMaterial(): void {
  image = null;
  grid = null;
  sourceName = '';
  fileInput.value = '';
  aspectNote.textContent = '';
  aspectNote.classList.remove('warn');
  colorBox.replaceChildren();
  colorWarn.hidden = true;
  status.textContent = EMPTY_STATUS;
  paint(null);
  syncPartButtons();
}

function paint(next: PaletteGridFile | null): void {
  const ctx = view.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  view.hidden = next === null;
  emptyNote.hidden = next !== null || image !== null;
  if (!next) {
    view.width = 1;
    view.height = 1;
    refreshCompare();
    return;
  }
  const frame = renderSprite(gridToSpriteData(next));
  const long = Math.max(frame.width, frame.height);
  const scale = Math.max(1, Math.floor(LOGICAL_W / long));
  view.width = frame.width * scale;
  view.height = frame.height * scale;
  view.style.imageRendering = 'pixelated';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = EXTERIOR_VOID;
  ctx.fillRect(0, 0, view.width, view.height);
  blitSprite(ctx, frame, 0, 0, frame.width * scale, frame.height * scale);
  refreshCompare();
}

function readParams(source: RgbaImage): GridPixelizeParams {
  return {
    sourceWidth: source.width,
    sourceHeight: source.height,
    targetWidth: readInt(widthInput, '目标宽', 1, 512),
    targetHeight: readInt(heightInput, '目标高', 1, 512),
    sample: readSample(sampleInput.value),
    quantize: readQuantize(quantizeInput.value),
    alphaCutoff: readInt(alphaInput, '透明阈值', 0, 255),
    ditherStrength: readUnit(ditherInput.value),
  };
}

function readInt(input: HTMLInputElement, label: string, min: number, max: number): number {
  const value = Number(input.value);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}需为 ${min}–${max} 的整数`);
  }
  return value;
}

function readUnit(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error('抖动强度需为 0 到 1');
  return n;
}

function readSample(value: string): GridSample {
  if (value === 'nearest' || value === 'box') return value;
  throw new Error('取样无效');
}

function readQuantize(value: string): GridQuantize {
  if (value === 'nearest' || value === 'dither') return value;
  throw new Error('量化无效');
}

function fitTarget(width: number, height: number): { width: number; height: number } {
  const max = 64;
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function decode(bytes: Uint8Array): Promise<RgbaImage> {
  return decodePngRgba(bytes, inflateZlib);
}

async function inflateZlib(zlib: Uint8Array): Promise<Uint8Array> {
  const bytes = Uint8Array.from(zlib);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function download(filename: string, text: string): void {
  downloadBytes(filename, new TextEncoder().encode(text), 'application/json');
}

function downloadBytes(filename: string, bytes: Uint8Array, type: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadName(name: string): string {
  const stem = name.replace(/\.png$/i, '');
  return `${stem}.grid.json`;
}

function assetUrl(name: string): string {
  return `${import.meta.env.BASE_URL}${name}`;
}

function report(error: unknown): void {
  grid = null;
  colorBox.replaceChildren();
  colorWarn.hidden = true;
  status.textContent = error instanceof Error ? error.message : '像素化失败';
  paint(null);
  syncPartButtons();
}
