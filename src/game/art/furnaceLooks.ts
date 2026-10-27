/**
 * 炉心 (stage 3 boss) sprites and the furnace draw pass.
 * Chassis 200×132, pods 28×28 (intact / active / wrecked, plus the active
 * highlight ring), petals 24×24, core 32×32, palette indices only. Every baked
 * coordinate is a whole pixel. Core glow, flames, petal and pod rotation, the
 * highlight blink, pod muzzle glow / smoke / wreck sparks, and the hit flash
 * are drawn in code.
 */

import {
  FURNACE_HULL_H,
  FURNACE_HULL_W,
  FURNACE_POD_MARK_FLASH,
  FURNACE_POD_MARK_HZ,
  FURNACE_POD_MUZZLE,
  FURNACE_POD_SMOKE_ON,
  FURNACE_POD_SMOKE_PERIOD,
  FURNACE_POD_SPARK_TIME,
} from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import type { BossRuntime } from '@/game/systems/boss';
import { bossLook } from '@/game/systems/boss';
import {
  FURNACE_CORE_ID,
  FURNACE_POD_IDS,
  furnaceCorePhase,
  furnaceLastWreckAge,
  furnaceOpenness,
  furnacePetals,
  furnaceOffset,
  furnacePodAngle,
  furnacePodLook,
  furnacePodWreckAge,
  type FurnacePodLook,
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
const RD = COLOR.ENEMY_DARK_RED;
const RC = COLOR.ENEMY_CRIMSON;
const BR = COLOR.TERRAIN_BROWN;
const RR = COLOR.ENEMY_RED;
const PG = COLOR.PALE_GRAY;

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
    DG
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
    MG
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
    G
  );

  // Bright rust trim along the deck plate's straight edges.
  fillRect(grid, 44, 8, w - 88, 1, RO);
  fillRect(grid, 44, h - 9, w - 88, 1, RO);
  fillRect(grid, 8, 42, 1, h - 84, RO);
  fillRect(grid, w - 9, 42, 1, h - 84, RO);
  for (let x = 48; x < w - 48; x += 12) plot(grid, x, 8, OR);

  // Rib plates and rivets.
  for (const y of [30, h - 31]) fillRect(grid, 40, y, w - 80, 1, MG);
  for (const x of [52, w - 53]) fillRect(grid, x, 22, 1, h - 44, MG);
  for (let i = 0; i < 6; i++) {
    plot(grid, 60 + i * 16, 24, LG);
    plot(grid, 60 + i * 16, h - 25, LG);
  }

  // Scrap-port wear: rust runs under the rivets and on the hull flanks.
  for (let i = 0; i < 6; i++) {
    const x = 61 + i * 16;
    const run = 3 + (i % 3);
    fillRect(grid, x, 25, 1, run, RR);
    plot(grid, x, 25 + run, RO);
    fillRect(grid, x, h - 24, 1, run - 1, RR);
  }
  for (const [x, y, rw, rh] of [
    [12, 50, 3, 5],
    [w - 15, 76, 3, 6],
    [30, h - 30, 4, 2],
    [w - 40, 20, 5, 2],
  ] as const) {
    fillRect(grid, x, y, rw, rh, RR);
    plot(grid, x, y, RO);
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
  ring(grid, cx, cy, SOCKET_R + 6, SOCKET_R + 3, LG);
  ring(grid, cx, cy, SOCKET_R + 3, SOCKET_R, MG);
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
    fillRect(grid, cx - THROAT_HALF, throatTop, THROAT_HALF * 2, throatH, LG);
    for (let y = throatTop + 4; y < throatTop + throatH; y += 6) {
      fillRect(grid, cx - THROAT_HALF, y, THROAT_HALF * 2, 1, MG);
    }
    fillRect(grid, cx - 1, throatTop, 2, throatH, G);
  }

  outline(grid, K);
  return grid;
}

/** Pod hex seat: flat top and bottom, points left and right, centered on (14, 11). */
const POD_HEX: ReadonlyArray<readonly [number, number]> = [
  [3, 11],
  [8, 2],
  [19, 2],
  [24, 11],
  [19, 20],
  [8, 20],
];
const POD_HEX_IN: ReadonlyArray<readonly [number, number]> = [
  [7, 11],
  [10, 5],
  [17, 5],
  [20, 11],
  [17, 17],
  [10, 17],
];

function podBarrel(grid: SpriteData, c: number, end: number, lit: boolean): void {
  fillRect(grid, c - 2, 15, 4, end - 15, EB);
  fillRect(grid, c - 1, 15, 1, end - 15, lit ? G : MG);
  fillRect(grid, c, 15, 1, end - 15, lit ? MG : S);
}

