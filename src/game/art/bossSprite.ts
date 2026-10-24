/**
 * Orbital battleship sprites (design §6.2, wave table §5.1).
 * Hull 220×140, turrets 40×40, palette indices only.
 * Engine flame, core glow, laser, and hit flash are drawn in code.
 */

import {
  BOSS_HULL_H,
  BOSS_HULL_W,
  BOSS_TURRET_SIZE,
  LOGICAL_H,
  TIEBAO_LOOK,
  TIEBAO_PARK_Y,
  TIEBAO_RAIL_X,
  TIEBAO_SWITCH_SPAN,
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import type { BossHpBarLayout, BossRuntime } from '@/game/systems/boss';
import { bossActiveLaser, bossLook } from '@/game/systems/boss';
import { tiebaoSwitchX, tiebaoVisual } from '@/game/systems/tiebao';
import { buildTiebaoHull } from './tiebaoLooks';
import { laserSweepRadians } from '@/game/systems/danmaku';
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
  /** Part sprites keyed by `BossPartDef.sprite`. */
  parts: Record<string, SpriteFrame>;
}

/** Boss art registry, keyed by `BossDef.art`. A new boss adds one builder here. */
function buildTiebaoAa(broken: boolean): SpriteData {
  const g = createGrid(16, 16, -1);
  const EY = COLOR.EXPLOSION_YELLOW;
  fillRect(g, 2, 9, 12, 5, MG);
  fillRect(g, 4, 7, 8, 3, G);
  fillRect(g, 2, 12, 4, 2, EY);
  fillRect(g, 10, 12, 4, 2, K);
  if (!broken) {
    fillRect(g, 7, 2, 2, 8, DG);
    fillRect(g, 5, 1, 6, 2, K);
    plot(g, 8, 2, EH);
  } else {
    fillRect(g, 4, 5, 8, 3, K);
    plot(g, 3, 4, COLOR.EXPLOSION_ORANGE);
    plot(g, 12, 4, EY);
    plot(g, 8, 6, W);
  }
  outline(g, K);
  return g;
}

export const BOSS_ART: Readonly<Record<string, () => BossAssets>> = {
  orbital: () => ({
    hull: renderSprite(buildBossHull(false)),
    hullOpen: renderSprite(buildBossHull(true)),
    parts: { turret: renderSprite(buildBossTurret()) },
  }),
  tiebao: () => ({
    hull: renderSprite(buildTiebaoHull(TIEBAO_LOOK, false)),
    hullOpen: renderSprite(buildTiebaoHull(TIEBAO_LOOK, true)),
    parts: {
      aa: renderSprite(buildTiebaoAa(false)),
      aaBroken: renderSprite(buildTiebaoAa(true)),
    },
  }),
};

/** Bake every registered boss. */
export function createBossAssets(): Record<string, BossAssets> {
  const out: Record<string, BossAssets> = {};
  for (const [key, build] of Object.entries(BOSS_ART)) out[key] = build();
  return out;
}

export interface BossDraw {
  drawImage(image: CanvasImageSource, x: number, y: number, w?: number, h?: number): void;
}

const GLOW_COLOR = {
  magenta: COLOR.BULLET_MAGENTA,
  yellow: COLOR.EXPLOSION_YELLOW,
  orange: COLOR.EXPLOSION_ORANGE,
} as const;

