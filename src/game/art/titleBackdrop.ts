/**
 * Approach A — three code-drawn title stills (A1 晨袭 / A2 海峡 / A3 机库).
 * Each one blits a real stage scroll position, then stamps in-game sprites.
 * No external image files.
 */

import { BG_SCROLL_SPEED, LOGICAL_H, LOGICAL_W } from '@/game/config';
import { stage1 } from '@/game/levels/stage1';
import { PALETTE, COLOR } from '@/game/palette';
import { backgroundFade, type ScrollFrame } from '@/game/systems/background';
import type { EnemyType } from '@/game/levels/types';
import type { TitleBackground } from '@/game/settings';
import { drawEnemyFlame, drawPlayerFlames } from './engineFlame';
import type { GameAssets } from './index';
import type { SpriteFrame } from './types';
import { drawBackground } from './tiles';
import { sharedGameAssets } from './sharedAssets';

export interface StaticTitleSpec {
  id: Exclude<TitleBackground, 'attract'>;
  /** Comparison label used in the milestone notes. */
  variant: 'A1' | 'A2' | 'A3';
  /** Stage time whose scroll and section fade are painted. */
  time: number;
}

export const STATIC_TITLE_SPECS: readonly StaticTitleSpec[] = [
  { id: 'dawn', variant: 'A1', time: 18 },
  { id: 'strait', variant: 'A2', time: 72 },
  { id: 'base', variant: 'A3', time: 120 },
];

type Stamp =
  | { kind: 'player'; x: number; y: number; bank: number }
  | { kind: 'boss'; x: number; y: number }
  | { kind: EnemyType; x: number; y: number };

const STAMPS: Record<StaticTitleSpec['id'], readonly Stamp[]> = {
  dawn: [
    { kind: 'small', x: 78, y: 168 },
    { kind: 'small', x: 132, y: 132 },
    { kind: 'small', x: 186, y: 108 },
    { kind: 'small', x: 240, y: 132 },
    { kind: 'small', x: 294, y: 168 },
    { kind: 'medium', x: 186, y: 210 },
    { kind: 'tank', x: 96, y: 430 },
    { kind: 'tank', x: 250, y: 468 },
    { kind: 'player', x: 180, y: 548, bank: 7 },
  ],
  strait: [
    { kind: 'interceptor', x: 54, y: 176 },
    { kind: 'interceptor', x: 308, y: 196 },
    { kind: 'drone', x: 128, y: 150 },
    { kind: 'drone', x: 230, y: 168 },
    { kind: 'medium', x: 180, y: 112 },
    { kind: 'missile_car', x: 72, y: 456 },
    { kind: 'missile_car', x: 286, y: 490 },
    { kind: 'player', x: 196, y: 548, bank: 3 },
  ],
  base: [
    { kind: 'boss', x: 180, y: 78 },
    { kind: 'bomber', x: 86, y: 250 },
    { kind: 'bomber', x: 268, y: 286 },
    { kind: 'turret2', x: 48, y: 448 },
    { kind: 'turret2', x: 312, y: 470 },
    { kind: 'small', x: 150, y: 200 },
    { kind: 'small', x: 214, y: 214 },
    { kind: 'player', x: 180, y: 552, bank: 5 },
  ],
};

const cache = new Map<StaticTitleSpec['id'], HTMLCanvasElement>();

function specFor(id: StaticTitleSpec['id']): StaticTitleSpec {
  return STATIC_TITLE_SPECS.find((s) => s.id === id) ?? STATIC_TITLE_SPECS[0]!;
}

function frameAt(time: number): ScrollFrame {
  return {
    scroll: time * BG_SCROLL_SPEED,
    tileDelta: 0,
    fade: backgroundFade(time, stage1.warningAt),
    starScroll: [0, 0, 0],
  };
}

function blit(ctx: CanvasRenderingContext2D, frame: SpriteFrame, x: number, y: number): void {
  ctx.drawImage(frame.canvas, Math.floor(x - frame.anchorX), Math.floor(y - frame.anchorY));
}

