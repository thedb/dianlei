/**
 * Enemy sprites — code-drawn, palette indices only.
 * Medium fighter is a real 36×36 (P2). P1 scaled the 24×24 small fighter;
 * do not bring that path back.
 *
 * Air ships are drawn nose-down (toward the player) with engines at the top,
 * so the upward exhaust sits on the nozzles.
 */

import { COLOR } from '@/game/palette';
import type { EnemyType } from '@/game/levels/types';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite, createHitFlashSprite } from './spriteRenderer';
import { createGrid, fillEllipse, fillPoly, fillRect, outline, plot } from './pixelDraw';

const _ = -1;
const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const G = COLOR.GRAY;

const EB = COLOR.ENEMY_BLACK;
const ED = COLOR.ENEMY_DARK_RED;
const EC = COLOR.ENEMY_CRIMSON;
const ER = COLOR.ENEMY_RED;
const EH = COLOR.ENEMY_BRIGHT_RED;

const OD = COLOR.GROUND_DARK_OLIVE;
const OL = COLOR.GROUND_OLIVE;
const OM = COLOR.GROUND_MED_OLIVE;
const OL2 = COLOR.GROUND_LIGHT_OLIVE;
const TN = COLOR.GROUND_TAN;
const AS = COLOR.TERRAIN_ASPHALT;
const CC = COLOR.TERRAIN_CONCRETE;
const DB = COLOR.TERRAIN_DARK_BROWN;

/**
 * Small fighter — 24×24. Nose at the top, engines at the bottom (P1 art).
 * Flame anchor stays at the top edge so the P1 exhaust position is unchanged.
 */
const SMALL_FIGHTER: SpriteData = [
  [_, _, _, _, _, _, _, _, _, _, _, K, K, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, K, ER, ER, K, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, K, EC, ER, ER, EC, K, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K, EC, EC, ER, ER, EC, EC, K, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K, EC, EC, ED, ER, ER, ED, EC, EC, K, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K, EC, EC, ED, K, EH, EH, K, ED, EC, EC, K, _, _, _, _, _, _],
  [_, _, _, _, _, K, EC, EC, ED, K, K, EH, EH, K, K, ED, EC, EC, K, _, _, _, _, _],
  [_, _, _, _, K, EC, EC, ED, K, DG, K, ER, ER, K, DG, K, ED, EC, EC, K, _, _, _, _],
  [_, _, _, K, EC, EC, ED, K, DG, G, K, ER, ER, K, G, DG, K, ED, EC, EC, K, _, _, _],
  [_, _, K, EC, EC, ED, K, DG, G, G, K, ER, ER, K, G, G, DG, K, ED, EC, EC, K, _, _],
  [_, K, EC, EC, ED, K, K, DG, G, K, K, ER, ER, K, K, G, DG, K, K, ED, EC, EC, K, _],
  [K, EC, EC, ED, K, K, K, DG, K, K, EC, ER, ER, EC, K, K, DG, K, K, K, ED, EC, EC, K],
  [K, EC, ED, K, K, K, EC, ED, K, EC, EC, ER, ER, EC, EC, K, ED, EC, K, K, K, ED, EC, K],
  [K, ED, K, K, K, EC, EC, ED, EC, EC, ED, ER, ER, ED, EC, EC, ED, EC, EC, K, K, K, ED, K],
  [K, K, K, K, EC, EC, ED, ED, ED, ED, ED, ER, ER, ED, ED, ED, ED, ED, EC, EC, K, K, K, K],
  [_, K, K, EC, EC, ED, ED, S, S, S, ED, ER, ER, ED, S, S, S, ED, ED, EC, EC, K, K, _],
  [_, _, K, EC, ED, ED, S, K, K, K, S, ER, ER, S, K, K, K, S, ED, ED, EC, K, _, _],
  [_, _, K, EC, ED, S, K, _, _, K, S, ER, ER, S, K, _, _, K, S, ED, EC, K, _, _],
  [_, _, _, K, ED, S, K, _, _, K, ED, ER, ER, ED, K, _, _, K, S, ED, K, _, _, _],
  [_, _, _, K, ED, K, _, _, _, K, ED, EC, EC, ED, K, _, _, _, K, ED, K, _, _, _],
  [_, _, _, K, S, K, _, _, _, K, ED, EC, EC, ED, K, _, _, _, K, S, K, _, _, _],
  [_, _, _, _, K, _, _, _, _, K, S, EC, EC, S, K, _, _, _, _, K, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, K, K, K, K, _, _, _, _, _, _, _, _, _, _],
];

export interface EnemyArt {
  pixels: SpriteData;
  /** Flame anchors relative to the sprite center. Empty = no exhaust. */
  nozzles: ReadonlyArray<{ x: number; y: number }>;
}

function art(pixels: SpriteData, nozzles: ReadonlyArray<{ x: number; y: number }>): EnemyArt {
  return { pixels, nozzles };
}

