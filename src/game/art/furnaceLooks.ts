/**
 * 炉心 sprites. Look A is 灯带四瓣: a wide steel chassis, four armor petals,
 * and four outward pods. The fight bakes these and rotates the petals and
 * pods. The iris is not painted into one frozen sheet.
 *
 * B–E stay unpainted. The battle does not switch looks.
 */

import { FURNACE_CORE_RADIUS, FURNACE_HULL_H, FURNACE_HULL_W } from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import type { BossAssets, BossDraw } from '@/game/art/bossSprite';
import type { BossRuntime } from '@/game/systems/boss';
import { bossLook } from '@/game/systems/boss';
import {
  furnaceDebris,
  furnacePetalCenters,
  furnacePetalOpen,
  furnacePods,
  type FurnaceDebris,
  type FurnacePetalCenter,
} from '@/game/systems/furnace';
import type { SpriteData, SpriteFrame } from './types';
import { createGrid, fillEllipse, fillPoly, fillRect, plot } from './pixelDraw';
import { renderSprite } from './spriteRenderer';
import { drawEnemyFlame } from './engineFlame';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const CY = COLOR.PLAYER_CYAN;
const PC = COLOR.PLAYER_PALE_CYAN;
const BM = COLOR.BULLET_MAGENTA;
const BP = COLOR.BULLET_PINK;
const OR = COLOR.EXPLOSION_ORANGE;
const YE = COLOR.EXPLOSION_YELLOW;

export const FURNACE_POD_SPRITE = 22;
export const FURNACE_PETAL_W = 36;
export const FURNACE_PETAL_H = 32;

function ring(
  grid: SpriteData,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  color: number
): void {
  const y0 = Math.floor(cy - rOut);
  const y1 = Math.ceil(cy + rOut);
  const x0 = Math.floor(cx - rOut);
  const x1 = Math.ceil(cx + rOut);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d <= rOut && d >= rIn) plot(grid, x, y, color);
    }
  }
}

/** Wide fortress, nose toward the player (bottom of the sprite). */
export function buildFurnaceChassis(): SpriteData {
  const w = FURNACE_HULL_W;
  const h = FURNACE_HULL_H;
  const g = createGrid(w, h);
  const cx = w / 2;
  const cy = h / 2;
  fillEllipse(g, cx, cy, 96, 60, DG);
  fillEllipse(g, cx, cy, 88, 52, MG);
  fillPoly(
    g,
    [
      [cx - 78, cy - 36],
      [cx + 78, cy - 36],
      [cx + 92, cy],
      [cx + 70, cy + 48],
      [cx - 70, cy + 48],
      [cx - 92, cy],
    ],
    S
  );
  fillRect(g, cx - 70, cy - 28, 140, 56, DG);
  fillRect(g, cx - 54, cy - 16, 108, 32, MG);
  // Four light strips set into the plate.
  for (const x of [cx - 48, cx - 16, cx + 16, cx + 48]) {
    for (let y = cy - 22; y <= cy + 22; y++) {
      const lamp = (y + x) % 6 < 3 ? CY : BM;
      plot(g, x, y, lamp);
      plot(g, x + 1, y, y % 4 === 0 ? PC : BP);
    }
  }
  ring(g, cx, cy, 22, 16, K);
  fillEllipse(g, cx, cy, 14, 14, S);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    plot(g, cx + Math.cos(a) * 30, cy + Math.sin(a) * 22, LG);
  }
  plot(g, cx - 80, cy - 8, G);
  plot(g, cx + 80, cy - 8, G);
  plot(g, cx - 60, cy + 40, LG);
  plot(g, cx + 60, cy + 40, LG);
  return g;
}

/** Armor petal. The wide end is outward (down); the inner edge is the seam. */
export function buildFurnacePetal(): SpriteData {
  const g = createGrid(FURNACE_PETAL_W, FURNACE_PETAL_H);
  fillPoly(
    g,
    [
      [8, 2],
      [28, 2],
      [34, 16],
      [30, 30],
      [6, 30],
      [2, 16],
    ],
    DG
  );
  fillPoly(
    g,
    [
      [12, 5],
      [24, 5],
      [28, 16],
      [24, 26],
      [12, 26],
      [8, 16],
    ],
    MG
  );
  for (let x = 10; x <= 25; x++) plot(g, x, 4, x % 2 === 0 ? CY : BM);
  plot(g, 18, 18, LG);
  plot(g, 14, 22, S);
  plot(g, 22, 22, S);
  return g;
}

