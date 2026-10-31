/**
 * Boot scene — loading cover, then a click-to-enter gate.
 *
 * While `timer < BOOT_DURATION` the frame is the coast cover (full-bleed)
 * and a loading bar. The next `BOOT_READY_HOLD` seconds keep that full bar.
 * After both, the centered title mark and 「点击进入」 appear. A tap or
 * confirm before that does nothing. After that, either one enters the title.
 * There is no auto-advance.
 *
 * Gate: this is a pre-title loading state. It must not create, update, or
 * render the attract demo or any stage / battle background. The cover and
 * the title mark are shell bitmaps, not a map.
 */

import type { Scene, SceneContext } from './types';
import type { InputState } from '@/engine/input';
import type { Renderer } from '@/engine/renderer';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { drawGameTitle } from '@/game/ui/titleFont';
import {
  BOOT_MARK_CY,
  BOOT_MARK_MAX_W,
  drawBootCover,
  drawTitleMark,
  ensureShellArt,
} from '@/game/ui/shellArt';
import { drawText, UI_COLORS } from '@/game/ui/widgets';

/** Seconds the loading bar takes to fill. */
export const BOOT_DURATION = 1.5;

/** Extra seconds after the bar fills, before the enter prompt. */
export const BOOT_READY_HOLD = 2;

/** Tap / confirm is ignored until the clock reaches this. */
export const BOOT_READY_AT = BOOT_DURATION + BOOT_READY_HOLD;

/** Prompt shown once the gate is ready. */
export const BOOT_ENTER_LABEL = '点击进入';

/** One blink of the enter prompt, seconds. */
export const BOOT_PROMPT_PERIOD = 0.9;

const BAR_W = 200;
const BAR_H = 6;
const BAR_Y = LOGICAL_H - 48;
const PROMPT_Y = LOGICAL_H - 56;

export function createBootScene(ctx: SceneContext): Scene {
  let timer = 0;
  ensureShellArt();

  return {
    id: 'boot',

    enter(): void {
      timer = 0;
      ensureShellArt();
      ctx.input.setControlsEnabled(false);
    },

    exit(): void {
      timer = 0;
    },

    update(dt, input: InputState) {
      timer += dt;
      if (timer < BOOT_READY_AT) return null;
      if (input.menuConfirm || input.taps.length > 0) return 'title';
      return null;
    },

    render(renderer: Renderer, _alpha: number): void {
      renderer.clear('#000');
      const c = renderer.getContext();
      drawBootCover(c);

      if (timer < BOOT_READY_AT) {
        drawLoadingBar(c, Math.min(1, timer / BOOT_DURATION));
        return;
      }

      if (!drawTitleMark(c, LOGICAL_W / 2, BOOT_MARK_CY, BOOT_MARK_MAX_W)) {
        drawGameTitle(c, LOGICAL_W / 2, BOOT_MARK_CY);
      }
      drawEnterPrompt(c, timer);
    },
  };
}

function drawLoadingBar(ctx: CanvasRenderingContext2D, t: number): void {
  const x = LOGICAL_W / 2 - BAR_W / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - 10, BAR_Y - 8, BAR_W + 20, BAR_H + 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(x, BAR_Y, BAR_W, BAR_H);
  ctx.fillStyle = UI_COLORS.accent;
  ctx.fillRect(x, BAR_Y, BAR_W * t, BAR_H);
  ctx.restore();
}

function drawEnterPrompt(ctx: CanvasRenderingContext2D, timer: number): void {
  const phase = ((timer - BOOT_READY_AT) / BOOT_PROMPT_PERIOD) * Math.PI * 2;
  const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase));
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(LOGICAL_W / 2 - 88, PROMPT_Y - 16, 176, 32);
  ctx.globalAlpha = alpha;
  drawText(ctx, BOOT_ENTER_LABEL, LOGICAL_W / 2, PROMPT_Y, 18, '#ffffff', 'center');
  ctx.restore();
}