/**
 * Orbiting gun pod: a hex seat, a turret cap, and a barrel pointing down
 * (outward); the draw rotates it by the orbit angle. `active` (the pod that
 * takes damage now) adds cracks, a chipped corner, and dark red strips. `wrecked` is the seat ring left on
 * the orbit with a black hole and a snapped barrel stub.
 */
export function buildFurnacePod(look: FurnacePodLook): SpriteData {
  const n = FURNACE_POD_SIZE;
  const c = n / 2;
  const grid = createGrid(n, n);
  if (look === 'wrecked') {
    fillPoly(grid, POD_HEX, DG);
    fillPoly(grid, POD_HEX_IN, K);
    fillEllipse(grid, c, 11, 4, 4, S);
    fillEllipse(grid, c, 11, 3, 3, K);
    for (const [x, y, w, h] of [
      [3, 8, 4, 6],
      [17, 2, 3, 3],
      [19, 16, 4, 3],
    ] as const) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy]![xx] = -1;
    }
    fillRect(grid, c - 2, 18, 4, 4, EB);
    fillRect(grid, c - 1, 18, 1, 4, DG);
    plot(grid, c - 2, 22, EB);
    plot(grid, c + 1, 23, EB);
    plot(grid, c, 22, S);
    for (const [x, y, col] of [
      [9, 4, MG],
      [12, 3, MG],
      [21, 10, MG],
      [8, 17, S],
      [11, 7, RD],
      [16, 14, RD],
      [10, 14, BR],
    ] as const) {
      plot(grid, x, y, col);
    }
    outline(grid, K);
    return grid;
  }
  const damaged = look === 'active';
  fillPoly(grid, POD_HEX, damaged ? S : DG);
  fillPoly(grid, POD_HEX_IN, damaged ? DG : MG);
  for (let i = 0; i < 6; i++) plot(grid, 9 + i, 3, damaged ? MG : LG);
  plot(grid, 7, 5, damaged ? MG : G);
  plot(grid, 6, 7, damaged ? MG : G);
  fillRect(grid, c - 4, 7, 8, 8, damaged ? MG : G);
  fillRect(grid, c - 4, 7, 8, 1, damaged ? G : LG);
  fillRect(grid, c - 4, 7, 1, 8, damaged ? G : LG);
  fillRect(grid, c + 3, 8, 1, 7, S);
  fillRect(grid, c - 3, 14, 7, 1, S);
  plot(grid, c - 2, 9, K);
  plot(grid, c + 1, 12, K);
  podBarrel(grid, c, damaged ? 25 : 26, !damaged);
  fillRect(grid, c - 3, 22, 6, 3, damaged ? S : MG);
  fillRect(grid, c - 3, 22, 6, 1, damaged ? DG : G);
  if (!damaged) {
    fillRect(grid, c - 1, 25, 2, 2, OR);
    plot(grid, c - 1, 26, OY);
  } else {
    fillRect(grid, c - 1, 24, 2, 1, RO);
  }
  const strip = damaged ? RD : CY;
  const glint = damaged ? RC : CP;
  for (const x of POD_STRIP_X) fillRect(grid, x, POD_STRIP_Y, 1, POD_STRIP_H, strip);
  plot(grid, 6, 10, glint);
  plot(grid, 21, 12, glint);
  plot(grid, c - 1, 4, damaged ? RD : BM);
  plot(grid, c, 4, damaged ? RD : BM);
  if (damaged) {
    for (const [x, y] of [
      [9, 6],
      [10, 7],
      [10, 8],
      [11, 9],
      [12, 9],
      [17, 13],
      [18, 14],
      [18, 15],
      [19, 16],
      [8, 15],
      [9, 14],
    ] as const) {
      plot(grid, x, y, K);
    }
    for (const [x, y, col] of [
      [11, 8, RO],
      [10, 6, RO],
      [12, 10, OR],
      [18, 13, OR],
      [19, 15, RO],
      [9, 15, RO],
    ] as const) {
      plot(grid, x, y, col);
    }
    for (const [x, y] of [
      [19, 2],
      [20, 3],
      [21, 4],
      [20, 2],
      [21, 3],
      [22, 5],
      [21, 2],
      [22, 3],
      [22, 4],
    ] as const) {
      grid[y]![x] = -1;
    }
  }
  outline(grid, K);
  return grid;
}

/** Pod side light strips (pod pixels), lit yellow by the active highlight. */
const POD_STRIP_X = [6, 21] as const;
const POD_STRIP_Y = 9;
const POD_STRIP_H = 5;

/**
 * Active-pod highlight: a two-pixel ring (yellow, then orange-yellow) outside
 * the active pod's black outline, plus its two side strips. Same size and
 * anchor as the pod, so the draw rotates it the same way.
 */
