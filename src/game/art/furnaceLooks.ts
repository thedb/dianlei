/**
 * 炉心 (stage 3 boss) sprites and the furnace draw pass.
 * Chassis 200×132, pods 28×28, petals 24×24, core 32×32, palette indices only.
 * Every baked coordinate is a whole pixel. Core glow, flames, petal and pod
 * rotation, and the hit flash are drawn in code.
 */

import { FURNACE_HULL_H, FURNACE_HULL_W } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import type { BossRuntime } from '@/game/systems/boss';
import { bossLook } from '@/game/systems/boss';
import {
  FURNACE_CORE_ID,
  FURNACE_POD_IDS,
  furnaceCorePhase,
  furnaceOpenness,
  furnacePetals,
  furnacePodAngle,
} from '@/game/systems/furnace';
import { drawEnemyFlame } from './engineFlame';
import { createGrid, fillEllipse, fillPoly, fillRect, outline, plot } from './pixelDraw';
import type { SpriteData, SpriteFrame } from './types';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const W = COLOR.WHITE;
const EB = COLOR.ENEMY_BLACK;
const ER = COLOR.ENEMY_RED;
const BM = COLOR.BULLET_MAGENTA;
const BD = COLOR.BULLET_DARK;
const CY = COLOR.PLAYER_CYAN;
const CP = COLOR.PLAYER_PALE_CYAN;
const CD = COLOR.PLAYER_DARK_CYAN;
const OY = COLOR.EXPLOSION_ORANGE_YELLOW;
const OR = COLOR.EXPLOSION_ORANGE;
const RO = COLOR.EXPLOSION_RED_ORANGE;
const YE = COLOR.EXPLOSION_YELLOW;

export const FURNACE_POD_SIZE = 28;
export const FURNACE_PETAL_SIZE = 24;
export const FURNACE_CORE_SIZE = 32;
/** Throat channel under the socket, in chassis pixels. Matches `FURNACE_CORE_RADIUS` × 2. */
const THROAT_HALF = 20;
const SOCKET_R = 30;
const NOZZLE_DX = [-44, 44] as const;

function ring(
  grid: SpriteData,
  cx: number,
  cy: number,
  rOut: number,
  rIn: number,
  color: number
): void {
  for (let y = cy - rOut - 1; y <= cy + rOut + 1; y++) {
    for (let x = cx - rOut - 1; x <= cx + rOut + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rOut && d >= rIn) plot(grid, x, y, color);
    }
  }
}

function lightStrip(grid: SpriteData, x: number, y: number, w: number, h: number): void {
  fillRect(grid, x - 1, y - 1, w + 2, h + 2, CD);
  fillRect(grid, x, y, w, h, CY);
  if (w >= h) {
    for (let i = x + 2; i < x + w; i += 6) plot(grid, i, y, CP);
  } else {
    for (let i = y + 2; i < y + h; i += 6) plot(grid, x, i, CP);
  }
}

