/**
 * Title scene - main menu: 开始游戏 / 设置
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';
import { createSettingsPanel } from '@/game/ui/settingsPanel';
import { drawButton, drawText, tappedIndex, UI_COLORS, type Rect } from '@/game/ui/widgets';

const ITEMS = ['开始游戏', '设置'] as const;

function itemRects(): Rect[] {
  return ITEMS.map((_, i) => ({
    x: LOGICAL_W / 2 - 90,
    y: LOGICAL_H * 0.56 + i * 56,
    w: 180,
    h: 44,
  }));
}

export function createTitleScene(ctx: SceneContext): Scene {
  let selected = 0;
  let inSettings = false;
  let blinkTimer = 0;
  const settingsPanel = createSettingsPanel(ctx.settings);

  function choose(i: number): 'battle' | null {
    if (i === 0) return 'battle';
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
    },

    exit(): void {
      ctx.input.setControlsEnabled(true);
    },

    update(dt: number, input: InputState) {
      blinkTimer = (blinkTimer + dt) % 1;

      if (inSettings) {
        if (settingsPanel.update(input) === 'close') inSettings = false;
        return null;
      }

      if (input.menuUp) selected = (selected + ITEMS.length - 1) % ITEMS.length;
      if (input.menuDown) selected = (selected + 1) % ITEMS.length;

      const tapped = tappedIndex(itemRects(), input.taps);
      if (tapped >= 0) return choose(tapped);
      if (input.menuConfirm) return choose(selected);
      return null;
    },

    render(renderer: Renderer, _alpha: number): void {
      renderer.clear('#0a0a1a');
      const c = renderer.getContext();

      drawText(c, '电雷', LOGICAL_W / 2, LOGICAL_H / 3, 56, UI_COLORS.accent, 'center');
      drawText(c, 'DIANLEI', LOGICAL_W / 2, LOGICAL_H / 3 + 50, 14, UI_COLORS.dim, 'center');

      itemRects().forEach((r, i) => {
        const sel = i === selected;
        drawButton(c, r, ITEMS[i]!, sel, sel && blinkTimer > 0.5 ? UI_COLORS.accent : undefined);
      });

      drawText(
        c,
        '方向键/WASD 移动  Z/空格 射击  X 炸弹  Esc 暂停',
        LOGICAL_W / 2,
        LOGICAL_H - 60,
        11,
        '#666',
        'center'
      );
      drawText(c, 'P1.1', LOGICAL_W - 20, LOGICAL_H - 20, 10, '#444', 'right');

      if (inSettings) {
        settingsPanel.render(c, ctx.input.getControlsView(), '设置');
      }
    },
  };
}
