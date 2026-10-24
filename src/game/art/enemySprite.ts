/**
 * Enemy sprites — palette-index pixel art, baked to an offscreen canvas at boot.
 *
 * Airframes point nose-down (toward the player). Engines sit at the top so the
 * code-drawn exhaust (design §3.5) leaves upward. Silhouettes follow the
 * stage-1 sheets: straight small fighter, darker medium gunship, swept
 * interceptor, four-nacelle bomber, X-rotor drone. Ground units are top-down
 * olive with the same thin red rim. Hit flash is a code tint of the idle frame.
 */

import { COLOR } from '@/game/palette';
import type { EnemyType } from '@/game/levels/types';
import type { SpriteData, SpriteFrame } from './types';
import { renderSprite, createHitFlashSprite } from './spriteRenderer';
import { createGrid, fillEllipse, plot, rim } from './pixelDraw';

const K = COLOR.BLACK;
const S = COLOR.SHADOW;
const DG = COLOR.DARK_GRAY;
const MG = COLOR.MEDIUM_GRAY;
const G = COLOR.GRAY;
const LG = COLOR.LIGHT_GRAY;
const PG = COLOR.PALE_GRAY;
const W = COLOR.WHITE;

const EB = COLOR.ENEMY_BLACK;
const ED = COLOR.ENEMY_DARK_RED;
const EC = COLOR.ENEMY_CRIMSON;
const ER = COLOR.ENEMY_RED;
const EH = COLOR.ENEMY_BRIGHT_RED;
const EV = COLOR.ENEMY_VIVID_RED;

const OD = COLOR.GROUND_DARK_OLIVE;
const OL = COLOR.GROUND_OLIVE;
const OM = COLOR.GROUND_MED_OLIVE;
const OI = COLOR.GROUND_LIGHT_OLIVE;
const TN = COLOR.GROUND_TAN;
const AS = COLOR.TERRAIN_ASPHALT;
const DB = COLOR.TERRAIN_DARK_BROWN;

export interface EnemyArt {
  pixels: SpriteData;
  /** Flame anchors relative to the sprite center. Empty = no exhaust. */
  nozzles: ReadonlyArray<{ x: number; y: number }>;
}

function art(pixels: SpriteData, nozzles: ReadonlyArray<{ x: number; y: number }>): EnemyArt {
  return { pixels, nozzles };
}

function nozzleAt(w: number, h: number, px: number, py: number): { x: number; y: number } {
  return { x: px - Math.floor(w / 2), y: py - Math.floor(h / 2) };
}

interface FighterSpec {
  w: number;
  h: number;
  engineRows: number;
  wingRows: number;
  wingHalf: number;
  engineHalf: number;
  notch: number;
  sweep: number;
  noseHalf: number;
  fuselage: number;
  /** Crimson/black hull instead of the bright small-fighter red. */
  dark: boolean;
}

/**
 * Top-down fighter. Rear and nozzles are y=0; the nose is the last filled row.
 * `sweep` pulls the wing tips rearward (small sweep = straight wings).
 */
