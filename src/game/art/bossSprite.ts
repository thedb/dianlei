/**
 * Orbital battleship sprites (design §6.2, wave table §5.1).
 * Hull 220×140, turrets 40×40, palette indices only.
 * Engine flame, core glow, laser, and hit flash are drawn in code.
 */

import { BOSS_HULL_H, BOSS_HULL_W, BOSS_TURRET_SIZE, LOGICAL_H } from '@/game/config';
import type { BossConfig } from '@/game/levels/types';
import { PALETTE, COLOR } from '@/game/palette';
import type { BossRuntime } from '@/game/systems/boss';
import { bossPart } from '@/game/systems/boss';
import type { SpriteData, SpriteFrame } from './types';
import { createGrid, fillEllipse, fillPoly, fillRect, outline, plot } from './pixelDraw';
import { renderSprite } from './spriteRenderer';
import { drawEnemyFlame } from './engineFlame';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const W = COLOR.WHITE;
const EB = COLOR.ENEMY_BLACK;
const ED = COLOR.ENEMY_DARK_RED;
const EC = COLOR.ENEMY_CRIMSON;
const ER = COLOR.ENEMY_RED;
const EH = COLOR.ENEMY_BRIGHT_RED;
const EV = COLOR.ENEMY_VIVID_RED;
const BM = COLOR.BULLET_MAGENTA;
const BC = COLOR.BULLET_CORE;

export function buildBossHull(openCore: boolean): SpriteData {
  const grid = createGrid(BOSS_HULL_W, BOSS_HULL_H);
  const cx = BOSS_HULL_W / 2;

  // Wings
  fillPoly(
    grid,
    [
      [8, 50],
      [72, 32],
      [86, 104],
      [18, 116],
    ],
    DG
  );
  fillPoly(
    grid,
    [
      [BOSS_HULL_W - 9, 50],
      [BOSS_HULL_W - 73, 32],
      [BOSS_HULL_W - 87, 104],
      [BOSS_HULL_W - 19, 116],
    ],
    DG
  );
  fillPoly(
    grid,
    [
      [22, 58],
      [70, 44],
      [78, 96],
      [30, 104],
    ],
    MG
  );
  fillPoly(
    grid,
    [
      [BOSS_HULL_W - 23, 58],
      [BOSS_HULL_W - 71, 44],
      [BOSS_HULL_W - 79, 96],
      [BOSS_HULL_W - 31, 104],
    ],
    MG
  );

  // Wing leading-edge stripes
  fillRect(grid, 28, 70, 44, 4, EC);
  fillRect(grid, BOSS_HULL_W - 72, 70, 44, 4, EC);

  // Main hull
  fillRect(grid, cx - 36, 16, 72, 104, ED);
  fillEllipse(grid, cx, 28, 30, 16, EB);
  fillPoly(
    grid,
    [
      [cx - 24, 112],
      [cx, 132],
      [cx + 24, 112],
    ],
    ED
  );
  fillRect(grid, cx - 8, 30, 16, 78, EB);
  fillRect(grid, cx - 28, 40, 6, 60, EC);
  fillRect(grid, cx + 22, 40, 6, 60, EC);

  // Engine bells at the rear (top)
  fillEllipse(grid, cx - 16, 22, 10, 8, S);
  fillEllipse(grid, cx + 16, 22, 10, 8, S);
  fillEllipse(grid, cx - 16, 22, 5, 4, EH);
  fillEllipse(grid, cx + 16, 22, 5, 4, EH);

  // Panel lines and lights
  fillRect(grid, cx - 34, 48, 68, 1, G);
  fillRect(grid, cx - 34, 78, 68, 1, G);
  fillRect(grid, cx - 34, 100, 68, 1, G);
  plot(grid, cx - 30, 56, EV);
  plot(grid, cx + 29, 56, EV);
  plot(grid, cx - 30, 90, EV);
  plot(grid, cx + 29, 90, EV);
  fillRect(grid, cx - 10, 118, 20, 3, LG);

  // Core bay sits on the hull center, offset (0, +10) → y = 70+10 = 80
  const coreY = BOSS_HULL_H / 2 + 10;
  if (openCore) {
    fillEllipse(grid, cx, coreY, 20, 16, K);
    fillEllipse(grid, cx, coreY, 14, 11, EC);
    fillEllipse(grid, cx, coreY, 8, 6, BM);
    fillEllipse(grid, cx, coreY, 3, 3, BC);
  } else {
    fillEllipse(grid, cx, coreY, 16, 12, EB);
    fillRect(grid, cx - 12, coreY - 1, 24, 2, MG);
    fillRect(grid, cx - 1, coreY - 10, 2, 20, MG);
    plot(grid, cx - 8, coreY - 6, G);
    plot(grid, cx + 7, coreY - 6, G);
    plot(grid, cx - 8, coreY + 5, G);
    plot(grid, cx + 7, coreY + 5, G);
  }

  // Turret mounts (sockets). The turret sprites draw on top while they live.
  fillEllipse(grid, cx - 78, BOSS_HULL_H / 2 + 20, 14, 14, S);
  fillEllipse(grid, cx + 78, BOSS_HULL_H / 2 + 20, 14, 14, S);

  // Light hull dressing. The hitbox stays the 220×140 rectangle.
  for (let i = -3; i <= 3; i++) {
    plot(grid, cx + i * 4, 36, LG);
    plot(grid, cx + i * 4, 96, G);
  }
  plot(grid, cx - 6, 46, EV);
  plot(grid, cx + 5, 46, EV);
  plot(grid, cx, 24, W);

  outline(grid, K);
  return grid;
}

