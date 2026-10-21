/**
 * Title scene - main menu: 开始游戏 / 设置
 * The live stage demo starts here, in enter, once this scene is current.
 * Boot and any earlier loading frame do not create it.
 * A hidden top-right hot zone opens the debug panel; the demo keeps running.
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { readHighScore } from '@/game/highScore';
import { createDebugHotZone } from '@/game/ui/debugHotZone';
import { createDebugPanel } from '@/game/ui/debugPanel';
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

const ITEM_COUNT = 2;
const MENU_W = 180;
const MENU_H = 44;
/** Wider than the start button's touch slack so the two hits do not overlap. */
const MENU_GAP = 16;

export const SETTINGS_BUTTON: Rect = {
  x: LOGICAL_W / 2 - MENU_W / 2,
  y: START_BUTTON.y + START_BUTTON.h + MENU_GAP,
  w: MENU_W,
  h: MENU_H,
};

export function createTitleScene(ctx: SceneContext, injected?: TitleAttract): Scene {
  let selected = 0;
  let inSettings = false;
  let inDebug = false;
  let blinkTimer = 0;
  // Shared demo is created in enter. An injected demo stays stopped until then.
  let attract: TitleAttract | null = injected ?? null;
  const settingsPanel = createSettingsPanel(ctx.settings);
  const debugPanel = createDebugPanel();
  const hotZone = createDebugHotZone();

  function demo(): TitleAttract {
    if (!attract) attract = sharedTitleAttract();
    return attract;
  }

  function startGame(): 'battle' {
    ctx.playMode = 'play';
    ctx.battleEntry = 'stage';
    return 'battle';
  }

  function openSettings(): null {
    inSettings = true;
    settingsPanel.open();
    return null;
  }

  return {
    id: 'title',

    enter(): void {
      selected = 0;
      inSettings = false;
      inDebug = false;
      blinkTimer = 0;
      hotZone.reset();
      ctx.input.setControlsEnabled(false);
      demo().start();
    },

    exit(): void {
      attract?.stop();
      ctx.input.setControlsEnabled(true);
    },

    update(dt: number, input: InputState) {
      blinkTimer = (blinkTimer + dt) % 1;
      const live = demo();
      if (!live.isRunning()) live.start();
      live.update(dt);

      if (inSettings) {
        if (settingsPanel.update(input) === 'close') inSettings = false;
        return null;
      }

      if (inDebug) {
        const action = debugPanel.update(input);
        if (action === 'close') inDebug = false;
        else if (action === 'toggleDebug') {
          ctx.settings.update({ debugMode: !ctx.settings.get().debugMode });
        } else if (action === 'boss') {
          ctx.playMode = 'play';
          ctx.battleEntry = 'boss';
          return 'battle';
        } else if (action === 'weaponTest') {
          ctx.playMode = 'weaponTest';
          ctx.battleEntry = 'stage';
          return 'battle';
        }
        return null;
      }

      hotZone.advance(dt);
      for (const tap of input.taps) {
        if (hotZone.tap(tap.x, tap.y)) {
          inDebug = true;
          debugPanel.open();
          return null;
        }
      }

      if (input.menuUp) selected = (selected + ITEM_COUNT - 1) % ITEM_COUNT;
      if (input.menuDown) selected = (selected + 1) % ITEM_COUNT;

      if (isStartTapped(input.taps)) return startGame();
      if (input.taps.some((t) => hitRect(SETTINGS_BUTTON, t.x, t.y))) return openSettings();
      if (input.menuConfirm) return selected === 0 ? startGame() : openSettings();
      return null;
    },

    render(renderer: Renderer, alpha: number): void {
      if (attract?.isRunning()) attract.render(renderer, alpha);
      else renderer.clear('#000');
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
      drawButton(c, SETTINGS_BUTTON, '设置', selected === 1);

      drawText(
        c,
        '方向键/WASD 移动  Z/空格 射击  X 炸弹  Esc 暂停',
        LOGICAL_W / 2,
        LOGICAL_H - 60,
        11,
        '#666',
        'center'
      );
      drawText(c, 'P5', LOGICAL_W - 20, LOGICAL_H - 20, 10, '#444', 'right');

      if (inSettings) {
        settingsPanel.render(c, ctx.input.getControlsView(), '设置');
      } else if (inDebug) {
        debugPanel.render(c, ctx.settings.get().debugMode);
      }
    },
  };
}
