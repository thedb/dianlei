/**
 * Pause menu (design doc §7): 继续游戏 / 游戏设置 / 退出 (+ 退出确认)
 */

import type { InputState, ControlsView } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import type { SettingsStore } from '@/game/settings';
import { createSettingsPanel } from './settingsPanel';
import {
  drawButton,
  drawPanel,
  drawScrim,
  drawText,
  tappedIndex,
  UI_COLORS,
  type Rect,
} from './widgets';

export type PauseView = 'closed' | 'menu' | 'confirmExit' | 'settings';
export type PauseAction = 'resume' | 'exit' | null;

export interface PauseMenu {
  open(): void;
  close(): void;
  isOpen(): boolean;
  getView(): PauseView;
  /** Drive the menu for one step; the caller must not run gameplay while open */
  update(input: InputState): PauseAction;
  render(
    ctx: CanvasRenderingContext2D,
    controls: ControlsView,
    info: { stage: number; score: number }
  ): void;
}

const MENU_ITEMS = ['继续游戏', '游戏设置', '退出'] as const;
const CONFIRM_ITEMS = ['确认退出', '取消'] as const;

const MENU_PANEL: Rect = { x: 50, y: 190, w: LOGICAL_W - 100, h: 250 };
const CONFIRM_PANEL: Rect = { x: 40, y: 230, w: LOGICAL_W - 80, h: 170 };

function menuButtons(): Rect[] {
  return MENU_ITEMS.map((_, i) => ({
    x: MENU_PANEL.x + 30,
    y: MENU_PANEL.y + 60 + i * 52,
    w: MENU_PANEL.w - 60,
    h: 40,
  }));
}

function confirmButtons(): Rect[] {
  const w = (CONFIRM_PANEL.w - 60) / 2;
  return CONFIRM_ITEMS.map((_, i) => ({
    x: CONFIRM_PANEL.x + 20 + i * (w + 20),
    y: CONFIRM_PANEL.y + 104,
    w,
    h: 40,
  }));
}

export function createPauseMenu(store: SettingsStore): PauseMenu {
  let view: PauseView = 'closed';
  let menuSel = 0;
  let confirmSel = 1;
  const settings = createSettingsPanel(store);

  function chooseMenu(i: number): PauseAction {
    if (i === 0) {
      view = 'closed';
      return 'resume';
    }
    if (i === 1) {
      view = 'settings';
      settings.open();
    } else {
      view = 'confirmExit';
      confirmSel = 1;
    }
    return null;
  }

  function chooseConfirm(i: number): PauseAction {
    if (i === 0) {
      view = 'closed';
      return 'exit';
    }
    view = 'menu';
    return null;
  }

  return {
    open(): void {
      view = 'menu';
      menuSel = 0;
    },
    close(): void {
      view = 'closed';
    },
    isOpen: () => view !== 'closed',
    getView: () => view,

    update(input: InputState): PauseAction {
      switch (view) {
        case 'closed':
          return null;

        case 'menu': {
          if (input.menuBack || input.pausePressed) {
            view = 'closed';
            return 'resume';
          }
          if (input.menuUp) menuSel = (menuSel + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
          if (input.menuDown) menuSel = (menuSel + 1) % MENU_ITEMS.length;
          const tapped = tappedIndex(menuButtons(), input.taps);
          if (tapped >= 0) return chooseMenu(tapped);
          if (input.menuConfirm) return chooseMenu(menuSel);
          return null;
        }

        case 'confirmExit': {
          if (input.menuBack) {
            view = 'menu';
            return null;
          }
          if (input.menuLeft || input.menuUp) confirmSel = 0;
          if (input.menuRight || input.menuDown) confirmSel = 1;
          const tapped = tappedIndex(confirmButtons(), input.taps);
          if (tapped >= 0) return chooseConfirm(tapped);
          if (input.menuConfirm) return chooseConfirm(confirmSel);
          return null;
        }

        case 'settings':
          if (settings.update(input) === 'close') view = 'menu';
          return null;
      }
    },

    render(ctx, controls, info): void {
      if (view === 'closed') return;
      if (view === 'settings') {
        settings.render(ctx, controls, '游戏设置');
        return;
      }

      drawScrim(ctx, LOGICAL_W, LOGICAL_H);

      if (view === 'menu') {
        drawPanel(ctx, MENU_PANEL);
        drawText(ctx, '暂停', LOGICAL_W / 2, MENU_PANEL.y + 30, 22, UI_COLORS.accent, 'center');
        menuButtons().forEach((r, i) => drawButton(ctx, r, MENU_ITEMS[i]!, i === menuSel));
        drawText(
          ctx,
          `第 ${info.stage} 关    分数 ${info.score}`,
          LOGICAL_W / 2,
          MENU_PANEL.y + MENU_PANEL.h - 22,
          13,
          UI_COLORS.dim,
          'center'
        );
        return;
      }

      drawPanel(ctx, CONFIRM_PANEL);
      drawText(
        ctx,
        '退出游戏？',
        LOGICAL_W / 2,
        CONFIRM_PANEL.y + 36,
        20,
        UI_COLORS.text,
        'center'
      );
      drawText(
        ctx,
        '退出后本局进度不保存',
        LOGICAL_W / 2,
        CONFIRM_PANEL.y + 70,
        14,
        UI_COLORS.dim,
        'center'
      );
      confirmButtons().forEach((r, i) =>
        drawButton(
          ctx,
          r,
          CONFIRM_ITEMS[i]!,
          i === confirmSel,
          i === 0 ? UI_COLORS.danger : UI_COLORS.text
        )
      );
    },
  };
}
