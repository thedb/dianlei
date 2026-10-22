/**
 * Shared canvas overlay used by the formal difficulty picker and the
 * challenge-Boss stage / difficulty steps. Same scrim, panel, and rows.
 * The caller owns what an action means and whether the attract demo steps.
 */

import type { InputState } from '@/engine/input';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { drawPanel, drawScrim, drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export interface ChoiceRow<T extends string> {
  action: T | 'back';
  title: string;
  sub: string;
}

const BUTTON_W = 248;
const BUTTON_H = 58;
const BUTTON_GAP = 12;
const BUTTON_TOP = 196;
const PANEL_X = 28;
const PANEL_Y = 132;
/** Gap under the last row. Four rows reproduce the original 400px panel. */
const PANEL_BOTTOM_PAD = 68;
const TITLE_Y = 164;

export function choiceButton(index: number): Rect {
  return {
    x: LOGICAL_W / 2 - BUTTON_W / 2,
    y: BUTTON_TOP + index * (BUTTON_H + BUTTON_GAP),
    w: BUTTON_W,
    h: BUTTON_H,
  };
}

export function choicePanelRect(rowCount: number): Rect {
  const lastBottom = BUTTON_TOP + rowCount * BUTTON_H + Math.max(0, rowCount - 1) * BUTTON_GAP;
  return {
    x: PANEL_X,
    y: PANEL_Y,
    w: LOGICAL_W - PANEL_X * 2,
    h: lastBottom + PANEL_BOTTOM_PAD - PANEL_Y,
  };
}

export interface ChoiceOverlay<T extends string> {
  open(): void;
  update(input: InputState): T | 'back' | null;
  render(ctx: CanvasRenderingContext2D): void;
}

export function createChoiceOverlay<T extends string>(options: {
  heading: string;
  rows: ReadonlyArray<ChoiceRow<T>>;
}): ChoiceOverlay<T> {
  const rows = options.rows;
  let selected = 0;

  return {
    open(): void {
      selected = 0;
    },

    update(input: InputState): T | 'back' | null {
      if (input.menuBack) return 'back';
      if (input.menuUp) selected = (selected + rows.length - 1) % rows.length;
      if (input.menuDown) selected = (selected + 1) % rows.length;

      for (let i = 0; i < rows.length; i++) {
        const rect = choiceButton(i);
        if (input.taps.some((t) => hitRect(rect, t.x, t.y))) {
          selected = i;
          return rows[i]!.action;
        }
      }
      if (input.menuConfirm) return rows[selected]!.action;
      return null;
    },

    render(ctx: CanvasRenderingContext2D): void {
      drawScrim(ctx, LOGICAL_W, LOGICAL_H);
      drawPanel(ctx, choicePanelRect(rows.length));
      drawText(ctx, options.heading, LOGICAL_W / 2, TITLE_Y, 22, UI_COLORS.accent, 'center');
      rows.forEach((row, index) => {
        const rect = choiceButton(index);
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
