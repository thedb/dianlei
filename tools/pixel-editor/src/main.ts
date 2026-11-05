/**
 * Part pixelizer. The left canvas is only the current grid (`renderSprite` + `blitSprite`).
 * The assembly canvas lives in `assembly.ts` and is never this one.
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
import { decodePngRgba } from '@/game/art/pngRgba';
import { blitSprite, renderSprite } from '@/game/art/spriteRenderer';
import { mountAssembly } from './assembly';
import { mountGuide } from './guide';

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

let image: RgbaImage | null = null;
let sourceName = '';
let grid: PaletteGridFile | null = null;
let fixtureText: string | null = null;

fixtureButton.addEventListener('click', () => {
  loadFixture().catch((error: unknown) => report(error));
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  loadFile(file).catch((error: unknown) => report(error));
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
});
mountGuide();
paint(null);

loadFixtureText().catch(() => {
  fixtureText = null;
});

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
      exportButton.disabled = false;
    } catch (error) {
      report(error);
    }
  }
  paint(grid);
}

function paint(next: PaletteGridFile | null): void {
  const ctx = view.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  if (!next) {
    view.width = 160;
    view.height = 120;
    view.style.imageRendering = 'pixelated';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = EXTERIOR_VOID;
    ctx.fillRect(0, 0, view.width, view.height);
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
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
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
  exportButton.disabled = true;
  grid = null;
  status.textContent = error instanceof Error ? error.message : '像素化失败';
}
