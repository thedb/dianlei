/**
 * Code-drawn gun barrels for tanks, turrets, and roof guns. Drawn over the
 * sprite at the pivot and rotated to the unit's aim angle (0 = facing +x).
 */

import { PALETTE, COLOR } from '@/game/palette';

export function drawGunBarrel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  twin: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (twin) {
    ctx.fillStyle = PALETTE[COLOR.BLACK];
    ctx.fillRect(2, -6, 16, 4);
    ctx.fillRect(2, 2, 16, 4);
    ctx.fillStyle = PALETTE[COLOR.DARK_GRAY];
    ctx.fillRect(3, -5, 13, 2);
    ctx.fillRect(3, 3, 13, 2);
    ctx.fillStyle = PALETTE[COLOR.MEDIUM_GRAY];
    ctx.fillRect(14, -6, 3, 4);
    ctx.fillRect(14, 2, 3, 4);
  } else {
    ctx.fillStyle = PALETTE[COLOR.BLACK];
    ctx.fillRect(2, -2, 14, 4);
    ctx.fillStyle = PALETTE[COLOR.GROUND_DARK_OLIVE];
    ctx.fillRect(3, -1, 11, 2);
    ctx.fillStyle = PALETTE[COLOR.GROUND_TAN];
    ctx.fillRect(13, -2, 3, 4);
  }
  ctx.restore();
}
