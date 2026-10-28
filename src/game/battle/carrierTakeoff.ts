/**
 * Stage 4 carrier launch. A stage-start entry parks the ship on the deck,
 * holds the stage clock, counts down with left-side lamps, then ramps the
 * tail flame and rushes up to `CARRIER_RELEASE_Y` as the map starts to scroll.
 * Control returns when the rush ends. 挑战 Boss and 地图预览 never arm it.
 *
 * The clock stays at 0 through the lamps, so scroll, waves, and the boss
 * warning stay on `BG_SCROLL_SPEED * gameTime` once the rush begins.
 */

import { getBankFrameIndex } from '@/game/art/playerSprite';
import {
  CARRIER_LIGHT_COUNT,
  CARRIER_LIGHT_GAP,
  CARRIER_LIGHT_SIZE,
  CARRIER_LIGHT_STEP,
  CARRIER_LIGHT_X,
  CARRIER_LIGHT_Y,
  CARRIER_LIGHTS_TIME,
  CARRIER_PARK_Y,
  CARRIER_RELEASE_Y,
  CARRIER_RUSH_TIME,
  LOGICAL_W,
} from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';

export type CarrierTakeoffPhase = 'off' | 'lights' | 'rush' | 'done';

export interface CarrierTakeoff {
  phase: CarrierTakeoffPhase;
  /** Seconds already spent in the current phase. */
  t: number;
  /** 0 at the start of the rush, 1 at the end. Cruise is 0 outside the rush. */
  flame: number;
}

/** Fields the launch script writes. The battle ship satisfies this. */
export interface TakeoffShip {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  bank: number;
  targetBank: number;
  lastBankFrame: number;
  velocityY: number;
}

export function createCarrierTakeoff(): CarrierTakeoff {
  return { phase: 'off', t: 0, flame: 0 };
}

export function resetCarrierTakeoff(takeoff: CarrierTakeoff): void {
  takeoff.phase = 'off';
  takeoff.t = 0;
  takeoff.flame = 0;
}

/**
 * Real stage run of stage 4 from t = 0. Boss practice seeks the enemy deck.
 * Map preview and the weapon range scroll or fly without this script.
 */
export function carrierTakeoffApplies(
  stageId: string,
  entry: 'stage' | 'boss',
  rules: { hud: string; spawns: boolean }
): boolean {
  return stageId === '4' && entry === 'stage' && rules.hud === 'stage' && rules.spawns;
}

/** Lamps freeze the stage clock and the map. The rush does not. */
export function carrierHoldsClock(phase: CarrierTakeoffPhase): boolean {
  return phase === 'lights';
}

/** Lights and the rush ignore the stick, fire, and bomb. */
export function carrierBlocksInput(phase: CarrierTakeoffPhase): boolean {
  return phase === 'lights' || phase === 'rush';
}

/**
 * How many lamps are lit. They come on from the top, one every
 * `CARRIER_LIGHT_STEP`, then stay lit until the rush.
 */
export function carrierLightsLit(t: number): number {
  if (t < CARRIER_LIGHT_STEP) return 0;
  return Math.min(CARRIER_LIGHT_COUNT, Math.floor(t / CARRIER_LIGHT_STEP));
}

/**
 * Exhaust passed to `drawEngineFlame`. Null skips the flame (engines cold
 * on the deck). A rush value is 0–1 and ramps the shared boost.
 */
export function carrierExhaustBoost(takeoff: CarrierTakeoff): number | null {
  if (takeoff.phase === 'lights') return null;
  return takeoff.flame;
}

function parkPose(player: TakeoffShip): void {
  player.bank = 0;
  player.targetBank = 0;
  player.lastBankFrame = getBankFrameIndex(0);
}

/** Arm the launch, or leave it off. Does not move the ship when it does not apply. */
export function beginCarrierTakeoff(
  takeoff: CarrierTakeoff,
  player: TakeoffShip,
  flying: { isFlying: boolean },
  applies: boolean
): void {
  resetCarrierTakeoff(takeoff);
  if (!applies) return;
  takeoff.phase = 'lights';
  player.x = LOGICAL_W / 2;
  player.y = CARRIER_PARK_Y;
  player.prevX = player.x;
  player.prevY = player.y;
  player.velocityY = 0;
  parkPose(player);
  flying.isFlying = false;
}

/**
 * Cubic ease-in. u=0.5 has only covered 12.5% of the run, and the slope
 * is steepest at u=1. Not linear.
 */
function rushEase(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * t;
}

/** Normalized speed of `rushEase` (derivative 3t², divided by 3). Ends at 1. */
function rushSpeed(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t;
}

export function stepCarrierTakeoff(takeoff: CarrierTakeoff, player: TakeoffShip, dt: number): void {
  if (takeoff.phase === 'off' || takeoff.phase === 'done') {
    takeoff.flame = 0;
    return;
  }
  takeoff.t += dt;
  parkPose(player);
  if (takeoff.phase === 'lights') {
    player.x = LOGICAL_W / 2;
    player.y = CARRIER_PARK_Y;
    player.velocityY = 0;
    takeoff.flame = 0;
    // An integer number of 1/60 frames lands a few ulps under the nominal second.
    if (takeoff.t + 1e-6 >= CARRIER_LIGHTS_TIME) {
      takeoff.phase = 'rush';
      takeoff.t = 0;
    }
    return;
  }
  const u = Math.min(1, takeoff.t / CARRIER_RUSH_TIME);
  const speed = rushSpeed(u);
  player.x = LOGICAL_W / 2;
  player.y = CARRIER_PARK_Y + (CARRIER_RELEASE_Y - CARRIER_PARK_Y) * rushEase(u);
  // Negative y lengthens the tail flame in drawEngineFlame. Flame tracks speed.
  player.velocityY = -speed;
  takeoff.flame = speed;
  if (takeoff.t + 1e-6 >= CARRIER_RUSH_TIME) {
    player.y = CARRIER_RELEASE_Y;
    player.velocityY = 0;
    takeoff.flame = 0;
    takeoff.phase = 'done';
    takeoff.t = 0;
  }
}

/** Left-side start lamps. Pixel blocks, palette indices only. */
export function drawCarrierLights(ctx: CanvasRenderingContext2D, takeoff: CarrierTakeoff): void {
  if (takeoff.phase !== 'lights') return;
  const lit = carrierLightsLit(takeoff.t);
  const size = CARRIER_LIGHT_SIZE;
  const gap = CARRIER_LIGHT_GAP;
  const count = CARRIER_LIGHT_COUNT;
  const mastH = count * size + (count - 1) * gap;
  ctx.fillStyle = PALETTE[COLOR.MEDIUM_GRAY];
  ctx.fillRect(CARRIER_LIGHT_X, CARRIER_LIGHT_Y, 2, mastH);
  for (let i = 0; i < count; i++) {
    const x = CARRIER_LIGHT_X + 4;
    const y = CARRIER_LIGHT_Y + i * (size + gap);
    const on = i < lit;
    ctx.fillStyle = PALETTE[COLOR.GRAY];
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = PALETTE[on ? COLOR.ENEMY_VIVID_RED : COLOR.ENEMY_DARK_RED];
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    if (on) {
      ctx.fillStyle = PALETTE[COLOR.WHITE];
      ctx.fillRect(x + 4, y + 4, 2, 2);
    }
  }
}
