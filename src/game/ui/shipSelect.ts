/**
 * TEMP ship picker until G1–G4.
 * Three rows, the names, 返回, and 确认. No portraits, plates, or preview.
 * The title stays 「选择机体」. Later the title and names become hand-pixel
 * palette glyphs. Do not add a font file for that.
 */

import type { InputState } from '@/engine/input';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { listShips, SHIP_IDS, type ShipId } from '@/game/entities/shipDefs';
import { drawButton, drawScrim, drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export const SHIP_SELECT_TITLE: Rect = { x: 24, y: 48, w: 312, h: 36 };
export const SHIP_SELECT_ROWS: readonly Rect[] = [
  { x: 24, y: 120, w: 312, h: 44 },
  { x: 24, y: 176, w: 312, h: 44 },
  { x: 24, y: 232, w: 312, h: 44 },
];
export const SHIP_SELECT_BACK: Rect = { x: 24, y: 568, w: 100, h: 44 };
export const SHIP_SELECT_CONFIRM: Rect = { x: 136, y: 568, w: 200, h: 44 };

export interface ShipSelect {
  open(id?: ShipId): void;
  selected(): ShipId;
  tick(dt: number): void;
  update(input: InputState): ShipId | 'back' | null;
  render(ctx: CanvasRenderingContext2D): void;
}

export function createShipSelect(): ShipSelect {
  let index = 0;

  function choose(next: number): void {
    index = (next + SHIP_IDS.length) % SHIP_IDS.length;
  }

  return {
    open(id) {
      const found = id ? SHIP_IDS.indexOf(id) : 0;
      index = found >= 0 ? found : 0;
    },

    selected() {
      return SHIP_IDS[index] ?? 'eagle';
    },

    tick(_dt) {
      return undefined;
    },

    update(input) {
      if (input.menuBack) return 'back';
      if (input.menuUp) choose(index - 1);
      if (input.menuDown) choose(index + 1);

      for (const tap of input.taps) {
        if (hitRect(SHIP_SELECT_BACK, tap.x, tap.y)) return 'back';
        if (hitRect(SHIP_SELECT_CONFIRM, tap.x, tap.y)) return SHIP_IDS[index] ?? 'eagle';
        for (let i = 0; i < SHIP_SELECT_ROWS.length; i++) {
          const row = SHIP_SELECT_ROWS[i]!;
          if (!hitRect(row, tap.x, tap.y)) continue;
          if (i === index) return SHIP_IDS[i]!;
          choose(i);
          return null;
        }
      }
      if (input.menuConfirm) return SHIP_IDS[index] ?? 'eagle';
      return null;
    },

    render(ctx) {
      drawScrim(ctx, LOGICAL_W, LOGICAL_H);
      drawText(
        ctx,
        '选择机体',
        LOGICAL_W / 2,
        SHIP_SELECT_TITLE.y + 18,
        16,
        UI_COLORS.text,
        'center'
      );

      const ships = listShips();
      for (let i = 0; i < ships.length; i++) {
        const ship = ships[i]!;
        const row = SHIP_SELECT_ROWS[i]!;
        drawButton(ctx, row, ship.name, i === index);
      }

      drawButton(ctx, SHIP_SELECT_BACK, '返回', false);
      drawButton(ctx, SHIP_SELECT_CONFIRM, '确认', false);
    },
  };
}
