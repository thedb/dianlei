/**
 * 海面B / 黑曜舰空 tiles (ids 87–101).
 * Open water is `ocean` / `oceanB` (low-contrast mounds, not scanlines).
 * `water` / `waterB` stay the river tiles. These cells are also the
 * flight deck, the escort hulls, the cold wreckage, and the enemy carrier.
 * No palette 0 or 1 as a fill. Player cyan 10–13 is not a body colour:
 * wreckage uses grays 3–5, pale gray 6, white 7, and pale cyan 9 as a speck.
 * Integer cells only.
 */

import { TILE_SIZE } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillEllipse, fillRect, plot } from './pixelDraw';
import type { SpriteData } from './types';

const N = TILE_SIZE;
const G3 = COLOR.MEDIUM_GRAY;
const G4 = COLOR.GRAY;
const G5 = COLOR.LIGHT_GRAY;
const G6 = COLOR.PALE_GRAY;
const W = COLOR.WHITE;
const CY = COLOR.PLAYER_PALE_CYAN;
const PW = COLOR.PLAYER_WHITE;
const DG = COLOR.DARK_GRAY;
const CC = COLOR.TERRAIN_CONCRETE;
const ER = COLOR.ENEMY_RED;
const WO = COLOR.WATER_OCEAN;
const WM = COLOR.WATER_MEDIUM;
const WS = COLOR.WATER_SHALLOW;
const WF = COLOR.WATER_FOAM;
const WD = COLOR.WATER_DEEP;

export interface SeaTileArt {
  pixels: SpriteData;
  tall: boolean[][] | null;
}

function solidTall(pixels: SpriteData): SeaTileArt {
  return {
    pixels,
    tall: Array.from({ length: pixels.length }, () =>
      Array.from({ length: pixels[0]!.length }, () => true)
    ),
  };
}

/**
 * Open sea. Wide mounds of deep / medium blue on ocean blue, two salts so
 * neighbours do not line up into a screen-wide stripe. No foam row: the
 * moving specks are drawn later, in `seaSwell.ts`.
 */
export function oceanTile(salt: number): SpriteData {
  const g = createGrid(N, N, WO);
  const blobs =
    salt === 0
      ? [
          { x: 0, y: 1, w: 6, h: 4, c: WD },
          { x: 9, y: 5, w: 7, h: 5, c: WM },
          { x: 2, y: 11, w: 5, h: 4, c: WD },
          { x: 12, y: 0, w: 3, h: 2, c: WM },
        ]
      : [
          { x: 10, y: 0, w: 6, h: 4, c: WD },
          { x: 0, y: 4, w: 8, h: 5, c: WM },
          { x: 8, y: 11, w: 6, h: 4, c: WM },
          { x: 1, y: 13, w: 4, h: 3, c: WD },
        ];
  for (const blob of blobs) fillRect(g, blob.x, blob.y, blob.w, blob.h, blob.c);
  if (salt === 0) {
    plot(g, 14, 9, WS);
    plot(g, 4, 8, WS);
  } else {
    plot(g, 6, 2, WS);
    plot(g, 13, 7, WS);
  }
  return g;
}

/** Our flight deck: concrete with a pale seam. Brighter than the day sea. */
export function carrierDeckTile(): SpriteData {
  const g = createGrid(N, N, CC);
  for (let i = 0; i < N; i++) {
    g[0]![i] = G6;
    g[i]![0] = G6;
  }
  plot(g, 5, 6, G5);
  plot(g, 11, 9, G5);
  plot(g, 8, 13, G6);
  return g;
}

/** One dashed catapult stripe on the concrete. Two columns of this tile read as parallel lines. */
export function carrierMarkTile(): SpriteData {
  const g = carrierDeckTile();
  for (const y of [2, 3, 4, 10, 11, 12]) {
    plot(g, 7, y, W);
    plot(g, 8, y, W);
  }
  return g;
}

/** Island superstructure. The whole cell stands up and casts the usual shadow. */
export function carrierIslandTile(): SeaTileArt {
  const g = createGrid(N, N, G3);
  for (let y = 0; y < N; y++) {
    g[y]![0] = G5;
    g[y]![1] = G4;
    g[y]![N - 1] = DG;
  }
  for (let x = 0; x < N; x++) g[0]![x] = G5;
  for (const y of [3, 7, 11]) {
    fillRect(g, 4, y, 3, 2, G6);
    fillRect(g, 9, y, 3, 2, G5);
  }
  plot(g, 5, 4, W);
  plot(g, 10, 8, W);
  return solidTall(g);
}

/** Wake: foam over water that is still visible. Feature, never an edge-row contract. */
export function wakeTile(): SpriteData {
  const g = createGrid(N, N, WO);
  for (let y = 0; y < N; y++) {
    const band = y % 4;
    const col = band === 0 ? WM : band === 1 ? WF : WO;
    for (let x = 0; x < N; x++) g[y]![x] = col;
  }
  for (let x = 0; x < N; x += 2) plot(g, x, 3, WF);
  for (let x = 1; x < N; x += 3) plot(g, x, 8, W);
  for (let x = 0; x < N; x += 2) plot(g, x, 12, WF);
  plot(g, 4, 6, WD);
  plot(g, 11, 14, WM);
  return g;
}

