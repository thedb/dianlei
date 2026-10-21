/**
 * Canvas-drawn UI primitives for menus (pause, settings, title).
 * Chinese labels use the system CJK font until Fusion Pixel Font lands.
 */

import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const UI_FONT =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

export const UI_COLORS = {
  text: '#ffffff',
  dim: '#8a8aa0',
  accent: PALETTE[COLOR.PLAYER_CYAN],
  accentDark: PALETTE[COLOR.PLAYER_DARK_CYAN],
  panel: 'rgba(10, 12, 30, 0.92)',
  panelBorder: PALETTE[COLOR.PLAYER_MED_CYAN],
  rowSelected: 'rgba(0, 229, 255, 0.16)',
  danger: PALETTE[COLOR.ENEMY_BRIGHT_RED],
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export function hitRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left'
): void {
  ctx.font = `${size}px ${UI_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.textAlign = 'left';
}

export function drawScrim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = UI_COLORS.scrim;
  ctx.fillRect(0, 0, w, h);
}

/** Dim the attract playfield so the title and boot chrome stay readable. */
export function drawTitleScrim(ctx: CanvasRenderingContext2D): void {
  const fade = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  fade.addColorStop(0, 'rgba(4, 8, 18, 0.62)');
  fade.addColorStop(0.28, 'rgba(4, 8, 18, 0.28)');
  fade.addColorStop(0.5, 'rgba(4, 8, 18, 0.34)');
  fade.addColorStop(1, 'rgba(4, 8, 18, 0.66)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = 'rgba(4, 8, 18, 0.38)';
  ctx.fillRect(24, LOGICAL_H / 3 - 48, LOGICAL_W - 48, 150);
}

export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = UI_COLORS.panel;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = UI_COLORS.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  selected: boolean,
  color: string = UI_COLORS.text
): void {
  ctx.fillStyle = selected ? UI_COLORS.rowSelected : 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = selected ? UI_COLORS.accent : UI_COLORS.accentDark;
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, 16, color, 'center');
}

/** Index of the rect containing any tap this step, or -1 */
export function tappedIndex(rects: Rect[], taps: ReadonlyArray<{ x: number; y: number }>): number {
  for (const t of taps) {
    const i = rects.findIndex((r) => hitRect(r, t.x, t.y));
    if (i >= 0) return i;
  }
  return -1;
}
