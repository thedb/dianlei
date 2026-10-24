/**
 * Five overhead armored-ammo hulls for 铁堡. Yoan picks one.
 * The fight uses `TIEBAO_LOOK` (temporary default A). Factory A is already locked.
 *
 * Names: A 弹舱棚车, B 纵置油罐, C 敞车弹架, D 指挥守车, E 三节联挂.
 * Drawn from overhead freight references (roof plates, couplers, bogies,
 * tank hatches, a corrugated box, a caboose cupola). Not a side view.
 * The nose points down the screen, toward the player: the core hatch stays
 * near local (40, 128) and the roof guns stay near (50, 34) and (30, 102).
 * All are 80×160 palette pixels. Same hitbox.
 */

import { TIEBAO_HULL_H, TIEBAO_HULL_W } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillPoly, fillRect, outline, plot } from './pixelDraw';
import type { SpriteData } from './types';

export const TIEBAO_LOOK_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
export type TiebaoLookId = (typeof TIEBAO_LOOK_IDS)[number];

export const TIEBAO_LOOK_NAMES: Readonly<Record<TiebaoLookId, string>> = {
  A: '弹舱棚车',
  B: '纵置油罐',
  C: '敞车弹架',
  D: '指挥守车',
  E: '三节联挂',
};

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const PG = COLOR.PALE_GRAY;
const W = COLOR.WHITE;
const OL = COLOR.GROUND_DARK_OLIVE;
const OV = COLOR.GROUND_OLIVE;
const OM = COLOR.GROUND_MED_OLIVE;
const TAN = COLOR.GROUND_TAN;
const BR = COLOR.TERRAIN_DARK_BROWN;
const WD = COLOR.TERRAIN_BROWN;
const CON = COLOR.TERRAIN_CONCRETE;
const EY = COLOR.EXPLOSION_YELLOW;
const EO = COLOR.EXPLOSION_ORANGE;
const OY = COLOR.EXPLOSION_ORANGE_YELLOW;

/** Rear roof gun. Matches `TIEBAO_ROOF_CAR` on an 80×160 hull. */
const GUN_REAR = { x: 50, y: 34 } as const;
/** Forward roof gun. Matches `TIEBAO_ROOF_LOCO`. */
const GUN_FORE = { x: 30, y: 102 } as const;

function hline(g: SpriteData, x: number, y: number, w: number, color: number): void {
  for (let i = 0; i < w; i++) plot(g, x + i, y, color);
}

function vline(g: SpriteData, x: number, y: number, h: number, color: number): void {
  for (let i = 0; i < h; i++) plot(g, x, y + i, color);
}

/** Side walls plus an inset roof, so the car reads as a volume from above. */
function carBody(
  g: SpriteData,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: number,
  roof: number
): void {
  fillRect(g, x, y, w, h, wall);
  fillRect(g, x + 4, y + 4, w - 8, h - 8, roof);
  hline(g, x + 4, y + 4, w - 8, LG);
  vline(g, x + 4, y + 4, h - 8, LG);
  hline(g, x + 4, y + h - 5, w - 8, S);
  vline(g, x + w - 5, y + 4, h - 8, S);
  plot(g, x + 2, y + 2, PG);
  plot(g, x + w - 3, y + 2, PG);
  plot(g, x + 2, y + h - 3, DG);
  plot(g, x + w - 3, y + h - 3, DG);
}

/** Wheel pairs sticking out past the sill. Drawn after the body. */
function bogie(g: SpriteData, y: number, left: number, right: number): void {
  fillRect(g, left + 2, y - 1, 6, 3, S);
  fillRect(g, right - 8, y - 1, 6, 3, S);
  for (const x of [left - 5, right + 1]) {
    fillRect(g, x, y - 5, 4, 3, K);
    fillRect(g, x, y + 3, 4, 3, K);
    plot(g, x + 1, y - 4, MG);
    plot(g, x + 1, y + 4, MG);
  }
}

/** Knuckle between two cars. `y` is the top of a short gap. */
function coupler(g: SpriteData, y: number): void {
  fillRect(g, 37, y, 6, 2, S);
  fillRect(g, 34, y + 2, 12, 5, DG);
  fillRect(g, 37, y + 3, 6, 3, MG);
  plot(g, 35, y + 4, PG);
  plot(g, 44, y + 4, PG);
  vline(g, 33, y + 3, 3, S);
  vline(g, 46, y + 3, 3, S);
  fillRect(g, 37, y + 7, 6, 2, S);
}

