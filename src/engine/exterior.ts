/**
 * Static letterbox exterior. Drawn behind the 360×640 playfield canvas.
 * It is not gameplay: no input, no scrolling, no RNG from the scene.
 */

import { COLOR, PALETTE } from '@/game/palette';

/** Deep ocean from the locked palette. The page background uses this same hex. */
export const EXTERIOR_VOID = PALETTE[COLOR.WATER_DEEP];

/** One star attempt per cell. Sparse on purpose. */
const CELL = 48;

export const EXTERIOR_STAR_COLORS = [
  PALETTE[COLOR.PALE_GRAY],
  PALETTE[COLOR.LIGHT_GRAY],
  PALETTE[COLOR.GRAY],
  PALETTE[COLOR.WHITE],
  PALETTE[COLOR.PLAYER_PALE_CYAN],
  PALETTE[COLOR.PLAYER_BLUE],
] as const;

const STAR_WHITE: string = EXTERIOR_STAR_COLORS[3];
const VIGNETTE_EDGE = 'rgba(0, 0, 0, 0.4)';
const VIGNETTE_CLEAR = 'rgba(0, 0, 0, 0)';

export interface ExteriorStar {
  x: number;
  y: number;
  size: number;
  color: string;
}

function hashCell(x: number, y: number): number {
  let n = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function starColor(h: number): string {
  const roll = h >>> 16;
  if ((roll & 31) === 0) return EXTERIOR_STAR_COLORS[3];
  if ((roll & 15) === 0) return EXTERIOR_STAR_COLORS[4];
  if ((roll & 7) === 0) return EXTERIOR_STAR_COLORS[5];
  const dim = roll % 3;
  return EXTERIOR_STAR_COLORS[dim] ?? EXTERIOR_STAR_COLORS[0];
}

/** Deterministic 1px (rare 2px) stars in CSS pixels. Stable across resizes. */
export function exteriorStars(width: number, height: number): ExteriorStar[] {
  if (!(width > 0) || !(height > 0)) return [];
  const stars: ExteriorStar[] = [];
  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const h = hashCell(cx, cy);
      if ((h & 3) !== 0) continue;
      const x = cx * CELL + (h % CELL);
      const y = cy * CELL + ((h >>> 8) % CELL);
      if (x >= width || y >= height) continue;
      const color = starColor(h);
      const size = color === STAR_WHITE && x + 1 < width && y + 1 < height ? 2 : 1;
      if (x + size > width || y + size > height) continue;
      stars.push({ x, y, size, color });
    }
  }
  return stars;
}

function paintVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const band = Math.max(24, Math.min(Math.round(height * 0.22), Math.round(height / 2)));
  const top = ctx.createLinearGradient(0, 0, 0, band);
  top.addColorStop(0, VIGNETTE_EDGE);
  top.addColorStop(1, VIGNETTE_CLEAR);
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, band);

  const bottom = ctx.createLinearGradient(0, height, 0, height - band);
  bottom.addColorStop(0, VIGNETTE_EDGE);
  bottom.addColorStop(1, VIGNETTE_CLEAR);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, height - band, width, band);
}

/**
 * Fill a viewport-sized context. Caller sets the DPR transform and
 * `imageSmoothingEnabled = false`. Coordinates are CSS pixels.
 */
export function paintExterior(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  if (!(width > 0) || !(height > 0)) return;
  ctx.fillStyle = EXTERIOR_VOID;
  ctx.fillRect(0, 0, width, height);
  for (const star of exteriorStars(width, height)) {
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  paintVignette(ctx, width, height);
}