function drawFighter(spec: FighterSpec): SpriteData {
  const {
    w,
    h,
    engineRows,
    wingRows,
    wingHalf,
    engineHalf,
    notch,
    sweep,
    noseHalf,
    fuselage,
    dark,
  } = spec;
  const g = createGrid(w, h);
  const cx = (w - 1) / 2;
  const body: number = dark ? EC : EH;
  const root: number = dark ? EB : ED;
  const edge: number = dark ? EB : EC;

  for (let y = 0; y < h; y++) {
    let half: number;
    let notchHere = 0;
    if (y < engineRows) {
      half = engineHalf + ((wingHalf - engineHalf) * (y + 1)) / (engineRows + 1);
      notchHere = notch;
    } else if (y < engineRows + wingRows) {
      const t = (y - engineRows) / Math.max(1, wingRows - 1);
      half = wingHalf - sweep * t * t;
    } else {
      const span = Math.max(1, h - 1 - (engineRows + wingRows));
      const t = (y - (engineRows + wingRows)) / span;
      const start = wingHalf - sweep;
      half = start + (noseHalf - start) * Math.pow(t, 0.75);
    }
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx);
      if (dx > half) continue;
      if (notchHere && dx + 0.2 < notchHere) continue;
      let color = body;
      if (dx < fuselage) color = root;
      else if (dx > half - 2.2) color = edge;
      g[y]![x] = color;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y]![x]! < 0) continue;
      const dx = Math.abs(x - cx);
      const below = g[y + 1]?.[x] ?? -1;
      const below2 = g[y + 2]?.[x] ?? -1;
      if (below >= 0 && below2 < 0 && dx > fuselage + 0.5) g[y]![x] = EV;
      if (y < engineRows && dx >= notch - 0.2 && dx <= notch + 1.5) g[y]![x] = K;
      else if (y < engineRows && dx > notch + 1.5 && dx < engineHalf) g[y]![x] = EB;
    }
  }

  const stripe = engineRows + Math.floor(wingRows * 0.4);
  const stripeRow = g[stripe];
  if (stripeRow) {
    for (let x = 0; x < w; x++) {
      if (stripeRow[x]! < 0) continue;
      if (Math.abs(x - cx) > fuselage + 1) stripeRow[x] = dark ? ED : EC;
    }
  }

  const cy0 = Math.floor(engineRows + wingRows * 0.45);
  const cy1 = Math.min(h - 5, cy0 + Math.max(4, Math.floor(fuselage * 2)));
  const left = Math.floor(cx);
  const right = Math.ceil(cx);
  for (let y = cy0; y <= cy1; y++) {
    const fat = y > cy0 + 1 && y < cy1 - 1;
    plot(g, left, y, fat ? S : DG);
    plot(g, right, y, fat ? S : DG);
    plot(g, left - 1, y, DG);
    plot(g, right + 1, y, MG);
  }
  plot(g, left, cy0 + 1, LG);
  plot(g, right, cy0 + 1, LG);

  rim(g, ER);
  for (let y = 0; y < engineRows - 1; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx);
      if (dx >= notch - 0.2 && dx <= notch + 1.3 && g[y]![x]! >= 0) g[y]![x] = K;
    }
  }
  return g;
}

function twinNozzles(g: SpriteData, rows: number): Array<{ x: number; y: number }> {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const cx = Math.floor(w / 2);
  const buckets: Array<Array<[number, number]>> = [[], []];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y]![x] !== K) continue;
      buckets[x < cx ? 0 : 1]!.push([x, y]);
    }
  }
  return buckets
    .filter((pts) => pts.length > 0)
    .map((pts) => {
      const x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
      const y = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
      return nozzleAt(w, h, Math.round(x), Math.round(y));
    });
}

function drawSmall(): EnemyArt {
  const pixels = drawFighter({
    w: 24,
    h: 24,
    engineRows: 4,
    wingRows: 8,
    wingHalf: 11,
    engineHalf: 6,
    notch: 2,
    sweep: 1.4,
    noseHalf: 0.45,
    fuselage: 2.3,
    dark: false,
  });
  return art(pixels, twinNozzles(pixels, 4));
}

/** Own 36×36 gunship — not a scaled small fighter. Dark hull, thick wing. */
function drawMedium(): EnemyArt {
  const pixels = drawFighter({
    w: 36,
    h: 36,
    engineRows: 5,
    wingRows: 14,
    wingHalf: 16.4,
    engineHalf: 9,
    notch: 2.2,
    sweep: 2.2,
    noseHalf: 1.2,
    fuselage: 4.2,
    dark: true,
  });
  return art(pixels, twinNozzles(pixels, 5));
}

function drawInterceptor(): EnemyArt {
  const pixels = drawFighter({
    w: 28,
    h: 28,
    engineRows: 3,
    wingRows: 11,
    wingHalf: 13.2,
    engineHalf: 5,
    notch: 1.6,
    sweep: 8.5,
    noseHalf: 0.4,
    fuselage: 2,
    dark: false,
  });
  return art(pixels, twinNozzles(pixels, 3));
}