/** Blunt armored pilot at the bottom of the sprite. Nose toward the player. */
function pilot(g: SpriteData, y: number): void {
  fillPoly(
    g,
    [
      [14, y],
      [66, y],
      [58, y + 14],
      [22, y + 14],
    ],
    DG
  );
  fillPoly(
    g,
    [
      [20, y + 2],
      [60, y + 2],
      [54, y + 11],
      [26, y + 11],
    ],
    MG
  );
  hline(g, 22, y + 2, 36, LG);
  fillRect(g, 22, y + 5, 5, 3, EY);
  fillRect(g, 53, y + 5, 5, 3, EY);
  plot(g, 23, y + 6, W);
  plot(g, 54, y + 6, W);
  fillRect(g, 36, y + 8, 8, 4, K);
  fillRect(g, 38, y + 9, 4, 2, DG);
}

function ring(g: SpriteData, cx: number, cy: number): void {
  fillEllipse(g, cx, cy, 8, 7, S);
  fillEllipse(g, cx, cy, 6, 5, DG);
  fillEllipse(g, cx, cy, 3, 2, MG);
  plot(g, cx - 6, cy - 4, PG);
  plot(g, cx + 6, cy - 4, PG);
  plot(g, cx - 6, cy + 4, DG);
  plot(g, cx + 6, cy + 4, DG);
}

function guns(g: SpriteData): void {
  ring(g, GUN_REAR.x, GUN_REAR.y);
  ring(g, GUN_FORE.x, GUN_FORE.y);
}

/** Core hatch. Closed plate versus the open orange bay. Sits on the nose. */
function hatch(g: SpriteData, open: boolean): void {
  fillRect(g, 29, 116, 22, 18, S);
  fillRect(g, 31, 118, 18, 14, DG);
  if (open) {
    fillRect(g, 34, 121, 12, 8, EO);
    fillRect(g, 36, 123, 8, 4, EY);
    plot(g, 40, 125, W);
  } else {
    fillRect(g, 34, 121, 12, 8, MG);
    hline(g, 34, 121, 12, LG);
    fillRect(g, 38, 123, 4, 4, S);
    plot(g, 40, 124, EO);
  }
  plot(g, 31, 118, PG);
  plot(g, 47, 118, PG);
  plot(g, 31, 130, PG);
  plot(g, 47, 130, PG);
}

function finish(g: SpriteData, open: boolean): SpriteData {
  guns(g);
  hatch(g, open);
  outline(g, K);
  return g;
}

/** A: ammo boxcar. Long roof hatches and a panel grid, then an armored loco. */
function lookA(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  carBody(g, 16, 4, 48, 58, OL, OV);
  fillRect(g, 22, 12, 14, 40, OL);
  fillRect(g, 44, 12, 14, 40, OL);
  for (let i = 0; i < 3; i++) {
    const y = 16 + i * 12;
    fillRect(g, 24, y, 10, 8, TAN);
    fillRect(g, 46, y, 10, 8, EO);
    hline(g, 24, y, 10, OY);
    plot(g, 28, y + 3, EY);
    plot(g, 50, y + 3, EY);
  }
  vline(g, 39, 10, 44, PG);
  vline(g, 40, 10, 44, S);
  bogie(g, 16, 16, 64);
  bogie(g, 50, 16, 64);
  coupler(g, 63);
  carBody(g, 12, 74, 56, 68, DG, G);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 20 + col * 14;
      const y = 82 + row * 16;
      fillRect(g, x, y, 10, 10, MG);
      hline(g, x, y, 10, LG);
      plot(g, x + 1, y + 1, PG);
      plot(g, x + 8, y + 8, S);
    }
  }
  bogie(g, 86, 12, 68);
  bogie(g, 128, 12, 68);
  pilot(g, 142);
  return finish(g, open);
}

/** B: two tank barrels, center stripe, round hatches, short armored cab. */
function lookB(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  const tank = (cy: number, ry: number): void => {
    fillEllipse(g, 40, cy, 18, ry, S);
    fillEllipse(g, 40, cy, 15, ry - 3, LG);
    fillEllipse(g, 40, cy, 12, ry - 6, PG);
    fillRect(g, 37, cy - ry + 6, 6, ry * 2 - 12, EY);
    fillRect(g, 39, cy - ry + 6, 2, ry * 2 - 12, W);
    for (const dy of [-Math.floor(ry / 2), Math.floor(ry / 2)]) {
      fillEllipse(g, 40, cy + dy, 4, 4, S);
      fillEllipse(g, 40, cy + dy, 2, 2, DG);
      plot(g, 40, cy + dy, EO);
    }
    vline(g, 26, cy - ry + 8, ry * 2 - 16, DG);
  };
  tank(30, 24);
  bogie(g, 14, 24, 56);
  bogie(g, 46, 24, 56);
  coupler(g, 56);
  tank(84, 20);
  bogie(g, 70, 24, 56);
  bogie(g, 98, 24, 56);
  fillRect(g, 42, 26, 16, 14, MG);
  fillRect(g, 20, 94, 16, 14, MG);
  coupler(g, 106);
  carBody(g, 14, 116, 52, 26, DG, G);
  pilot(g, 142);
  return finish(g, open);
}