/** Outward pod. The barrel points down, which rotation turns into the normal. */
export function buildFurnacePod(broken: boolean): SpriteData {
  const s = FURNACE_POD_SPRITE;
  const g = createGrid(s, s);
  const c = s / 2;
  fillEllipse(g, c, c, 9, 9, broken ? K : S);
  fillEllipse(g, c, c, 6, 6, broken ? S : DG);
  if (!broken) {
    fillRect(g, c - 2, c, 4, 9, MG);
    fillRect(g, c - 3, s - 4, 6, 3, K);
    plot(g, c, s - 3, OR);
    plot(g, c - 3, c - 2, CY);
    plot(g, c + 3, c - 2, BM);
  } else {
    plot(g, c - 3, c - 2, OR);
    plot(g, c + 2, c + 3, YE);
    plot(g, c, c, LG);
    plot(g, c + 4, c - 3, K);
  }
  return g;
}

export function furnaceFrames(): {
  hull: SpriteFrame;
  petal: SpriteFrame;
  pod: SpriteFrame;
  podBroken: SpriteFrame;
} {
  return {
    hull: renderSprite(buildFurnaceChassis()),
    petal: renderSprite(buildFurnacePetal()),
    pod: renderSprite(buildFurnacePod(false)),
    podBroken: renderSprite(buildFurnacePod(true)),
  };
}

const GLOW = {
  magenta: COLOR.BULLET_MAGENTA,
  yellow: COLOR.EXPLOSION_YELLOW,
  orange: COLOR.EXPLOSION_ORANGE,
} as const;

function drawRotated(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  deg: number
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

function drawCore(
  ctx: CanvasRenderingContext2D,
  boss: BossRuntime,
  open: number,
  time: number
): void {
  const look = bossLook(boss);
  const color = PALETTE[GLOW[look?.glow?.color ?? 'orange']];
  const hot = PALETTE[COLOR.EXPLOSION_ORANGE_YELLOW];
  ctx.save();
  if (open < 0.2) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.fillRect(boss.x - 10, boss.y - 1, 20, 2);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = hot;
    ctx.fillRect(boss.x - 4, boss.y - 1, 8, 2);
  } else {
    const pulse = 0.75 + 0.15 * Math.sin(time * 7);
    const radius = FURNACE_CORE_RADIUS * open;
    ctx.globalAlpha = 0.35 * pulse * open;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, radius + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9 * open;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, Math.max(2, radius * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPetal(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  petal: FurnacePetalCenter | FurnaceDebris
): void {
  drawRotated(ctx, frame, petal.x, petal.y, petal.deg);
}

/** Chassis, iris, pods, and the core mouth. Skips the generic hull blit. */
export function drawFurnaceBoss(
  ctx: CanvasRenderingContext2D,
  draw: BossDraw,
  boss: BossRuntime,
  assets: BossAssets,
  time: number
): void {
  const hull = assets.hull;
  const petal = assets.parts.petal;
  const pod = assets.parts.pod;
  const broken = assets.parts.podBroken;
  if (!petal || !pod) return;

  const top = boss.y - FURNACE_HULL_H / 2;
  drawEnemyFlame(ctx, boss.x - 28, top + 8, time);
  drawEnemyFlame(ctx, boss.x + 28, top + 8, time);
  draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);

  const open = furnacePetalOpen(boss);
  const bits = furnaceDebris(boss);
  if (bits) {
    for (const bit of bits) drawPetal(ctx, petal, bit);
  } else if (petal) {
    for (const center of furnacePetalCenters(boss)) drawPetal(ctx, petal, center);
  }

  drawCore(ctx, boss, bits ? 0 : open, time);

  if (pod && broken) {
    for (const mount of furnacePods(boss)) {
      const frame = mount.alive ? pod : broken;
      drawRotated(ctx, frame, mount.x, mount.y, mount.deg);
    }
  }

  if (boss.hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);
    ctx.restore();
  }
}
