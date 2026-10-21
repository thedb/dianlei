/**
 * Title scene - main menu: 开始游戏 / 挑战 Boss / 设置
 * The live stage demo runs behind the chrome.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { readHighScore } from '@/game/highScore';
import { createSettingsPanel } from '@/game/ui/settingsPanel';
import {
  drawButton,
  drawText,
  drawTitleScrim,
  hitRect,
  UI_COLORS,
  type Rect,
} from '@/game/ui/widgets';
import { START_BUTTON, drawStartButton, isStartTapped } from '@/game/ui/startButton';
import { sharedTitleAttract, type TitleAttract } from './titleAttract';

const ITEM_COUNT = 3;
const MENU_W = 180;
const MENU_H = 44;
/** Wider than the start button's touch slack so the two hits do not overlap. */
const MENU_GAP = 16;

export const BOSS_BUTTON: Rect = {
  x: LOGICAL_W / 2 - MENU_W / 2,
  y: START_BUTTON.y + START_BUTTON.h + MENU_GAP,
  w: MENU_W,
  h: MENU_H,
};

export const SETTINGS_BUTTON: Rect = {
  x: LOGICAL_W / 2 - MENU_W / 2,
  y: BOSS_BUTTON.y + BOSS_BUTTON.h + MENU_GAP,
  w: MENU_W,
  h: MENU_H,
};

export function createTitleScene(
  ctx: SceneContext,
  attract: TitleAttract = sharedTitleAttract()
): Scene {
  let selected = 0;
  let inSettings = false;
  let blinkTimer = 0;
  const settingsPanel = createSettingsPanel(ctx.settings);

  function choose(i: number): 'battle' | null {
    if (i === 0) {
      ctx.battleEntry = 'stage';
      return 'battle';
    }
    if (i === 1) {
      ctx.battleEntry = 'boss';
      return 'battle';
    }
    inSettings = true;
    settingsPanel.open();
    return null;
  }

  return {
    id: 'title',

    enter(): void {
      selected = 0;
      inSettings = false;
      blinkTimer = 0;
      ctx.input.setControlsEnabled(false);
      attract.start();
    },

    exit(): void {
      attract.stop();
      ctx.input.setControlsEnabled(true);
    },

    update(dt: number, input: InputState) {
      blinkTimer = (blinkTimer + dt) % 1;
      if (!attract.isRunning()) attract.start();
      attract.update(dt);

      if (inSettings) {
        if (settingsPanel.update(input) === 'close') inSettings = false;
        return null;
      }

      if (input.menuUp) selected = (selected + ITEM_COUNT - 1) % ITEM_COUNT;
      if (input.menuDown) selected = (selected + 1) % ITEM_COUNT;

      if (isStartTapped(input.taps)) return choose(0);
      if (input.taps.some((t) => hitRect(BOSS_BUTTON, t.x, t.y))) return choose(1);
      if (input.taps.some((t) => hitRect(SETTINGS_BUTTON, t.x, t.y))) return choose(2);
      if (input.menuConfirm) return choose(selected);
      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      attract.render(renderer, alpha);
      const c = renderer.getContext();
      drawTitleScrim(c);

      drawText(c, '电雷', LOGICAL_W / 2, LOGICAL_H / 3, 56, UI_COLORS.accent, 'center');
      drawText(c, 'DIANLEI', LOGICAL_W / 2, LOGICAL_H / 3 + 50, 14, UI_COLORS.dim, 'center');
      const best = readHighScore(ctx.storage);
      drawText(
        c,
        `最高分 ${best.toString().padStart(8, '0')}`,
        LOGICAL_W / 2,
        LOGICAL_H / 3 + 78,
        14,
        UI_COLORS.dim,
        'center'
      );

      drawStartButton(c, blinkTimer, selected === 0);
      drawButton(c, BOSS_BUTTON, '挑战 Boss', selected === 1);
      drawButton(c, SETTINGS_BUTTON, '设置', selected === 2);

      drawText(
        c,
        ctx.showDebug
          ? '方向键移动  Z射击  X炸弹  Esc暂停  F2预警  F3 BOSS'
          : '方向键/WASD 移动  Z/空格 射击  X 炸弹  Esc 暂停',
        LOGICAL_W / 2,
        LOGICAL_H - 60,
        11,
        '#666',
        'center'
      );
      drawText(c, 'P5', LOGICAL_W - 20, LOGICAL_H - 20, 10, '#444', 'right');

      if (inSettings) {
        settingsPanel.render(c, ctx.input.getControlsView(), '设置');
      }
    },
  };
}