export function buildFurnacePodMark(): SpriteData {
  const grid = buildFurnacePod('active');
  outline(grid, YE);
  outline(grid, OY);
  const n = FURNACE_POD_SIZE;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = grid[y]![x];
      if (v !== YE && v !== OY) grid[y]![x] = -1;
    }
  }
  for (const x of POD_STRIP_X) fillRect(grid, x, POD_STRIP_Y, 1, POD_STRIP_H, YE);
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
    LG
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
    PG
  );
  fillRect(grid, 4, 18, 17, 1, G);
  fillRect(grid, 4, 19, 17, 1, RO);
  fillRect(grid, 11, 5, 2, 13, G);
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

const POD_SPARKS = 8;
const POD_SPARK_REACH = 16;
const POD_SMOKE_RISE = 14;
const POD_MARK_ALPHA = [0.5, 0.95] as const;

/**
 * Highlight strength: a steady blink, held at full for
 * `FURNACE_POD_MARK_FLASH` after the previous pod's wreck hands over the turn.
 */
function podMarkAlpha(boss: BossRuntime, time: number): number {
  const handover = furnaceLastWreckAge(boss);
  if (handover !== null && handover < FURNACE_POD_MARK_FLASH) return 1;
  const on = Math.sin(time * FURNACE_POD_MARK_HZ * Math.PI * 2) >= 0;
  return POD_MARK_ALPHA[on ? 1 : 0];
}

/**
 * Code-drawn pod state cues: a warm muzzle glow on a live barrel (it gutters
 * on the active pod), smoke puffs from the active pod, and a short spark burst over
 * a fresh wreck. Time-driven only; never touches `rng`.
 */
function drawPodFx(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  podLook: FurnacePodLook,
  wreckAge: number | null,
  time: number,
  index: number
): void {
  ctx.save();
  if (podLook !== 'wrecked') {
    const tip = furnaceOffset(angle, FURNACE_POD_MUZZLE);
    const lit = podLook === 'intact' || Math.sin(time * 23 + index * 2) > 0.3;
    if (lit) {
      const pulse = podLook === 'intact' ? 0.4 + 0.2 * Math.sin(time * 9 + index) : 0.25;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = PALETTE[OR];
      ctx.beginPath();
      ctx.arc(x + tip.x, y + tip.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, pulse * 1.8);
      ctx.fillStyle = PALETTE[YE];
      ctx.fillRect(Math.round(x + tip.x) - 1, Math.round(y + tip.y) - 1, 2, 2);
    }
  }
  if (podLook === 'active') {
    const phase = (time + index * 0.37) % FURNACE_POD_SMOKE_PERIOD;
    if (phase < FURNACE_POD_SMOKE_ON) {
      ctx.fillStyle = PALETTE[G];
      for (let k = 0; k < 3; k++) {
        const rise = (phase / FURNACE_POD_SMOKE_ON + k / 3) % 1;
        ctx.globalAlpha = 0.45 * (1 - rise);
        ctx.beginPath();
        ctx.arc(
          x + Math.sin(rise * 5 + k) * 3,
          y - 2 - rise * POD_SMOKE_RISE,
          2 + rise * 3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }
  if (podLook === 'wrecked' && wreckAge !== null && wreckAge < FURNACE_POD_SPARK_TIME) {
    const u = wreckAge / FURNACE_POD_SPARK_TIME;
    ctx.globalAlpha = 0.5 * (1 - u);
    ctx.fillStyle = PALETTE[RO];
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1 - u;
    for (let k = 0; k < POD_SPARKS; k++) {
      const o = furnaceOffset(k * (360 / POD_SPARKS) + index * 20, 4 + u * POD_SPARK_REACH);
      ctx.fillStyle = PALETTE[k % 2 ? OR : YE];
      ctx.fillRect(Math.round(x + o.x) - 1, Math.round(y + o.y) - 1, 2, 2);
    }
  }
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

  const podFrames: Record<FurnacePodLook, SpriteFrame | undefined> = {
    intact: assets.parts.pod,
    active: assets.parts.podActive,
    wrecked: assets.parts.podWrecked,
  };
  FURNACE_POD_IDS.forEach((id, i) => {
    const part = boss.parts.find((p) => p.id === id);
    if (!part) return;
    const podLook = furnacePodLook(boss, part);
    const frame = podFrames[podLook];
    if (!frame) return;
    const angle = furnacePodAngle(boss, i);
    blitRotated(ctx, draw, frame, part.worldX, part.worldY, angle);
    const mark = assets.parts.podMark;
    if (podLook === 'active' && mark) {
      ctx.save();
      ctx.globalAlpha = podMarkAlpha(boss, time);
      blitRotated(ctx, draw, mark, part.worldX, part.worldY, angle);
      ctx.restore();
    }
    drawPodFx(ctx, part.worldX, part.worldY, angle, podLook, furnacePodWreckAge(boss, i), time, i);
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
