/**
 * Locked 铁堡 hull: dark-steel locomotive plus two armored boxcars.
 * The player chases from behind, so the nose points up-screen.
 * Top of the sprite is the pilot. Bottom is the last car's buffer.
 *
 * Five variations share that consist, the coupler gaps, and the hit
 * anchors. They differ in nose plating, mount shape, and roof panels.
 * Temporary default is A. Factory A is already locked.
 *
 * Anchors are hull-center offsets (`TIEBAO_CORE` / `TIEBAO_ROOF_*`),
 * +y toward the player. On this 80×160 sprite that is:
 *   core      (40, 18)   nose
 *   roofLoco  (40, 42)   locomotive roof
 *   roofCar   (40, 130)  rear boxcar
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

/** Inset roof. Light from the upper left, so the nose edge stays bright. */
function roof(g: SpriteData, x: number, y: number, w: number, h: number, cap: number): void {
  fillRect(g, x, y, w, h, DG);
  fillRect(g, x + 3, y + 3, w - 6, h - 6, cap);
  hline(g, x + 3, y + 3, w - 6, LG);
  vline(g, x + 3, y + 3, h - 6, LG);
  hline(g, x + 3, y + h - 4, w - 6, S);
  vline(g, x + w - 4, y + 3, h - 6, S);
  plot(g, x + 1, y + 1, PG);
  plot(g, x + w - 2, y + 1, PG);
  plot(g, x + 1, y + h - 2, G);
  plot(g, x + w - 2, y + h - 2, G);
}

function bogie(g: SpriteData, y: number, left: number, right: number): void {
  fillRect(g, left, y - 2, 8, 4, S);
  fillRect(g, right - 8, y - 2, 8, 4, S);
  for (const x of [left - 6, right + 2]) {
    fillRect(g, x, y - 6, 4, 3, K);
    fillRect(g, x, y + 3, 4, 3, K);
    plot(g, x + 1, y - 5, G);
    plot(g, x + 1, y + 4, LG);
  }
}

/** Knuckle in a gap. `y` is the top of the housing. */
function coupler(g: SpriteData, y: number, heavy: boolean): void {
  const w = heavy ? 16 : 12;
  const x = CX - Math.floor(w / 2);
  fillRect(g, CX - 3, y, 6, 2, S);
  fillRect(g, x, y + 2, w, heavy ? 7 : 5, DG);
  fillRect(g, CX - 3, y + 3, 6, 3, MG);
  hline(g, x, y + 2, w, LG);
  plot(g, x + 1, y + 4, PG);
  plot(g, x + w - 2, y + 4, PG);
  fillRect(g, CX - 3, y + (heavy ? 9 : 7), 6, 2, S);
}

function noseOf(g: SpriteData, nose: Nose): void {
  if (nose === 'wedge') {
    fillPoly(
      g,
      [
        [CX, 2],
        [18, 20],
        [62, 20],
      ],
      DG
    );
    fillPoly(
      g,
      [
        [CX, 5],
        [24, 18],
        [56, 18],
      ],
      MG
    );
    hline(g, CX - 1, 4, 2, LG);
  } else if (nose === 'blunt') {
    fillRect(g, 24, 4, 32, 4, DG);
    fillPoly(
      g,
      [
        [24, 4],
        [56, 4],
        [64, 16],
        [16, 16],
      ],
      DG
    );
    fillRect(g, 26, 6, 28, 8, MG);
    hline(g, 26, 6, 28, LG);
    fillRect(g, 30, 8, 4, 3, EY);
    fillRect(g, 46, 8, 4, 3, EY);
    plot(g, 31, 9, W);
    plot(g, 47, 9, W);
  } else if (nose === 'spike') {
    fillPoly(
      g,
      [
        [CX, 1],
        [30, 18],
        [50, 18],
      ],
      DG
    );
    fillPoly(
      g,
      [
        [CX, 4],
        [34, 16],
        [46, 16],
      ],
      MG
    );
    hline(g, CX, 3, 1, W);
  } else if (nose === 'chamfer') {
    fillPoly(
      g,
      [
        [22, 8],
        [58, 8],
        [66, 18],
        [14, 18],
      ],
      DG
    );
    fillRect(g, 24, 10, 32, 6, MG);
    hline(g, 24, 10, 32, LG);
    fillRect(g, 36, 1, 8, 3, G);
    fillRect(g, 38, 1, 4, 12, DG);
    plot(g, 39, 2, EY);
    plot(g, 40, 2, W);
  } else {
    fillRect(g, 30, 3, 20, 6, DG);
    fillRect(g, 32, 5, 16, 3, MG);
    hline(g, 32, 5, 16, LG);
    fillRect(g, 22, 9, 36, 6, DG);
    fillRect(g, 24, 11, 32, 3, MG);
    fillRect(g, 16, 15, 48, 4, DG);
  }
}