function paintAtmosphere(ctx: CanvasRenderingContext2D, id: StaticTitleSpec['id']): void {
  ctx.save();
  if (id === 'dawn') {
    ctx.fillStyle = 'rgba(255, 186, 72, 0.2)';
    ctx.beginPath();
    ctx.arc(292, 74, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 140, 48, 0.08)';
    ctx.fillRect(0, 0, LOGICAL_W, 180);
  } else if (id === 'strait') {
    ctx.fillStyle = 'rgba(144, 200, 232, 0.16)';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(16, 188 + i * 42, LOGICAL_W - 32, 2);
    }
  } else {
    ctx.fillStyle = 'rgba(192, 192, 204, 0.16)';
    ctx.beginPath();
    ctx.moveTo(48, 460);
    ctx.lineTo(150, 20);
    ctx.lineTo(176, 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(312, 470);
    ctx.lineTo(200, 16);
    ctx.lineTo(228, 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function paintStamp(
  ctx: CanvasRenderingContext2D,
  assets: GameAssets,
  stamp: Stamp,
  time: number
): void {
  if (stamp.kind === 'player') {
    const frame = assets.player.bankFrames[stamp.bank] ?? assets.player.bankFrames[5]!;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(stamp.x, stamp.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPlayerFlames(ctx, stamp.x, stamp.y, frame.nozzles, 0.2, time);
    blit(ctx, frame, stamp.x, stamp.y);
    return;
  }
  if (stamp.kind === 'boss') {
    blit(ctx, assets.boss.hull, stamp.x, stamp.y);
    return;
  }
  const sheet = assets.enemies.byType[stamp.kind];
  for (const nozzle of sheet.nozzles) {
    drawEnemyFlame(ctx, stamp.x + nozzle.x, stamp.y + nozzle.y, time);
  }
  blit(ctx, sheet.idle, stamp.x, stamp.y);
}

function paintStill(id: StaticTitleSpec['id'], assets: GameAssets): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PALETTE[COLOR.BLACK];
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const spec = specFor(id);
  drawBackground(ctx, assets.background, frameAt(spec.time), spec.time);
  paintAtmosphere(ctx, id);

  const stamps = STAMPS[id];
  const ground = new Set<EnemyType>(['tank', 'turret2', 'missile_car']);
  for (const stamp of stamps) {
    if (stamp.kind !== 'player' && stamp.kind !== 'boss' && ground.has(stamp.kind)) {
      paintStamp(ctx, assets, stamp, spec.time);
    }
  }
  for (const stamp of stamps) {
    if (stamp.kind === 'boss') paintStamp(ctx, assets, stamp, spec.time);
  }
  for (const stamp of stamps) {
    if (stamp.kind !== 'player' && stamp.kind !== 'boss' && !ground.has(stamp.kind)) {
      paintStamp(ctx, assets, stamp, spec.time);
    }
  }
  for (const stamp of stamps) {
    if (stamp.kind === 'player') paintStamp(ctx, assets, stamp, spec.time);
  }
  return canvas;
}

export function staticTitleCanvas(id: StaticTitleSpec['id']): HTMLCanvasElement | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const assets = sharedGameAssets();
  if (!assets) return null;
  const canvas = paintStill(id, assets);
  cache.set(id, canvas);
  return canvas;
}

/** Full-screen still. Falls back to a flat night colour when canvases are unavailable. */
export function drawStaticTitle(ctx: CanvasRenderingContext2D, id: StaticTitleSpec['id']): void {
  const canvas = staticTitleCanvas(id);
  if (!canvas) {
    ctx.fillStyle = '#071018';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    return;
  }
  ctx.drawImage(canvas, 0, 0);
}

/** Dim the playfield so the title chrome stays readable. */
export function drawTitleScrim(ctx: CanvasRenderingContext2D): void {
  const fade = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  fade.addColorStop(0, 'rgba(4, 8, 18, 0.62)');
  fade.addColorStop(0.28, 'rgba(4, 8, 18, 0.28)');
  fade.addColorStop(0.5, 'rgba(4, 8, 18, 0.34)');
  fade.addColorStop(1, 'rgba(4, 8, 18, 0.66)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = 'rgba(4, 8, 18, 0.38)';
  ctx.fillRect(24, LOGICAL_H / 3 - 48, LOGICAL_W - 48, 150);
}
