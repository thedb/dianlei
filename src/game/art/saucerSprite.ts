/**
 * 巨碟 and the beam. Not a boss, not a weapon, not in `BOSS_ART` or
 * `FIRE_PRESETS`. Cold metal: gray 3–5, pale gray 6, white 7, pale cyan 9
 * as a rim accent. No player cyan 10–13. No explosion yellow 40–43.
 */

import { OBSIDIAN_BEAM_WIDTH, OBSIDIAN_SAUCER_DIAMETER } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import { createGrid, plot } from './pixelDraw';
import { renderSprite } from './spriteRenderer';
import type { SpriteData, SpriteFrame } from './types';

export const SAUCER_BEAM_EDGE = COLOR.PLAYER_PALE_CYAN;
export const SAUCER_BEAM_CORE = COLOR.WHITE;

/** Disc raster. Diameter is the locked 208. */
export function buildSaucerDisc(): SpriteData {
  const size = OBSIDIAN_SAUCER_DIAMETER;
  const g = createGrid(size, size, -1);
  const c = size / 2;
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > r - 0.5) continue;
      let color: number = COLOR.GRAY;
      if (d > r - 6) color = COLOR.LIGHT_GRAY;
      else if (d > r - 12) color = COLOR.PALE_GRAY;
      else if (d < 6) color = COLOR.WHITE;
      else if (d < 12) color = COLOR.PLAYER_PALE_CYAN;
      else if (Math.floor(d / 14) % 2 === 0) color = COLOR.MEDIUM_GRAY;
      plot(g, x, y, color);
    }
  }
  return g;
}

let baked: SpriteFrame | null = null;

export function saucerFrame(): SpriteFrame {
  if (!baked) baked = renderSprite(buildSaucerDisc());
  return baked;
}

/** Vertical bar from the disc heart to the hull heart. Code-drawn, not a laser. */
export function drawSaucerBeam(
  ctx: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number
): void {
  const top = Math.min(y0, y1);
  const height = Math.abs(y1 - y0);
  const width = OBSIDIAN_BEAM_WIDTH;
  const edge = 3;
  const left = Math.round(x - width / 2);
  ctx.fillStyle = PALETTE[SAUCER_BEAM_EDGE];
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = PALETTE[SAUCER_BEAM_CORE];
  ctx.fillRect(left + edge, top, width - edge * 2, height);
}

/** Brighter heart for the 0.25s before the beam. Still not a weapon. */
export function drawSaucerCharge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const left = Math.round(x) - 8;
  const top = Math.round(y) - 8;
  ctx.fillStyle = PALETTE[SAUCER_BEAM_EDGE];
  ctx.fillRect(left, top, 16, 16);
  ctx.fillStyle = PALETTE[SAUCER_BEAM_CORE];
  ctx.fillRect(left + 4, top + 4, 8, 8);
}
