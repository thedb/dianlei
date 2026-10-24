import { describe, expect, it } from 'vitest';
import {
  TIEBAO_CAR_PITCH,
  TIEBAO_CARS,
  TIEBAO_END_CARS,
  TIEBAO_END_NOSE_Y,
  TIEBAO_END_PARK_Y,
  TIEBAO_ENTER_Y,
  TIEBAO_FULL_H,
  TIEBAO_HULL_H,
  TIEBAO_LOCO_H,
  TIEBAO_PARK_Y,
  TIEBAO_RAM_MAX_CARS,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_SHED_AT,
} from '@/game/config';
import {
  tiebaoCarCenterRow,
  tiebaoCarsFromRatio,
  tiebaoHullHeight,
  tiebaoRamArmed,
  tiebaoRestCenter,
  tiebaoShedCountFromRatio,
  tiebaoTailY,
} from '@/game/systems/tiebaoShed';

describe('铁堡剥厢', () => {
  it('sheds one car at each 10% step and stops at loco+2', () => {
    expect([...TIEBAO_SHED_AT]).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
    expect(tiebaoShedCountFromRatio(1)).toBe(0);
    expect(tiebaoCarsFromRatio(1)).toBe(TIEBAO_CARS);
    expect(tiebaoShedCountFromRatio(0.9001)).toBe(0);
    TIEBAO_SHED_AT.forEach((at, index) => {
      expect(tiebaoShedCountFromRatio(at)).toBe(index + 1);
      expect(tiebaoCarsFromRatio(at)).toBe(TIEBAO_CARS - index - 1);
    });
    expect(tiebaoCarsFromRatio(0.3)).toBe(TIEBAO_END_CARS);
    expect(tiebaoCarsFromRatio(0)).toBe(TIEBAO_END_CARS);
    expect(tiebaoShedCountFromRatio(0)).toBe(TIEBAO_SHED_AT.length);
  });

  it('steps the hitbox by one car pitch and parks the end-form nose at y=48', () => {
    expect(TIEBAO_LOCO_H).toBe(116);
    expect(tiebaoHullHeight(TIEBAO_CARS)).toBe(TIEBAO_FULL_H);
    expect(tiebaoHullHeight(TIEBAO_END_CARS)).toBe(TIEBAO_HULL_H);
    expect(TIEBAO_HULL_H).toBe(280);
    expect(TIEBAO_FULL_H).toBe(840);
    for (let sheds = 0; sheds <= TIEBAO_SHED_AT.length; sheds++) {
      const cars = TIEBAO_CARS - sheds;
      expect(tiebaoHullHeight(cars)).toBe(TIEBAO_FULL_H - sheds * TIEBAO_CAR_PITCH);
    }
    expect(tiebaoTailY(TIEBAO_CARS) - 2.5 * TIEBAO_CAR_PITCH).toBe(-TIEBAO_CAR_PITCH / 2);
    expect(tiebaoRestCenter(TIEBAO_CARS)).toBe(TIEBAO_PARK_Y);
    expect(tiebaoRestCenter(TIEBAO_END_CARS)).toBe(TIEBAO_END_PARK_Y);
    expect(TIEBAO_END_PARK_Y - TIEBAO_HULL_H / 2).toBe(TIEBAO_END_NOSE_Y);
    expect(TIEBAO_ENTER_Y).toBe(-12 - TIEBAO_FULL_H / 2);
    expect(tiebaoCarCenterRow(1)).toBe(TIEBAO_ROOF_CAR_ROW);
  });

  it('arms the ram only at loco+4, which is the 50% shed', () => {
    expect(TIEBAO_RAM_MAX_CARS).toBe(4);
    expect(tiebaoCarsFromRatio(0.5001)).toBe(5);
    expect(tiebaoRamArmed(5)).toBe(false);
    expect(tiebaoCarsFromRatio(0.5)).toBe(4);
    expect(tiebaoRamArmed(4)).toBe(true);
    expect(tiebaoRamArmed(TIEBAO_END_CARS)).toBe(true);
    expect(tiebaoRamArmed(TIEBAO_CARS)).toBe(false);
  });
});
