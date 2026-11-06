/**
 * Named pixelize presets for the local editor (P2).
 * A preset is the knobs in `GridPixelizeParams` plus whether the target keeps
 * the source aspect. The palette is always the game palette. Applying one
 * calls `pixelize`: same image and same preset always yield the same cells.
 * The fight does not read presets.
 */

import { heightForWidth, widthForHeight } from './gridStats';
import { pixelize, type RgbaImage } from './pixelize';
import type { GridPixelizeParams, GridQuantize, GridSample, PaletteGridFile } from './gridFile';

/** Matches the part-dialog inputs. Pixelize itself allows up to 1024. */
export const PRESET_TARGET_MAX = 512;
export const PRESET_NAME_MAX = 32;
export const PRESET_NOTE_MAX = 80;
export const PRESET_USER_MAX = 40;

export interface PixelizePreset {
  /** `builtin:…` or `user:…`. */
  id: string;
  name: string;
  builtin: boolean;
  targetWidth: number;
  targetHeight: number;
  sample: GridSample;
  quantize: GridQuantize;
  alphaCutoff: number;
  ditherStrength: number;
  /**
   * When set, the target width is kept and the height follows the image.
   * The stored height is what the form shows before an image is loaded.
   */
  lockRatio: boolean;
  note: string;
}

export interface PresetDraft {
  name: string;
  targetWidth: number;
  targetHeight: number;
  sample: GridSample;
  quantize: GridQuantize;
  alphaCutoff: number;
  ditherStrength: number;
  lockRatio: boolean;
  note: string;
}

const USER_ID = /^user:[a-z0-9-]{1,40}$/;

function preset(
  id: string,
  name: string,
  targetWidth: number,
  targetHeight: number,
  sample: GridSample,
  quantize: GridQuantize,
  alphaCutoff: number,
  ditherStrength: number,
  lockRatio: boolean,
  note: string
): PixelizePreset {
  return {
    id,
    name,
    builtin: true,
    targetWidth,
    targetHeight,
    sample,
    quantize,
    alphaCutoff,
    ditherStrength,
    lockRatio,
    note,
  };
}

/**
 * Sizes from the sprite table. `nearest` samples the source pixel under the
 * center of each cell (the alignment). `box` averages the covered source area.
 * None of these switches the palette.
 */
export const BUILTIN_PRESETS: readonly PixelizePreset[] = [
  preset(
    'builtin:eagle',
    '玩家·Eagle',
    28,
    32,
    'nearest',
    'nearest',
    0,
    1,
    false,
    '整机 28×32，格子中心取样，不丢半透明。不锁比例。'
  ),
  preset(
    'builtin:mandy',
    '玩家·Mandy',
    48,
    32,
    'nearest',
    'nearest',
    0,
    1,
    false,
    '整机 48×32，格子中心取样，不丢半透明。不锁比例。'
  ),
  preset(
    'builtin:jason',
    '玩家·Jason',
    26,
    30,
    'nearest',
    'nearest',
    0,
    1,
    false,
    '整机 26×30，格子中心取样，不丢半透明。不锁比例。'
  ),
  preset(
    'builtin:small',
    '小零件',
    24,
    24,
    'nearest',
    'nearest',
    0,
    1,
    false,
    '小敌机、炮塔一类 24×24，格子中心取样。'
  ),
  preset(
    'builtin:icon',
    '界面图标',
    16,
    16,
    'nearest',
    'nearest',
    16,
    1,
    false,
    '16×16。透明阈值 16，丢掉很淡的边。'
  ),
  preset(
    'builtin:tile',
    '地砖',
    16,
    16,
    'nearest',
    'nearest',
    0,
    1,
    false,
    '地砖 16×16，格子中心取样，不丢半透明。'
  ),
  preset(
    'builtin:boss',
    'Boss 零件',
    64,
    64,
    'box',
    'dither',
    8,
    0.75,
    true,
    '宽 64 并锁定源比例，区域平均加轻微抖动。适合零件，不是整架两百像素的机体。'
  ),
];

export function builtinPreset(id: string): PixelizePreset | null {
  return BUILTIN_PRESETS.find((item) => item.id === id) ?? null;
}

