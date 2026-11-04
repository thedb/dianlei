/**
 * Ship select, G1 L2, landed 2026-11-04 with the G3 confirm.
 * Hangar, the selected ship at 4× (level frame), three grade bars, three cards.
 * No hitbox bar, no role line, no TEMP / G2 markers. Names are Eagle, Mandy, Jason.
 * The preview flame is `drawFittedPlayerFlames`, the same exhaust as a scaled ship.
 */

import type { InputState } from '@/engine/input';
import { createPlayerSpriteSheet, type PlayerSpriteSheet } from '@/game/art/playerSprite';
import { createLockedShipSheets } from '@/game/art/shipSprites';
import type { BankFrame } from '@/game/art/types';
import { drawFittedPlayerFlames } from '@/game/art/engineFlame';
import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import { listShips, SHIP_IDS, type ShipDef, type ShipId } from '@/game/entities/shipDefs';
import { drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export const SHIP_SELECT_TITLE: Rect = { x: 24, y: 8, w: 312, h: 28 };
export const SHIP_PREVIEW_SCALE = 4;
export const SHIP_PREVIEW_AT = { x: 180, y: 168 };
export const SHIP_SELECT_CARDS: readonly Rect[] = [
  { x: 16, y: 448, w: 104, h: 112 },
  { x: 128, y: 448, w: 104, h: 112 },
  { x: 240, y: 448, w: 104, h: 112 },
];
export const SHIP_SELECT_BACK: Rect = { x: 24, y: 568, w: 100, h: 44 };
export const SHIP_SELECT_CONFIRM: Rect = { x: 136, y: 568, w: 200, h: 44 };

const BARS = [
  { key: 'speedGrade', label: '速度' },
  { key: 'powerGrade', label: '火力' },
  { key: 'rateGrade', label: '攻击频率' },
] as const;

export interface ShipSelect {
  open(id?: ShipId): void;
  selected(): ShipId;
  tick(dt: number): void;
  update(input: InputState): ShipId | 'back' | null;
  render(ctx: CanvasRenderingContext2D): void;
}

interface Sheets {
  eagle: PlayerSpriteSheet;
  mandy: PlayerSpriteSheet;
  jason: PlayerSpriteSheet;
}

let baked: Sheets | undefined;

function sheets(): Sheets | null {
  if (baked) return baked;
  try {
    const locked = createLockedShipSheets();
    baked = { eagle: createPlayerSpriteSheet(), mandy: locked.mandy, jason: locked.jason };
    return baked;
  } catch {
    return null;
  }
}

function sheetFor(all: Sheets, id: ShipId): PlayerSpriteSheet {
  if (id === 'mandy') return all.mandy;
  if (id === 'jason') return all.jason;
  return all.eagle;
}

function levelFrame(sheet: PlayerSpriteSheet): BankFrame {
  return sheet.bankFrames[5] ?? sheet.bankFrames[0]!;
}

interface DrawnBox {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: BankFrame,
  cx: number,
  cy: number,
  scale: number,
  gray: boolean
): DrawnBox {
  const drawn = {
    width: frame.width * scale,
    height: frame.height * scale,
    anchorX: frame.anchorX * scale,
    anchorY: frame.anchorY * scale,
  };
  ctx.save();
  if (gray) ctx.filter = 'grayscale(1) brightness(0.55)';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame.canvas, cx - drawn.anchorX, cy - drawn.anchorY, drawn.width, drawn.height);
  ctx.restore();
  return drawn;
}

function drawHangar(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE[COLOR.WATER_DEEP];
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = PALETTE[COLOR.SHADOW];
  ctx.fillRect(0, 0, LOGICAL_W, 250);
  ctx.fillStyle = PALETTE[COLOR.DARK_GRAY];
  for (let x = 18; x < LOGICAL_W; x += 48) ctx.fillRect(x, 0, 2, 250);
  ctx.fillStyle = PALETTE[COLOR.TERRAIN_ASPHALT];
  ctx.fillRect(0, 250, LOGICAL_W, LOGICAL_H - 250);
  ctx.fillStyle = PALETTE[COLOR.MEDIUM_GRAY];
  for (let y = 268; y < 440; y += 16) ctx.fillRect(0, y, LOGICAL_W, 1);
  ctx.fillStyle = PALETTE[COLOR.PLAYER_DARK_CYAN];
  ctx.fillRect(150, 286, 60, 4);
  ctx.fillStyle = PALETTE[COLOR.GRAY];
  ctx.fillRect(8, 8, LOGICAL_W - 16, 2);
  ctx.fillRect(8, LOGICAL_H - 10, LOGICAL_W - 16, 2);
}