/** Wide floating chassis. `open` lights the socket and opens the throat shutter. */
export function buildFurnaceChassis(open: boolean): SpriteData {
  const w = FURNACE_HULL_W;
  const h = FURNACE_HULL_H;
  const cx = w / 2;
  const cy = h / 2;
  const grid = createGrid(w, h);

  fillPoly(
    grid,
    [
      [40, 2],
      [w - 40, 2],
      [w - 2, 38],
      [w - 2, h - 38],
      [w - 40, h - 2],
      [40, h - 2],
      [2, h - 38],
      [2, 38],
    ],
    S
  );
  fillPoly(
    grid,
    [
      [44, 8],
      [w - 44, 8],
      [w - 8, 42],
      [w - 8, h - 42],
      [w - 44, h - 8],
      [44, h - 8],
      [8, h - 42],
      [8, 42],
    ],
    DG
  );
  fillPoly(
    grid,
    [
      [56, 16],
      [w - 56, 16],
      [w - 24, 48],
      [w - 24, h - 48],
      [w - 56, h - 16],
      [56, h - 16],
      [24, h - 48],
      [24, 48],
    ],
    MG
  );

  // Rib plates and rivets.
  for (const y of [30, h - 31]) fillRect(grid, 40, y, w - 80, 1, S);
  for (const x of [52, w - 53]) fillRect(grid, x, 22, 1, h - 44, S);
  for (let i = 0; i < 6; i++) {
    plot(grid, 60 + i * 16, 24, G);
    plot(grid, 60 + i * 16, h - 25, G);
  }

  // Thruster blocks along the rear (top edge).
  for (const dx of NOZZLE_DX) {
    fillRect(grid, cx + dx - 9, 2, 18, 9, EB);
    fillRect(grid, cx + dx - 5, 3, 10, 5, S);
    fillRect(grid, cx + dx - 2, 4, 4, 2, ER);
  }

  // Cyan light strips (chassis look A).
  lightStrip(grid, 60, 12, 30, 2);
  lightStrip(grid, w - 90, 12, 30, 2);
  lightStrip(grid, 14, cy - 14, 2, 28);
  lightStrip(grid, w - 16, cy - 14, 2, 28);
  lightStrip(grid, 34, h - 22, 24, 2);
  lightStrip(grid, w - 58, h - 22, 24, 2);

  // Magenta status lamps on the shoulders.
  for (const [x, y] of [
    [30, 40],
    [w - 31, 40],
    [30, h - 41],
    [w - 31, h - 41],
  ] as const) {
    fillRect(grid, x - 1, y - 1, 3, 3, BD);
    plot(grid, x, y, BM);
  }

  // Iris socket.
  ring(grid, cx, cy, SOCKET_R + 6, SOCKET_R + 3, G);
  ring(grid, cx, cy, SOCKET_R + 3, SOCKET_R, DG);
  fillEllipse(grid, cx, cy, SOCKET_R, SOCKET_R, EB);
  if (open) {
    fillEllipse(grid, cx, cy, SOCKET_R - 4, SOCKET_R - 4, RO);
    fillEllipse(grid, cx, cy, SOCKET_R - 10, SOCKET_R - 10, OR);
  } else {
    ring(grid, cx, cy, SOCKET_R - 4, SOCKET_R - 7, S);
  }

  // Throat under the socket: the shot lane to the core while the iris is open.
  const throatTop = cy + SOCKET_R;
  const throatH = h - 4 - throatTop;
  fillRect(grid, cx - THROAT_HALF - 2, throatTop, THROAT_HALF * 2 + 4, throatH, EB);
  if (open) {
    fillRect(grid, cx - THROAT_HALF, throatTop, THROAT_HALF * 2, throatH, K);
    for (let y = throatTop + 2; y < throatTop + throatH; y += 5) {
      plot(grid, cx - THROAT_HALF, y, OR);
      plot(grid, cx + THROAT_HALF - 1, y, OR);
    }
  } else {
    fillRect(grid, cx - THROAT_HALF, throatTop, THROAT_HALF * 2, throatH, G);
    for (let y = throatTop + 4; y < throatTop + throatH; y += 6) {
      fillRect(grid, cx - THROAT_HALF, y, THROAT_HALF * 2, 1, DG);
    }
    fillRect(grid, cx - 1, throatTop, 2, throatH, MG);
  }

  outline(grid, K);
  return grid;
}

/** Orbiting gun pod. The barrel points down (outward); the draw rotates it by the orbit angle. */
export function buildFurnacePod(broken: boolean): SpriteData {
  const n = FURNACE_POD_SIZE;
  const c = n / 2;
  const grid = createGrid(n, n);
  if (broken) {
    fillEllipse(grid, c, c - 1, 10, 10, K);
    fillEllipse(grid, c, c - 1, 6, 6, S);
    plot(grid, c - 3, c - 4, OR);
    plot(grid, c + 3, c + 1, RO);
    plot(grid, c, c - 6, YE);
    plot(grid, c + 5, c - 3, BD);
    outline(grid, K);
    return grid;
  }
  fillEllipse(grid, c, c - 2, 11, 11, DG);
  fillEllipse(grid, c, c - 2, 8, 8, MG);
  fillEllipse(grid, c, c - 3, 4, 4, G);
  fillRect(grid, c - 2, c + 6, 4, 7, EB);
  fillRect(grid, c - 1, c + 7, 2, 5, S);
  plot(grid, c - 1, c + 12, ER);
  plot(grid, c, c + 12, ER);
  plot(grid, c - 1, c - 4, BM);
  plot(grid, c, c - 4, BM);
  plot(grid, c - 6, c - 2, CY);
  plot(grid, c + 5, c - 2, CY);
  plot(grid, c - 1, c - 8, LG);
  outline(grid, K);
  return grid;
}

/** Armor petal. Inner tip up (toward the core), outer edge down. */
export function buildFurnacePetal(): SpriteData {
  const n = FURNACE_PETAL_SIZE;
  const grid = createGrid(n, n);
  fillPoly(
    grid,
    [
      [12, 1],
      [21, 9],
      [21, 21],
      [3, 21],
      [3, 9],
    ],
    G
  );
  fillPoly(
    grid,
    [
      [12, 4],
      [18, 10],
      [18, 15],
      [6, 15],
      [6, 10],
    ],
    LG
  );
  fillRect(grid, 4, 18, 17, 2, MG);
  fillRect(grid, 11, 5, 2, 13, MG);
  plot(grid, 7, 19, CY);
  plot(grid, 16, 19, CY);
  plot(grid, 12, 6, W);
  outline(grid, K);
  return grid;
}

