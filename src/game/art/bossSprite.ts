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
const EH = COLOR.ENEMY_BRIGHT_RED;
const PG = COLOR.PALE_GRAY;
const BM = COLOR.BULLET_MAGENTA;
const BP = COLOR.BULLET_PINK;
const BD = COLOR.BULLET_DARK;
const BC = COLOR.BULLET_CORE;

/**
 * Reference sheet is nose-up on the page. In battle the prow faces the player
 * (bottom of the sprite). Exhaust stays at the top, where `drawEnemyFlame` points up.
 * Core (0, +10) and turrets (±78, +20) stay on the gameplay anchors.
 */
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

function conduit(grid: SpriteData, x: number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    plot(grid, x - 1, y, BD);
    plot(grid, x, y, y % 5 === 0 ? BC : BM);
    plot(grid, x + 1, y, BD);
  }
}

function paintSocket(grid: SpriteData, cx: number, cy: number, broken: boolean): void {
  if (broken) {
    fillEllipse(grid, cx, cy, 13, 12, K);
    fillEllipse(grid, cx, cy, 8, 7, S);
    plot(grid, cx - 4, cy - 3, BM);
    plot(grid, cx + 3, cy + 2, BM);
    plot(grid, cx, cy - 6, BP);
    plot(grid, cx + 5, cy - 1, BD);
    plot(grid, cx - 2, cy + 5, BC);
    return;
  }
  fillEllipse(grid, cx, cy, 13, 12, S);
  fillEllipse(grid, cx, cy, 9, 8, DG);
  ring(grid, cx, cy, 7, 5, MG);
  plot(grid, cx, cy - 2, BM);
  plot(grid, cx - 3, cy + 2, BD);
  plot(grid, cx + 3, cy + 2, BD);
}

export function buildBossHull(openCore: boolean): SpriteData {
  const grid = createGrid(BOSS_HULL_W, BOSS_HULL_H);
  const cx = BOSS_HULL_W / 2;
  const coreY = BOSS_HULL_H / 2 + 10;
  const turretY = BOSS_HULL_H / 2 + 20;

  // Outer armor, prow toward the player.
  fillPoly(
    grid,
    [
      [cx, 6],
      [cx + 22, 16],
      [cx + 40, 34],
      [cx + 52, 52],
      [cx + 64, 68],
      [cx + 90, 78],
      [cx + 96, 94],
      [cx + 78, 108],
      [cx + 52, 100],
      [cx + 36, 116],
      [cx + 18, 128],
      [cx, 136],
      [cx - 18, 128],
      [cx - 36, 116],
      [cx - 52, 100],
      [cx - 78, 108],
      [cx - 96, 94],
      [cx - 90, 78],
      [cx - 64, 68],
      [cx - 52, 52],
      [cx - 40, 34],
      [cx - 22, 16],
    ],
    S
  );
  fillPoly(
    grid,
    [
      [cx, 14],
      [cx + 16, 24],
      [cx + 32, 40],
      [cx + 42, 58],
      [cx + 50, 74],
      [cx + 70, 84],
      [cx + 74, 98],
      [cx + 46, 96],
      [cx + 28, 112],
      [cx + 12, 124],
      [cx, 130],
      [cx - 12, 124],
      [cx - 28, 112],
      [cx - 46, 96],
      [cx - 74, 98],
      [cx - 70, 84],
      [cx - 50, 74],
      [cx - 42, 58],
      [cx - 32, 40],
      [cx - 16, 24],
    ],
    DG
  );
  fillPoly(
    grid,
    [
      [cx, 28],
      [cx + 22, 42],
      [cx + 30, 64],
      [cx + 28, 92],
      [cx + 16, 110],
      [cx, 120],
      [cx - 16, 110],
      [cx - 28, 92],
      [cx - 30, 64],
      [cx - 22, 42],
    ],
    MG
  );

  // Engine block at the rear (top).
  fillEllipse(grid, cx - 18, 22, 12, 9, EB);
  fillEllipse(grid, cx + 18, 22, 12, 9, EB);
  fillEllipse(grid, cx - 18, 22, 7, 5, S);
  fillEllipse(grid, cx + 18, 22, 7, 5, S);
  fillEllipse(grid, cx - 18, 21, 3, 2, EH);
  fillEllipse(grid, cx + 18, 21, 3, 2, EH);
  fillRect(grid, cx - 34, 16, 8, 3, G);
  fillRect(grid, cx + 26, 16, 8, 3, G);

  // Layered prow plates facing the player.
  fillPoly(
    grid,
    [
      [cx, 132],
      [cx - 14, 118],
      [cx - 8, 108],
      [cx + 8, 108],
      [cx + 14, 118],
    ],
    G
  );
  fillPoly(
    grid,
    [
      [cx, 128],
      [cx - 8, 118],
      [cx, 112],
      [cx + 8, 118],
    ],
    LG
  );
  plot(grid, cx, 122, W);

  // Panel seams and rivets.
  for (const y of [40, 56, 72, 96, 112]) {
    fillRect(grid, cx - 26, y, 52, 1, S);
  }
  fillRect(grid, cx - 1, 30, 2, 46, S);
  for (let i = -2; i <= 2; i++) {
    plot(grid, cx + i * 8, 48, PG);
    plot(grid, cx + i * 8, 64, G);
    plot(grid, cx + i * 10, 104, LG);
  }

  // Magenta energy channels from the reference sheet.
  conduit(grid, cx, 30, 68);
  conduit(grid, cx, 94, 118);
  conduit(grid, cx - 16, 46, 70);
  conduit(grid, cx + 16, 46, 70);
  conduit(grid, cx - 16, 96, 110);
  conduit(grid, cx + 16, 96, 110);

  // Side armor lamps.
  for (const x of [cx - 40, cx + 40]) {
    fillRect(grid, x - 1, 60, 3, 10, BD);
    plot(grid, x, 64, BM);
    plot(grid, x, 68, BP);
  }

  if (openCore) {
    fillEllipse(grid, cx, coreY, 22, 18, K);
    ring(grid, cx, coreY, 18, 14, BD);
    fillEllipse(grid, cx, coreY, 13, 11, BM);
    fillEllipse(grid, cx, coreY, 8, 6, BP);
    fillEllipse(grid, cx, coreY, 3, 3, BC);
    plot(grid, cx, coreY, W);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      plot(grid, Math.round(cx + Math.cos(a) * 16), Math.round(coreY + Math.sin(a) * 13), LG);
    }
  } else {
    fillEllipse(grid, cx, coreY, 18, 15, EB);
    ring(grid, cx, coreY, 16, 12, DG);
    ring(grid, cx, coreY, 11, 8, MG);
    fillRect(grid, cx - 14, coreY - 1, 28, 2, G);
    fillRect(grid, cx - 1, coreY - 12, 2, 24, G);
    fillEllipse(grid, cx, coreY, 4, 3, S);
    plot(grid, cx - 6, coreY - 5, BM);
    plot(grid, cx + 6, coreY - 5, BM);
    plot(grid, cx - 6, coreY + 5, BD);
    plot(grid, cx + 6, coreY + 5, BD);
    plot(grid, cx, coreY, LG);
  }

  paintSocket(grid, cx - 78, turretY, openCore);
  paintSocket(grid, cx + 78, turretY, openCore);

  outline(grid, K);
  return grid;
}

