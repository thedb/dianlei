/**
 * 黑曜 draw pass. Hull bank and the tail flame follow the fight script.
 * The saucer, smoke, and beam are screen-space and have no hitbox.
 */

import { OBSIDIAN_HULL_H, OBSIDIAN_WRECK_BANK } from '@/game/config';
import type { BossRuntime } from '@/game/systems/boss';
import { obsidianMotion } from '@/game/systems/obsidian';
import { obsidianSaucerView } from '@/game/systems/obsidianSaucer';
import { drawEngineFlame, ENEMY_FLAME_CONFIG } from './engineFlame';
import { COLOR, PALETTE } from '@/game/palette';
import { drawSaucerBeam, drawSaucerCharge, saucerFrame } from './saucerSprite';

interface HullFrame {
  canvas: CanvasImageSource;
  anchorX: number;
  anchorY: number;
}

interface ObsidianAssets {
  hull: HullFrame;
  hullOpen: HullFrame;
  parts: Record<string, HullFrame | undefined>;
}

interface ObsidianDraw {
  drawImage(image: CanvasImageSource, x: number, y: number, w?: number, h?: number): void;
}

function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  for (let i = 0; i < 4; i++) {
    const age = (time * 0.7 + i * 0.27) % 1;
    const px = Math.round(x - 12 + i * 8 + Math.sin(time * 3 + i) * 3);
    const py = Math.round(y - 28 - age * 40);
    ctx.globalAlpha = (1 - age) * 0.5;
    ctx.fillStyle = PALETTE[i % 2 === 0 ? COLOR.GRAY : COLOR.MEDIUM_GRAY];
    ctx.fillRect(px, py, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawTail(ctx: CanvasRenderingContext2D, time: number, boost: number): void {
  ctx.save();
  ctx.translate(0, -OBSIDIAN_HULL_H / 2 + 6);
  ctx.scale(1, -1);
  drawEngineFlame(ctx, -8, 0, ENEMY_FLAME_CONFIG, 0, time, boost);
  drawEngineFlame(ctx, 8, 0, ENEMY_FLAME_CONFIG, 0, time, boost);
  ctx.restore();
}

/** Hull, flame, wreck smoke, disc, and beam. Returns without touching other bosses. */
export function drawObsidianBoss(
  ctx: CanvasRenderingContext2D,
  draw: ObsidianDraw,
  boss: BossRuntime,
  assets: ObsidianAssets,
  time: number
): void {
  const cut = obsidianSaucerView(boss);
  const motion = obsidianMotion(boss);

  if (cut.beam && cut.saucerY !== null) {
    drawSaucerBeam(ctx, cut.saucerX, cut.saucerY, boss.y);
  }

  if (!cut.broken) {
    const wreck = cut.active;
    const frame = wreck ? assets.parts.wreck : motion.warn ? assets.hullOpen : assets.hull;
    const bank = wreck ? OBSIDIAN_WRECK_BANK * Math.min(1, cut.t / 0.45) : motion.bank;
    const boost = wreck ? 0 : motion.flameBoost;
    if (frame) {
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.rotate(bank);
      if (!wreck) drawTail(ctx, time, boost);
      draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
      if (boss.hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  if (cut.smoke) drawSmoke(ctx, boss.x, boss.y, time);

  if (cut.saucerY !== null) {
    const disc = saucerFrame();
    draw.drawImage(disc.canvas, cut.saucerX - disc.anchorX, cut.saucerY - disc.anchorY);
    if (cut.charge) drawSaucerCharge(ctx, cut.saucerX, cut.saucerY);
  }
}
