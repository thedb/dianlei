/**
 * Boot scene - loading animation with a tappable 开始游戏 button.
 * Tapping opens the same difficulty overlay as the title, then starts the stage.
 * Waiting out the timer still moves on to the title screen.
 *
 * Gate: this is a pre-title loading state. It must not create, update, or
 * render the attract demo or any stage / battle background. The frame is a
 * black clear plus this chrome. The attract starts in title.enter, only after
 * boot has finished and the title scene is current. Returning to the title
 * uses that same enter; nothing here keeps a battle running underneath.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { drawText, drawTitleScrim, UI_COLORS } from '@/game/ui/widgets';
import { drawStartButton, isStartTapped } from '@/game/ui/startButton';
import { createDifficultySelect } from '@/game/ui/difficultySelect';

/** Seconds before the boot screen hands off to the title screen */
export const BOOT_DURATION = 1.5;

export function createBootScene(ctx: SceneContext): Scene {
  let timer = 0;
  let inDifficulty = false;
  const difficultySelect = createDifficultySelect();

  return {
    id: 'boot',

    enter(): void {
      timer = 0;
      inDifficulty = false;
      ctx.input.setControlsEnabled(false);
    },

    exit(): void {
      timer = 0;
    },

    update(dt: number, input: InputState) {
      if (inDifficulty) {
        const choice = difficultySelect.update(input);
        if (choice === 'back') {
          inDifficulty = false;
          return null;
        }
        if (choice) {
          ctx.difficulty = choice;
          ctx.playMode = 'play';
          ctx.battleEntry = 'stage';
          delete ctx.challengeStage;
          return 'battle';
        }
        return null;
      }
      if (isStartTapped(input.taps) || input.menuConfirm) {
        inDifficulty = true;
        difficultySelect.open();
        return null;
      }
      timer += dt;
      if (timer >= BOOT_DURATION) {
        return 'title';
      }
      return null;
    },

    render(renderer: Renderer): void {
      renderer.clear('#000');
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
      if (inDifficulty) difficultySelect.render(c);
    },
  };
}