export function buildBossTurret(): SpriteData {
  const grid = createGrid(BOSS_TURRET_SIZE, BOSS_TURRET_SIZE);
  const c = BOSS_TURRET_SIZE / 2;
  fillEllipse(grid, c, c, 16, 16, DG);
  fillEllipse(grid, c, c, 12, 12, EC);
  fillEllipse(grid, c, c, 7, 7, ED);
  fillRect(grid, c - 3, c + 2, 6, 14, EB);
  fillRect(grid, c - 1, c + 4, 2, 10, EH);
  fillEllipse(grid, c, c - 1, 3, 3, ER);
  plot(grid, c - 1, c - 2, W);
  outline(grid, K);
  return grid;
}

export interface BossAssets {
  hull: SpriteFrame;
  hullOpen: SpriteFrame;
  turret: SpriteFrame;
}

export function createBossAssets(): BossAssets {
  return {
    hull: renderSprite(buildBossHull(false)),
    hullOpen: renderSprite(buildBossHull(true)),
    turret: renderSprite(buildBossTurret()),
  };
}

export interface BossDraw {
  drawImage(image: CanvasImageSource, x: number, y: number, w?: number, h?: number): void;
}

/** Hull, turrets, engine flame, and the opening core. The laser is drawn separately. */
export function drawBossWorld(
  ctx: CanvasRenderingContext2D,
  draw: BossDraw,
  boss: BossRuntime,
  assets: BossAssets,
  time: number
): void {
  if (boss.phase === 'clear' || boss.phase === 'done') return;

  const open = boss.phase === 'transition' || boss.phase === 'phase2' || boss.phase === 'death';
  const hull = open ? assets.hullOpen : assets.hull;
  drawEnemyFlame(ctx, boss.x - 16, boss.y - BOSS_HULL_H / 2 + 6, time);
  drawEnemyFlame(ctx, boss.x + 16, boss.y - BOSS_HULL_H / 2 + 6, time);
  draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);

  for (const part of boss.parts) {
    if (part.id === 'core') continue;
    if (!part.alive && !part.falling) continue;
    const frame = assets.turret;
    draw.drawImage(frame.canvas, part.worldX - frame.anchorX, part.worldY - frame.anchorY);
  }

  if (boss.hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);
    ctx.restore();
  }

  const core = bossPart(boss, 'core');
  if (core && (boss.phase === 'transition' || boss.phase === 'phase2') && core.alive) {
    const opening = boss.phase === 'transition' ? Math.min(1, boss.phaseTime / 0.5) : 1;
    const pulse = 0.35 + 0.2 * Math.sin(time * 7);
    ctx.save();
    ctx.globalAlpha = pulse * opening;
    ctx.fillStyle = PALETTE[COLOR.BULLET_MAGENTA];
    ctx.beginPath();
    ctx.arc(core.worldX, core.worldY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85 * opening;
    ctx.fillStyle = PALETTE[COLOR.BULLET_CORE];
    ctx.beginPath();
    ctx.arc(core.worldX, core.worldY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawBossLaser(
  ctx: CanvasRenderingContext2D,
  boss: BossRuntime,
  config: BossConfig,
  time: number
): void {
  if (boss.phase !== 'phase2' || boss.laser.mode === 'idle') return;
  const core = bossPart(boss, 'core');
  if (!core) return;
  const ang = Math.PI / 2 + (boss.laser.angleDeg * Math.PI) / 180;
  const len = LOGICAL_H;
  const x2 = core.worldX + Math.cos(ang) * len;
  const y2 = core.worldY + Math.sin(ang) * len;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE[COLOR.BULLET_PINK];
  if (boss.laser.mode === 'telegraph') {
    ctx.globalAlpha = Math.floor(time * 16) % 2 === 0 ? 0.9 : 0.25;
    ctx.lineWidth = 2;
  } else {
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = config.phase2.laser.width;
    ctx.beginPath();
    ctx.moveTo(core.worldX, core.worldY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE[COLOR.BULLET_CORE];
    ctx.lineWidth = Math.max(2, config.phase2.laser.width * 0.35);
  }
  ctx.beginPath();
  ctx.moveTo(core.worldX, core.worldY);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Top HUD bar. `fill` is 0–1. */
export function drawBossHpBar(
  ctx: CanvasRenderingContext2D,
  fill: number,
  x = 48,
  y = 32,
  w = 264,
  h = 8
): void {
  const clamped = Math.max(0, Math.min(1, fill));
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE[COLOR.ENEMY_VIVID_RED];
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamped), h - 2);
  ctx.strokeStyle = PALETTE[COLOR.ENEMY_BRIGHT_RED];
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
