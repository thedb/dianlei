/**
 * Big touch-first 开始游戏 button, shared by boot and title so it sits in the
 * same place on both screens (a tap during the hand-off still lands on it).
 */

import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export const START_BUTTON: Rect = {
  x: LOGICAL_W / 2 - 110,
  y: Math.round(LOGICAL_H * 0.56),
  w: 220,
  h: 60,
};

/** Extra hit slack so slightly-off thumbs still start the game */
const START_SLACK = 12;

export function isStartTapped(taps: ReadonlyArray<{ x: number; y: number }>): boolean {
  const r = START_BUTTON;
  const padded: Rect = {
    x: r.x - START_SLACK,
    y: r.y - START_SLACK,
    w: r.w + START_SLACK * 2,
    h: r.h + START_SLACK * 2,
  };
  return taps.some((t) => hitRect(padded, t.x, t.y));
}

/** @param pulse 0..1 animation phase */
export function drawStartButton(
  ctx: CanvasRenderingContext2D,
  pulse: number,
  selected = true
): void {
  const r = START_BUTTON;
  const glow = 0.5 + 0.5 * Math.sin(pulse * Math.PI * 2);
  ctx.fillStyle = `rgba(0, 229, 255, ${0.14 + 0.12 * glow})`;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = selected ? UI_COLORS.accent : UI_COLORS.accentDark;
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  drawText(ctx, '开始游戏', r.x + r.w / 2, r.y + r.h / 2 - 6, 22, UI_COLORS.text, 'center');
  drawText(ctx, 'TAP TO START', r.x + r.w / 2, r.y + r.h / 2 + 16, 10, UI_COLORS.dim, 'center');
}
