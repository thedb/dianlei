/**
 * Locked 铁堡 hull: a slender dark-steel locomotive plus two long boxcars.
 * The player chases from behind, so the nose points up-screen.
 * Top of the sprite is the pilot. Bottom is the last car's buffer.
 *
 * Body width stays near 36px inside the 80px hitbox so the cars read as
 * 细长 rather than stubby. Both boxcars are about twice as long as they
 * are wide. Five variations share the consist, the coupler gaps, and the
 * hit anchors. Temporary default is A. Factory A is already locked.
 *
 * Anchors are hull-center offsets (`TIEBAO_CORE` / `TIEBAO_ROOF_*`),
 * +y toward the player. On this 80×232 sprite that is:
 *   core      (40, 18)   nose
 *   roofLoco  (40, 48)   locomotive roof
 *   roofCar   (40, 190)  rear boxcar
 */

import {
  TIEBAO_CORE,
  TIEBAO_HULL_H,
  TIEBAO_HULL_W,
  TIEBAO_ROOF_CAR,
  TIEBAO_ROOF_LOCO,
} from '@/game/config';
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
const CY = Math.floor(TIEBAO_HULL_H / 2);

/** Thin loco body. 32×50 under a tapered nose. */
const LOCO = { x: 24, y: 14, w: 32, h: 50 } as const;
/** Two long boxcars, 36×72. About 2:1. */
const CAR1 = { x: 22, y: 74, w: 36, h: 72 } as const;
const CAR2 = { x: 22, y: 156, w: 36, h: 72 } as const;
const COUPLE_1 = 65;
const COUPLE_2 = 147;

function at(offset: { readonly x: number; readonly y: number }): { x: number; y: number } {
  return { x: CX + offset.x, y: CY + offset.y };
}

const CORE_AT = at(TIEBAO_CORE);
const LOCO_GUN = at(TIEBAO_ROOF_LOCO);
const CAR_GUN = at(TIEBAO_ROOF_CAR);

type Nose = 'wedge' | 'blunt' | 'spike' | 'chamfer' | 'step';
type Mount = 'round' | 'square' | 'twin';
type Plate = 'round' | 'square' | 'slit';

function hline(g: SpriteData, x: number, y: number, w: number, color: number): void {
  for (let i = 0; i < w; i++) plot(g, x + i, y, color);
}

function vline(g: SpriteData, x: number, y: number, h: number, color: number): void {
  for (let i = 0; i < h; i++) plot(g, x, y + i, color);
}

/** Inset roof. A long center seam keeps a stretched car from reading as a slab. */
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

/** Knuckle in a gap. `y` is the top of the housing. */
function coupler(g: SpriteData, y: number, heavy: boolean): void {
  const w = heavy ? 14 : 10;
  const x = CX - Math.floor(w / 2);
  fillRect(g, CX - 2, y, 4, 2, S);
  fillRect(g, x, y + 2, w, heavy ? 6 : 5, DG);
  fillRect(g, CX - 2, y + 3, 4, 3, MG);
  hline(g, x, y + 2, w, LG);
  plot(g, x + 1, y + 4, PG);
  plot(g, x + w - 2, y + 4, PG);
  fillRect(g, CX - 2, y + (heavy ? 8 : 7), 4, 2, S);
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
}

function loco(g: SpriteData, nose: Nose): void {
  noseOf(g, nose);
  roof(g, LOCO.x, LOCO.y, LOCO.w, LOCO.h, MG);
  fillRect(g, 28, 22, 2, 2, RD);
  fillRect(g, 50, 22, 2, 2, RD);
}

function boxcar(g: SpriteData, y: number, h: number): void {
  roof(g, CAR1.x, y, CAR1.w, h, G);
}

/** Missile pods on the middle car. Tubes reach the shot origins without joining the cars. */
function pods(g: SpriteData): void {
  const y = CY - 30;
  fillRect(g, 8, y, 14, 14, DG);
  fillRect(g, 58, y, 14, 14, DG);
  fillRect(g, 10, y + 2, 10, 8, S);
  fillRect(g, 60, y + 2, 10, 8, S);
  fillRect(g, 11, y + 4, 3, 4, K);
  fillRect(g, 16, y + 4, 3, 4, K);
  fillRect(g, 61, y + 4, 3, 4, K);
  fillRect(g, 66, y + 4, 3, 4, K);
}