export function buildBossTurret(): SpriteData {
  const grid = createGrid(BOSS_TURRET_SIZE, BOSS_TURRET_SIZE);
  const c = BOSS_TURRET_SIZE / 2;
  fillPoly(
    grid,
    [
      [c, 6],
      [c + 12, 10],
      [c + 16, 18],
      [c + 14, 28],
      [c + 8, 32],
      [c - 8, 32],
      [c - 14, 28],
      [c - 16, 18],
      [c - 12, 10],
    ],
    DG
  );
  fillPoly(
    grid,
    [
      [c, 10],
      [c + 8, 14],
      [c + 10, 22],
      [c + 6, 28],
      [c - 6, 28],
      [c - 10, 22],
      [c - 8, 14],
    ],
    MG
  );
  fillRect(grid, c - 7, 24, 4, 12, EB);
  fillRect(grid, c + 3, 24, 4, 12, EB);
  fillRect(grid, c - 6, 30, 2, 6, G);
  fillRect(grid, c + 4, 30, 2, 6, G);
  fillRect(grid, c - 3, 14, 6, 8, S);
  plot(grid, c - 1, 16, BM);
  plot(grid, c + 1, 16, BM);
  plot(grid, c, 20, BP);
  plot(grid, c - 8, 18, BD);
  plot(grid, c + 8, 18, BD);
  plot(grid, c, 12, W);
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

  const open =
    boss.phase === 'transition' ||
    boss.phase === 'phase2' ||
    boss.phase === 'transition3' ||
    boss.phase === 'phase3' ||
    boss.phase === 'death';
  const hull = open ? assets.hullOpen : assets.hull;
  drawEnemyFlame(ctx, boss.x - 16, boss.y - BOSS_HULL_H / 2 + 6, time);
  drawEnemyFlame(ctx, boss.x + 16, boss.y - BOSS_HULL_H / 2 + 6, time);
  draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);

  for (const part of boss.parts) {
    if (part.id === 'core') continue;
    if (!part.alive && !part.falling) {
      if (open) drawSocketSparks(ctx, part.worldX, part.worldY, time);
      continue;
    }
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
  const corePhase =
    boss.phase === 'transition' ||
    boss.phase === 'phase2' ||
    boss.phase === 'transition3' ||
    boss.phase === 'phase3';
  if (core && corePhase && core.alive) {
    const opening =
      boss.phase === 'transition' || boss.phase === 'transition3'
        ? Math.min(1, boss.phaseTime / 0.5)
        : 1;
    const pulse = 0.35 + 0.2 * Math.sin(time * 7);
    const phase3 = boss.phase === 'transition3' || boss.phase === 'phase3';
    ctx.save();
    ctx.globalAlpha = pulse * opening;
    ctx.fillStyle = PALETTE[phase3 ? COLOR.EXPLOSION_YELLOW : COLOR.BULLET_MAGENTA];
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

/** Code-drawn sparks on a destroyed turret socket. Not baked into the hull. */
function drawSocketSparks(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  if (Math.floor(time * 14) % 3 === 0) return;
  ctx.save();
  ctx.strokeStyle = PALETTE[COLOR.BULLET_MAGENTA];
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1;
  const spin = time * 8;
  for (let i = 0; i < 3; i++) {
    const a = spin + i * 2.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (8 + (i % 2) * 5), y + Math.sin(a) * 7);
    ctx.stroke();
  }
  ctx.restore();
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
