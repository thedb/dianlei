/**
 * Palette-index grid files (`*.grid.json`).
 *
 * This is the import the game will use for art that comes out of
 * `tools/pixel-editor/`. Reference PNGs are not stored in the file.
 * P0 is one rectangular grid. Stages, hitboxes, and pivots are P1.
 */

import { PALETTE } from '@/game/palette';
import type { SpriteData } from './types';

export const GRID_FORMAT = 'dianlei.palette-grid';
export const GRID_FORMAT_VERSION = 1;

/** Locked palette in `palette.ts`. Bump only when an index changes meaning. */
export const GRID_PALETTE_ID = 'dianlei';
export const GRID_PALETTE_VERSION = 1;

/** -1 is transparent. Every other cell is a palette index. */
export const GRID_TRANSPARENT = -1;

/** Largest grid the loader will accept on one side. */
export const GRID_MAX_SIDE = 1024;

/** Largest source image pixelize will read on one side. */
export const GRID_MAX_SOURCE_SIDE = 4096;

export const GRID_FILE_EXTENSION = '.grid.json';

export type GridSample = 'nearest' | 'box';
export type GridQuantize = 'nearest' | 'dither';

/**
 * Knobs that produced `cells`. The editor writes them back so the same PNG
 * and the same object pixelize to the same bytes.
 */
export interface GridPixelizeParams {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  sample: GridSample;
  quantize: GridQuantize;
  /** Alpha <= this (0–255) becomes transparent. */
  alphaCutoff: number;
  /**
   * Floyd–Steinberg mix, 0–1. Ignored unless `quantize` is `dither`.
   * 1 is the classic 7/16, 3/16, 5/16, 1/16 split.
   */
  ditherStrength: number;
}

export interface PaletteGridFile {
  format: typeof GRID_FORMAT;
  version: typeof GRID_FORMAT_VERSION;
  width: number;
  height: number;
  /** Row-major. Length is `width * height`. */
  cells: number[];
  palette: {
    id: typeof GRID_PALETTE_ID;
    version: typeof GRID_PALETTE_VERSION;
    size: number;
  };
  source: {
    /** File name only. Not a path, and not the PNG bytes. */
    name: string;
    params: GridPixelizeParams;
  };
}

const NAME_MAX = 128;

export function gridToSpriteData(grid: PaletteGridFile): SpriteData {
  const rows: SpriteData = [];
  for (let y = 0; y < grid.height; y++) {
    const start = y * grid.width;
    rows.push(grid.cells.slice(start, start + grid.width));
  }
  return rows;
}

/** Wrap an existing palette-index sprite. Params record an identity resample. */
export function spriteToGrid(data: SpriteData, sourceName: string): PaletteGridFile {
  const height = data.length;
  const width = data[0]?.length ?? 0;
  if (width < 1 || height < 1) throw new Error('sprite is empty');
  if (width > GRID_MAX_SIDE || height > GRID_MAX_SIDE) throw new Error('sprite is too large');
  const cells: number[] = [];
  for (const row of data) {
    if (row.length !== width) throw new Error('sprite is not rectangular');
    for (const cell of row) {
      if (!isCell(cell)) throw new Error('sprite cell is not a palette index');
      cells.push(cell);
    }
  }
  return buildGrid(width, height, cells, {
    name: sourceName,
    params: {
      sourceWidth: width,
      sourceHeight: height,
      targetWidth: width,
      targetHeight: height,
      sample: 'nearest',
      quantize: 'nearest',
      alphaCutoff: 0,
      ditherStrength: 0,
    },
  });
}

export function serializePaletteGrid(grid: PaletteGridFile): string {
  const checked = parsePaletteGrid(JSON.stringify(shapeGrid(grid)));
  return `${JSON.stringify(shapeGrid(checked), null, 2)}\n`;
}

