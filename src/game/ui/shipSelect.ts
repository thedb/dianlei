/**
 * Ship select. Three equal rows, Metal Slug 3 soldier-select turned portrait.
 * The preview is the in-game bank sheet, nearest-neighbor, plus that ship's flame.
 * Unselected rows are the grey nose crop of the same raster.
 */

import type { InputState } from '@/engine/input';
import { LOGICAL_W } from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import {
  createPlayerFrameData,
  createPlayerSpriteSheet,
  getBankFrameIndex,
} from '@/game/art/playerSprite';
import { drawPlayerFlames, type FlameConfig } from '@/game/art/engineFlame';
import { renderSprite } from '@/game/art/spriteRenderer';
import {
  createJasonFrameData,
  createJasonSpriteSheet,
  createMandyFrameData,
  createMandySpriteSheet,
} from '@/game/art/shipSprites';
import { greyPortrait } from '@/game/art/shipPortrait';
import { listShips, SHIP_IDS, type ShipId } from '@/game/entities/shipDefs';
import type { PlayerSpriteSheet, SpriteData, SpriteFrame } from '@/game/art/types';
import { drawButton, drawScrim, drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export const SHIP_SELECT_TITLE: Rect = { x: 24, y: 24, w: 312, h: 36 };
export const SHIP_SELECT_ROWS: readonly Rect[] = [
  { x: 16, y: 68, w: 328, h: 156 },
  { x: 16, y: 232, w: 328, h: 156 },
  { x: 16, y: 396, w: 328, h: 156 },
];
export const SHIP_SELECT_BACK: Rect = { x: 24, y: 568, w: 100, h: 44 };
export const SHIP_SELECT_CONFIRM: Rect = { x: 136, y: 568, w: 200, h: 44 };

const WELL = { x: 12, y: 12, w: 132, h: 132 };
const PREVIEW_SCALE = 3;

/**
 * Slow bank, ±0.45, period 3s. Full stick is ±1, so this never reaches the
 * outer bank frames. Changing rows restarts the clock.
 */
export function selectBank(time: number): number {
  const u = ((time % 3) + 3) % 3;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (u < 0.4) return 0;
  if (u < 1.0) return 0.45 * ease((u - 0.4) / 0.6);
  if (u < 1.4) return 0.45;
  if (u < 2.0) return 0.45 * (1 - ease((u - 1.4) / 0.6));
  if (u < 2.6) return -0.45 * ease((u - 2.0) / 0.6);
  return -0.45 * (1 - ease((u - 2.6) / 0.4));
}

interface Preview {
  sheet: PlayerSpriteSheet;
  bust: SpriteFrame;
}

function bustOf(frame: SpriteData): SpriteFrame {
  // Anchor at the top so the crop's nose stays put when we place the rect.
  return renderSprite(greyPortrait(frame), 0.5, 0);
}

function buildPreviews(): Record<ShipId, Preview> {
  return {
    eagle: { sheet: createPlayerSpriteSheet(), bust: bustOf(createPlayerFrameData()[5]!) },
    mandy: { sheet: createMandySpriteSheet(), bust: bustOf(createMandyFrameData()[5]!) },
    jason: { sheet: createJasonSpriteSheet(), bust: bustOf(createJasonFrameData()[5]!) },
  };
}

function drawPlate(ctx: CanvasRenderingContext2D, r: Rect, edge: string): void {
  ctx.fillStyle = PALETTE[COLOR.DARK_GRAY];
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = PALETTE[COLOR.LIGHT_GRAY];
  ctx.fillRect(r.x, r.y, r.w, 1);
  ctx.fillStyle = PALETTE[COLOR.SHADOW];
  ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = PALETTE[COLOR.PALE_GRAY];
  ctx.fillRect(r.x + 2, r.y + 2, 1, 1);
  ctx.fillRect(r.x + r.w - 3, r.y + 2, 1, 1);
  ctx.fillRect(r.x + 2, r.y + r.h - 3, 1, 1);
  ctx.fillRect(r.x + r.w - 3, r.y + r.h - 3, 1, 1);
}

function drawHazard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const yellow = PALETTE[COLOR.EXPLOSION_YELLOW];
  const black = PALETTE[COLOR.BLACK];
  for (let s = -h; s < w + h; s += 6) {
    ctx.fillStyle = Math.floor(s / 6) % 2 === 0 ? yellow : black;
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.lineTo(x + s + 4, y);
    ctx.lineTo(x + s + 4 - h, y + h);
    ctx.lineTo(x + s - h, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function scaledFlame(flame: FlameConfig, scale: number): FlameConfig {
  return {
    ...flame,
    baseLength: flame.baseLength * scale,
    baseWidth: flame.baseWidth * scale,
    flickerAmount: flame.flickerAmount * scale,
  };
}

export interface ShipSelect {
  open(id?: ShipId): void;
  selected(): ShipId;
  tick(dt: number): void;
  update(input: InputState): ShipId | 'back' | null;
  render(ctx: CanvasRenderingContext2D): void;
}

export function createShipSelect(): ShipSelect {
  let index = 0;
  let time = 0;
  let previews: Record<ShipId, Preview> | null = null;

  function art(): Record<ShipId, Preview> {
    if (!previews) previews = buildPreviews();
    return previews;
  }

  function choose(next: number): void {
    index = (next + SHIP_IDS.length) % SHIP_IDS.length;
    time = 0;
  }

  return {
    open(id) {
      const found = id ? SHIP_IDS.indexOf(id) : 0;
      index = found >= 0 ? found : 0;
      time = 0;
    },

    selected() {
      return SHIP_IDS[index] ?? 'eagle';
    },

    tick(dt) {
      time += dt;
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
      const sheets = art();
      drawScrim(ctx, LOGICAL_W, 640);
      drawPlate(ctx, SHIP_SELECT_TITLE, PALETTE[COLOR.LIGHT_GRAY]);
      drawText(
        ctx,
        '选择机体',
        LOGICAL_W / 2,
        SHIP_SELECT_TITLE.y + 18,
        18,
        UI_COLORS.text,
        'center'
      );

      const ships = listShips();
      for (let i = 0; i < ships.length; i++) {
        const ship = ships[i]!;
        const row = SHIP_SELECT_ROWS[i]!;
        const on = i === index;
        ctx.fillStyle = on ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(row.x, row.y, row.w, row.h);
        ctx.strokeStyle = on ? PALETTE[COLOR.PLAYER_CYAN] : PALETTE[COLOR.MEDIUM_GRAY];
        ctx.lineWidth = 1;
        ctx.strokeRect(row.x + 0.5, row.y + 0.5, row.w - 1, row.h - 1);

        const well: Rect = {
          x: row.x + WELL.x,
          y: row.y + WELL.y,
          w: WELL.w,
          h: WELL.h,
        };
        ctx.fillStyle = PALETTE[COLOR.SHADOW];
        ctx.fillRect(well.x, well.y, well.w, well.h);

        const preview = sheets[ship.id];
        ctx.save();
        ctx.beginPath();
        ctx.rect(well.x, well.y, well.w, well.h);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        if (on) {
          const frame = preview.sheet.bankFrames[getBankFrameIndex(selectBank(time))]!;
          const dw = ship.spriteW * PREVIEW_SCALE;
          const dh = ship.spriteH * PREVIEW_SCALE;
          const left = well.x + (well.w - dw) / 2;
          const top = well.y + well.h - 8 - dh;
          const cx = left + dw / 2;
          const cy = top + dh / 2;
          const nozzles = frame.nozzles.map((n) => ({
            x: n.x * PREVIEW_SCALE,
            y: n.y * PREVIEW_SCALE,
          }));
          drawPlayerFlames(
            ctx,
            cx,
            cy,
            nozzles,
            0,
            time,
            0,
            scaledFlame(ship.flame, PREVIEW_SCALE)
          );
          ctx.drawImage(frame.canvas, left, top, dw, dh);
        } else {
          const bust = preview.bust;
          const dw = bust.width * 4;
          const dh = bust.height * 4;
          const left = well.x + (well.w - dw) / 2;
          const top = well.y + (well.h - dh) / 2;
          ctx.drawImage(bust.canvas, left, top, dw, dh);
        }
        ctx.restore();

        if (on) drawHazard(ctx, well.x, well.y + well.h - 8, well.w, 8);
        ctx.strokeStyle = on ? PALETTE[COLOR.PALE_GRAY] : PALETTE[COLOR.DARK_GRAY];
        ctx.strokeRect(well.x + 0.5, well.y + 0.5, well.w - 1, well.h - 1);

        const plate: Rect = { x: row.x + 156, y: row.y + 16, w: 156, h: 28 };
        drawPlate(ctx, plate, on ? PALETTE[COLOR.WHITE] : PALETTE[COLOR.MEDIUM_GRAY]);
        drawText(ctx, ship.name, plate.x + plate.w / 2, plate.y + 14, 16, UI_COLORS.text, 'center');
        const copy = on ? PALETTE[COLOR.PLAYER_CYAN] : UI_COLORS.dim;
        const body = on ? UI_COLORS.text : UI_COLORS.dim;
        drawText(ctx, ship.role, row.x + 156, row.y + 58, 13, copy, 'left');
        ship.lines.forEach((line, lineIndex) => {
          drawText(ctx, line, row.x + 156, row.y + 80 + lineIndex * 18, 12, body, 'left');
        });
      }

      drawButton(ctx, SHIP_SELECT_BACK, '返回', false);
      drawButton(ctx, SHIP_SELECT_CONFIRM, '确认', true);
    },
  };
}