function broadside(g: SpriteData): void {
  const y = CY + 6;
  fillRect(g, 2, y, 20, 5, DG);
  fillRect(g, 58, y, 20, 5, DG);
  fillRect(g, 3, y + 2, 10, 2, K);
  fillRect(g, 67, y + 2, 10, 2, K);
  plot(g, 4, y + 1, LG);
  plot(g, 74, y + 1, LG);
}

/** Rear beam. Yellow lamps sit where the ram telegraph flashes. */
function buffer(g: SpriteData, tall: boolean): void {
  const y = tall ? TIEBAO_HULL_H - 20 : TIEBAO_HULL_H - 14;
  const h = TIEBAO_HULL_H - 4 - y;
  fillRect(g, CAR2.x, y, CAR2.w, h, DG);
  fillRect(g, CAR2.x + 3, y + 2, CAR2.w - 6, Math.max(2, h - 4), MG);
  hline(g, CAR2.x + 3, y + 2, CAR2.w - 6, LG);
  const lampY = TIEBAO_HULL_H - 10;
  fillRect(g, 24, lampY, 8, 3, EY);
  fillRect(g, 48, lampY, 8, 3, EY);
  plot(g, 26, lampY + 1, W);
  plot(g, 50, lampY + 1, W);
  fillRect(g, CX - 3, y + h - 3, 6, 2, K);
}

function trucks(g: SpriteData): void {
  bogie(g, 28, LOCO.x, LOCO.x + LOCO.w);
  bogie(g, 52, LOCO.x, LOCO.x + LOCO.w);
  bogie(g, CAR1.y + 12, CAR1.x, CAR1.x + CAR1.w);
  bogie(g, CAR1.y + CAR1.h - 16, CAR1.x, CAR1.x + CAR1.w);
  bogie(g, CAR2.y + 12, CAR2.x, CAR2.x + CAR2.w);
  bogie(g, CAR2.y + CAR2.h - 18, CAR2.x, CAR2.x + CAR2.w);
}

function consist(g: SpriteData, nose: Nose, heavy: boolean, tallBuffer: boolean): void {
  loco(g, nose);
  if (nose === 'spike') {
    fillRect(g, 18, 24, 8, 22, DG);
    fillRect(g, 54, 24, 8, 22, DG);
    fillRect(g, 20, 26, 5, 18, S);
    fillRect(g, 55, 26, 5, 18, S);
  }
  coupler(g, COUPLE_1, heavy);
  boxcar(g, CAR1.y, CAR1.h);
  pods(g);
  broadside(g);
  coupler(g, COUPLE_2, heavy);
  boxcar(g, CAR2.y, CAR2.h);
  buffer(g, tallBuffer);
  trucks(g);
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
  mount(g, LOCO_GUN.x, LOCO_GUN.y, kind);
  mount(g, CAR_GUN.x, CAR_GUN.y, kind);
  corePlate(g, open, plate);
  outline(g, K);
  return g;
}

/** A: wedge nose, round mounts, long vented roof, rear cargo hatch. */
function lookA(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'wedge', false, false);
  fillEllipse(g, CX, CAR1.y + 14, 7, 6, S);
  fillEllipse(g, CX, CAR1.y + 14, 4, 3, DG);
  fillEllipse(g, CX, CAR1.y + 14, 2, 2, K);
  plot(g, CX, CAR1.y + 14, LG);
  fillRect(g, 28, CAR1.y + 32, 24, 22, S);
  for (let x = 30; x < 50; x += 4) vline(g, x, CAR1.y + 34, 18, DG);
  hline(g, 28, CAR1.y + 32, 24, LG);
  fillRect(g, 26, CAR2.y + 8, 8, 14, MG);
  fillRect(g, 46, CAR2.y + 8, 8, 14, MG);
  plot(g, 29, CAR2.y + 10, EY);
  plot(g, 49, CAR2.y + 10, EY);
  fillRect(g, 26, CAR2.y + 40, 12, 22, S);
  fillRect(g, 42, CAR2.y + 40, 12, 22, S);
  fillRect(g, 28, CAR2.y + 42, 8, 8, WD);
  fillRect(g, 28, CAR2.y + 52, 8, 8, BR);
  hline(g, 28, CAR2.y + 42, 8, TAN);
  fillEllipse(g, 46, CAR2.y + 48, 3, 4, MG);
  fillEllipse(g, 51, CAR2.y + 48, 3, 4, G);
  plot(g, 46, CAR2.y + 46, LG);
  plot(g, 51, CAR2.y + 46, LG);
  return finish(g, open, 'round', 'round');
}

