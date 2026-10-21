/**
 * Difficulty overlay drawn over the title (and the boot start path).
 * Canvas widgets only. The caller writes `SceneContext.difficulty` and decides
 * whether the attract demo keeps stepping.
 */

import type { InputState } from '@/engine/input';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import type { Difficulty } from '@/game/difficulty';
import { drawPanel, drawScrim, drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export type DifficultyAction = Difficulty | 'back' | null;

const BUTTON_W = 248;
const BUTTON_H = 58;
const BUTTON_GAP = 12;
const BUTTON_TOP = 196;

export function difficultyButton(index: number): Rect {
  return {
    x: LOGICAL_W / 2 - BUTTON_W / 2,
    y: BUTTON_TOP + index * (BUTTON_H + BUTTON_GAP),
    w: BUTTON_W,
    h: BUTTON_H,
  };
}

export const DIFFICULTY_EASY_BUTTON = difficultyButton(0);
export const DIFFICULTY_MEDIUM_BUTTON = difficultyButton(1);
export const DIFFICULTY_HARD_BUTTON = difficultyButton(2);
export const DIFFICULTY_BACK_BUTTON = difficultyButton(3);

const PANEL: Rect = { x: 28, y: 132, w: LOGICAL_W - 56, h: 400 };

const ROWS: ReadonlyArray<{ action: Difficulty | 'back'; title: string; sub: string }> = [
  { action: 'easy', title: '简单', sub: '当前平衡' },
  { action: 'medium', title: '中等', sub: '敌方生命 +15%' },
  { action: 'hard', title: '困难', sub: '生命 +30%，BOSS 三阶段' },
  { action: 'back', title: '返回', sub: '' },
];

export interface DifficultySelect {
  open(): void;
  update(input: InputState): DifficultyAction;
  render(ctx: CanvasRenderingContext2D): void;
}

export function createDifficultySelect(): DifficultySelect {
  let selected = 0;

  return {
    open(): void {
      selected = 0;
    },

    update(input: InputState): DifficultyAction {
      if (input.menuBack) return 'back';
      if (input.menuUp) selected = (selected + ROWS.length - 1) % ROWS.length;
      if (input.menuDown) selected = (selected + 1) % ROWS.length;

      for (let i = 0; i < ROWS.length; i++) {
        const rect = difficultyButton(i);
        if (input.taps.some((t) => hitRect(rect, t.x, t.y))) {
          selected = i;
          return ROWS[i]!.action;
        }
      }
      if (input.menuConfirm) return ROWS[selected]!.action;
      return null;
    },

    render(ctx: CanvasRenderingContext2D): void {
      drawScrim(ctx, LOGICAL_W, LOGICAL_H);
      drawPanel(ctx, PANEL);
      drawText(ctx, '选择难度', LOGICAL_W / 2, 164, 22, UI_COLORS.accent, 'center');
      ROWS.forEach((row, index) => {
        const rect = difficultyButton(index);
        const on = index === selected;
        ctx.fillStyle = on ? UI_COLORS.rowSelected : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = on ? UI_COLORS.accent : UI_COLORS.accentDark;
        ctx.lineWidth = on ? 2 : 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
        const titleY = row.sub ? rect.y + 20 : rect.y + rect.h / 2;
        drawText(ctx, row.title, rect.x + rect.w / 2, titleY, 18, UI_COLORS.text, 'center');
        if (row.sub) {
          drawText(ctx, row.sub, rect.x + rect.w / 2, rect.y + 40, 11, UI_COLORS.dim, 'center');
        }
      });
    },
  };
}
