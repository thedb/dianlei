/**
 * Mandy (black flying wing, 32×36) and Jason (purple-gold dart, 22×26).
 * Bank frames use Eagle's formula: right banks are drawn, left banks are
 * mirrors. Eagle itself stays in playerSprite.ts and is not redrawn here.
 */

import { COLOR } from '@/game/palette';
import type { SpriteData, NozzleOffset, PlayerSpriteSheet } from './types';
import { renderSprite } from './spriteRenderer';

const T = -1;
const BANK_STEPS = 5;

interface Bank {
  b: number;
  bodyScale: number;
  topShift: number;
  underShift: number;
  farSpan: number;
  nearSweep: number;
}

/** Same coefficients as Eagle's bankParams. */
function bankOf(step: number): Bank {
  const b = step / BANK_STEPS;
  return {
    b,
    bodyScale: 1 - 0.12 * b,
    topShift: 1.6 * b,
    underShift: -1.0 * b,
    farSpan: 1 - 0.75 * Math.pow(b, 1.1),
    nearSweep: 1.4 * b,
  };
}

function mirror(data: SpriteData): SpriteData {
  return data.map((row) => [...row].reverse());
}

type Sample = (px: number, y: number, bank: Bank) => number;

function raster(
  sample: Sample,
  width: number,
  height: number,
  step: number,
  outline: number
): SpriteData {
  const bank = bankOf(step);
  const cx = width / 2;
  const raw: number[][] = [];
  for (let row = 0; row < height; row++) {
    const line: number[] = [];
    for (let col = 0; col < width; col++) {
      line.push(sample(col + 0.5 - cx, row + 0.5, bank));
    }
    raw.push(line);
  }
  const out: SpriteData = [];
  for (let row = 0; row < height; row++) {
    const line: number[] = [];
    for (let col = 0; col < width; col++) {
      const cell = raw[row]![col]!;
      if (cell >= 0) {
        line.push(cell);
        continue;
      }
      const touch =
        (raw[row - 1]?.[col] ?? T) >= 0 ||
        (raw[row + 1]?.[col] ?? T) >= 0 ||
        (raw[row]?.[col - 1] ?? T) >= 0 ||
        (raw[row]?.[col + 1] ?? T) >= 0;
      line.push(touch ? outline : T);
    }
    out.push(line);
  }
  return out;
}

function framesFrom(
  sample: Sample,
  width: number,
  height: number,
  outline: number,
  nozzlesFor: (step: number) => NozzleOffset[]
): { data: SpriteData[]; nozzles: NozzleOffset[][] } {
  const right: SpriteData[] = [];
  for (let step = 0; step <= BANK_STEPS; step++) {
    right.push(raster(sample, width, height, step, outline));
  }
  const data: SpriteData[] = [];
  const nozzles: NozzleOffset[][] = [];
  for (let step = BANK_STEPS; step >= 1; step--) {
    data.push(mirror(right[step]!));
    nozzles.push(nozzlesFor(step).map((n) => ({ x: -n.x, y: n.y })));
  }
  for (let step = 0; step <= BANK_STEPS; step++) {
    data.push(right[step]!);
    nozzles.push(nozzlesFor(step));
  }
  return { data, nozzles };
}

function sheetFrom(
  data: SpriteData[],
  nozzles: NozzleOffset[][],
  width: number,
  height: number
): PlayerSpriteSheet {
  const bankFrames = data.map((frame, i) => ({
    ...renderSprite(frame, 0.5, 0.5),
    nozzles: nozzles[i]!,
  }));
  return { bankFrames, frameCount: bankFrames.length, width, height };
}

// ---------------------------------------------------------------------------
// Mandy — blunt flying wing. Wing and body are one shape. Not a wide Eagle.
// ---------------------------------------------------------------------------

export const MANDY_SPRITE_W = 32;
export const MANDY_SPRITE_H = 36;
const MANDY_NOZZLE_ROW = 33;

function mandyHalf(y: number): number {
  if (y < 2 || y > 33.5) return -1;
  if (y < 6) return 2.4 + (y - 2) * 1.2;
  if (y < 16) return 7.2 + (y - 6) * 0.78;
  if (y < 22) return 15;
  if (y < 30) return 15 - (y - 22) * 0.55;
  return 10.6 - (y - 30) * 0.7;
}

function mandySample(px: number, y: number, bank: Bank): number {
  const shifted = px - bank.topShift;
  const side = shifted < 0 ? -1 : 1;
  const span = side > 0 ? bank.farSpan : 1;
  const ax = Math.abs(shifted) / (bank.bodyScale * span);
  const yShift = side < 0 ? bank.nearSweep * Math.min(1, ax / 12) : 0;
  const gy = y - yShift;
  const hw = mandyHalf(gy);
  if (hw < 0 || ax > hw) return T;

  const el = -5 * bank.bodyScale + bank.underShift;
  const er = 5 * bank.bodyScale + bank.underShift;
  if (y >= 27 && y < MANDY_NOZZLE_ROW) {
    const left = Math.abs(px - el) < 2.2;
    const right = Math.abs(px - er) < 2.2 * (1 - 0.28 * bank.b);
    if (left || right) {
      const ex = left ? el : er;
      if (y >= 31.4) return px < ex ? COLOR.MEDIUM_GRAY : COLOR.DARK_GRAY;
      return px < ex ? COLOR.GRAY : COLOR.MEDIUM_GRAY;
    }
  }

  const cu = shifted / 1.65;
  const cv = (gy - 6.1) / 2.05;
  if (cu * cu + cv * cv < 1) {
    return cv > 0.3 ? COLOR.PLAYER_DARK_CYAN : COLOR.PLAYER_MED_CYAN;
  }

  if (ax < 3.6 && gy >= 11 && gy < 27) {
    if (Math.abs(shifted) < 0.55) return COLOR.MEDIUM_GRAY;
    return COLOR.DARK_GRAY;
  }

  if (hw - ax < 1.2) return COLOR.SHADOW;
  if (Math.floor(gy) === 20 && ax > 4.5 && ax < hw - 1.6) return COLOR.SHADOW;
  return COLOR.BLACK;
}