/** Relocate a pixel coordinate to the sprite-center frame used at draw time. */
function nozzleAt(w: number, h: number, px: number, py: number): { x: number; y: number } {
  return { x: px - Math.floor(w / 2), y: py - Math.floor(h / 2) };
}

/** Medium fighter 36×36. Dark red/black body, thin red outline. Not a scaled small. */
function drawMedium(): EnemyArt {
  const w = 36;
  const h = 36;
  const g = createGrid(w, h);
  fillPoly(
    g,
    [
      [3, 12],
      [33, 12],
      [34, 18],
      [24, 22],
      [20, 20],
      [16, 22],
      [2, 18],
    ],
    ED
  );
  fillPoly(
    g,
    [
      [7, 14],
      [29, 14],
      [30, 18],
      [18, 20],
      [6, 18],
    ],
    EB
  );
  fillEllipse(g, 18, 20, 5, 13, ED);
  fillEllipse(g, 18, 20, 3.2, 11, EB);
  fillPoly(
    g,
    [
      [15, 30],
      [21, 30],
      [18, 35],
    ],
    EC
  );
  fillRect(g, 13, 3, 4, 7, EB);
  fillRect(g, 19, 3, 4, 7, EB);
  fillRect(g, 14, 2, 2, 3, EC);
  fillRect(g, 20, 2, 2, 3, EC);
  fillEllipse(g, 18, 16, 2.2, 3.2, S);
  plot(g, 18, 15, EH);
  plot(g, 18, 17, DG);
  for (let y = 8; y <= 28; y += 4) plot(g, 18, y, EC);
  outline(g, ER);
  return art(g, [nozzleAt(w, h, 15, 3), nozzleAt(w, h, 21, 3)]);
}

/** Interceptor 28×28. Narrow dart, side intakes, red edge. */
function drawInterceptor(): EnemyArt {
  const w = 28;
  const h = 28;
  const g = createGrid(w, h);
  fillPoly(
    g,
    [
      [2, 10],
      [10, 14],
      [12, 18],
      [8, 20],
      [1, 16],
    ],
    ED
  );
  fillPoly(
    g,
    [
      [26, 10],
      [18, 14],
      [16, 18],
      [20, 20],
      [27, 16],
    ],
    ED
  );
  fillEllipse(g, 14, 15, 3.2, 11, EB);
  fillEllipse(g, 14, 16, 2, 9, ED);
  fillPoly(
    g,
    [
      [12, 24],
      [16, 24],
      [14, 27],
    ],
    EC
  );
  fillRect(g, 12, 2, 4, 5, EB);
  fillRect(g, 13, 1, 2, 2, EC);
  fillEllipse(g, 14, 13, 1.4, 2.4, S);
  plot(g, 14, 12, EH);
  outline(g, ER);
  return art(g, [nozzleAt(w, h, 14, 2)]);
}

/** Heavy bomber 56×48. Wide wing, four engines, dark hull. */
function drawBomber(): EnemyArt {
  const w = 56;
  const h = 48;
  const g = createGrid(w, h);
  fillPoly(
    g,
    [
      [2, 16],
      [54, 16],
      [50, 26],
      [36, 28],
      [28, 24],
      [20, 28],
      [6, 26],
    ],
    ED
  );
  fillPoly(
    g,
    [
      [8, 18],
      [48, 18],
      [44, 24],
      [28, 22],
      [12, 24],
    ],
    EB
  );
  fillEllipse(g, 28, 26, 6, 16, ED);
  fillEllipse(g, 28, 27, 4, 13, EB);
  fillPoly(
    g,
    [
      [24, 40],
      [32, 40],
      [28, 46],
    ],
    EC
  );
  fillPoly(
    g,
    [
      [18, 4],
      [24, 12],
      [20, 12],
    ],
    ED
  );
  fillPoly(
    g,
    [
      [38, 4],
      [32, 12],
      [36, 12],
    ],
    ED
  );
  for (const x of [12, 20, 34, 42]) {
    fillRect(g, x, 11, 4, 6, S);
    fillRect(g, x + 1, 9, 2, 3, EC);
  }
  fillEllipse(g, 28, 22, 2.5, 4, DG);
  plot(g, 28, 20, EH);
  for (let y = 16; y <= 36; y += 4) plot(g, 28, y, EC);
  outline(g, ER);
  return art(g, [nozzleAt(w, h, 14, 11), nozzleAt(w, h, 44, 11)]);
}