function loco(g: SpriteData, nose: Nose): void {
  noseOf(g, nose);
  roof(g, 16, 18, 48, 34, MG);
  hline(g, 22, 32, 36, S);
  fillRect(g, 20, 24, 2, 2, RD);
  fillRect(g, 58, 24, 2, 2, RD);
}

function boxcar(g: SpriteData, y: number, h: number): void {
  roof(g, 10, y, 60, h, G);
}

/** Side pods. Short tubes reach the missile origins without bridging the gap. */
function pods(g: SpriteData): void {
  fillRect(g, 4, 36, 14, 12, DG);
  fillRect(g, 62, 36, 14, 12, DG);
  fillRect(g, 6, 38, 10, 8, S);
  fillRect(g, 64, 38, 10, 8, S);
  fillRect(g, 7, 40, 3, 4, K);
  fillRect(g, 12, 40, 3, 4, K);
  fillRect(g, 65, 40, 3, 4, K);
  fillRect(g, 70, 40, 3, 4, K);
  fillRect(g, 10, 46, 6, 12, S);
  fillRect(g, 64, 46, 6, 12, S);
  vline(g, 12, 48, 8, DG);
  vline(g, 66, 48, 8, DG);
}

function broadside(g: SpriteData): void {
  fillRect(g, 1, 84, 12, 6, DG);
  fillRect(g, 67, 84, 12, 6, DG);
  fillRect(g, 2, 86, 8, 2, K);
  fillRect(g, 70, 86, 8, 2, K);
  plot(g, 3, 85, LG);
  plot(g, 76, 85, LG);
}

/** Rear beam. Yellow lamps sit where the ram telegraph flashes. */
function buffer(g: SpriteData, tall: boolean): void {
  const y = tall ? 146 : 150;
  const h = tall ? 12 : 8;
  fillRect(g, 12, y, 56, h, DG);
  fillRect(g, 16, y + 2, 48, h - 4, MG);
  hline(g, 16, y + 2, 48, LG);
  fillRect(g, 24, 150, 8, 3, EY);
  fillRect(g, 48, 150, 8, 3, EY);
  plot(g, 26, 151, W);
  plot(g, 50, 151, W);
  fillRect(g, 36, y + h - 4, 8, 3, K);
}

function trucks(g: SpriteData): void {
  bogie(g, 28, 16, 64);
  bogie(g, 46, 16, 64);
  bogie(g, 72, 10, 70);
  bogie(g, 96, 10, 70);
  bogie(g, 124, 10, 70);
  bogie(g, 142, 10, 70);
}

function consist(g: SpriteData, nose: Nose, heavy: boolean, tallBuffer: boolean): void {
  loco(g, nose);
  if (nose === 'spike') {
    fillRect(g, 6, 24, 12, 24, DG);
    fillRect(g, 62, 24, 12, 24, DG);
    fillRect(g, 8, 26, 8, 20, S);
    fillRect(g, 64, 26, 8, 20, S);
  }
  pods(g);
  coupler(g, 54, heavy);
  boxcar(g, 64, 40);
  broadside(g);
  coupler(g, 106, heavy);
  boxcar(g, 116, 34);
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

/** A: wedge nose, round mounts, middle vent, rear cargo bay. Concept massing. */
function lookA(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'wedge', false, false);
  fillEllipse(g, 40, 74, 8, 7, S);
  fillEllipse(g, 40, 74, 5, 4, DG);
  fillEllipse(g, 40, 74, 2, 2, K);
  plot(g, 40, 74, LG);
  fillRect(g, 22, 88, 36, 10, S);
  for (let x = 24; x < 56; x += 4) vline(g, x, 89, 8, DG);
  hline(g, 22, 88, 36, LG);
  fillRect(g, 16, 122, 14, 20, S);
  fillRect(g, 50, 122, 14, 20, S);
  fillRect(g, 18, 124, 10, 8, WD);
  fillRect(g, 18, 134, 10, 6, BR);
  hline(g, 18, 124, 10, TAN);
  fillEllipse(g, 55, 128, 4, 5, MG);
  fillEllipse(g, 61, 128, 4, 5, G);
  plot(g, 55, 126, LG);
  plot(g, 61, 126, LG);
  fillRect(g, 54, 136, 3, 4, OL);
  fillRect(g, 60, 136, 3, 4, OL);
  return finish(g, open, 'round', 'round');
}

