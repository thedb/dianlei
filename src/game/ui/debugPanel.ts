/**
 * Modal debug panel drawn over the title scene.
 * The attract demo keeps updating behind it. This panel only reports actions;
 * the title scene writes settings and the battle entry.
 */

import type { InputState } from '@/engine/input';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import {
  drawButton,
  drawPanel,
  drawScrim,
  drawText,
  hitRect,
  UI_COLORS,
  type Rect,
} from './widgets';

export type DebugPanelAction =
  'close' | 'stage' | 'boss' | 'weaponTest' | 'mapPreview' | 'toggleDebug' | null;

const BUTTON_W = 220;
const BUTTON_H = 44;
const BUTTON_GAP = 12;
const BUTTON_TOP = 210;

export function debugPanelButton(index: number): Rect {
  return {
    x: LOGICAL_W / 2 - BUTTON_W / 2,
    y: BUTTON_TOP + index * (BUTTON_H + BUTTON_GAP),
    w: BUTTON_W,
    h: BUTTON_H,
  };
}

export const DEBUG_STAGE_BUTTON = debugPanelButton(0);
export const DEBUG_BOSS_BUTTON = debugPanelButton(1);
export const DEBUG_MODE_BUTTON = debugPanelButton(2);
export const DEBUG_WEAPON_BUTTON = debugPanelButton(3);
export const DEBUG_MAP_BUTTON = debugPanelButton(4);
export const DEBUG_CLOSE_BUTTON = debugPanelButton(5);

const PANEL: Rect = { x: 40, y: 148, w: LOGICAL_W - 80, h: 400 };
const BUTTONS = [
  DEBUG_STAGE_BUTTON,
  DEBUG_BOSS_BUTTON,
  DEBUG_MODE_BUTTON,
  DEBUG_WEAPON_BUTTON,
  DEBUG_MAP_BUTTON,
  DEBUG_CLOSE_BUTTON,
] as const;

function actionFor(index: number): DebugPanelAction {
  if (index === 0) return 'stage';
  if (index === 1) return 'boss';
  if (index === 2) return 'toggleDebug';
  if (index === 3) return 'weaponTest';
  if (index === 4) return 'mapPreview';
  return 'close';
}

export interface DebugPanel {
  open(): void;
  update(input: InputState): DebugPanelAction;
  render(ctx: CanvasRenderingContext2D, debugOn: boolean): void;
}

export function createDebugPanel(): DebugPanel {
  let selected = 0;

  return {
    open(): void {
      selected = 0;
    },

    update(input: InputState): DebugPanelAction {
      if (input.menuBack) return 'close';
      if (input.menuUp) selected = (selected + BUTTONS.length - 1) % BUTTONS.length;
      if (input.menuDown) selected = (selected + 1) % BUTTONS.length;

      for (let i = 0; i < BUTTONS.length; i++) {
        const rect = BUTTONS[i]!;
        if (input.taps.some((t) => hitRect(rect, t.x, t.y))) {
          selected = i;
          return actionFor(i);
        }
      }
      if (input.menuConfirm) return actionFor(selected);
      return null;
    },

    render(ctx: CanvasRenderingContext2D, debugOn: boolean): void {
      drawScrim(ctx, LOGICAL_W, LOGICAL_H);
      drawPanel(ctx, PANEL);
      drawText(ctx, '调试', LOGICAL_W / 2, PANEL.y + 28, 20, UI_COLORS.accent, 'center');
      const labels = [
        '关卡选择',
        '挑战 Boss',
        `调试模式 ${debugOn ? '开' : '关'}`,
        '武器测试',
        '地图预览',
        '关闭',
      ];
      BUTTONS.forEach((rect, i) => {
        drawButton(ctx, rect, labels[i]!, i === selected);
      });
    },
  };
}