/** Drone 20×20. Round hub and four arms. The battle scene spins the whole sprite. */
function drawDrone(): EnemyArt {
  const w = 20;
  const h = 20;
  const g = createGrid(w, h);
  fillEllipse(g, 10, 10, 4.2, 4.2, EB);
  fillEllipse(g, 10, 10, 2.2, 2.2, ED);
  plot(g, 10, 10, EH);
  for (const [x, y] of [
    [3, 3],
    [14, 3],
    [3, 14],
    [14, 14],
  ] as const) {
    fillRect(g, x, y, 3, 3, EC);
    plot(g, x + 1, y + 1, ER);
  }
  fillRect(g, 9, 4, 2, 3, ED);
  fillRect(g, 9, 13, 2, 3, ED);
  fillRect(g, 4, 9, 3, 2, ED);
  fillRect(g, 13, 9, 3, 2, ED);
  outline(g, ER);
  return art(g, []);
}

/** Tank 24×24. Olive hull and tracks. The barrel is drawn in code from aimAngle. */
function drawTank(): EnemyArt {
  const w = 24;
  const h = 24;
  const g = createGrid(w, h);
  fillRect(g, 2, 3, 4, 18, AS);
  fillRect(g, 18, 3, 4, 18, AS);
  for (let y = 4; y < 20; y += 3) {
    fillRect(g, 2, y, 4, 1, K);
    fillRect(g, 18, y, 4, 1, K);
  }
  fillRect(g, 6, 4, 12, 16, OL);
  fillRect(g, 7, 5, 10, 14, OD);
  fillEllipse(g, 12, 12, 4.2, 4.2, OM);
  fillEllipse(g, 12, 12, 2.2, 2.2, OL2);
  plot(g, 12, 12, DB);
  outline(g, K);
  return art(g, []);
}

/** Dual turret 32×32. Concrete pit, twin gun bases. Barrels are code-drawn. */
function drawTurret(): EnemyArt {
  const w = 32;
  const h = 32;
  const g = createGrid(w, h);
  fillRect(g, 2, 2, 28, 28, CC);
  fillRect(g, 4, 4, 24, 24, AS);
  fillRect(g, 6, 6, 20, 20, OD);
  fillEllipse(g, 16, 16, 7, 7, OL);
  fillEllipse(g, 16, 16, 4, 4, OM);
  fillRect(g, 10, 8, 3, 6, DG);
  fillRect(g, 19, 8, 3, 6, DG);
  plot(g, 11, 9, K);
  plot(g, 20, 9, K);
  outline(g, K);
  return art(g, []);
}

/** Missile car 24×32. Cab toward the bottom of the sprite, two tubes on the bed. */
function drawMissileCar(): EnemyArt {
  const w = 24;
  const h = 32;
  const g = createGrid(w, h);
  fillRect(g, 2, 6, 4, 20, AS);
  fillRect(g, 18, 6, 4, 20, AS);
  for (let y = 7; y < 25; y += 4) {
    plot(g, 3, y, K);
    plot(g, 20, y, K);
  }
  fillRect(g, 6, 8, 12, 18, OL);
  fillRect(g, 7, 18, 10, 7, OM);
  fillRect(g, 8, 20, 8, 4, DG);
  plot(g, 10, 21, OL2);
  plot(g, 13, 21, OL2);
  fillRect(g, 7, 8, 4, 10, TN);
  fillRect(g, 13, 8, 4, 10, TN);
  fillRect(g, 8, 6, 2, 3, ER);
  fillRect(g, 14, 6, 2, 3, ER);
  outline(g, K);
  return art(g, []);
}

const BUILDERS: Record<EnemyType, () => EnemyArt> = {
  small: () => art(SMALL_FIGHTER, [{ x: 0, y: -12 }]),
  medium: drawMedium,
  interceptor: drawInterceptor,
  bomber: drawBomber,
  drone: drawDrone,
  tank: drawTank,
  turret2: drawTurret,
  missile_car: drawMissileCar,
};

/** Palette-index art for one enemy. Safe to call in unit tests (no canvas). */
export function buildEnemyArt(type: EnemyType): EnemyArt {
  return BUILDERS[type]();
}

export interface EnemySpriteSheet {
  idle: SpriteFrame;
  hitFlash: SpriteFrame;
  nozzles: ReadonlyArray<{ x: number; y: number }>;
  width: number;
  height: number;
}

function sheetFromArt(enemyArt: EnemyArt): EnemySpriteSheet {
  const idle = renderSprite(enemyArt.pixels, 0.5, 0.5);
  return {
    idle,
    hitFlash: createHitFlashSprite(idle),
    nozzles: enemyArt.nozzles,
    width: idle.width,
    height: idle.height,
  };
}

export interface EnemyAssets {
  byType: Record<EnemyType, EnemySpriteSheet>;
}

/** Initialize every enemy sprite. Call once at battle enter. */
export function createEnemyAssets(): EnemyAssets {
  const byType = {} as Record<EnemyType, EnemySpriteSheet>;
  (Object.keys(BUILDERS) as EnemyType[]).forEach((type) => {
    byType[type] = sheetFromArt(buildEnemyArt(type));
  });
  return { byType };
}
