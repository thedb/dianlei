/**
 * Code-drawn weapon effects (design §3.5): the bomb shockwave ring and the
 * homing missile exhaust. Both are whole-pixel blocks in palette colors.
 */

import { PALETTE, COLOR } from '@/game/palette';
import { BOMB_WAVE_BAND } from '@/game/config';

/** Pixel block size of the shockwave ring */
const WAVE_BLOCK = 2;

/**
 * Shockwave ring of `radius` around (x, y). `fade` 1 → 0 over its life.
 * Bands from the outside in: white crest, pale cyan, cyan tail.
 */
export function drawBombShockwave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fade: number
): void {
  if (radius <= 0 || fade <= 0) return;
  const bands: ReadonlyArray<readonly [number, string, number]> = [
    [0, PALETTE[COLOR.WHITE], 1],
    [WAVE_BLOCK, PALETTE[COLOR.PLAYER_PALE_CYAN], 0.85],
    [WAVE_BLOCK * 2, PALETTE[COLOR.PLAYER_CYAN], 0.6],
  ];
  ctx.save();
  for (const [inset, color, alpha] of bands) {
    const r = radius - inset;
    if (r <= 0 || inset >= BOMB_WAVE_BAND) continue;
    ctx.globalAlpha = alpha * fade;
    ctx.fillStyle = color;
    const steps = Math.max(16, Math.ceil((Math.PI * 2 * r) / WAVE_BLOCK));
    let lastX = NaN;
    let lastY = NaN;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = Math.round((x + Math.cos(a) * r) / WAVE_BLOCK) * WAVE_BLOCK;
      const py = Math.round((y + Math.sin(a) * r) / WAVE_BLOCK) * WAVE_BLOCK;
      if (px === lastX && py === lastY) continue;
      lastX = px;
      lastY = py;
      ctx.fillRect(px, py, WAVE_BLOCK, WAVE_BLOCK);
    }
  }
  ctx.restore();
}

/**
 * Short exhaust behind a homing missile: one flickering flame pixel at the
 * nozzle and a fading orange trail through the recent positions.
 */
export function drawHomingExhaust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  trailX: readonly number[],
  trailY: readonly number[],
  head: number,
  count: number,
  time: number
): void {
  ctx.save();
  const n = trailX.length;
  for (let i = 0; i < count; i++) {
    const idx = (head - i + n) % n;
    const alpha = 0.7 * (1 - i / Math.max(1, count));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE[i === 0 ? COLOR.EXPLOSION_ORANGE_YELLOW : COLOR.EXPLOSION_ORANGE];
    ctx.fillRect(Math.round(trailX[idx]!) - 1, Math.round(trailY[idx]!) - 1, 2, 2);
  }
  const back = 5 + (Math.floor(time * 30) % 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
  ctx.fillRect(
    Math.round(x - Math.cos(angle) * back) - 1,
    Math.round(y - Math.sin(angle) * back) - 1,
    2,
    2
  );
  ctx.restore();
}
