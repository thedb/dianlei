/**
 * Locked 铁堡 hull. Nose up-screen: the player chases from behind.
 * The baked sprite is the full consist (locomotive + 9 slender boxcars).
 * The fight crops it from the bottom as cars shed. The end form is the
 * top of this sprite: a long locomotive and the first two boxcars.
 *
 * Look A is the locked style. B–E share the chassis and only change the
 * nose, the cab, and the two end cars. Every car carries at least one
 * hardpoint; cropping a shed car takes that turret with it.
 *
 * Anchors are nose rows (`TIEBAO_CORE_ROW` / `TIEBAO_ROOF_*_ROW`):
 *   core      (40, 18)    nose
 *   roofLoco  (40, 64)    cab
 *   roofCar   (40, 240)   second boxcar, the rear car of the end form
 */

import {
  TIEBAO_BUFFER,
  TIEBAO_CAR_H,
  TIEBAO_CAR_PITCH,
  TIEBAO_CARS,
  TIEBAO_CORE_ROW,
  TIEBAO_FULL_H,
  TIEBAO_HULL_W,
  TIEBAO_LOCO_H,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_ROOF_LOCO_ROW,
} from '@/game/config';
import { tiebaoCarBodyY } from '@/game/systems/tiebaoShed';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillPoly, fillRect, outline, plot } from './pixelDraw';
import type { SpriteData } from './types';

export const TIEBAO_LOOK_IDS = ['A', 'B', 'C', 'D', 'E'] as const;
export type TiebaoLookId = (typeof TIEBAO_LOOK_IDS)[number];

export const TIEBAO_LOOK_NAMES: Readonly<Record<TiebaoLookId, string>> = {
  A: '尖头三节',
  B: '钝鼻铆甲',
  C: '侧裙弹舱',
  D: '脊炮车顶',
  E: '厚钩尾梁',
};

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const PG = COLOR.PALE_GRAY;
const W = COLOR.WHITE;
const RD = COLOR.ENEMY_BRIGHT_RED;
const BR = COLOR.TERRAIN_DARK_BROWN;
const WD = COLOR.TERRAIN_BROWN;
const TAN = COLOR.GROUND_TAN;
const OL = COLOR.GROUND_OLIVE;
const EY = COLOR.EXPLOSION_YELLOW;
const EO = COLOR.EXPLOSION_ORANGE;
const OY = COLOR.EXPLOSION_ORANGE_YELLOW;

const CX = Math.floor(TIEBAO_HULL_W / 2);
const CAR_X = 22;
const CAR_W = 36;
/** Cab body. 32×100 under the wedge, ending just before the first coupler. */
const LOCO = { x: 24, y: 14, w: 32, h: TIEBAO_LOCO_H - 16 } as const;

const CORE_AT = { x: CX, y: TIEBAO_CORE_ROW };
const LOCO_GUN = { x: CX, y: TIEBAO_ROOF_LOCO_ROW };
const CAR_GUN = { x: CX, y: TIEBAO_ROOF_CAR_ROW };

type Nose = 'wedge' | 'blunt' | 'spike' | 'chamfer' | 'step';
type Mount = 'round' | 'square' | 'twin';
type Plate = 'round' | 'square' | 'slit';

function hline(g: SpriteData, x: number, y: number, w: number, color: number): void {
  for (let i = 0; i < w; i++) plot(g, x + i, y, color);
}

function vline(g: SpriteData, x: number, y: number, h: number, color: number): void {
  for (let i = 0; i < h; i++) plot(g, x, y + i, color);
}

/** Inset roof. Cross seams keep a long car from reading as one slab. */
function roof(g: SpriteData, x: number, y: number, w: number, h: number, cap: number): void {
  fillRect(g, x, y, w, h, DG);
  fillRect(g, x + 3, y + 3, w - 6, h - 6, cap);
  hline(g, x + 3, y + 3, w - 6, LG);
  vline(g, x + 3, y + 3, h - 6, LG);
  hline(g, x + 3, y + h - 4, w - 6, S);
  vline(g, x + w - 4, y + 3, h - 6, S);
  vline(g, x + Math.floor(w / 2), y + 6, h - 12, S);
  for (let yy = y + 18; yy < y + h - 8; yy += 18) hline(g, x + 6, yy, w - 12, S);
  plot(g, x + 1, y + 1, PG);
  plot(g, x + w - 2, y + 1, PG);
  plot(g, x + 1, y + h - 2, G);
  plot(g, x + w - 2, y + h - 2, G);
}