/** Escort hull plate. A light gunwale on the top edge, no barrel. */
export function cruiserHullTile(): SeaTileArt {
  const g = createGrid(N, N, G4);
  for (let x = 0; x < N; x++) g[0]![x] = G5;
  for (let y = 2; y < N; y += 5) {
    for (let x = 2; x < N - 2; x++) plot(g, x, y, G3);
  }
  plot(g, 4, 8, G6);
  plot(g, 12, 11, G5);
  return solidTall(g);
}

/**
 * Gun pad. Reads as a metal mount and is classified as water so a 2×2
 * building can stand on it. No barrel — that sprite is a later building.
 */
export function cruiserGunDeckTile(): SpriteData {
  const g = createGrid(N, N, G4);
  for (let x = 0; x < N; x++) g[0]![x] = G5;
  fillEllipse(g, 8, 8, 5, 5, G5);
  fillEllipse(g, 8, 8, 3, 3, G3);
  fillEllipse(g, 8, 8, 1, 1, G6);
  return g;
}

/** Cold fragment. Grays, a white nick, and one pale-cyan speck. Not player cyan. */
export function wreckAlloyTile(): SeaTileArt {
  const g = createGrid(N, N, G4);
  fillRect(g, 2, 3, 8, 5, G5);
  fillRect(g, 7, 8, 6, 4, G3);
  fillRect(g, 3, 10, 4, 3, G6);
  plot(g, 4, 4, W);
  plot(g, 10, 9, W);
  plot(g, 12, 5, CY);
  plot(g, 6, 12, G6);
  const tall = Array.from({ length: N }, () => Array.from({ length: N }, () => false));
  for (let y = 3; y < 8; y++) for (let x = 2; x < 10; x++) tall[y]![x] = true;
  return { pixels: g, tall };
}

/** Cold scorch. Gray plate, dark-gray scratches. Not the land `scorch` brown. */
export function wreckBurnTile(): SpriteData {
  const g = createGrid(N, N, G4);
  for (let i = 1; i < N - 1; i++) {
    plot(g, i, 4 + (i % 3), DG);
    plot(g, 3 + (i % 4), i, DG);
  }
  plot(g, 8, 8, G5);
  plot(g, 2, 13, G3);
  plot(g, 13, 2, G6);
  return g;
}

/**
 * 32×32 friendly fighter, nose toward y = 0 (the higher map row).
 * White 8 body, pale cyan 9 canopy. No exhaust. Deck shows around it.
 */
function carrierPlaneSheet(): SeaTileArt {
  const S = N * 2;
  const pixels = createGrid(S, S, CC);
  const tall = Array.from({ length: S }, () => Array.from({ length: S }, () => false));
  const paint = (x: number, y: number, w: number, h: number, color: number) => {
    fillRect(pixels, x, y, w, h, color);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (yy >= 0 && yy < S && xx >= 0 && xx < S) tall[yy]![xx] = true;
      }
    }
  };
  for (let i = 0; i < S; i++) {
    pixels[0]![i] = G6;
    pixels[i]![0] = G6;
  }
  paint(2, 12, 28, 6, PW);
  paint(4, 13, 24, 4, G5);
  paint(13, 4, 6, 24, PW);
  paint(14, 6, 4, 16, G6);
  paint(14, 1, 4, 4, PW);
  plot(pixels, 15, 0, PW);
  plot(pixels, 16, 0, PW);
  tall[0]![15] = true;
  tall[0]![16] = true;
  paint(14, 8, 4, 4, CY);
  paint(10, 26, 12, 3, PW);
  return { pixels, tall };
}

/** Screen quadrants: top-left, top-right, bottom-left, bottom-right. Nose is the top pair. */
export function carrierPlaneQuads(): readonly SeaTileArt[] {
  const art = carrierPlaneSheet();
  return [0, 1, 2, 3].map((q) => {
    const ox = (q % 2) * N;
    const oy = Math.floor(q / 2) * N;
    return {
      pixels: art.pixels.slice(oy, oy + N).map((row) => row.slice(ox, ox + N)),
      tall: art.tall!.slice(oy, oy + N).map((row) => row.slice(ox, ox + N)),
    };
  });
}

/** Enemy flight deck. Steel gray, lighter seams. Not our concrete deck. */
export function enemyDeckTile(): SpriteData {
  const g = createGrid(N, N, G4);
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      g[N - 1]![i] = G5;
      g[i]![N - 1] = G5;
    }
  }
  plot(g, 3, 5, G3);
  plot(g, 10, 8, G5);
  plot(g, 6, 12, G3);
  return g;
}

/** Enemy deck line: a red chevron plus a white index block. Not explosion yellow. */
export function enemyMarkTile(): SpriteData {
  const g = enemyDeckTile();
  for (let i = 0; i < N; i++) {
    const y = N - 1 - i;
    plot(g, i, y, ER);
    if (i + 1 < N) plot(g, i + 1, y, ER);
  }
  fillRect(g, 2, 2, 4, 3, W);
  plot(g, 3, 3, G4);
  plot(g, 4, 3, G4);
  return g;
}

/** Empty parking T. White and pale gray on the steel deck. No aircraft. */
export function deckSpotTile(): SpriteData {
  const g = enemyDeckTile();
  for (let x = 3; x <= 12; x++) {
    plot(g, x, 4, W);
    plot(g, x, 5, G6);
  }
  for (let y = 4; y <= 13; y++) {
    plot(g, 7, y, W);
    plot(g, 8, y, G6);
  }
  return g;
}
