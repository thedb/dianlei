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
  TIEBAO_LOCO_H,
  TIEBAO_RAM_MAX_CARS,
  TIEBAO_SHED_ADVANCE,
  TIEBAO_SHED_AT,
  TIEBAO_TAIL,
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