/** Target size a preset resolves to for this image. `image` null uses the stored size. */
export function resolvedTarget(
  preset: PixelizePreset,
  image: { width: number; height: number } | null
): { width: number; height: number } {
  if (!image || !preset.lockRatio) {
    return clampTarget(preset.targetWidth, preset.targetHeight);
  }
  let width = Math.min(preset.targetWidth, PRESET_TARGET_MAX);
  let height = heightForWidth(image.width, image.height, width);
  if (height > PRESET_TARGET_MAX) {
    height = PRESET_TARGET_MAX;
    width = Math.min(PRESET_TARGET_MAX, widthForHeight(image.width, image.height, height));
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function clampTarget(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.min(PRESET_TARGET_MAX, width)),
    height: Math.max(1, Math.min(PRESET_TARGET_MAX, height)),
  };
}

/** Params `pixelize` will see. Source size always comes from the image. */
export function presetParams(preset: PixelizePreset, image: RgbaImage): GridPixelizeParams {
  const target = resolvedTarget(preset, image);
  return {
    sourceWidth: image.width,
    sourceHeight: image.height,
    targetWidth: target.width,
    targetHeight: target.height,
    sample: preset.sample,
    quantize: preset.quantize,
    alphaCutoff: preset.alphaCutoff,
    ditherStrength: preset.ditherStrength,
  };
}

export function pixelizeWithPreset(
  image: RgbaImage,
  sourceName: string,
  preset: PixelizePreset
): PaletteGridFile {
  return pixelize(image, presetParams(preset, image), sourceName);
}

export type PixelizeOutcome =
  { name: string; ok: true; grid: PaletteGridFile } | { name: string; ok: false; error: string };

/** One preset across many images. A bad image is a failed row, not a thrown batch. */
export function pixelizeAll(
  items: readonly { name: string; image: RgbaImage }[],
  preset: PixelizePreset
): PixelizeOutcome[] {
  return items.map((item) => {
    try {
      return {
        name: item.name,
        ok: true as const,
        grid: pixelizeWithPreset(item.image, item.name, preset),
      };
    } catch (error) {
      return {
        name: item.name,
        ok: false as const,
        error: error instanceof Error ? error.message : 'pixelize failed',
      };
    }
  });
}

export function createUserPreset(
  draft: PresetDraft,
  existingIds: readonly string[]
): PixelizePreset {
  const name = checkName(draft.name);
  const targetWidth = checkInt(draft.targetWidth, '目标宽');
  const targetHeight = checkInt(draft.targetHeight, '目标高');
  const sample = checkSample(draft.sample);
  const quantize = checkQuantize(draft.quantize);
  const alphaCutoff = checkAlpha(draft.alphaCutoff);
  const ditherStrength = checkDither(draft.ditherStrength);
  if (typeof draft.lockRatio !== 'boolean') throw new Error('锁定源比例无效');
  const note = checkNote(draft.note);
  return {
    id: nextUserId(name, new Set(existingIds)),
    name,
    builtin: false,
    targetWidth,
    targetHeight,
    sample,
    quantize,
    alphaCutoff,
    ditherStrength,
    lockRatio: draft.lockRatio,
    note,
  };
}

export interface ParsedPresets {
  presets: PixelizePreset[];
  skipped: number;
}

/** User presets only. Invalid rows are skipped. More than {@link PRESET_USER_MAX} keeps the first ones. */
export function parseUserPresets(json: string): ParsedPresets {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('预设文件不是合法 JSON');
  }
  if (!value || typeof value !== 'object' || !('presets' in value)) {
    throw new Error('预设文件缺少 presets');
  }
  const list = (value as { presets: unknown }).presets;
  if (!Array.isArray(list)) throw new Error('预设文件缺少 presets');
  const presets: PixelizePreset[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of list) {
    const preset = readUserPreset(item, seen);
    if (!preset) {
      skipped++;
      continue;
    }
    if (presets.length >= PRESET_USER_MAX) {
      skipped++;
      continue;
    }
    seen.add(preset.id);
    presets.push(preset);
  }
  return { presets, skipped };
}

