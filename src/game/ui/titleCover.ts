/**
 * Code-drawn title poster shared by boot and the title screen.
 * Dusk over a border airfield, open water, a distant carrier, and the
 * player fighter climbing through it. Palette pixels only — the ship is
 * the real center bank frame, with a cyan outline and code-drawn exhaust.
 * Boot paints this on black. The title paints it over the attract scrim.
 * It is not a stage map and not the attract demo.
 */

import { LOGICAL_H, LOGICAL_W } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import { drawEngineFlame, type FlameConfig } from '@/game/art/engineFlame';
import {
  PLAYER_SPRITE_H,
  PLAYER_SPRITE_W,
  createPlayerFrameData,
  createPlayerNozzles,
  getBankFrameIndex,
} from '@/game/art/playerSprite';

const FRAME = getBankFrameIndex(0);
const SHIP = createPlayerFrameData()[FRAME]!;
const NOZZLES = createPlayerNozzles()[FRAME]!;

/** Integer scale so the 28×32 hull stays on the pixel grid. */
export const TITLE_SHIP_SCALE = 3;
export const TITLE_SHIP_X = LOGICAL_W / 2;
export const TITLE_SHIP_Y = 168;

const COVER_FLAME: FlameConfig = {
  baseLength: 16,
  baseWidth: 5,
  flickerAmount: 3,
  coreColor: '#ffffff',
  outerColor: PALETTE[COLOR.PLAYER_CYAN],
  glowColor: 'rgba(0, 229, 255, 0.35)',
};

const HORIZON = 228;

function mix(n: number): number {
  let h = Math.imul(n ^ (n >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

function block(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawSky(ctx: CanvasRenderingContext2D, solid: boolean): void {
  const sky = ctx.createLinearGradient(0, 0, 0, solid ? LOGICAL_H : 360);
  sky.addColorStop(0, PALETTE[COLOR.SHADOW]);
  sky.addColorStop(0.42, PALETTE[COLOR.WATER_DEEP]);
  sky.addColorStop(0.62, PALETTE[COLOR.WATER_OCEAN]);
  sky.addColorStop(0.78, '#243044');
  sky.addColorStop(1, solid ? PALETTE[COLOR.WATER_DEEP] : 'rgba(10, 24, 40, 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, LOGICAL_W, solid ? LOGICAL_H : 380);

  ctx.fillStyle = PALETTE[COLOR.PALE_GRAY];
  for (let i = 0; i < 28; i++) {
    const h = mix(i + 3);
    const x = h % (LOGICAL_W - 8);
    const y = (h >>> 8) % (HORIZON - 36);
    const bright = (h >>> 20) % 5 === 0;
    ctx.globalAlpha = bright ? 0.9 : 0.45;
    ctx.fillRect(x, y + 8, bright ? 2 : 1, bright ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function drawCoast(ctx: CanvasRenderingContext2D, time: number): void {
  block(ctx, 0, HORIZON - 18, 168, 28, PALETTE[COLOR.GROUND_DARK_OLIVE]);
  block(ctx, 0, HORIZON - 8, 148, 16, PALETTE[COLOR.TERRAIN_DARK_GREEN]);
  block(ctx, 18, HORIZON - 28, 36, 12, PALETTE[COLOR.TERRAIN_ASPHALT]);
  block(ctx, 22, HORIZON - 40, 10, 14, PALETTE[COLOR.TERRAIN_CONCRETE]);
  block(ctx, 12, HORIZON - 4, 128, 6, PALETTE[COLOR.TERRAIN_ASPHALT]);

  const blink = Math.floor(time * 4) % 2 === 0;
  ctx.fillStyle = blink ? PALETTE[COLOR.ENEMY_VIVID_RED] : PALETTE[COLOR.PLAYER_CYAN];
  for (let x = 16; x < 136; x += 16) ctx.fillRect(x, HORIZON - 6, 2, 2);

  block(ctx, 248, HORIZON - 6, 96, 8, PALETTE[COLOR.MEDIUM_GRAY]);
  block(ctx, 300, HORIZON - 22, 16, 16, PALETTE[COLOR.DARK_GRAY]);
  block(ctx, 304, HORIZON - 28, 6, 8, PALETTE[COLOR.GRAY]);
  ctx.fillStyle = PALETTE[COLOR.ENEMY_BRIGHT_RED];
  ctx.fillRect(318, HORIZON - 8, 3, 2);

  ctx.fillStyle = PALETTE[COLOR.WATER_FOAM];
  ctx.fillRect(0, HORIZON + 8, LOGICAL_W, 1);
  for (let i = 0; i < 8; i++) {
    const x = (mix(i + 40) % 280) + 8;
    ctx.fillRect(x, HORIZON + 16 + (i % 3) * 10, 18 + (i % 4) * 6, 1);
  }

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = PALETTE[COLOR.PLAYER_CYAN];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, HORIZON - 36);
  ctx.lineTo(TITLE_SHIP_X - 24, TITLE_SHIP_Y - 36);
  ctx.moveTo(120, HORIZON - 20);
  ctx.lineTo(TITLE_SHIP_X + 10, TITLE_SHIP_Y + 10);
  ctx.stroke();
  ctx.restore();

  const flak = Math.floor(time * 3) % 4;
  ctx.fillStyle = PALETTE[COLOR.EXPLOSION_ORANGE];
  ctx.fillRect(70 + flak * 18, 96, 3, 3);
  ctx.fillStyle = PALETTE[COLOR.EXPLOSION_ORANGE_YELLOW];
  ctx.fillRect(250, 72 + (flak % 2) * 8, 2, 2);
}

function drawShip(ctx: CanvasRenderingContext2D, time: number): void {
  const scale = TITLE_SHIP_SCALE;
  const left = Math.round(TITLE_SHIP_X - (PLAYER_SPRITE_W * scale) / 2);
  const top = Math.round(TITLE_SHIP_Y - (PLAYER_SPRITE_H * scale) / 2);
  const glow = PALETTE[COLOR.PLAYER_CYAN];

  ctx.fillStyle = glow;
  for (let y = 0; y < PLAYER_SPRITE_H; y++) {
    const row = SHIP[y]!;
    for (let x = 0; x < PLAYER_SPRITE_W; x++) {
      if (row[x]! < 0) continue;
      const px = left + x * scale;
      const py = top + y * scale;
      ctx.fillRect(px - scale, py, scale, scale);
      ctx.fillRect(px + scale, py, scale, scale);
      ctx.fillRect(px, py - scale, scale, scale);
      ctx.fillRect(px, py + scale, scale, scale);
    }
  }

  for (let y = 0; y < PLAYER_SPRITE_H; y++) {
    const row = SHIP[y]!;
    for (let x = 0; x < PLAYER_SPRITE_W; x++) {
      const index = row[x]!;
      if (index < 0) continue;
      ctx.fillStyle = PALETTE[index] ?? glow;
      ctx.fillRect(left + x * scale, top + y * scale, scale, scale);
    }
  }

  for (const nozzle of NOZZLES) {
    drawEngineFlame(
      ctx,
      TITLE_SHIP_X + nozzle.x * scale,
      TITLE_SHIP_Y + nozzle.y * scale,
      COVER_FLAME,
      -0.45,
      time,
      0.4
    );
  }
}

/**
 * @param solid Boot fills the frame. The title fades the lower edge so the
 * attract demo still shows behind the menu.
 */
export function drawTitleCover(ctx: CanvasRenderingContext2D, time: number, solid: boolean): void {
  drawSky(ctx, solid);
  drawCoast(ctx, time);
  drawShip(ctx, time);
}
