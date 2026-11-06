/**
 * Palette use and aspect checks for the local pixel editor.
 * The game does not import this. It exists so an export that is almost all
 * one dark color, or a part squashed by its target size, does not pass quietly.
 */

import { PALETTE } from '@/game/palette';

/** Relative luminance below this counts as dark. Index 2 (`#2d2d44`) is about 0.18. */
export const GRID_DARK_LUMA = 0.2;
/** Warn when at least this share of opaque cells is dark. */
export const GRID_DARK_SHARE_WARN = 0.9;
/** Warn when one palette index covers at least this share of opaque cells. */
export const GRID_DOMINANT_SHARE_WARN = 0.9;
/** Warn when the target aspect differs from the source by more than this fraction. */
export const GRID_ASPECT_WARN = 0.1;

export type GridColorWarning = 'empty' | 'dark' | 'dominant';

export interface PaletteUse {
  index: number;
  count: number;
  /** Share of opaque cells, 0–1. */
  share: number;
}

export interface GridColorStats {
  opaque: number;
  transparent: number;
  distinct: number;
  /** Most used first. Ties keep the lower palette index first. */
  uses: PaletteUse[];
  /** Share of opaque cells whose color is below {@link GRID_DARK_LUMA}. */
  darkShare: number;
  warnings: GridColorWarning[];
}

export function paletteLuma(index: number): number {
  const hex = PALETTE[index];
  if (!hex) throw new Error(`palette index ${index} is out of range`);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function gridColorStats(cells: readonly number[]): GridColorStats {
  const counts = new Map<number, number>();
  let transparent = 0;
  for (const cell of cells) {
    if (cell < 0) {
      transparent++;
      continue;
    }
    counts.set(cell, (counts.get(cell) ?? 0) + 1);
  }
  const opaque = cells.length - transparent;
  const uses = [...counts.entries()]
    .map(([index, count]) => ({ index, count, share: opaque > 0 ? count / opaque : 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
  let dark = 0;
  for (const use of uses) {
    if (paletteLuma(use.index) < GRID_DARK_LUMA) dark += use.count;
  }
  const darkShare = opaque > 0 ? dark / opaque : 0;
  const warnings: GridColorWarning[] = [];
  if (opaque === 0) warnings.push('empty');
  if (opaque > 0 && darkShare >= GRID_DARK_SHARE_WARN) warnings.push('dark');
  const top = uses[0];
  if (top && top.share >= GRID_DOMINANT_SHARE_WARN && paletteLuma(top.index) >= GRID_DARK_LUMA) {
    warnings.push('dominant');
  }
  return { opaque, transparent, distinct: uses.length, uses, darkShare, warnings };
}

/**
 * Target aspect divided by source aspect. 1 keeps the shape. Above 1 the
 * target is wider than the source (squashed vertically).
 */
export function aspectSkew(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): number {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('aspect sizes must be positive');
  }
  return targetWidth / targetHeight / (sourceWidth / sourceHeight);
}

/** Symmetric: 1.2 wider and 1.2 taller both count. */
export function aspectIsSkewed(skew: number): boolean {
  return Math.abs(Math.log(skew)) > Math.log(1 + GRID_ASPECT_WARN);
}

/** Height that keeps the source aspect at this target width. At least 1. */
export function heightForWidth(sourceWidth: number, sourceHeight: number, width: number): number {
  return Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
}

/** Width that keeps the source aspect at this target height. At least 1. */
export function widthForHeight(sourceWidth: number, sourceHeight: number, height: number): number {
  return Math.max(1, Math.round((height * sourceWidth) / sourceHeight));
}