/** Hull, part sprites, engine flame, and the phase glow. The laser is drawn separately. */
export function drawBossWorld(
  ctx: CanvasRenderingContext2D,
  draw: BossDraw,
  boss: BossRuntime,
  bosses: Readonly<Record<string, BossAssets>>,
  time: number
): void {
  const look = bossLook(boss);
  const assets = bosses[boss.def.art];
  if (!look || !assets) return;

  const open = look.hull === 'open';
  const hull = open ? assets.hullOpen : assets.hull;
  const tiebao = boss.def.art === 'tiebao';
  const top = boss.y - boss.def.hull.h / 2;
  if (tiebao) drawTiebaoGround(ctx, boss, time);
  else {
    drawEnemyFlame(ctx, boss.x - 16, top + 6, time);
    drawEnemyFlame(ctx, boss.x + 16, top + 6, time);
  }
  draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);

  for (const part of boss.parts) {
    if (!part.sprite) continue;
    if (!part.alive && !part.falling) {
      const broken = assets.parts[`${part.sprite}Broken`];
      if (broken) {
        draw.drawImage(broken.canvas, part.worldX - broken.anchorX, part.worldY - broken.anchorY);
        continue;
      }
      if (open) drawSocketSparks(ctx, part.worldX, part.worldY, time);
      continue;
    }
    const frame = assets.parts[part.sprite];
    if (!frame) continue;
    draw.drawImage(frame.canvas, part.worldX - frame.anchorX, part.worldY - frame.anchorY);
  }

  if (tiebao) drawTiebaoAir(ctx, boss, time, look.smoke);

  if (boss.hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);
    ctx.restore();
  }

  const glow = look.glow;
  if (glow) {
    const pulse = 0.35 + 0.2 * Math.sin(time * 7);
    ctx.save();
    ctx.globalAlpha = pulse * glow.opening;
    ctx.fillStyle = PALETTE[GLOW_COLOR[glow.color]];
    ctx.beginPath();
    ctx.arc(glow.part.worldX, glow.part.worldY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85 * glow.opening;
    ctx.fillStyle = PALETTE[COLOR.BULLET_CORE];
    ctx.beginPath();
    ctx.arc(glow.part.worldX, glow.part.worldY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** The converging point-rail the train rides. Map tiles keep the three straight rails. */
function drawTurnout(ctx: CanvasRenderingContext2D, fromX: number, toX: number, u: number): void {
  const y0 = Math.max(0, Math.floor(TIEBAO_PARK_Y - TIEBAO_SWITCH_SPAN + u * TIEBAO_SWITCH_SPAN));
  const y1 = Math.min(LOGICAL_H, Math.ceil(y0 + TIEBAO_SWITCH_SPAN));
  ctx.fillStyle = PALETTE[COLOR.TERRAIN_CONCRETE];
  for (let y = y0; y < y1; y += 8) {
    const x = Math.round(tiebaoSwitchX(y, fromX, toX, u));
    ctx.fillRect(x - 8, y, 16, 2);
  }
  for (let y = y0; y < y1; y++) {
    const x = Math.round(tiebaoSwitchX(y, fromX, toX, u));
    ctx.fillStyle = PALETTE[COLOR.BLACK];
    ctx.fillRect(x - 2, y, 1, 1);
    ctx.fillRect(x + 2, y, 1, 1);
    ctx.fillStyle = PALETTE[COLOR.PALE_GRAY];
    ctx.fillRect(x - 1, y, 2, 1);
  }
}

/** Turnout, warning circles, and the rail-break sparks under the train. */
function drawTiebaoGround(ctx: CanvasRenderingContext2D, boss: BossRuntime, time: number): void {
  const visual = tiebaoVisual(boss);
  ctx.save();
  if (visual?.switch) drawTurnout(ctx, visual.switch.fromX, visual.switch.toX, visual.switch.u);
  if (visual?.rocketWarn) {
    ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
    for (const x of TIEBAO_RAIL_X) ctx.fillRect(x - 1, 4, 3, 3);
  }
  if (visual?.broken) {
    ctx.fillStyle = PALETTE[COLOR.EXPLOSION_ORANGE];
    for (let i = 0; i < TIEBAO_RAIL_X.length; i++) {
      const x = TIEBAO_RAIL_X[i] ?? 0;
      if (Math.floor(time * 12 + i) % 2 === 0) {
        ctx.fillRect(x - 1, 180 + ((time * 40 + i * 50) % 280), 3, 3);
      }
    }
  }
  if (visual) {
    for (const circle of visual.circles) {
      ctx.globalAlpha = 0.35 + 0.45 * circle.u;
      ctx.strokeStyle = PALETTE[COLOR.EXPLOSION_ORANGE];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.radius * (0.35 + 0.65 * circle.u), 0, Math.PI * 2);
      ctx.stroke();
      const shellY = circle.fromY + (circle.y - circle.fromY) * circle.u;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
      ctx.fillRect(circle.x - 1, shellY - 2, 3, 4);
    }
  }
  ctx.restore();
}

/** Falling crates and overload smoke. Drawn over the hull. */
function drawTiebaoAir(
  ctx: CanvasRenderingContext2D,
  boss: BossRuntime,
  time: number,
  smoke: boolean
): void {
  const visual = tiebaoVisual(boss);
  if (!visual) return;
  ctx.save();
  for (const crate of visual.crates) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE[COLOR.GROUND_OLIVE];
    ctx.fillRect(crate.x - 6, crate.y - 5, 12, 10);
    ctx.fillStyle = PALETTE[Math.floor(time * 8) % 2 === 0 ? COLOR.EXPLOSION_YELLOW : COLOR.BLACK];
    ctx.fillRect(crate.x - 6, crate.y - 1, 12, 2);
  }
  if (smoke || visual.smoke) {
    ctx.fillStyle = PALETTE[COLOR.LIGHT_GRAY];
    for (let i = 0; i < 4; i++) {
      const rise = (time * 18 + i * 11) % 28;
      ctx.globalAlpha = 0.35 * (1 - rise / 28);
      ctx.beginPath();
      ctx.arc(boss.x - 8 + i * 6, boss.y + 36 - rise, 3 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (visual.ramWarn && Math.floor(time * 16) % 2 === 0) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
    ctx.fillRect(boss.x - 16, boss.y + boss.def.hull.h / 2 - 10, 8, 3);
    ctx.fillRect(boss.x + 8, boss.y + boss.def.hull.h / 2 - 10, 8, 3);
  }
  ctx.restore();
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

/** The current phase's telegraph line or sweeping beam, from its origin part. */
export function drawBossLaser(
  ctx: CanvasRenderingContext2D,
  boss: BossRuntime,
  time: number
): void {
  const active = bossActiveLaser(boss);
  if (!active) return;
  const ang = laserSweepRadians(active.state);
  const len = LOGICAL_H;
  const { originX, originY } = active;
  const x2 = originX + Math.cos(ang) * len;
  const y2 = originY + Math.sin(ang) * len;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = PALETTE[COLOR.BULLET_PINK];
  if (active.state.mode === 'telegraph') {
    ctx.globalAlpha = Math.floor(time * 16) % 2 === 0 ? 0.9 : 0.25;
    ctx.lineWidth = 2;
  } else {
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = active.spec.width;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE[COLOR.BULLET_CORE];
    ctx.lineWidth = Math.max(2, active.spec.width * 0.35);
  }
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function clampUnit(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Top HUD bar. One red fill, plus a yellow slot on the right when the boss has
 * an armed extra phase (Hard phase 3); damage to the main phases does not eat it.
 */
export function drawBossHpBar(
  ctx: CanvasRenderingContext2D,
  layout: BossHpBarLayout,
  x = 48,
  y = 32,
  w = 264,
  h = 8
): void {
  const mainFill = clampUnit(layout.mainFill);
  const phase3Fill = clampUnit(layout.extraFill);
  const phase3Span = clampUnit(layout.extraSpan);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);

  const innerX = x + 1;
  const innerY = y + 1;
  const innerW = Math.max(0, w - 2);
  const innerH = Math.max(0, h - 2);
  const split = phase3Span > 0.001 && innerW > 4;
  const phase3W = split ? Math.max(2, Math.min(innerW - 3, Math.round(innerW * phase3Span))) : 0;
  const divider = split ? 1 : 0;
  const mainW = innerW - phase3W - divider;

  if (mainW > 0 && mainFill > 0) {
    const mainDraw = Math.max(0, Math.min(mainW, Math.round(mainW * mainFill)));
    if (mainDraw > 0) {
      ctx.fillStyle = PALETTE[COLOR.ENEMY_VIVID_RED];
      ctx.fillRect(innerX, innerY, mainDraw, innerH);
    }
  }
  if (split) {
    const phaseX = innerX + mainW + divider;
    ctx.fillStyle = PALETTE[COLOR.ENEMY_CRIMSON];
    ctx.fillRect(phaseX, innerY, phase3W, innerH);
    const phaseDraw = Math.max(0, Math.min(phase3W, Math.round(phase3W * phase3Fill)));
    if (phaseDraw > 0) {
      ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
      ctx.fillRect(phaseX, innerY, phaseDraw, innerH);
    }
    ctx.fillStyle = PALETTE[COLOR.WHITE];
    ctx.fillRect(innerX + mainW, innerY, divider, innerH);
  }

  ctx.strokeStyle = PALETTE[COLOR.ENEMY_BRIGHT_RED];
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