/** B: flat armored face, rivet rows, ribbed middle roof, louvered rear. */
function lookB(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'blunt', false, false);
  for (let y = 22; y < 48; y += 6) {
    plot(g, 18, y, PG);
    plot(g, 61, y, PG);
  }
  for (let y = 68; y < 100; y += 4) hline(g, 16, y, 48, y % 8 === 0 ? S : DG);
  for (let x = 16; x < 66; x += 8) {
    plot(g, x, 66, PG);
    plot(g, x, 100, PG);
    plot(g, x, 118, PG);
    plot(g, x, 146, PG);
  }
  for (let y = 122; y < 146; y += 3) hline(g, 18, y, 44, S);
  fillRect(g, 18, 120, 44, 2, LG);
  return finish(g, open, 'square', 'square');
}

/** C: spike, side skirts, twin ammo doors, a small cupola beside the rear gun. */
function lookC(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'spike', false, false);
  fillRect(g, 18, 70, 18, 26, S);
  fillRect(g, 44, 70, 18, 26, S);
  fillRect(g, 20, 72, 14, 22, TAN);
  fillRect(g, 46, 72, 14, 22, OL);
  hline(g, 20, 72, 14, OY);
  hline(g, 46, 72, 14, LG);
  vline(g, 26, 74, 18, WD);
  vline(g, 52, 74, 18, DG);
  fillRect(g, 54, 120, 12, 10, MG);
  fillRect(g, 56, 122, 8, 6, LG);
  plot(g, 58, 124, S);
  plot(g, 61, 124, S);
  return finish(g, open, 'round', 'round');
}

/** D: chamfered nose with an up-barrel, center spine, rear tubes flanking the gun. */
function lookD(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'chamfer', false, false);
  vline(g, 39, 20, 28, S);
  vline(g, 40, 20, 28, LG);
  vline(g, 41, 20, 28, S);
  fillRect(g, 18, 68, 44, 28, S);
  fillRect(g, 20, 70, 40, 24, MG);
  for (let y = 74; y < 92; y += 6) hline(g, 22, y, 36, S);
  fillEllipse(g, 22, 126, 5, 6, S);
  fillEllipse(g, 58, 126, 5, 6, S);
  fillEllipse(g, 22, 126, 3, 4, DG);
  fillEllipse(g, 58, 126, 3, 4, DG);
  plot(g, 22, 123, EY);
  plot(g, 58, 123, EY);
  fillRect(g, 20, 132, 4, 10, DG);
  fillRect(g, 56, 132, 4, 10, DG);
  return finish(g, open, 'twin', 'square');
}

/** E: stepped nose, heavy knuckles, four hatches, tall buffer beam. */
function lookE(open: boolean): SpriteData {
  const g = createGrid(TIEBAO_HULL_W, TIEBAO_HULL_H, -1);
  consist(g, 'step', true, true);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const x = 22 + col * 20;
      const y = 70 + row * 14;
      fillRect(g, x, y, 14, 10, S);
      fillRect(g, x + 2, y + 2, 10, 6, MG);
      hline(g, x + 2, y + 2, 10, LG);
      plot(g, x + 6, y + 4, EO);
    }
  }
  vline(g, 20, 120, 24, PG);
  vline(g, 21, 120, 24, S);
  for (let x = 18; x < 64; x += 6) plot(g, x, 148, PG);
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
