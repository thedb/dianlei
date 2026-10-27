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
  TIEBAO_BUFFER,
  TIEBAO_HULL_W,
  TIEBAO_LOOK,
  TIEBAO_RAIL_X,
  TIEBAO_TAIL_LAMP_H,
  TIEBAO_TAIL_LAMP_W,
  TIEBAO_TAIL_LAMP_X,
  TIEBAO_TAIL_LAMP_Y_FROM_BOTTOM,
} from '@/game/config';
import { PALETTE, COLOR } from '@/game/palette';
import type { BossHpBarLayout, BossRuntime } from '@/game/systems/boss';
import { bossActiveLaser, bossLook } from '@/game/systems/boss';
import {
  tiebaoCarPoses,
  tiebaoClosureX,
  tiebaoLiveHull,
  tiebaoPartMount,
  tiebaoSpanMarks,
  tiebaoVisual,
  type TiebaoCarPose,
  type TiebaoVisual,
} from '@/game/systems/tiebao';
import { tiebaoTailLampLocals } from '@/game/systems/tiebaoShed';
import { laserSweepRadians } from '@/game/systems/danmaku';
import { buildTiebaoHull } from './tiebaoLooks';
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
/** Roof gun. Barrel points down-screen, back at the player chasing the train. */
export function buildTiebaoAa(broken: boolean): SpriteData {
  const g = createGrid(16, 16, -1);
  const EY = COLOR.EXPLOSION_YELLOW;
  fillRect(g, 2, 2, 12, 5, MG);
  fillRect(g, 4, 6, 8, 3, G);
  fillRect(g, 2, 3, 4, 2, EY);
  fillRect(g, 10, 3, 4, 2, K);
  if (!broken) {
    fillRect(g, 7, 7, 2, 7, DG);
    fillRect(g, 5, 13, 6, 2, K);
    plot(g, 8, 14, EH);
  } else {
    fillRect(g, 4, 8, 8, 3, K);
    plot(g, 3, 11, COLOR.EXPLOSION_ORANGE);
    plot(g, 12, 11, EY);
    plot(g, 8, 9, W);
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
  const top = boss.y - (tiebao ? tiebaoLiveHull(boss).h : boss.def.hull.h) / 2;
  if (tiebao) drawTiebaoGround(ctx, boss, time);
  else {
    drawEnemyFlame(ctx, boss.x - 16, top + 6, time);
    drawEnemyFlame(ctx, boss.x + 16, top + 6, time);
  }
  if (tiebao) drawTiebaoHull(ctx, hull, boss);
  else draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);

  for (const part of boss.parts) {
    if (!part.sprite) continue;
    const bank = tiebaoPartBank(boss, part);
    if (!part.alive && !part.falling) {
      const broken = assets.parts[`${part.sprite}Broken`];
      if (broken) {
        drawPartSprite(ctx, draw, broken, part.worldX, part.worldY, bank);
        continue;
      }
      if (open) drawSocketSparks(ctx, part.worldX, part.worldY, time);
      continue;
    }
    const frame = assets.parts[part.sprite];
    if (!frame) continue;
    drawPartSprite(ctx, draw, frame, part.worldX, part.worldY, bank);
  }

  if (tiebao) drawTiebaoAir(ctx, boss, time, look.smoke);

  if (boss.hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    if (tiebao) drawTiebaoHull(ctx, hull, boss);
    else draw.drawImage(hull.canvas, boss.x - hull.anchorX, boss.y - hull.anchorY);
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

/** Bank of the rigid car this part is bolted to. Falling debris stays upright. */
function tiebaoPartBank(boss: BossRuntime, part: BossRuntime['parts'][number]): number {
  if (boss.def.art !== 'tiebao' || part.falling) return 0;
  return tiebaoPartMount(boss, part.id)?.angle ?? 0;
}

/**
 * Roof guns share the parent car's rotate. A zero bank keeps the untransformed
 * blit, so a straight rail does not shift the sprite by a subpixel.
 */
function drawPartSprite(
  ctx: CanvasRenderingContext2D,
  draw: BossDraw,
  frame: SpriteFrame,
  x: number,
  y: number,
  angle: number
): void {
  if (angle === 0) {
    draw.drawImage(frame.canvas, x - frame.anchorX, y - frame.anchorY);
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.rotate(angle);
  draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

/** Straight crop. The tail beam is the bottom of the full sprite, pasted on the live tail. */
function blitTiebaoStraight(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  centerX: number,
  top: number,
  height: number
): void {
  const left = Math.floor(centerX - TIEBAO_HULL_W / 2);
  const stamp = Math.min(TIEBAO_BUFFER, height);
  const body = height - stamp;
  if (body > 0) {
    ctx.drawImage(frame.canvas, 0, 0, TIEBAO_HULL_W, body, left, top, TIEBAO_HULL_W, body);
  }
  ctx.drawImage(
    frame.canvas,
    0,
    frame.height - stamp,
    TIEBAO_HULL_W,
    stamp,
    left,
    top + body,
    TIEBAO_HULL_W,
    stamp
  );
}

/**
 * One rigid crop. Rows above the tail stamp come from the live sprite.
 * The stamp itself is the bottom of the full consist, pasted onto this piece
 * so the beam stays on the last car. Rotation is the pose bank; pixels are
 * not sheared.
 */
function blitTiebaoRigid(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  pose: TiebaoCarPose,
  bodyEnd: number,
  height: number
): void {
  const row1 = pose.row + pose.h;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  const localTop = -pose.h / 2;
  const body0 = Math.max(pose.row, 0);
  const body1 = Math.min(row1, bodyEnd);
  if (body1 > body0) {
    ctx.drawImage(
      frame.canvas,
      0,
      body0,
      TIEBAO_HULL_W,
      body1 - body0,
      -TIEBAO_HULL_W / 2,
      localTop + (body0 - pose.row),
      TIEBAO_HULL_W,
      body1 - body0
    );
  }
  const stamp0 = Math.max(pose.row, bodyEnd);
  const stamp1 = Math.min(row1, height);
  if (stamp1 > stamp0) {
    ctx.drawImage(
      frame.canvas,
      0,
      frame.height - (height - stamp0),
      TIEBAO_HULL_W,
      stamp1 - stamp0,
      -TIEBAO_HULL_W / 2,
      localTop + (stamp0 - pose.row),
      TIEBAO_HULL_W,
      stamp1 - stamp0
    );
  }
  ctx.restore();
}

/**
 * Crop the full consist to the cars still attached and paste the tail beam
 * onto the bottom. On a straight rail this is one blit. On a turnout each
 * remaining car is its own rectangle, banked onto the same curve as the
 * painted rails. Shed cars leave with the crop. Strips are not offset.
 */
function drawTiebaoHull(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  boss: BossRuntime
): void {
  const height = tiebaoLiveHull(boss).h;
  const top = Math.floor(boss.y - height / 2);
  const poses = tiebaoCarPoses(boss);
  const anchor = poses[0];
  const straight =
    anchor !== undefined && poses.every((pose) => pose.angle === 0 && pose.x === anchor.x);
  if (straight) {
    blitTiebaoStraight(ctx, frame, anchor.x, top, height);
    return;
  }
  const bodyEnd = height - Math.min(TIEBAO_BUFFER, height);
  for (const pose of poses) blitTiebaoRigid(ctx, frame, pose, bodyEnd, height);
}

function drawRailPixels(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const xi = Math.round(x);
  ctx.fillStyle = PALETTE[COLOR.GRAY];
  ctx.fillRect(xi - 2, y, 1, 1);
  ctx.fillRect(xi + 1, y, 1, 1);
  ctx.fillStyle = PALETTE[COLOR.BLACK];
  ctx.fillRect(xi - 1, y, 1, 1);
  ctx.fillStyle = PALETTE[COLOR.PALE_GRAY];
  ctx.fillRect(xi, y, 1, 1);
}

function nearestStock(x: number): number {
  let best = Infinity;
  for (const rail of TIEBAO_RAIL_X) best = Math.min(best, Math.abs(x - rail));
  return best;
}

/**
 * Point blade beside the stock. The stock centerline is left alone; the
 * straight rail is redrawn on top of the whole closure afterwards.
 */
function drawSwitchPoints(
  ctx: CanvasRenderingContext2D,
  stockX: number,
  y: number,
  dir: number
): void {
  const xi = Math.round(stockX);
  const len = 28;
  for (let i = 0; i < len; i++) {
    const py = Math.round(y) - i;
    if (py < 0 || py >= LOGICAL_H) continue;
    const open = 5 + Math.round((i / (len - 1)) * 7);
    const bx = xi + open * dir;
    if (i % 4 === 0) {
      ctx.fillStyle = PALETTE[COLOR.TERRAIN_CONCRETE];
      ctx.fillRect(Math.min(xi + 4 * dir, bx), py, Math.abs(bx - (xi + 4 * dir)) + 1, 2);
    }
    drawRailPixels(ctx, bx, py);
  }
}

/**
 * Frog wing on the diverging side of the target stock. The stock itself is
 * not painted here, so the straight rail is not cut.
 */
function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  for (let i = -8; i <= 8; i++) {
    const py = yi + i;
    if (py < 0 || py >= LOGICAL_H) continue;
    const gap = 5 + Math.round(Math.abs(i) * 0.45);
    const bx = xi + dir * gap;
    if (Math.abs(i) % 4 === 0) {
      ctx.fillStyle = PALETTE[COLOR.TERRAIN_CONCRETE];
      const left = Math.min(xi + dir * 5, bx);
      ctx.fillRect(left, py, Math.abs(bx - (xi + dir * 5)) + 1, 2);
    }
    drawRailPixels(ctx, bx, py);
  }
}

/** Straight stock steel, on top of any closure paint in this span. */
function drawStockSteel(ctx: CanvasRenderingContext2D, y0: number, y1: number): void {
  const yStart = Math.max(0, Math.floor(y0));
  const yEnd = Math.min(LOGICAL_H, Math.ceil(y1));
  const h = yEnd - yStart;
  if (h <= 0) return;
  for (const rail of TIEBAO_RAIL_X) {
    const xi = Math.round(rail);
    ctx.fillStyle = PALETTE[COLOR.GRAY];
    ctx.fillRect(xi - 2, yStart, 1, h);
    ctx.fillRect(xi + 1, yStart, 1, h);
    ctx.fillStyle = PALETTE[COLOR.BLACK];
    ctx.fillRect(xi - 1, yStart, 1, h);
    ctx.fillStyle = PALETTE[COLOR.PALE_GRAY];
    ctx.fillRect(xi, yStart, 1, h);
  }
}

type ClosureSpan = TiebaoVisual['turnouts'][number];

/**
 * Diverging route only: points, closure steel, frog. Samples are `tiebaoClosureX`,
 * the same curve the cars ride. Pixels on a stock rail are skipped, and the
 * three stock rails are redrawn straight through the span. No highlight.
 */
function drawClosure(ctx: CanvasRenderingContext2D, span: ClosureSpan): void {
  const yStart = Math.max(0, Math.floor(span.y0));
  const yEnd = Math.min(LOGICAL_H, Math.ceil(span.y1));
  for (let y = yStart; y < yEnd; y++) {
    const x = tiebaoClosureX(y, span.fromX, span.toX, span.y0, span.y1);
    const clear = nearestStock(x);
    if (clear < 6) continue;
    if ((y & 3) < 2 && clear > 14) {
      ctx.fillStyle = PALETTE[COLOR.TERRAIN_CONCRETE];
      ctx.fillRect(Math.round(x) - 6, y, 12, 1);
    }
    drawRailPixels(ctx, x, y);
  }
  for (const mark of tiebaoSpanMarks(span.y0, span.y1, span.fromX, span.toX)) {
    if (mark.y < -40 || mark.y > LOGICAL_H + 8) continue;
    const dir = mark.joinX >= mark.stockX ? 1 : -1;
    if (mark.kind === 'points') drawSwitchPoints(ctx, mark.stockX, mark.y, dir);
    else drawFrog(ctx, mark.joinX, mark.y, dir);
  }
  drawStockSteel(ctx, span.y0, span.y1);
}

/** Turnout, warning circles, and the rail-break sparks under the train. */
function drawTiebaoGround(ctx: CanvasRenderingContext2D, boss: BossRuntime, time: number): void {
  const visual = tiebaoVisual(boss);
  ctx.save();
  if (visual) {
    for (const turnout of visual.turnouts) drawClosure(ctx, turnout);
  }
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
    boss.parts.forEach((part, i) => {
      const rise = (time * 18 + i * 9) % 22;
      ctx.globalAlpha = 0.35 * (1 - rise / 22);
      ctx.beginPath();
      ctx.arc(part.worldX, part.worldY - 8 - rise, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  drawTiebaoTailBrighten(ctx, boss, time, visual.ramWarn);
  ctx.restore();
}

/**
 * Ram-warn blink only. The pair itself is the buffer stamp on the last car.
 * A steady second pair, or one shifted by `sin(angle) * along` before the
 * rotate, ghosts beside the beam while the consist is on a turnout.
 */
export function tiebaoTailLampsFlash(ramWarn: boolean, time: number): boolean {
  return ramWarn && Math.floor(time * 16) % 2 === 0;
}

function drawTiebaoTailBrighten(
  ctx: CanvasRenderingContext2D,
  boss: BossRuntime,
  time: number,
  ramWarn: boolean
): void {
  if (!tiebaoTailLampsFlash(ramWarn, time)) return;
  const poses = tiebaoCarPoses(boss);
  const tail = poses.length > 0 ? poses[poses.length - 1] : undefined;
  const anchor = poses[0];
  if (!tail || !anchor) return;
  const straight = poses.every((pose) => pose.angle === 0 && pose.x === anchor.x);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = PALETTE[COLOR.EXPLOSION_YELLOW];
  ctx.imageSmoothingEnabled = false;
  if (straight) {
    const height = tiebaoLiveHull(boss).h;
    const left = Math.floor(anchor.x - TIEBAO_HULL_W / 2);
    const top = Math.floor(boss.y - height / 2);
    const y = top + height - TIEBAO_TAIL_LAMP_Y_FROM_BOTTOM;
    for (const sx of TIEBAO_TAIL_LAMP_X) {
      ctx.fillRect(left + sx, y, TIEBAO_TAIL_LAMP_W, TIEBAO_TAIL_LAMP_H);
    }
  } else {
    ctx.translate(tail.x, tail.y);
    ctx.rotate(tail.angle);
    for (const lamp of tiebaoTailLampLocals(tail.h)) {
      ctx.fillRect(lamp.x, lamp.y, lamp.w, lamp.h);
    }
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