function bogie(g: SpriteData, y: number, left: number, right: number): void {
  fillRect(g, left, y - 2, 6, 4, S);
  fillRect(g, right - 6, y - 2, 6, 4, S);
  for (const x of [left - 5, right + 1]) {
    fillRect(g, x, y - 5, 4, 3, K);
    fillRect(g, x, y + 2, 4, 3, K);
    plot(g, x + 1, y - 4, G);
    plot(g, x + 1, y + 3, LG);
  }
}

/** Knuckle inside an 8px coupler gap. `y` is the top of the gap. */
function coupler(g: SpriteData, y: number, heavy: boolean): void {
  const w = heavy ? 12 : 8;
  const x = CX - Math.floor(w / 2);
  fillRect(g, x, y + 1, w, 6, DG);
  fillRect(g, CX - 2, y + 2, 4, 4, MG);
  hline(g, x, y + 1, w, LG);
  plot(g, x + 1, y + 3, PG);
  plot(g, x + w - 2, y + 3, PG);
}

function noseOf(g: SpriteData, nose: Nose): void {
  if (nose === 'wedge') {
    fillPoly(
      g,
      [
        [CX, 2],
        [26, 16],
        [54, 16],
      ],
      DG
    );
    fillPoly(
      g,
      [
        [CX, 5],
        [30, 15],
        [50, 15],
      ],
      MG
    );
    hline(g, CX - 1, 4, 2, LG);
  } else if (nose === 'blunt') {
    fillRect(g, 28, 4, 24, 4, DG);
    fillPoly(
      g,
      [
        [28, 4],
        [52, 4],
        [56, 14],
        [24, 14],
      ],
      DG
    );
    fillRect(g, 30, 6, 20, 6, MG);
    hline(g, 30, 6, 20, LG);
    fillRect(g, 32, 7, 3, 2, EY);
    fillRect(g, 45, 7, 3, 2, EY);
    plot(g, 33, 8, W);
    plot(g, 46, 8, W);
  } else if (nose === 'spike') {
    fillPoly(
      g,
      [
        [CX, 1],
        [32, 16],
        [48, 16],
      ],
      DG
    );
    fillPoly(
      g,
      [
        [CX, 4],
        [35, 14],
        [45, 14],
      ],
      MG
    );
    hline(g, CX, 3, 1, W);
  } else if (nose === 'chamfer') {
    fillPoly(
      g,
      [
        [28, 6],
        [52, 6],
        [56, 16],
        [24, 16],
      ],
      DG
    );
    fillRect(g, 30, 8, 20, 6, MG);
    hline(g, 30, 8, 20, LG);
    fillRect(g, 37, 1, 6, 3, G);
    fillRect(g, 38, 1, 4, 10, DG);
    plot(g, 39, 2, EY);
    plot(g, 40, 2, W);
  } else {
    fillRect(g, 32, 3, 16, 5, DG);
    fillRect(g, 34, 4, 12, 3, MG);
    hline(g, 34, 4, 12, LG);
    fillRect(g, 28, 8, 24, 5, DG);
    fillRect(g, 30, 9, 20, 3, MG);
    fillRect(g, 24, 13, 32, 4, DG);
  }
  plot(g, CX, 4, LG);
}

/** Wedge (or the look's nose) plus a deep cab so the locomotive reads long. */
function loco(g: SpriteData, nose: Nose): void {
  noseOf(g, nose);
  roof(g, LOCO.x, LOCO.y, LOCO.w, LOCO.h, MG);
  fillRect(g, 28, 22, 2, 2, RD);
  fillRect(g, 50, 22, 2, 2, RD);
  fillRect(g, 30, 70, 20, 28, S);
  fillRect(g, 32, 74, 7, 12, MG);
  fillRect(g, 41, 74, 7, 12, MG);
  hline(g, 32, 74, 7, LG);
  hline(g, 41, 74, 7, LG);
  plot(g, 34, 78, PG);
  plot(g, 43, 78, PG);
  hline(g, 28, 68, 24, S);
}

function boxcar(g: SpriteData, y: number): void {
  roof(g, CAR_X, y, CAR_W, TIEBAO_CAR_H, G);
}

/** Short barrel toward the player. The yellow pixel is the muzzle. */
function downBarrel(g: SpriteData, x: number, y: number, len: number): void {
  fillRect(g, x - 1, y, 3, len, DG);
  const muzzle = y + len - 2;
  fillRect(g, x - 2, muzzle, 5, 2, K);
  plot(g, x, muzzle, EY);
}