export function parsePaletteGrid(json: string): PaletteGridFile {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('grid json is not valid JSON');
  }
  const root = asObject(value, 'grid');
  if (root.format !== GRID_FORMAT) throw new Error('grid format is not dianlei.palette-grid');
  if (root.version !== GRID_FORMAT_VERSION) throw new Error('grid version is not supported');
  const width = asInt(root.width, 'width', 1, GRID_MAX_SIDE);
  const height = asInt(root.height, 'height', 1, GRID_MAX_SIDE);
  const palette = asObject(root.palette, 'palette');
  if (palette.id !== GRID_PALETTE_ID) throw new Error('grid palette id is not dianlei');
  if (palette.version !== GRID_PALETTE_VERSION)
    throw new Error('grid palette version is not supported');
  if (palette.size !== PALETTE.length) throw new Error('grid palette size does not match the game');
  const source = asObject(root.source, 'source');
  const paramsRaw = asObject(source.params, 'source.params');
  const params: GridPixelizeParams = {
    sourceWidth: asInt(paramsRaw.sourceWidth, 'sourceWidth', 1, GRID_MAX_SOURCE_SIDE),
    sourceHeight: asInt(paramsRaw.sourceHeight, 'sourceHeight', 1, GRID_MAX_SOURCE_SIDE),
    targetWidth: asInt(paramsRaw.targetWidth, 'targetWidth', 1, GRID_MAX_SIDE),
    targetHeight: asInt(paramsRaw.targetHeight, 'targetHeight', 1, GRID_MAX_SIDE),
    sample: asSample(paramsRaw.sample),
    quantize: asQuantize(paramsRaw.quantize),
    alphaCutoff: asInt(paramsRaw.alphaCutoff, 'alphaCutoff', 0, 255),
    ditherStrength: asUnit(paramsRaw.ditherStrength, 'ditherStrength'),
  };
  if (params.targetWidth !== width || params.targetHeight !== height) {
    throw new Error('target size must match the grid');
  }
  if (typeof source.name !== 'string') throw new Error('grid source name must be a string');
  const cells = asCells(root.cells, width, height);
  return buildGrid(width, height, cells, { name: source.name, params });
}

export function buildGrid(
  width: number,
  height: number,
  cells: readonly number[],
  source: PaletteGridFile['source']
): PaletteGridFile {
  assertSourceName(source.name);
  assertParams(width, height, source.params);
  if (cells.length !== width * height) throw new Error('cells length must equal width * height');
  return {
    format: GRID_FORMAT,
    version: GRID_FORMAT_VERSION,
    width,
    height,
    cells: [...cells],
    palette: {
      id: GRID_PALETTE_ID,
      version: GRID_PALETTE_VERSION,
      size: PALETTE.length,
    },
    source: {
      name: source.name,
      params: { ...source.params },
    },
  };
}

function shapeGrid(grid: PaletteGridFile): PaletteGridFile {
  return {
    format: grid.format,
    version: grid.version,
    width: grid.width,
    height: grid.height,
    palette: {
      id: grid.palette.id,
      version: grid.palette.version,
      size: grid.palette.size,
    },
    source: {
      name: grid.source.name,
      params: {
        sourceWidth: grid.source.params.sourceWidth,
        sourceHeight: grid.source.params.sourceHeight,
        targetWidth: grid.source.params.targetWidth,
        targetHeight: grid.source.params.targetHeight,
        sample: grid.source.params.sample,
        quantize: grid.source.params.quantize,
        alphaCutoff: grid.source.params.alphaCutoff,
        ditherStrength: grid.source.params.ditherStrength,
      },
    },
    cells: grid.cells,
  };
}

function asCells(value: unknown, width: number, height: number): number[] {
  if (!Array.isArray(value) || value.length !== width * height) {
    throw new Error('cells length must equal width * height');
  }
  const cells: number[] = [];
  for (const cell of value) {
    if (typeof cell !== 'number' || !isCell(cell)) {
      throw new Error('cells must be palette indices or -1');
    }
    cells.push(cell);
  }
  return cells;
}

function isCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= GRID_TRANSPARENT && cell < PALETTE.length;
}

function assertSourceName(name: string): void {
  if (name.length < 1 || name.length > NAME_MAX) {
    throw new Error('grid source name is empty or too long');
  }
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error('grid source name must be a file name, not a path');
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asInt(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function asUnit(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a number from 0 to 1`);
  }
  return value;
}

function assertParams(width: number, height: number, params: GridPixelizeParams): void {
  asInt(params.sourceWidth, 'sourceWidth', 1, GRID_MAX_SOURCE_SIDE);
  asInt(params.sourceHeight, 'sourceHeight', 1, GRID_MAX_SOURCE_SIDE);
  if (params.targetWidth !== width || params.targetHeight !== height) {
    throw new Error('target size must match the grid');
  }
  asSample(params.sample);
  asQuantize(params.quantize);
  asInt(params.alphaCutoff, 'alphaCutoff', 0, 255);
  asUnit(params.ditherStrength, 'ditherStrength');
}

function asSample(value: unknown): GridSample {
  if (value === 'nearest' || value === 'box') return value;
  throw new Error('sample must be nearest or box');
}

function asQuantize(value: unknown): GridQuantize {
  if (value === 'nearest' || value === 'dither') return value;
  throw new Error('quantize must be nearest or dither');
}