function drawBomber(): EnemyArt {
  const w = 56;
  const h = 48;
  const g = createGrid(w, h);
  const cx = 27.5;
  for (let y = 10; y < 46; y++) {
    let half: number;
    if (y < 18) half = 8 + (y - 10) * 0.7;
    else if (y < 34) half = 14;
    else half = 14 - (y - 34) * 1.15;
    half = Math.max(2, half);
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx);
      if (dx > half) continue;
      g[y]![x] = dx < 5 ? ED : dx > half - 2 ? EC : EH;
    }
  }
  for (let y = 16; y <= 28; y++) {
    for (let x = 4; x <= 51; x++) {
      if (g[y]![x]! < 0) g[y]![x] = ED;
    }
  }
  const pods: Array<[number, number, number, number]> = [
    [3, 8, 8, 22],
    [13, 10, 7, 18],
    [36, 10, 7, 18],
    [45, 8, 8, 22],
  ];
  for (const [x, y, pw, ph] of pods) {
    for (let yy = y; yy < y + ph; yy++) {
      for (let xx = x; xx < x + pw; xx++) {
        const top = yy < y + 4;
        const lx = xx - x;
        g[yy]![xx] = top ? K : lx <= 1 ? EV : lx >= pw - 2 ? ED : EC;
      }
    }
    g[y]![x] = -1;
    g[y]![x + pw - 1] = -1;
  }
  for (let y = 19; y < 27; y++) {
    for (const x of [11, 12, 20, 21, 34, 35, 43, 44]) plot(g, x, y, EB);
  }
  for (let x = 22; x <= 33; x += 2) {
    plot(g, x, 32, DG);
    plot(g, x, 33, K);
    plot(g, x + 1, 32, LG);
  }
  plot(g, 27, 40, EV);
  plot(g, 28, 40, EV);
  rim(g, ER);
  const nozzles: Array<{ x: number; y: number }> = [];
  for (const [x, y, pw] of pods) {
    for (let xx = x + 2; xx < x + pw - 2; xx++) {
      plot(g, xx, y + 1, K);
      plot(g, xx, y + 2, K);
    }
    nozzles.push(nozzleAt(w, h, x + Math.floor(pw / 2), y + 1));
  }
  return art(g, nozzles);
}

/** X-quad. The battle scene spins the whole sprite, so the blades read as rotors. */
function drawDrone(): EnemyArt {
  const w = 20;
  const h = 20;
  const g = createGrid(w, h);
  const hubs: Array<[number, number]> = [
    [4, 4],
    [15, 4],
    [4, 15],
    [15, 15],
  ];
  for (const [ax, ay] of hubs) {
    for (let i = 0; i <= 7; i++) {
      const x = Math.round(ax + ((9.5 - ax) * i) / 7);
      const y = Math.round(ay + ((9.5 - ay) * i) / 7);
      plot(g, x, y, EH);
      plot(g, x + Math.sign(10 - ax), y, EC);
      plot(g, x, y + Math.sign(10 - ay), ED);
    }
    for (let yy = -2; yy <= 2; yy++) {
      for (let xx = -4; xx <= 4; xx++) {
        if ((xx * xx) / 18 + (yy * yy) / 5 <= 1) plot(g, ax + xx, ay + yy, K);
      }
    }
    plot(g, ax, ay, EV);
    plot(g, ax - 1, ay, MG);
    plot(g, ax + 1, ay, G);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - 9.5;
      const dy = y - 9.5;
      const d = dx * dx + dy * dy;
      if (d <= 18) g[y]![x] = d <= 6 ? EB : EH;
    }
  }
  plot(g, 9, 9, W);
  plot(g, 10, 9, EV);
  plot(g, 9, 10, DG);
  rim(g, ER);
  return art(g, []);
}

function drawTank(): EnemyArt {
  const g = createGrid(24, 24);
  for (let y = 2; y <= 21; y++) {
    for (let x = 1; x <= 22; x++) {
      const corner = (x < 3 && (y < 4 || y > 19)) || (x > 20 && (y < 4 || y > 19));
      if (corner) continue;
      if (x <= 5 || x >= 18) g[y]![x] = y % 2 === 0 ? K : OD;
      else g[y]![x] = y < 6 ? OI : y > 17 ? OD : OM;
    }
  }
  for (let y = 3; y <= 20; y += 2) {
    for (const x of [2, 3, 4, 19, 20, 21]) plot(g, x, y, K);
  }
  for (let y = 7; y <= 16; y++) {
    for (let x = 7; x <= 16; x++) {
      const dx = x - 11.5;
      const dy = y - 11.2;
      if (dx * dx + dy * dy <= 18) g[y]![x] = dx * dx + dy * dy <= 6 ? OI : OL;
    }
  }
  plot(g, 11, 11, DB);
  plot(g, 12, 11, TN);
  plot(g, 11, 10, PG);
  plot(g, 8, 6, W);
  plot(g, 15, 6, LG);
  rim(g, ER);
  return art(g, []);
}

