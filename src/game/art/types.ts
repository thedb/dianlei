/**
 * Types for code-generated pixel art sprites
 * Design doc §10.1: sprites defined as palette index arrays
 */

/** Sprite frame data - 2D array of palette indices (-1 = transparent) */
export type SpriteData = number[][];

/** Pre-rendered sprite frame as offscreen canvas */
export interface SpriteFrame {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

/** Sprite sheet with multiple frames */
export interface SpriteSheet {
  frames: SpriteFrame[];
  frameCount: number;
}

/** Engine exhaust nozzle position relative to sprite anchor */
export interface NozzleOffset {
  x: number;
  y: number;
}

/** Bank frame info including nozzle positions */
export interface BankFrame extends SpriteFrame {
  nozzles: NozzleOffset[];
}

/** Player sprite sheet with bank frames */
export interface PlayerSpriteSheet {
  bankFrames: BankFrame[];
  frameCount: number;
  width: number;
  height: number;
}