/** C: open flatcars. Deck and sills show; shells sit in racks, not under a roof. */
function lookC(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  const flat = (y: number, h: number): void => {
    fillRect(g, 10, y, 8, h, DG);
    fillRect(g, 62, y, 8, h, DG);
    fillRect(g, 12, y, 4, h, MG);
    fillRect(g, 64, y, 4, h, LG);
    fillRect(g, 18, y, 44, h, WD);
    hline(g, 18, y, 44, BR);
    hline(g, 18, y + h - 1, 44, S);
  };
  flat(4, 60);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 22 + col * 12;
      const y = 10 + row * 12;
      fillRect(g, x, y, 8, 8, EO);
      fillRect(g, x + 1, y, 6, 2, EY);
      fillRect(g, x + 2, y + 3, 4, 3, OY);
      plot(g, x + 3, y + 6, TAN);
    }
  }
  bogie(g, 14, 10, 70);
  bogie(g, 52, 10, 70);
  coupler(g, 65);
  flat(76, 46);
  for (let i = 0; i < 2; i++) {
    fillRect(g, 38, 82 + i * 16, 20, 10, OV);
    fillRect(g, 40, 84 + i * 16, 16, 6, OM);
    hline(g, 40, 84 + i * 16, 16, TAN);
  }
  bogie(g, 86, 10, 70);
  bogie(g, 112, 10, 70);
  fillRect(g, 42, 26, 18, 14, CON);
  fillRect(g, 18, 92, 16, 14, CON);
  fillRect(g, 12, 114, 56, 28, DG);
  fillRect(g, 16, 118, 48, 20, G);
  hline(g, 16, 118, 48, LG);
  pilot(g, 142);
  return finish(g, open);
}

/** D: one armored caboose. Inset roof, center cupola, heavy trucks, plow. */
function lookD(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  carBody(g, 8, 4, 64, 136, DG, MG);
  hline(g, 16, 40, 48, S);
  hline(g, 16, 78, 48, S);
  hline(g, 16, 110, 48, S);
  vline(g, 40, 12, 110, S);
  for (let i = 0; i < 4; i++) {
    plot(g, 18, 16 + i * 28, PG);
    plot(g, 60, 16 + i * 28, PG);
  }
  fillRect(g, 26, 48, 28, 22, G);
  fillRect(g, 28, 50, 24, 18, LG);
  hline(g, 28, 50, 24, PG);
  vline(g, 28, 50, 18, PG);
  fillRect(g, 36, 55, 8, 8, DG);
  fillRect(g, 38, 57, 4, 4, S);
  plot(g, 29, 51, W);
  plot(g, 50, 51, W);
  plot(g, 29, 66, DG);
  plot(g, 50, 66, DG);
  vline(g, 22, 14, 112, PG);
  vline(g, 23, 14, 112, S);
  bogie(g, 18, 8, 72);
  bogie(g, 124, 8, 72);
  fillRect(g, 8, 140, 64, 4, S);
  pilot(g, 144);
  return finish(g, open);
}

/** E: three different cars — ribbed box, tank, armored loco — with knuckles. */
function lookE(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  carBody(g, 14, 2, 52, 46, DG, G);
  for (let y = 8; y < 42; y += 4) {
    hline(g, 20, y, 40, y % 8 === 0 ? PG : S);
  }
  bogie(g, 12, 14, 66);
  bogie(g, 38, 14, 66);
  coupler(g, 49);
  fillEllipse(g, 40, 70, 15, 14, S);
  fillEllipse(g, 40, 70, 12, 11, LG);
  fillEllipse(g, 40, 70, 9, 8, PG);
  fillRect(g, 37, 58, 6, 24, EY);
  fillRect(g, 39, 58, 2, 24, W);
  fillEllipse(g, 40, 70, 4, 4, S);
  fillEllipse(g, 40, 70, 2, 2, DG);
  plot(g, 40, 70, EO);
  bogie(g, 60, 26, 54);
  bogie(g, 80, 26, 54);
  coupler(g, 84);
  carBody(g, 10, 92, 60, 50, DG, G);
  for (let col = 0; col < 3; col++) {
    fillRect(g, 18 + col * 16, 110, 12, 16, MG);
    hline(g, 18 + col * 16, 112, 12, LG);
    plot(g, 20 + col * 16, 114, PG);
  }
  bogie(g, 114, 10, 70);
  bogie(g, 132, 10, 70);
  pilot(g, 142);
  return finish(g, open);
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
