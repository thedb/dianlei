/**
 * Risk crate — a flat UFO disc (B6) in the locked palette.
 *
 * Magenta dome, yellow-black hazard ring, cyan running lights, grey underside,
 * one-pixel red rim. A separate cyan octagon is the energy shield, drawn only
 * while shield HP remains. The wreck drops the lights and cuts the hull.
 * No reference image is imported; this is painted from that description.
 */

import { COLOR } from '@/game/palette';
import { RISK_CRATE_SIZE } from '@/game/config';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite, createHitFlashSprite } from './spriteRenderer';
import { createGrid, plot, rim } from './pixelDraw';

const SIZE = RISK_CRATE_SIZE;
/** Pixel-symmetric center of a 28-wide grid (mirrors x with 27 - x). */
const CX = SIZE / 2;
const CY = SIZE / 2;

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function plotLine(
  grid: SpriteData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xEnd = Math.round(x1);
  const yEnd = Math.round(y1);
  const dx = Math.abs(xEnd - x);
  const dy = Math.abs(yEnd - y);
  const sx = x < xEnd ? 1 : -1;
  const sy = y < yEnd ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    plot(grid, x, y, color);
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function octagon(cx: number, cy: number, radius: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 8 + (i * Math.PI) / 4;
    pts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return pts;
}

/** Intact hull, or the same disc after the shield is gone. */
export function riskCrateDiscPixels(wrecked = false): SpriteData {
  const g = createGrid(SIZE, SIZE);
  const rx = 11;
  const ry = 6.4;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inEllipse(x, y, CX, CY, rx, ry)) continue;
      const py = y + 0.5;
      let color: number = COLOR.PALE_GRAY;
      if (py > CY + 2.4) color = COLOR.MEDIUM_GRAY;
      else if (py > CY + 0.6) color = COLOR.GRAY;
      else if (py > CY - 0.8) color = COLOR.LIGHT_GRAY;
      g[y]![x] = color;
    }
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inEllipse(x, y, CX, CY - 2.5, 6.1, 3.5)) continue;
      if (!inEllipse(x, y, CX, CY, rx, ry)) continue;
      const py = y + 0.5;
      let color: number = COLOR.BULLET_MAGENTA;
      if (inEllipse(x, y, CX, CY - 3.7, 2.3, 1.15)) color = COLOR.BULLET_CORE;
      else if (py < CY - 3.4) color = COLOR.BULLET_PINK;
      else if (py > CY - 1.1) color = COLOR.BULLET_DARK;
      g[y]![x] = color;
    }
  }

  for (let y = 0; y < SIZE; y++) {
    if (Math.abs(y + 0.5 - (CY + 0.15)) > 1.05) continue;
    for (let x = 0; x < SIZE; x++) {
      if (g[y]![x]! < 0) continue;
      if (!inEllipse(x, y, CX, CY, rx - 0.6, ry - 0.3)) continue;
      const stripe = Math.floor(Math.abs(x + 0.5 - CX) / 2) % 2 === 0;
      g[y]![x] = stripe ? COLOR.EXPLOSION_YELLOW : COLOR.BLACK;
    }
  }

  if (!wrecked) {
    // 2×2 running lights, kept off the rim so the red edge stays a 1px line.
    const lights: Array<[number, number]> = [
      [6, 11],
      [7, 11],
      [6, 12],
      [7, 12],
      [20, 11],
      [21, 11],
      [20, 12],
      [21, 12],
      [13, 9],
      [14, 9],
      [13, 10],
      [14, 10],
    ];
    for (const [x, y] of lights) {
      if (g[y]![x]! >= 0) g[y]![x] = COLOR.PLAYER_CYAN;
    }
  }

  rim(g, COLOR.ENEMY_VIVID_RED);

  if (wrecked) {
    const crack: Array<[number, number]> = [
      [10, 11],
      [11, 12],
      [12, 12],
      [13, 13],
      [14, 13],
      [15, 14],
      [16, 15],
      [17, 15],
      [11, 13],
      [15, 12],
    ];
    for (const [x, y] of crack) {
      if (g[y]![x]! >= 0) g[y]![x] = COLOR.BLACK;
    }
    for (let y = 9; y <= 12; y++) {
      for (let x = 16; x <= 19; x++) {
        const cell = g[y]![x]!;
        if (
          cell === COLOR.BULLET_MAGENTA ||
          cell === COLOR.BULLET_PINK ||
          cell === COLOR.BULLET_CORE
        ) {
          g[y]![x] = COLOR.BULLET_DARK;
        }
      }
    }
    if (g[14]![24]! >= 0) g[14]![24] = -1;
    if (g[15]![24]! >= 0) g[15]![24] = COLOR.SHADOW;
  }

  return g;
}

/** Cyan octagon ring. The middle stays empty so the disc shows through. */
export function riskCrateShieldPixels(): SpriteData {
  const g = createGrid(SIZE, SIZE);
  const outer = octagon(CX, CY, 12.35);
  const inner = octagon(CX, CY, 11.2);
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    plotLine(g, a[0], a[1], b[0], b[1], COLOR.PLAYER_CYAN);
    const c = inner[i]!;
    const d = inner[(i + 1) % inner.length]!;
    plotLine(g, c[0], c[1], d[0], d[1], COLOR.PLAYER_MED_CYAN);
  }
  for (const [x, y] of outer) plot(g, Math.round(x), Math.round(y), COLOR.PLAYER_PALE_CYAN);
  return g;
}

export interface RiskCrateAssets {
  intact: SpriteFrame;
  intactFlash: SpriteFrame;
  wreck: SpriteFrame;
  wreckFlash: SpriteFrame;
  shield: SpriteFrame;
}

export function createRiskCrateAssets(): RiskCrateAssets {
  const intact = renderSprite(riskCrateDiscPixels(false));
  const wreck = renderSprite(riskCrateDiscPixels(true));
  return {
    intact,
    intactFlash: createHitFlashSprite(intact),
    wreck,
    wreckFlash: createHitFlashSprite(wreck),
    shield: renderSprite(riskCrateShieldPixels()),
  };
}