function mandyNozzles(step: number): NozzleOffset[] {
  const bank = bankOf(step);
  const y = MANDY_NOZZLE_ROW - MANDY_SPRITE_H / 2;
  return [
    { x: -5 * bank.bodyScale + bank.underShift, y },
    { x: 5 * bank.bodyScale + bank.underShift, y },
  ];
}

export function createMandyFrameData(): SpriteData[] {
  return framesFrom(mandySample, MANDY_SPRITE_W, MANDY_SPRITE_H, COLOR.DARK_GRAY, mandyNozzles)
    .data;
}

export function createMandyNozzles(): NozzleOffset[][] {
  return framesFrom(mandySample, MANDY_SPRITE_W, MANDY_SPRITE_H, COLOR.DARK_GRAY, mandyNozzles)
    .nozzles;
}

export function createMandySpriteSheet(): PlayerSpriteSheet {
  const built = framesFrom(
    mandySample,
    MANDY_SPRITE_W,
    MANDY_SPRITE_H,
    COLOR.DARK_GRAY,
    mandyNozzles
  );
  return sheetFrom(built.data, built.nozzles, MANDY_SPRITE_W, MANDY_SPRITE_H);
}

// ---------------------------------------------------------------------------
// Jason — narrow purple dart, gold edge and spine, one centerline nozzle.
// ---------------------------------------------------------------------------

export const JASON_SPRITE_W = 22;
export const JASON_SPRITE_H = 26;
const JASON_NOZZLE_ROW = 24;

function jasonHalf(y: number): number {
  if (y < 1.4 || y > 24.3) return -1;
  if (y < 6) return 0.95 + (y - 1.4) * 0.38;
  if (y < 16) return 2.7;
  return Math.max(1.35, 2.7 - (y - 16) * 0.16);
}

function jasonWing(ax: number, gy: number): boolean {
  if (ax < 2.15 || ax > 7.55) return false;
  const t = (ax - 2.15) / (7.55 - 2.15);
  const lead = 8 + t * 5.4;
  const trail = 17.8 - t * 1.6;
  return gy >= lead && gy <= trail;
}

function jasonSample(px: number, y: number, bank: Bank): number {
  const shifted = px - bank.topShift;
  const side = shifted < 0 ? -1 : 1;
  const span = side > 0 ? bank.farSpan : 1;
  const ax = Math.abs(shifted) / (bank.bodyScale * span);
  const yShift = side < 0 ? bank.nearSweep * Math.min(1, ax / 8) : 0;
  const gy = y - yShift;
  const hw = jasonHalf(gy);
  const inBody = hw > 0 && ax <= hw;
  const inWing = jasonWing(ax, gy);
  if (!inBody && !inWing) return T;

  const ex = bank.underShift;
  if (y >= 18 && y < JASON_NOZZLE_ROW && Math.abs(px - ex) < 1.6 && ax < 3.1) {
    if (y >= 22.5) return COLOR.PLAYER_GOLD;
    return Math.abs(px - ex) < 0.65 ? COLOR.PLAYER_PURPLE : COLOR.PLAYER_PURPLE_MID;
  }

  const cu = shifted / 1.1;
  const cv = (gy - 5.3) / 1.7;
  if (inBody && cu * cu + cv * cv < 1) {
    return cu * cu + cv * cv > 0.52 ? COLOR.PLAYER_GOLD : COLOR.BLACK;
  }

  if (inBody && gy >= 6.5 && gy < 17.5 && Math.abs(shifted) < 0.58) {
    return shifted < 0 ? COLOR.PLAYER_GOLD_LIGHT : COLOR.PLAYER_GOLD;
  }

  if (inWing && !inBody) {
    const t = (ax - 2.15) / (7.55 - 2.15);
    const lead = 8 + t * 5.4;
    if (gy < lead + 1.15 || ax > 6.5) return COLOR.PLAYER_GOLD_LIGHT;
    return COLOR.PLAYER_PURPLE;
  }

  if (hw > 0 && hw - ax < 0.8) return COLOR.PLAYER_GOLD;
  if (gy < 4.2) return COLOR.PLAYER_GOLD_LIGHT;
  if (shifted < -0.35) return COLOR.PLAYER_PURPLE_MID;
  return COLOR.PLAYER_PURPLE;
}

function jasonNozzles(step: number): NozzleOffset[] {
  const bank = bankOf(step);
  return [{ x: bank.underShift, y: JASON_NOZZLE_ROW - JASON_SPRITE_H / 2 }];
}

export function createJasonFrameData(): SpriteData[] {
  return framesFrom(jasonSample, JASON_SPRITE_W, JASON_SPRITE_H, COLOR.PLAYER_GOLD, jasonNozzles)
    .data;
}

export function createJasonNozzles(): NozzleOffset[][] {
  return framesFrom(jasonSample, JASON_SPRITE_W, JASON_SPRITE_H, COLOR.PLAYER_GOLD, jasonNozzles)
    .nozzles;
}

export function createJasonSpriteSheet(): PlayerSpriteSheet {
  const built = framesFrom(
    jasonSample,
    JASON_SPRITE_W,
    JASON_SPRITE_H,
    COLOR.PLAYER_GOLD,
    jasonNozzles
  );
  return sheetFrom(built.data, built.nozzles, JASON_SPRITE_W, JASON_SPRITE_H);
}