function drawMetal(ctx: CanvasRenderingContext2D, r: Rect, label: string, on: boolean): void {
  ctx.fillStyle = on ? PALETTE[COLOR.PLAYER_MED_CYAN] : PALETTE[COLOR.MEDIUM_GRAY];
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = on ? PALETTE[COLOR.PLAYER_CYAN] : PALETTE[COLOR.LIGHT_GRAY];
  ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 2);
  ctx.fillStyle = PALETTE[COLOR.SHADOW];
  ctx.fillRect(r.x + 2, r.y + r.h - 4, r.w - 4, 2);
  ctx.strokeStyle = PALETTE[COLOR.PALE_GRAY];
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (label) drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, 16, UI_COLORS.text, 'center');
}

function drawBars(ctx: CanvasRenderingContext2D, ship: ShipDef): void {
  BARS.forEach((bar, i) => {
    const y = 318 + i * 28;
    const grade = ship[bar.key];
    drawText(ctx, bar.label, 28, y, 12, UI_COLORS.text, 'left');
    drawText(ctx, `${grade}/8`, 332, y, 12, UI_COLORS.text, 'right');
    for (let pip = 0; pip < 8; pip++) {
      ctx.fillStyle = pip < grade ? UI_COLORS.accent : PALETTE[COLOR.DARK_GRAY];
      ctx.fillRect(108 + pip * 26, y - 5, 20, 10);
    }
  });
}

export function createShipSelect(): ShipSelect {
  let index = 0;
  let time = 0;

  function choose(next: number): void {
    index = (next + SHIP_IDS.length) % SHIP_IDS.length;
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
      if (input.menuUp || input.menuLeft) choose(index - 1);
      if (input.menuDown || input.menuRight) choose(index + 1);

      for (const tap of input.taps) {
        if (hitRect(SHIP_SELECT_BACK, tap.x, tap.y)) return 'back';
        if (hitRect(SHIP_SELECT_CONFIRM, tap.x, tap.y)) return SHIP_IDS[index] ?? 'eagle';
        for (let i = 0; i < SHIP_SELECT_CARDS.length; i++) {
          const card = SHIP_SELECT_CARDS[i]!;
          if (!hitRect(card, tap.x, tap.y)) continue;
          if (i === index) return SHIP_IDS[i]!;
          choose(i);
          return null;
        }
      }
      if (input.menuConfirm) return SHIP_IDS[index] ?? 'eagle';
      return null;
    },

    render(ctx) {
      drawHangar(ctx);
      drawText(ctx, '选择机体', LOGICAL_W / 2, 24, 16, UI_COLORS.text, 'center');

      const id = SHIP_IDS[index] ?? 'eagle';
      const ship = listShips()[index]!;
      const all = sheets();
      if (all) {
        const frame = levelFrame(sheetFor(all, id));
        const drawn = {
          width: frame.width * SHIP_PREVIEW_SCALE,
          height: frame.height * SHIP_PREVIEW_SCALE,
          anchorX: frame.anchorX * SHIP_PREVIEW_SCALE,
          anchorY: frame.anchorY * SHIP_PREVIEW_SCALE,
        };
        drawFittedPlayerFlames(ctx, SHIP_PREVIEW_AT.x, SHIP_PREVIEW_AT.y, frame, drawn, 0, time, 0);
        drawFrame(ctx, frame, SHIP_PREVIEW_AT.x, SHIP_PREVIEW_AT.y, SHIP_PREVIEW_SCALE, false);
      }

      drawText(ctx, ship.name, LOGICAL_W / 2, 286, 16, UI_COLORS.text, 'center');
      drawBars(ctx, ship);

      const roster = listShips();
      for (let i = 0; i < roster.length; i++) {
        const card = SHIP_SELECT_CARDS[i]!;
        const on = i === index;
        drawMetal(ctx, card, '', on);
        if (all) {
          const frame = levelFrame(sheetFor(all, roster[i]!.id));
          const scale = Math.min(88 / frame.width, 64 / frame.height);
          drawFrame(ctx, frame, card.x + card.w / 2, card.y + 40, scale, !on);
        }
        drawText(
          ctx,
          roster[i]!.name,
          card.x + card.w / 2,
          card.y + card.h - 16,
          12,
          UI_COLORS.text,
          'center'
        );
      }

      drawMetal(ctx, SHIP_SELECT_BACK, '返回', false);
      drawMetal(ctx, SHIP_SELECT_CONFIRM, '确认', true);
    },
  };
}