/** Round cupola in look A's roof-gun language. */
function cupola(g: SpriteData, x: number, y: number): void {
  fillEllipse(g, x, y, 6, 5, S);
  fillEllipse(g, x, y, 4, 3, MG);
  plot(g, x, y, G);
  plot(g, x - 3, y - 2, LG);
  plot(g, x + 3, y - 2, LG);
}

/** Two missile tubes on the roof, muzzles toward the player. */
function tubePair(g: SpriteData, x: number, y: number): void {
  fillRect(g, x, y, 4, 16, S);
  fillRect(g, x + 6, y, 4, 16, S);
  fillRect(g, x + 1, y + 2, 2, 10, DG);
  fillRect(g, x + 7, y + 2, 2, 10, DG);
  hline(g, x, y, 4, LG);
  hline(g, x + 6, y, 4, LG);
  plot(g, x + 1, y + 13, EY);
  plot(g, x + 7, y + 13, EY);
}

/**
 * One visible hardpoint on boxcar `index`. Painted into that car's rows,
 * so the live crop drops it when the car is shed.
 * 0, 3, 6: center AA cupola. 4, 7: cupola plus missile tubes.
 * 2, 5, 8: cupola plus side sponsons. Car 1 keeps the real rear gun.
 */
function carHardpoint(g: SpriteData, index: number): void {
  const top = tiebaoCarBodyY(index);
  if (index === 1) {
    downBarrel(g, CX, top + 42, 12);
    return;
  }
  const kind = index % 3;
  if (kind === 1) {
    cupola(g, CX, top + 16);
    tubePair(g, CX - 12, top + 20);
    downBarrel(g, CX, top + 20, 8);
    return;
  }
  if (kind === 2) {
    cupola(g, CX, top + 18);
    downBarrel(g, CX, top + 22, 8);
    fillRect(g, CX - 16, top + 30, 8, 3, DG);
    fillRect(g, CX + 8, top + 30, 8, 3, DG);
    plot(g, CX - 16, top + 31, EY);
    plot(g, CX + 14, top + 31, EY);
    return;
  }
  cupola(g, CX, top + 16);
  downBarrel(g, CX, top + 20, 12);
}

/** Hood cupola plus a longer barrel on the cab gun. Both point down-screen. */
function strengthenLocoGuns(g: SpriteData): void {
  cupola(g, CX, 36);
  downBarrel(g, CX, 40, 10);
  downBarrel(g, LOCO_GUN.x, LOCO_GUN.y + 6, 16);
}

function pods(g: SpriteData, y: number): void {
  fillRect(g, 8, y, 14, 14, DG);
  fillRect(g, 58, y, 14, 14, DG);
  fillRect(g, 10, y + 2, 10, 8, S);
  fillRect(g, 60, y + 2, 10, 8, S);
  fillRect(g, 11, y + 4, 3, 4, K);
  fillRect(g, 16, y + 4, 3, 4, K);
  fillRect(g, 61, y + 4, 3, 4, K);
  fillRect(g, 66, y + 4, 3, 4, K);
  plot(g, 12, y + 11, EY);
  plot(g, 17, y + 11, EY);
  plot(g, 62, y + 11, EY);
  plot(g, 67, y + 11, EY);
}

function broadside(g: SpriteData, y: number): void {
  fillRect(g, 2, y, 20, 5, DG);
  fillRect(g, 58, y, 20, 5, DG);
  fillRect(g, 3, y + 2, 10, 2, K);
  fillRect(g, 67, y + 2, 10, 2, K);
  plot(g, 4, y + 1, LG);
  plot(g, 74, y + 1, LG);
}

/** Rear beam of the full consist. Live draws paste these rows onto the current tail. */
function buffer(g: SpriteData, tall: boolean): void {
  const y = TIEBAO_FULL_H - (tall ? TIEBAO_BUFFER : 16);
  const h = TIEBAO_FULL_H - 2 - y;
  fillRect(g, CAR_X, y, CAR_W, h, DG);
  fillRect(g, CAR_X + 3, y + 2, CAR_W - 6, Math.max(2, h - 4), MG);
  hline(g, CAR_X + 3, y + 2, CAR_W - 6, LG);
  const lampY = TIEBAO_FULL_H - 8;
  fillRect(g, 24, lampY, 8, 3, EY);
  fillRect(g, 48, lampY, 8, 3, EY);
  plot(g, 26, lampY + 1, W);
  plot(g, 50, lampY + 1, W);
  fillRect(g, CX - 3, y + h - 3, 6, 2, K);
}