export function serializeUserPresets(presets: readonly PixelizePreset[]): string {
  return `${JSON.stringify(
    {
      presets: presets
        .filter((item) => !item.builtin)
        .map((item) => ({
          id: item.id,
          name: item.name,
          targetWidth: item.targetWidth,
          targetHeight: item.targetHeight,
          sample: item.sample,
          quantize: item.quantize,
          alphaCutoff: item.alphaCutoff,
          ditherStrength: item.ditherStrength,
          lockRatio: item.lockRatio,
          note: item.note,
        })),
    },
    null,
    2
  )}\n`;
}

/** Flat `*.grid.json` name. A repeated stem gets `-2`, `-3`, … */
export function gridFileName(sourceName: string, used: ReadonlySet<string>): string {
  const stem =
    sourceName
      .replace(/\.png$/i, '')
      .replace(/[\\/]/g, '')
      .trim() || 'image';
  const safe = [...stem].slice(0, 80).join('');
  let name = `${safe}.grid.json`;
  let n = 2;
  while (used.has(name)) {
    name = `${safe}-${n}.grid.json`;
    n++;
  }
  return name;
}

/** Cells that differ, or null when the grids are not the same size. */
export function gridCellDiff(a: PaletteGridFile, b: PaletteGridFile): number | null {
  if (a.width !== b.width || a.height !== b.height || a.cells.length !== b.cells.length)
    return null;
  let count = 0;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) count++;
  }
  return count;
}

function nextUserId(name: string, used: ReadonlySet<string>): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const base = slug.length > 0 ? slug : 'preset';
  let id = `user:${base}`;
  let n = 2;
  while (used.has(id) || !USER_ID.test(id)) {
    id = `user:${base}-${n}`;
    n++;
  }
  return id;
}

function readUserPreset(value: unknown, seen: ReadonlySet<string>): PixelizePreset | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !USER_ID.test(raw.id) || seen.has(raw.id)) return null;
  if (
    typeof raw.name !== 'string' ||
    raw.name.trim().length < 1 ||
    raw.name.trim().length > PRESET_NAME_MAX
  ) {
    return null;
  }
  if (!isTarget(raw.targetWidth) || !isTarget(raw.targetHeight)) return null;
  if (raw.sample !== 'nearest' && raw.sample !== 'box') return null;
  if (raw.quantize !== 'nearest' && raw.quantize !== 'dither') return null;
  if (!isAlpha(raw.alphaCutoff) || !isDither(raw.ditherStrength)) return null;
  if (typeof raw.lockRatio !== 'boolean') return null;
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, PRESET_NOTE_MAX) : '';
  return {
    id: raw.id,
    name: raw.name.trim(),
    builtin: false,
    targetWidth: raw.targetWidth,
    targetHeight: raw.targetHeight,
    sample: raw.sample,
    quantize: raw.quantize,
    alphaCutoff: raw.alphaCutoff,
    ditherStrength: raw.ditherStrength,
    lockRatio: raw.lockRatio,
    note,
  };
}

function isTarget(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PRESET_TARGET_MAX
  );
}

function isAlpha(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function isDither(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function checkName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1) throw new Error('预设名不能为空');
  if (trimmed.length > PRESET_NAME_MAX) throw new Error(`预设名最多 ${PRESET_NAME_MAX} 字`);
  return trimmed;
}

function checkNote(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length > PRESET_NOTE_MAX) throw new Error(`说明最多 ${PRESET_NOTE_MAX} 字`);
  return trimmed;
}

function checkInt(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > PRESET_TARGET_MAX) {
    throw new Error(`${label}需为 1–${PRESET_TARGET_MAX} 的整数`);
  }
  return value;
}

function checkAlpha(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 255)
    throw new Error('透明阈值需为 0–255 的整数');
  return value;
}

function checkDither(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('抖动强度需为 0 到 1');
  return value;
}

function checkSample(value: string): GridSample {
  if (value === 'nearest' || value === 'box') return value;
  throw new Error('取样无效');
}

function checkQuantize(value: string): GridQuantize {
  if (value === 'nearest' || value === 'dither') return value;
  throw new Error('量化无效');
}
