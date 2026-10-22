/**
 * Boot scene — loading. The frame is the game name and a loading bar.
 * There is no start button and no difficulty overlay; taps and confirm do
 * nothing. When the timer elapses, the title scene takes over (start button
 * and the attract demo begin there, not here).
 *
 * Gate: this is a pre-title loading state. It must not create, update, or
 * render the attract demo or any stage / battle background. The frame is a
 * black clear plus this chrome.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { drawText, UI_COLORS } from '@/game/ui/widgets';

/** Seconds before the boot screen hands off to the title screen */
export const BOOT_DURATION = 1.5;

export function createBootScene(ctx: SceneContext): Scene {
  let timer = 0;

  return {
    id: 'boot',

    enter(): void {
      timer = 0;
      ctx.input.setControlsEnabled(false);
    },

    exit(): void {
      timer = 0;
    },

    update(dt, _input) {
      timer += dt;
      if (timer >= BOOT_DURATION) return 'title';
      return null;
    },

    render(renderer: Renderer, _alpha: number): void {
      renderer.clear('#000');
      const c = renderer.getContext();

      drawText(c, '电雷', LOGICAL_W / 2, LOGICAL_H / 3, 56, UI_COLORS.accent, 'center');

      const barW = 160;
      const barX = LOGICAL_W / 2 - barW / 2;
      const barY = LOGICAL_H / 3 + 50;
      const t = Math.min(1, timer / BOOT_DURATION);
      c.fillStyle = 'rgba(255, 255, 255, 0.15)';
      c.fillRect(barX, barY, barW, 4);
      c.fillStyle = UI_COLORS.accent;
      c.fillRect(barX, barY, barW * t, 4);
    },
  };
}