function trucks(g: SpriteData): void {
  bogie(g, 36, LOCO.x, LOCO.x + LOCO.w);
  bogie(g, 96, LOCO.x, LOCO.x + LOCO.w);
  for (let i = 0; i < TIEBAO_CARS; i++) {
    const y = tiebaoCarBodyY(i);
    bogie(g, y + 14, CAR_X, CAR_X + CAR_W);
    bogie(g, y + TIEBAO_CAR_H - 16, CAR_X, CAR_X + CAR_W);
  }
}

function consist(g: SpriteData, nose: Nose, heavy: boolean, tallBuffer: boolean): void {
  loco(g, nose);
  if (nose === 'spike') {
    fillRect(g, 18, 28, 8, 36, DG);
    fillRect(g, 54, 28, 8, 36, DG);
    fillRect(g, 20, 32, 5, 28, S);
    fillRect(g, 55, 32, 5, 28, S);
  }
  for (let i = 0; i < TIEBAO_CARS; i++) {
    coupler(g, TIEBAO_LOCO_H + i * TIEBAO_CAR_PITCH, heavy);
    boxcar(g, tiebaoCarBodyY(i));
  }
  const lead = tiebaoCarBodyY(0);
  pods(g, lead + 28);
  broadside(g, lead + 50);
  trucks(g);
  buffer(g, tallBuffer);
}

function mount(g: SpriteData, x: number, y: number, kind: Mount): void {
  if (kind === 'square') {
    fillRect(g, x - 7, y - 6, 14, 12, S);
    fillRect(g, x - 5, y - 4, 10, 8, DG);
    fillRect(g, x - 2, y - 2, 4, 4, MG);
    plot(g, x - 5, y - 4, PG);
    plot(g, x, y, G);
    return;
  }
  if (kind === 'twin') {
    fillRect(g, x - 8, y - 5, 16, 10, S);
    fillRect(g, x - 6, y - 3, 5, 6, DG);
    fillRect(g, x + 1, y - 3, 5, 6, DG);
    plot(g, x - 4, y - 2, LG);
    plot(g, x + 3, y - 2, LG);
    plot(g, x, y, MG);
    return;
  }
  fillEllipse(g, x, y, 7, 6, S);
  fillEllipse(g, x, y, 5, 4, DG);
  fillEllipse(g, x, y, 2, 2, MG);
  plot(g, x - 4, y - 3, PG);
  plot(g, x, y, G);
}

function corePlate(g: SpriteData, open: boolean, plate: Plate): void {
  const x = CORE_AT.x;
  const y = CORE_AT.y;
  fillRect(g, x - 8, y - 7, 16, 14, S);
  fillRect(g, x - 6, y - 5, 12, 10, DG);
  if (open) {
    fillRect(g, x - 4, y - 3, 8, 6, EO);
    fillRect(g, x - 2, y - 1, 4, 3, EY);
    plot(g, x, y, W);
  } else if (plate === 'square') {
    fillRect(g, x - 4, y - 4, 8, 8, MG);
    hline(g, x - 4, y - 4, 8, LG);
    plot(g, x, y, EO);
  } else if (plate === 'slit') {
    fillRect(g, x - 5, y - 1, 10, 3, MG);
    hline(g, x - 5, y - 1, 10, LG);
    plot(g, x, y, EO);
  } else {
    fillEllipse(g, x, y, 4, 3, MG);
    plot(g, x - 2, y - 1, LG);
    plot(g, x, y, EO);
  }
  plot(g, x - 6, y - 5, PG);
  plot(g, x + 5, y - 5, PG);
  plot(g, x - 6, y + 4, G);
  plot(g, x + 5, y + 4, G);
}

function finish(g: SpriteData, open: boolean, kind: Mount, plate: Plate): SpriteData {
  fillEllipse(g, LOCO_GUN.x, LOCO_GUN.y, 8, 7, S);
  mount(g, LOCO_GUN.x, LOCO_GUN.y, kind);
  mount(g, CAR_GUN.x, CAR_GUN.y, kind);
  strengthenLocoGuns(g);
  for (let i = 0; i < TIEBAO_CARS; i++) carHardpoint(g, i);
  corePlate(g, open, plate);
  outline(g, K);
  return g;
}

