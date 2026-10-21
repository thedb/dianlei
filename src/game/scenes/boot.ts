/**
 * Boot scene - loading animation with a tappable 开始游戏 button.
 * Tapping starts stage 1 directly; otherwise it moves on to the title screen.
 * The same attract battle runs behind the chrome.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { drawText, drawTitleScrim, UI_COLORS } from '@/game/ui/widgets';
import { drawStartButton, isStartTapped } from '@/game/ui/startButton';
import { sharedTitleAttract } from './titleAttract';

/** Seconds before the boot screen hands off to the title screen */
export const BOOT_DURATION = 1.5;

export function createBootScene(ctx: SceneContext): Scene {
  let timer = 0;
  const attract = sharedTitleAttract();

  return {
    id: 'boot',

    enter(): void {
      timer = 0;
      ctx.input.setControlsEnabled(false);
      attract.start();
    },

    exit(): void {
      attract.stop();
    },

    update(dt: number, input: InputState) {
      if (!attract.isRunning()) attract.start();
      attract.update(dt);
      if (isStartTapped(input.taps) || input.menuConfirm) {
        ctx.battleEntry = 'stage';
        return 'battle';
      }
      timer += dt;
      if (timer >= BOOT_DURATION) {
        return 'title';
      }
      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      attract.render(renderer, alpha);
      const c = renderer.getContext();
      drawTitleScrim(c);

      drawText(c, '电雷', LOGICAL_W / 2, LOGICAL_H / 3, 56, UI_COLORS.accent, 'center');

      // Loading bar
      const barW = 160;
      const barX = LOGICAL_W / 2 - barW / 2;
      const barY = LOGICAL_H / 3 + 50;
      const t = Math.min(1, timer / BOOT_DURATION);
      c.fillStyle = 'rgba(255, 255, 255, 0.15)';
      c.fillRect(barX, barY, barW, 4);
      c.fillStyle = UI_COLORS.accent;
      c.fillRect(barX, barY, barW * t, 4);

      drawStartButton(c, timer);
    },
  };
}