/** B: flat face, rivets, long ribbed roof, louvered rear half. */
function lookB(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'blunt', false, false);
  for (let y = 20; y < 58; y += 8) {
    plot(g, 26, y, PG);
    plot(g, 53, y, PG);
  }
  for (let y = CAR1.y + 8; y < CAR1.y + CAR1.h - 8; y += 8) {
    hline(g, 28, y, 24, y % 16 === 0 ? S : DG);
  }
  for (let y = CAR2.y + 28; y < CAR2.y + CAR2.h - 10; y += 4) {
    hline(g, 28, y, 24, S);
  }
  hline(g, 28, CAR2.y + 26, 24, LG);
  return finish(g, open, 'square', 'square');
}

/** C: spike and short skirts, tall ammo doors on the long middle car. */
function lookC(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'spike', false, false);
  fillRect(g, 26, CAR1.y + 10, 12, 48, S);
  fillRect(g, 42, CAR1.y + 10, 12, 48, S);
  fillRect(g, 28, CAR1.y + 12, 8, 44, TAN);
  fillRect(g, 44, CAR1.y + 12, 8, 44, OL);
  hline(g, 28, CAR1.y + 12, 8, OY);
  hline(g, 44, CAR1.y + 12, 8, LG);
  vline(g, 31, CAR1.y + 16, 36, WD);
  vline(g, 47, CAR1.y + 16, 36, DG);
  fillRect(g, 48, CAR2.y + 16, 8, 12, MG);
  fillRect(g, 50, CAR2.y + 18, 4, 8, LG);
  plot(g, 51, CAR2.y + 20, S);
  plot(g, 53, CAR2.y + 20, S);
  return finish(g, open, 'round', 'round');
}

/** D: chamfer and up-barrel, spine, tubes flanking the rear gun. */
function lookD(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'chamfer', false, false);
  vline(g, 39, 22, 28, S);
  vline(g, 40, 22, 28, LG);
  vline(g, 41, 22, 28, S);
  fillRect(g, 28, CAR1.y + 18, 24, 36, S);
  fillRect(g, 30, CAR1.y + 20, 20, 32, MG);
  for (let y = CAR1.y + 26; y < CAR1.y + 48; y += 8) hline(g, 32, y, 16, S);
  fillEllipse(g, 28, CAR_GUN.y - 8, 4, 5, S);
  fillEllipse(g, 52, CAR_GUN.y - 8, 4, 5, S);
  fillEllipse(g, 28, CAR_GUN.y - 8, 2, 3, DG);
  fillEllipse(g, 52, CAR_GUN.y - 8, 2, 3, DG);
  plot(g, 28, CAR_GUN.y - 10, EY);
  plot(g, 52, CAR_GUN.y - 10, EY);
  return finish(g, open, 'twin', 'square');
}

/** E: stepped nose, heavy knuckles, a column of hatches, tall buffer. */
function lookE(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'step', true, true);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = 27 + col * 14;
      const y = CAR1.y + 8 + row * 18;
      fillRect(g, x, y, 12, 12, S);
      fillRect(g, x + 2, y + 2, 8, 8, MG);
      hline(g, x + 2, y + 2, 8, LG);
      plot(g, x + 5, y + 5, EO);
    }
  }
  vline(g, 28, CAR2.y + 8, 48, PG);
  vline(g, 29, CAR2.y + 8, 48, S);
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
