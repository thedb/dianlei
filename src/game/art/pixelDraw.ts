/**
 * Tiny palette-index raster helpers for code-drawn sprites and tiles.
 * Every painted cell is a palette index; -1 stays transparent.
 */

import type { SpriteData } from './types';

export function createGrid(width: number, height: number, fill = -1): SpriteData {
  const rows: SpriteData = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) row.push(fill);
    rows.push(row);
  }
  return rows;
}

export function inGrid(grid: SpriteData, x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < (grid[0]?.length ?? 0);
}

export function plot(grid: SpriteData, x: number, y: number, color: number): void {
  if (!inGrid(grid, x, y) || color < 0) return;
  grid[y]![x] = color;
}

export function fillRect(
  grid: SpriteData,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number
): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) plot(grid, xx, yy, color);
  }
}

export function fillEllipse(
  grid: SpriteData,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: number
): void {
  if (rx <= 0 || ry <= 0) return;
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) plot(grid, x, y, color);
    }
  }
}

/** Convex or simple polygon fill. Horizontal edges are skipped. */
export function fillPoly(
  grid: SpriteData,
  pts: ReadonlyArray<readonly [number, number]>,
  color: number
): void {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const yStart = Math.floor(minY);
  const yEnd = Math.ceil(maxY);
  for (let y = yStart; y <= yEnd; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % pts.length]!;
      const crosses = (y1 <= y && y2 > y) || (y2 <= y && y1 > y);
      if (!crosses || y2 === y1) continue;
      const t = (y - y1) / (y2 - y1);
      xs.push(x1 + t * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const left = Math.ceil(xs[i]!);
      const right = Math.floor(xs[i + 1]!);
      for (let x = left; x <= right; x++) plot(grid, x, y, color);
    }
  }
}

/** One-pixel 4-connected outline painted only into transparent cells. */
export function outline(grid: SpriteData, color: number): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const marks: Array<[number, number]> = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y]![x]! >= 0) continue;
      let touch = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (grid[ny]![nx]! >= 0) {
          touch = true;
          break;
        }
      }
      if (touch) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) grid[y]![x] = color;
}

export function opaqueCount(grid: SpriteData): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) if (cell >= 0) n++;
  }
  return n;
}
