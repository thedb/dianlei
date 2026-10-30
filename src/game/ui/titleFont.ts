/**
 * Title mark. Boot and the title screen share 「电雷计划」.
 * The face is Fusion Pixel (OFL), loaded in index.html / wx.loadFontFace.
 * Menu labels and the HUD stay on the system CJK stack in widgets.ts.
 */

import { PALETTE, COLOR } from '@/game/palette';

export const GAME_TITLE = '电雷计划';
export const GAME_TITLE_SUB = 'DIANLEI PLAN';

/** CSS family first, then the same Chinese fallbacks the rest of the UI uses. */
export const TITLE_FONT_STACK =
  '"Fusion Pixel Font", "Fusion Pixel", "PingFang SC", "Microsoft YaHei", sans-serif';

export const TITLE_LOGO_SIZE = 36;
export const TITLE_SUB_SIZE = 12;

export function drawGameTitle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = TITLE_LOGO_SIZE
): void {
  ctx.save();
  ctx.font = `${size}px ${TITLE_FONT_STACK}`;
  ctx.fillStyle = PALETTE[COLOR.PLAYER_CYAN];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = PALETTE[COLOR.PLAYER_CYAN];
  ctx.shadowBlur = 8;
  ctx.fillText(GAME_TITLE, Math.round(x), Math.round(y));
  ctx.restore();
}

export function drawGameSubtitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.font = `${TITLE_SUB_SIZE}px ${TITLE_FONT_STACK}`;
  ctx.fillStyle = PALETTE[COLOR.PLAYER_PALE_CYAN];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(GAME_TITLE_SUB, Math.round(x), Math.round(y));
  ctx.restore();
}
