/**
 * 黑曜 draw pass. Hull bank and the tail flame follow the fight script.
 * The saucer, smoke, and beam are screen-space and have no hitbox.
 */

import { OBSIDIAN_HINGE_RADIUS, OBSIDIAN_HULL_H, OBSIDIAN_WRECK_BANK } from '@/game/config';
import type { BossRuntime } from '@/game/systems/boss';
import {
  OBSIDIAN_BLADES,
  obsidianBladeLayers,
  obsidianHingeMarked,
  obsidianJettison,
  obsidianMotion,
} from '@/game/systems/obsidian';
import { obsidianSaucerView } from '@/game/systems/obsidianSaucer';
import { drawEngineFlame, type FlameConfig } from './engineFlame';
import { COLOR, PALETTE } from '@/game/palette';
import { drawSaucerBeam, drawSaucerCharge, saucerFrame } from './saucerSprite';

/** One large jet. Bigger than the shared enemy flame so the dive reads as a thrust. */
const JET_FLAME: FlameConfig = {
  baseLength: 16,
  baseWidth: 7,
  flickerAmount: 2,
  coreColor: PALETTE[COLOR.EXPLOSION_YELLOW],
  outerColor: PALETTE[COLOR.EXPLOSION_ORANGE],
  glowColor: 'rgba(255, 120, 32, 0.35)',
};

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

function drawJettison(ctx: CanvasRenderingContext2D, boss: BossRuntime): void {
  const pods = obsidianJettison(boss);
  for (const pod of pods) {
    const x = Math.round(pod.x) - 1;
    const y = Math.round(pod.y);
    ctx.fillStyle = PALETTE[COLOR.DARK_GRAY];
    ctx.fillRect(x, y, 3, 5);
    ctx.fillStyle = PALETTE[COLOR.MEDIUM_GRAY];
    ctx.fillRect(x, y, 3, 2);
  }
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

/** Solid yellow ring on the hit radius, orange ticks on the lock. No blink. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const r = OBSIDIAN_HINGE_RADIUS;
  ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
  ctx.fillRect(px - r - 1, py - 2, 6, 4);
  ctx.fillRect(px + r - 5, py - 2, 6, 4);
  ctx.fillRect(px - 2, py - r - 1, 4, 6);
  ctx.fillRect(px - 2, py + r - 5, 4, 6);
  ctx.fillStyle = PALETTE[COLOR.EXPLOSION_ORANGE];
  ctx.fillRect(px - 7, py - 1, 4, 3);
  ctx.fillRect(px + 3, py - 1, 4, 3);
  ctx.fillRect(px - 1, py - 7, 3, 4);
  ctx.fillRect(px - 1, py + 3, 3, 4);
}

function drawBlade(
  ctx: CanvasRenderingContext2D,
  draw: ObsidianDraw,
  frame: HullFrame,
  x: number,
  y: number,
  angle: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

function layerSpread(angles: readonly number[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const angle of angles) {
    min = Math.min(min, angle);
    max = Math.max(max, angle);
  }
  return max - min;
}

function drawJet(ctx: CanvasRenderingContext2D, time: number, boost: number): void {
  ctx.save();
  ctx.translate(0, -OBSIDIAN_HULL_H / 2 + 8);
  ctx.scale(1, -1);
  drawEngineFlame(ctx, 0, 0, JET_FLAME, 0, time, boost);
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
      const swept = assets.parts.bladeSwept;
      const cross = assets.parts.bladeCross ?? swept;
      const stub = assets.parts.bladeStub;
      const bladeOrder = OBSIDIAN_BLADES.map((spec, index) => ({ spec, index })).sort((a, b) => {
        if (a.spec.role === b.spec.role) return a.index - b.index;
        return a.spec.role === 'outer' ? -1 : 1;
      });
      for (const { spec, index } of bladeOrder) {
        const part = boss.parts.find((item) => item.id === spec.id);
        const angles = obsidianBladeLayers(boss, index);
        const dead = wreck || !part?.alive;
        const art = dead ? stub : layerSpread(angles) < 0.12 ? cross : swept;
        if (!art) continue;
        if (dead || layerSpread(angles) < 0.12) {
          drawBlade(ctx, draw, art, spec.x, spec.y, angles[1] ?? angles[0] ?? 0);
          continue;
        }
        const side = spec.x < 0 ? -1 : 1;
        for (let s = angles.length - 1; s >= 0; s--) {
          const off = s * 2;
          drawBlade(ctx, draw, art, spec.x + side * off * 0.5, spec.y - off * 0.45, angles[s] ?? 0);
        }
      }
      if (!wreck) drawJet(ctx, time, boost);
      draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
      if (boss.hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
        ctx.restore();
      }
      for (const spec of OBSIDIAN_BLADES) {
        const lock = boss.parts.find((item) => item.id === spec.hinge);
        const art = lock?.alive ? assets.parts.hinge : assets.parts.hingeDead;
        if (!art) continue;
        draw.drawImage(art.canvas, spec.x - art.anchorX, spec.y - art.anchorY);
        if (lock && obsidianHingeMarked(boss, lock.id)) drawMark(ctx, spec.x, spec.y);
      }
      ctx.restore();
    }
    drawJettison(ctx, boss);
  }

  if (cut.smoke) drawSmoke(ctx, boss.x, boss.y, time);

  if (cut.saucerY !== null) {
    const disc = saucerFrame();
    draw.drawImage(disc.canvas, cut.saucerX - disc.anchorX, cut.saucerY - disc.anchorY);
    if (cut.charge) drawSaucerCharge(ctx, cut.saucerX, cut.saucerY);
  }
}
