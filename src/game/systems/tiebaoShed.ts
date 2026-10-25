/**
 * 铁堡 carriage shed. Pure geometry and the main-bar thresholds.
 * Live placement is in `systems/tiebao.ts`.
 *
 * Loco + 9 cars. One rear car leaves at each remaining-HP step
 * 90 / 80 / 70 / 60 / 50 / 40 / 30. At ≤30% the consist is the loco
 * and two cars. Hard's second bar does not call this again.
 */

import {
  TIEBAO_CAR_GAP,
  TIEBAO_CAR_H,
  TIEBAO_CAR_PITCH,
  TIEBAO_CARS,
  TIEBAO_ENCOUNTER_TAIL_Y,
  TIEBAO_HULL_W,
  TIEBAO_LOCO_H,
  TIEBAO_RAM_MAX_CARS,
  TIEBAO_SHED_ADVANCE,
  TIEBAO_SHED_AT,
  TIEBAO_TAIL,
  TIEBAO_TAIL_LAMP_H,
  TIEBAO_TAIL_LAMP_W,
  TIEBAO_TAIL_LAMP_X,
  TIEBAO_TAIL_LAMP_Y_FROM_BOTTOM,
} from '@/game/config';

export function tiebaoHullHeight(cars: number): number {
  return TIEBAO_LOCO_H + cars * TIEBAO_CAR_PITCH + TIEBAO_TAIL;
}

/** Rear cars already gone. 0 at full main HP, 7 once remaining main HP is ≤30%. */
export function tiebaoShedCountFromRatio(ratio: number): number {
  let sheds = 0;
  for (const at of TIEBAO_SHED_AT) {
    if (ratio <= at) sheds++;
  }
  return sheds;
}

export function tiebaoCarsFromRatio(ratio: number): number {
  return TIEBAO_CARS - tiebaoShedCountFromRatio(ratio);
}

/** Screen y of the buffer. Each shed drops the tail so the loco can enter. */
export function tiebaoTailY(cars: number): number {
  const sheds = TIEBAO_CARS - cars;
  return TIEBAO_ENCOUNTER_TAIL_Y + sheds * TIEBAO_SHED_ADVANCE;
}

export function tiebaoRestCenter(cars: number): number {
  return tiebaoTailY(cars) - tiebaoHullHeight(cars) / 2;
}

/** Top row of boxcar `index` (0 is the car coupled to the locomotive). */
export function tiebaoCarBodyY(index: number): number {
  return TIEBAO_LOCO_H + index * TIEBAO_CAR_PITCH + TIEBAO_CAR_GAP;
}

export function tiebaoCarCenterRow(index: number): number {
  return tiebaoCarBodyY(index) + TIEBAO_CAR_H / 2;
}

/**
 * Ram stays off until the consist is down to loco+4.
 * That is the same moment main HP crosses 50% (five of the seven sheds).
 * The 9-car hull is 840px and would cover the screen on the dive.
 */
export function tiebaoRamArmed(cars: number): boolean {
  return cars <= TIEBAO_RAM_MAX_CARS;
}

export interface TiebaoTailLamp {
  /** Local x, hull center at 0, +x to the right. */
  x: number;
  /** Local y, piece center at 0, +y toward the buffer. */
  y: number;
  w: number;
  h: number;
}

/**
 * The one tail-lamp pair, in the last piece's local space.
 * These are the buffer pixels (`TIEBAO_TAIL_LAMP_*`). A second pair drawn
 * at `h/2 - 10` and then shifted by `sin(angle) * along` sits off the beam
 * once the car banks.
 */
export function tiebaoTailLampLocals(pieceH: number): TiebaoTailLamp[] {
  const y = pieceH / 2 - TIEBAO_TAIL_LAMP_Y_FROM_BOTTOM;
  return TIEBAO_TAIL_LAMP_X.map((spriteX) => ({
    x: spriteX - TIEBAO_HULL_W / 2,
    y,
    w: TIEBAO_TAIL_LAMP_W,
    h: TIEBAO_TAIL_LAMP_H,
  }));
}