function drawTurret(): EnemyArt {
  const g = createGrid(32, 32);
  for (let y = 4; y <= 27; y++) {
    for (let x = 3; x <= 28; x++) {
      const chamfer = x + y < 9 || x + (31 - y) < 8 || 31 - x + y < 8 || 31 - x + (31 - y) < 8;
      if (chamfer) continue;
      g[y]![x] = y < 8 ? OI : y > 23 ? OD : OL;
    }
  }
  for (let i = 0; i < 4; i++) {
    const y = 9 + i * 3;
    for (let x = 6; x <= 12; x++) plot(g, x, y, DG);
    for (let x = 19; x <= 25; x++) plot(g, x, y, S);
  }
  for (let y = 11; y <= 21; y++) {
    for (let x = 10; x <= 21; x++) {
      const dx = (x - 15.5) / 6.2;
      const dy = (y - 16) / 5.2;
      if (dx * dx + dy * dy <= 1) g[y]![x] = dx * dx + dy * dy < 0.28 ? OI : OM;
    }
  }
  for (const x of [12, 13, 18, 19]) {
    plot(g, x, 14, K);
    plot(g, x, 15, DG);
    plot(g, x, 16, K);
  }
  plot(g, 7, 7, PG);
  plot(g, 24, 7, G);
  rim(g, ER);
  return art(g, []);
}

function drawMissileCar(): EnemyArt {
  const g = createGrid(24, 32);
  for (let y = 2; y <= 28; y++) {
    for (let x = 5; x <= 18; x++) {
      g[y]![x] = y < 16 ? OM : y < 22 ? OL : OD;
    }
  }
  for (let x = 6; x <= 17; x++) plot(g, x, 3, OI);
  for (const [x, y] of [
    [8, 5],
    [13, 5],
    [8, 9],
    [13, 9],
    [8, 13],
    [13, 13],
  ] as const) {
    plot(g, x, y, K);
    plot(g, x + 1, y, K);
    plot(g, x, y + 1, DG);
    plot(g, x + 1, y + 1, MG);
  }
  for (let x = 8; x <= 15; x++) {
    plot(g, x, 20, S);
    plot(g, x, 21, DG);
  }
  plot(g, 9, 20, LG);
  plot(g, 14, 20, PG);
  for (const y of [7, 15, 25]) {
    for (const x of [2, 3, 20, 21]) {
      plot(g, x, y, K);
      plot(g, x, y - 1, AS);
      plot(g, x, y + 1, DG);
    }
    plot(g, 3, y, G);
    plot(g, 20, y, G);
  }
  plot(g, 8, 27, TN);
  plot(g, 15, 27, TN);
  rim(g, ER);
  return art(g, []);
}

/**
 * Flat saucer (P22, look B6). Magenta canopy, yellow/black equator, cyan lamps,
 * gray metal belly. The cyan shield ring is drawn in the battle renderer
 * while `shield` is up, not baked here.
 */
function drawRiskCrate(): EnemyArt {
  const w = 32;
  const h = 16;
  const g = createGrid(w, h);
  // fillEllipse samples pixel centers, so the disc center is w/2 (not (w-1)/2).
  const cx = w / 2;
  const bandCx = (w - 1) / 2;

  fillEllipse(g, cx, 9.2, 14.2, 5.2, COLOR.DARK_GRAY);
  fillEllipse(g, cx, 9.6, 12.2, 4, COLOR.MEDIUM_GRAY);
  fillEllipse(g, cx, 10.4, 9, 2.6, COLOR.GRAY);
  fillEllipse(g, cx, 11.2, 5.5, 1.4, COLOR.LIGHT_GRAY);

  fillEllipse(g, cx, 4.4, 8.4, 4, COLOR.BULLET_DARK);
  fillEllipse(g, cx, 4, 6.2, 2.8, COLOR.BULLET_MAGENTA);
  fillEllipse(g, cx, 3.2, 3.2, 1.6, COLOR.BULLET_PINK);

  for (let y = 7; y <= 8; y++) {
    const row = g[y];
    if (!row) continue;
    for (let x = 0; x < w; x++) {
      if (row[x]! < 0) continue;
      const band = Math.floor(Math.abs(x - bandCx) / 2) % 2 === 0;
      row[x] = band ? COLOR.EXPLOSION_YELLOW : COLOR.BLACK;
    }
  }

  for (const x of [6, 10, 21, 25]) {
    if ((g[7]?.[x] ?? -1) >= 0) plot(g, x, 7, COLOR.PLAYER_CYAN);
    if ((g[8]?.[x] ?? -1) >= 0) plot(g, x, 8, COLOR.PLAYER_MED_CYAN);
  }

  return art(g, []);
}

const BUILDERS: Record<EnemyType, () => EnemyArt> = {
  small: drawSmall,
  medium: drawMedium,
  interceptor: drawInterceptor,
  bomber: drawBomber,
  drone: drawDrone,
  tank: drawTank,
  turret2: drawTurret,
  missile_car: drawMissileCar,
  risk_crate: drawRiskCrate,
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
