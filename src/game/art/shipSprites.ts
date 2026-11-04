/**
 * Mandy and Jason bank sheets. G4, 2026-11-04.
 * The pixels are the G2 lock in `locked/`. Nothing here redraws them.
 * Eagle stays on `playerSprite.ts`. The uploaded eagle-bank files are a
 * reference only and are not baked in here.
 *
 * The lock has right-bank t0, t2, t3, and t5. t1 repeats t0 and t4 repeats
 * t3, so the 11-frame index still lines up with Eagle. Left banks are mirrors.
 * Level flight is t0, which matches the color JSON byte for byte.
 */

import type { SpriteData } from './types';
import type { NozzleOffset, PlayerSpriteSheet } from './types';
import { renderSprite } from './spriteRenderer';
import mandy0 from './locked/mandy-bank-t0.json';
import mandy2 from './locked/mandy-bank-t2.json';
import mandy3 from './locked/mandy-bank-t3.json';
import mandy5 from './locked/mandy-bank-t5.json';
import jason0 from './locked/jason-bank-t0.json';
import jason2 from './locked/jason-bank-t2.json';
import jason3 from './locked/jason-bank-t3.json';
import jason5 from './locked/jason-bank-t5.json';

export type LockedShipId = 'mandy' | 'jason';

interface LockedFile {
  pixels: number[][];
}

const MANDY: readonly LockedFile[] = [mandy0, mandy2, mandy3, mandy5];
const JASON: readonly LockedFile[] = [jason0, jason2, jason3, jason5];

/** Bright cyan cores of Mandy's two tail nozzles. */
const NOZZLE_CORE = 10;
/** Jason's exhaust: white core, otherwise the cyan rim. */
const EXHAUST = new Set([7, 10, 11, 12]);

function copyFrame(file: LockedFile): SpriteData {
  return file.pixels.map((row) => row.slice());
}

/** Right-bank steps 0..5. Steps 1 and 4 repeat the locked neighbour. */
function rightSteps(files: readonly LockedFile[]): SpriteData[] {
  const t0 = copyFrame(files[0]!);
  const t2 = copyFrame(files[1]!);
  const t3 = copyFrame(files[2]!);
  const t5 = copyFrame(files[3]!);
  return [t0, t0.map((row) => row.slice()), t2, t3, t3.map((row) => row.slice()), t5];
}

function mirror(data: SpriteData): SpriteData {
  return data.map((row) => [...row].reverse());
}

function mirrorNozzles(nozzles: readonly NozzleOffset[]): NozzleOffset[] {
  return nozzles.map((n) => ({ x: -n.x, y: n.y }));
}

function lowestRow(frame: SpriteData, match: (value: number) => boolean): number {
  for (let y = frame.length - 1; y >= 0; y--) {
    const row = frame[y];
    if (row?.some(match)) return y;
  }
  return -1;
}

function runCenters(xs: number[]): number[] {
  const clusters: number[][] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last && x === last[last.length - 1]! + 1) last.push(x);
    else clusters.push([x]);
  }
  return clusters.map((c) => (c[0]! + c[c.length - 1]! + 1) / 2);
}

/**
 * Nozzles relative to the sprite anchor (`floor(size / 2)`), on the bottom
 * edge of the exhaust pixels so `drawPlayerFlames` sits on the tail.
 * Mandy: one nozzle per bright-cyan cluster. Jason: one nozzle, the bounding
 * box of the lowest exhaust row, even when a bank opens a gap in that row.
 */
export function nozzlesForLockedFrame(frame: SpriteData, id: LockedShipId): NozzleOffset[] {
  const width = frame[0]?.length ?? 0;
  const anchorX = Math.floor(width / 2);
  const anchorY = Math.floor(frame.length / 2);
  if (id === 'mandy') {
    const y = lowestRow(frame, (v) => v === NOZZLE_CORE);
    const row = y >= 0 ? frame[y] : undefined;
    const xs = row ? row.flatMap((v, x) => (v === NOZZLE_CORE ? [x] : [])) : [];
    return runCenters(xs).map((center) => ({ x: center - anchorX, y: y + 1 - anchorY }));
  }
  const white = lowestRow(frame, (v) => v === 7);
  const y = white >= 0 ? white : lowestRow(frame, (v) => EXHAUST.has(v));
  const row = y >= 0 ? frame[y] : undefined;
  const wantWhite = white >= 0;
  const xs = row
    ? row.flatMap((v, x) => (wantWhite ? (v === 7 ? [x] : []) : EXHAUST.has(v) ? [x] : []))
    : [];
  if (xs.length === 0) return [];
  const center = (xs[0]! + xs[xs.length - 1]! + 1) / 2;
  return [{ x: center - anchorX, y: y + 1 - anchorY }];
}

export interface LockedShipArt {
  frames: SpriteData[];
  nozzles: NozzleOffset[][];
}

/** 11 frames, left-deep → right-deep, same index as Eagle. */
export function lockedShipArt(id: LockedShipId): LockedShipArt {
  const steps = rightSteps(id === 'mandy' ? MANDY : JASON);
  const frames: SpriteData[] = [];
  const nozzles: NozzleOffset[][] = [];
  for (let s = 5; s >= 1; s--) {
    frames.push(mirror(steps[s]!));
    nozzles.push(mirrorNozzles(nozzlesForLockedFrame(steps[s]!, id)));
  }
  for (let s = 0; s <= 5; s++) {
    frames.push(steps[s]!);
    nozzles.push(nozzlesForLockedFrame(steps[s]!, id));
  }
  return { frames, nozzles };
}

function bake(art: LockedShipArt): PlayerSpriteSheet {
  const bankFrames = art.frames.map((frame, i) => ({
    ...renderSprite(frame, 0.5, 0.5),
    nozzles: art.nozzles[i]!,
  }));
  return {
    bankFrames,
    frameCount: bankFrames.length,
    width: bankFrames[0]?.width ?? 0,
    height: bankFrames[0]?.height ?? 0,
  };
}

export function createLockedShipSheets(): { mandy: PlayerSpriteSheet; jason: PlayerSpriteSheet } {
  return {
    mandy: bake(lockedShipArt('mandy')),
    jason: bake(lockedShipArt('jason')),
  };
}