/** The furnace heart, seen through the open iris. */
export function buildFurnaceCore(): SpriteData {
  const n = FURNACE_CORE_SIZE;
  const c = n / 2;
  const grid = createGrid(n, n);
  fillEllipse(grid, c, c, 14, 14, RO);
  fillEllipse(grid, c, c, 11, 11, OR);
  fillEllipse(grid, c, c, 7, 7, OY);
  fillEllipse(grid, c, c, 4, 4, YE);
  fillRect(grid, c - 1, c - 1, 2, 2, W);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    plot(grid, Math.round(c + Math.cos(a) * 12), Math.round(c + Math.sin(a) * 12), YE);
  }
  outline(grid, K);
  return grid;
}

export interface FurnaceFrames {
  hull: SpriteFrame;
  hullOpen: SpriteFrame;
  parts: Record<string, SpriteFrame>;
}

export interface FurnaceDraw {
  drawImage(image: CanvasImageSource, x: number, y: number, w?: number, h?: number): void;
}

const DEG = Math.PI / 180;
/** Death: petals fly off from where they were, in px/s and °/s. */
const PETAL_FLY_SPEED = 90;
const PETAL_FLY_SPIN = 220;

function blitRotated(
  ctx: CanvasRenderingContext2D,
  draw: FurnaceDraw,
  frame: SpriteFrame,
  x: number,
  y: number,
  angleDeg: number
): void {
  if (angleDeg % 360 === 0) {
    draw.drawImage(frame.canvas, Math.round(x - frame.anchorX), Math.round(y - frame.anchorY));
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angleDeg * DEG);
  draw.drawImage(frame.canvas, -frame.anchorX, -frame.anchorY);
  ctx.restore();
}

/** Chassis, core, petals, pods, flames, glow, and the hit flash. */
export function drawFurnaceBoss(
  ctx: CanvasRenderingContext2D,
  draw: FurnaceDraw,
  boss: BossRuntime,
  assets: FurnaceFrames,
  time: number
): void {
  const look = bossLook(boss);
  if (!look) return;
  const open = furnaceOpenness(boss);
  const corePhase = furnaceCorePhase(boss.phases[boss.phaseIndex]);
  const hull = corePhase && (open > 0.05 || boss.stage === 'death') ? assets.hullOpen : assets.hull;
  const top = boss.y - FURNACE_HULL_H / 2;
  for (const dx of NOZZLE_DX) drawEnemyFlame(ctx, boss.x + dx, top + 4, time);

  const hx = Math.round(boss.x - hull.anchorX);
  const hy = Math.round(boss.y - hull.anchorY);
  draw.drawImage(hull.canvas, hx, hy);

  const core = boss.parts.find((part) => part.id === FURNACE_CORE_ID);
  const coreFrame = assets.parts.core;
  if (core && coreFrame && corePhase) {
    draw.drawImage(
      coreFrame.canvas,
      Math.round(core.worldX - coreFrame.anchorX),
      Math.round(core.worldY - coreFrame.anchorY)
    );
    const glow = look.glow;
    if (glow) {
      const color = glow.color === 'yellow' ? COLOR.EXPLOSION_YELLOW : COLOR.EXPLOSION_ORANGE;
      const pulse = 0.3 + 0.2 * Math.sin(time * 7);
      ctx.save();
      ctx.globalAlpha = pulse * glow.opening * (0.35 + 0.65 * open);
      ctx.fillStyle = PALETTE[color];
      ctx.beginPath();
      ctx.arc(core.worldX, core.worldY, 18 + 6 * open, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const petal = assets.parts.petal;
  if (petal) {
    const dying = boss.stage === 'death';
    for (const p of furnacePetals(boss)) {
      let { x, y, angle } = p;
      if (dying) {
        const d = boss.phaseTime * PETAL_FLY_SPEED;
        x += -Math.sin(angle * DEG) * d;
        y += Math.cos(angle * DEG) * d;
        angle += boss.phaseTime * PETAL_FLY_SPIN;
      }
      blitRotated(ctx, draw, petal, x, y, angle);
    }
  }

  const pod = assets.parts.pod;
  const podBroken = assets.parts.podBroken;
  FURNACE_POD_IDS.forEach((id, i) => {
    const part = boss.parts.find((p) => p.id === id);
    if (!part) return;
    const frame = part.alive ? pod : podBroken;
    if (!frame) return;
    blitRotated(ctx, draw, frame, part.worldX, part.worldY, furnacePodAngle(boss, i));
  });

  if (look.smoke) {
    ctx.save();
    ctx.fillStyle = PALETTE[COLOR.LIGHT_GRAY];
    for (let i = 0; i < 4; i++) {
      const rise = (time * 18 + i * 9) % 22;
      ctx.globalAlpha = 0.35 * (1 - rise / 22);
      ctx.beginPath();
      ctx.arc(boss.x + (i - 1.5) * 44, top + 12 - rise, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (boss.hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    draw.drawImage(hull.canvas, hx, hy);
    ctx.restore();
  }
}
