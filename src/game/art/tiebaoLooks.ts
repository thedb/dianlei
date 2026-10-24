/**
 * Five armored ammo-train hulls for 铁堡. Yoan picks one.
 * The fight uses `TIEBAO_LOOK` in config (temporary default A).
 * Names: A 厢列, B 炮楼头, C 油罐弹舱, D 平板弹架, E 双节堡垒.
 * All are 80×160 palette pixels. The core hatch stays near local (40, 128)
 * so the part glow still sits on the nose. Roof guns are a separate sprite.
 */

import { TIEBAO_HULL_H, TIEBAO_HULL_W } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillPoly, fillRect, outline, plot } from './pixelDraw';
import type { SpriteData } from './types';

export const TIEBAO_LOOK_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
export type TiebaoLookId = (typeof TIEBAO_LOOK_IDS)[number];

export const TIEBAO_LOOK_NAMES: Readonly<Record<TiebaoLookId, string>> = {
  A: '厢列',
  B: '炮楼头',
  C: '油罐弹舱',
  D: '平板弹架',
  E: '双节堡垒',
};

const EY = COLOR.EXPLOSION_YELLOW;
const EO = COLOR.EXPLOSION_ORANGE;
const K = COLOR.BLACK;

function hatch(g: SpriteData, open: boolean): void {
  if (open) {
    fillRect(g, 30, 120, 20, 14, EO);
    fillRect(g, 34, 123, 12, 8, EY);
    plot(g, 39, 126, COLOR.WHITE);
  } else {
    fillRect(g, 32, 122, 16, 10, COLOR.DARK_GRAY);
    plot(g, 40, 126, EO);
  }
}

/** Yellow-black tape on pixels that already belong to the hull, so the outline stays a train. */
function sideHazard(g: SpriteData, y0: number, y1: number): void {
  const yStart = Math.max(0, y0);
  const yEnd = Math.min(g.length, y1);
  for (let y = yStart; y < yEnd; y++) {
    const row = g[y];
    if (!row) continue;
    let left = -1;
    let right = -1;
    for (let x = 0; x < row.length; x++) {
      if ((row[x] ?? -1) >= 0) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left < 0 || right - left < 12) continue;
    const color = Math.floor((y - yStart) / 4) % 2 === 0 ? EY : K;
    for (let dx = 1; dx <= 3; dx++) {
      plot(g, left + dx, y, color);
      plot(g, right - dx, y, color);
    }
  }
}

function pads(g: SpriteData): void {
  fillEllipse(g, 50, 34, 7, 5, COLOR.DARK_GRAY);
  fillEllipse(g, 30, 102, 7, 5, COLOR.DARK_GRAY);
  fillRect(g, 47, 32, 6, 4, COLOR.MEDIUM_GRAY);
  fillRect(g, 27, 100, 6, 4, COLOR.MEDIUM_GRAY);
}

function lookA(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  fillRect(g, 18, 6, 44, 64, COLOR.GROUND_DARK_OLIVE);
  fillRect(g, 22, 10, 36, 54, COLOR.GROUND_OLIVE);
  for (let i = 0; i < 3; i++) {
    fillRect(g, 28, 16 + i * 16, 10, 8, EO);
    fillRect(g, 42, 16 + i * 16, 10, 8, COLOR.GROUND_TAN);
  }
  fillRect(g, 34, 68, 12, 8, COLOR.BLACK);
  fillRect(g, 16, 76, 48, 62, COLOR.MEDIUM_GRAY);
  fillRect(g, 22, 82, 36, 28, COLOR.GRAY);
  fillRect(g, 28, 88, 24, 10, COLOR.WATER_DEEP);
  fillRect(g, 30, 90, 8, 6, COLOR.WATER_SHALLOW);
  sideHazard(g, 8, 150);
  fillPoly(
    g,
    [
      [24, 136],
      [56, 136],
      [50, 156],
      [30, 156],
    ],
    COLOR.DARK_GRAY
  );
  fillRect(g, 36, 148, 8, 6, COLOR.ENEMY_BRIGHT_RED);
  pads(g);
  hatch(g, open);
  outline(g, K);
  return g;
}