/** A: wedge, round mounts, vent and grate on the first car, cargo on the second. */
function lookA(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_FULL_H, -1);
  consist(g, 'wedge', false, false);
  const a = tiebaoCarBodyY(0);
  const b = tiebaoCarBodyY(1);
  fillEllipse(g, CX, a + 14, 7, 6, S);
  fillEllipse(g, CX, a + 14, 4, 3, DG);
  fillEllipse(g, CX, a + 14, 2, 2, K);
  plot(g, CX, a + 14, LG);
  fillRect(g, 28, a + 36, 24, 22, S);
  for (let x = 30; x < 50; x += 4) vline(g, x, a + 38, 18, DG);
  hline(g, 28, a + 36, 24, LG);
  fillRect(g, 26, b + 8, 8, 14, MG);
  fillRect(g, 46, b + 8, 8, 14, MG);
  plot(g, 29, b + 10, EY);
  plot(g, 49, b + 10, EY);
  fillRect(g, 26, b + 28, 12, 20, S);
  fillRect(g, 42, b + 28, 12, 20, S);
  fillRect(g, 28, b + 30, 8, 8, WD);
  fillRect(g, 28, b + 40, 8, 6, BR);
  hline(g, 28, b + 30, 8, TAN);
  fillEllipse(g, 46, b + 36, 3, 4, MG);
  fillEllipse(g, 51, b + 36, 3, 4, G);
  return finish(g, open, 'round', 'round');
}

/** B: flat face, rivets along the cab, ribbed first car, louvered second. */
function lookB(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_FULL_H, -1);
  consist(g, 'blunt', false, false);
  for (let y = 20; y < 108; y += 10) {
    plot(g, 26, y, PG);
    plot(g, 53, y, PG);
  }
  const a = tiebaoCarBodyY(0);
  const b = tiebaoCarBodyY(1);
  for (let y = a + 8; y < a + TIEBAO_CAR_H - 8; y += 8) {
    hline(g, 28, y, 24, y % 16 === 0 ? S : DG);
  }
  for (let y = b + 28; y < b + TIEBAO_CAR_H - 10; y += 4) hline(g, 28, y, 24, S);
  hline(g, 28, b + 26, 24, LG);
  return finish(g, open, 'square', 'square');
}

/** C: spike and skirts, tall ammo doors on the first car. */
function lookC(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_FULL_H, -1);
  consist(g, 'spike', false, false);
  const a = tiebaoCarBodyY(0);
  const b = tiebaoCarBodyY(1);
  fillRect(g, 26, a + 10, 12, 48, S);
  fillRect(g, 42, a + 10, 12, 48, S);
  fillRect(g, 28, a + 12, 8, 44, TAN);
  fillRect(g, 44, a + 12, 8, 44, OL);
  hline(g, 28, a + 12, 8, OY);
  hline(g, 44, a + 12, 8, LG);
  vline(g, 31, a + 16, 36, WD);
  vline(g, 47, a + 16, 36, DG);
  fillRect(g, 48, b + 16, 8, 12, MG);
  fillRect(g, 50, b + 18, 4, 8, LG);
  return finish(g, open, 'round', 'round');
}

/** D: chamfer and up-barrel, spine down the cab, tubes by the rear gun. */
function lookD(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_FULL_H, -1);
  consist(g, 'chamfer', false, false);
  vline(g, 39, 24, 40, S);
  vline(g, 40, 24, 40, LG);
  vline(g, 41, 24, 40, S);
  const a = tiebaoCarBodyY(0);
  fillRect(g, 28, a + 16, 24, 36, S);
  fillRect(g, 30, a + 18, 20, 32, MG);
  for (let y = a + 24; y < a + 46; y += 8) hline(g, 32, y, 16, S);
  fillEllipse(g, 28, CAR_GUN.y - 8, 4, 5, S);
  fillEllipse(g, 52, CAR_GUN.y - 8, 4, 5, S);
  fillEllipse(g, 28, CAR_GUN.y - 8, 2, 3, DG);
  fillEllipse(g, 52, CAR_GUN.y - 8, 2, 3, DG);
  plot(g, 28, CAR_GUN.y - 10, EY);
  plot(g, 52, CAR_GUN.y - 10, EY);
  return finish(g, open, 'twin', 'square');
}

/** E: stepped nose, heavy knuckles, hatches, tall buffer. */
function lookE(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_FULL_H, -1);
  consist(g, 'step', true, true);
  const a = tiebaoCarBodyY(0);
  const b = tiebaoCarBodyY(1);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = 27 + col * 14;
      const y = a + 8 + row * 18;
      fillRect(g, x, y, 12, 12, S);
      fillRect(g, x + 2, y + 2, 8, 8, MG);
      hline(g, x + 2, y + 2, 8, LG);
      plot(g, x + 5, y + 5, EO);
    }
  }
  vline(g, 28, b + 8, 48, PG);
  vline(g, 29, b + 8, 48, S);
  return finish(g, open, 'twin', 'slit');
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