function lookB(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  fillRect(g, 22, 4, 36, 48, COLOR.DARK_GRAY);
  fillRect(g, 26, 8, 28, 36, COLOR.MEDIUM_GRAY);
  fillRect(g, 30, 14, 20, 8, COLOR.GROUND_TAN);
  fillRect(g, 14, 52, 52, 70, COLOR.GRAY);
  fillRect(g, 18, 58, 44, 22, COLOR.SHADOW);
  for (let i = 0; i < 4; i++) fillRect(g, 22, 62 + i * 4, 36, 2, i % 2 ? K : COLOR.PALE_GRAY);
  fillRect(g, 12, 122, 56, 28, COLOR.DARK_GRAY);
  fillRect(g, 20, 126, 40, 8, COLOR.MEDIUM_GRAY);
  fillRect(g, 24, 128, 6, 4, EY);
  fillRect(g, 50, 128, 6, 4, EY);
  fillRect(g, 28, 146, 24, 8, COLOR.BLACK);
  sideHazard(g, 8, 148);
  pads(g);
  hatch(g, open);
  outline(g, K);
  return g;
}

function lookC(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  fillEllipse(g, 40, 28, 18, 22, COLOR.GROUND_OLIVE);
  fillEllipse(g, 40, 28, 12, 16, COLOR.GROUND_MED_OLIVE);
  fillEllipse(g, 40, 72, 20, 24, COLOR.MEDIUM_GRAY);
  fillEllipse(g, 40, 72, 13, 16, COLOR.GRAY);
  fillEllipse(g, 40, 118, 18, 22, COLOR.DARK_GRAY);
  fillEllipse(g, 40, 118, 11, 14, COLOR.MEDIUM_GRAY);
  for (const y of [28, 72, 118]) {
    fillRect(g, 22, y - 2, 36, 4, EY);
    fillRect(g, 22, y + 2, 36, 2, K);
  }
  fillRect(g, 34, 142, 12, 12, COLOR.BLACK);
  fillRect(g, 37, 150, 6, 6, COLOR.ENEMY_BRIGHT_RED);
  sideHazard(g, 6, 140);
  pads(g);
  hatch(g, open);
  outline(g, K);
  return g;
}

function lookD(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  fillRect(g, 10, 10, 8, 130, COLOR.DARK_GRAY);
  fillRect(g, 62, 10, 8, 130, COLOR.DARK_GRAY);
  fillRect(g, 18, 18, 44, 6, COLOR.MEDIUM_GRAY);
  fillRect(g, 18, 70, 44, 6, COLOR.MEDIUM_GRAY);
  fillRect(g, 18, 124, 44, 8, COLOR.MEDIUM_GRAY);
  for (let i = 0; i < 4; i++) {
    fillRect(g, 24, 28 + i * 9, 6, 6, EO);
    fillRect(g, 36, 28 + i * 9, 6, 6, COLOR.GROUND_TAN);
    fillRect(g, 48, 28 + i * 9, 6, 6, EO);
  }
  for (let i = 0; i < 3; i++) {
    fillRect(g, 26, 82 + i * 12, 28, 6, COLOR.GROUND_DARK_OLIVE);
    plot(g, 30, 84 + i * 12, EY);
    plot(g, 48, 84 + i * 12, EY);
  }
  fillPoly(
    g,
    [
      [22, 132],
      [58, 132],
      [52, 156],
      [28, 156],
    ],
    COLOR.BLACK
  );
  sideHazard(g, 12, 140);
  pads(g);
  hatch(g, open);
  outline(g, K);
  return g;
}

function lookE(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  fillRect(g, 16, 4, 48, 58, COLOR.GRAY);
  fillRect(g, 20, 8, 40, 46, COLOR.MEDIUM_GRAY);
  fillRect(g, 26, 16, 28, 16, COLOR.GROUND_DARK_OLIVE);
  for (let i = 0; i < 5; i++) plot(g, 24 + i * 8, 40, COLOR.PALE_GRAY);
  fillRect(g, 30, 62, 20, 10, K);
  fillRect(g, 36, 64, 8, 6, COLOR.ENEMY_DARK_RED);
  fillRect(g, 12, 72, 56, 64, COLOR.DARK_GRAY);
  fillRect(g, 18, 78, 44, 40, COLOR.MEDIUM_GRAY);
  fillRect(g, 24, 86, 32, 12, COLOR.SHADOW);
  fillRect(g, 22, 108, 8, 8, EY);
  fillRect(g, 50, 108, 8, 8, K);
  fillPoly(
    g,
    [
      [20, 136],
      [60, 136],
      [48, 150],
      [40, 158],
      [32, 150],
    ],
    COLOR.BLACK
  );
  fillRect(g, 36, 144, 8, 6, EY);
  sideHazard(g, 6, 150);
  pads(g);
  hatch(g, open);
  outline(g, K);
  return g;
}

const BUILDERS: Readonly<Record<TiebaoLookId, (open: boolean) => SpriteData>> = {
  A: lookA,
  B: lookB,
  C: lookC,
  D: lookD,
  E: lookE,
};

export function buildTiebaoHull(look: TiebaoLookId, open: boolean): SpriteData {
  return BUILDERS[look](open);
}
