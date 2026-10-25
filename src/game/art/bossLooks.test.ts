import { describe, expect, it } from 'vitest';
import {
  TIEBAO_CAR_GAP,
  TIEBAO_CAR_H,
  TIEBAO_CAR_PITCH,
  TIEBAO_CARS,
  TIEBAO_CORE_ROW,
  TIEBAO_BUFFER,
  TIEBAO_FULL_H,
  TIEBAO_HULL_H,
  TIEBAO_HULL_W,
  TIEBAO_LOCO_H,
  TIEBAO_ROOF_CAR_ROW,
  TIEBAO_ROOF_LOCO_ROW,
  TIEBAO_TAIL_LAMP_H,
  TIEBAO_TAIL_LAMP_W,
  TIEBAO_TAIL_LAMP_X,
  TIEBAO_TAIL_LAMP_Y_FROM_BOTTOM,
} from '@/game/config';
import { FACTORY_LOOK_IDS, FACTORY_LOOK_NAMES, paintFactoryLook } from '@/game/art/factoryLooks';
import { TIEBAO_LOOK_IDS, TIEBAO_LOOK_NAMES, buildTiebaoHull } from '@/game/art/tiebaoLooks';
import { COLOR } from '@/game/palette';
import { tiebaoCarBodyY } from '@/game/systems/tiebaoShed';
import type { SpriteData } from '@/game/art/types';

function hashSprite(grid: SpriteData): number {
  let n = 2166136261;
  for (const row of grid) {
    for (const cell of row) n = Math.imul(n ^ (cell + 2), 16777619);
  }
  return n >>> 0;
}

describe('铁堡外观', () => {
  it('keeps five named factory looks and five slender consists, defaulting to A', () => {
    expect(FACTORY_LOOK_IDS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(TIEBAO_LOOK_IDS).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(FACTORY_LOOK_NAMES.A).toBe('铁皮高窗');
    expect(FACTORY_LOOK_NAMES.B).toBe('警示桁架');
    expect(FACTORY_LOOK_NAMES.C).toBe('夜班灯带');
    expect(FACTORY_LOOK_NAMES.D).toBe('弹药库');
    expect(FACTORY_LOOK_NAMES.E).toBe('冷却管廊');
    expect(TIEBAO_LOOK_NAMES.A).toBe('尖头三节');
    expect(TIEBAO_LOOK_NAMES.B).toBe('钝鼻铆甲');
    expect(TIEBAO_LOOK_NAMES.C).toBe('侧裙弹舱');
    expect(TIEBAO_LOOK_NAMES.D).toBe('脊炮车顶');
    expect(TIEBAO_LOOK_NAMES.E).toBe('厚钩尾梁');

    const floors = FACTORY_LOOK_IDS.map((id) => hashSprite(paintFactoryLook(id).floor));
    const walls = FACTORY_LOOK_IDS.map((id) => hashSprite(paintFactoryLook(id).wall));
    const windows = FACTORY_LOOK_IDS.map((id) => hashSprite(paintFactoryLook(id).window));
    const hulls = TIEBAO_LOOK_IDS.map((id) => hashSprite(buildTiebaoHull(id, false)));
    expect(new Set(floors).size).toBe(5);
    expect(new Set(walls).size).toBe(5);
    expect(new Set(windows).size).toBe(5);
    expect(new Set(hulls).size).toBe(5);
    const cx = Math.floor(TIEBAO_HULL_W / 2);
    const anchors = [TIEBAO_CORE_ROW, TIEBAO_ROOF_LOCO_ROW, TIEBAO_ROOF_CAR_ROW];
    const gap = TIEBAO_LOCO_H + 4;
    const gap2 = TIEBAO_LOCO_H + TIEBAO_CAR_PITCH + 4;
    const mid = tiebaoCarBodyY(3) + Math.floor(TIEBAO_CAR_H / 2);
    const lead = tiebaoCarBodyY(0);
    for (const id of TIEBAO_LOOK_IDS) {
      const hull = buildTiebaoHull(id, false);
      expect(hull).toHaveLength(TIEBAO_FULL_H);
      expect(hull[0]).toHaveLength(TIEBAO_HULL_W);
      expect(TIEBAO_HULL_H).toBeLessThan(TIEBAO_FULL_H);
      for (const row of anchors) {
        expect(hull[row]?.[cx]).toBeGreaterThanOrEqual(0);
      }
      expect(hull[4]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[TIEBAO_LOCO_H - 6]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[TIEBAO_FULL_H - 8]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[gap]?.[4]).toBe(-1);
      expect(hull[gap]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[gap2]?.[4]).toBe(-1);
      expect(hull[gap2]?.[cx]).toBeGreaterThanOrEqual(0);
      let carWidth = 0;
      const sample = hull[mid];
      if (sample) {
        let left = TIEBAO_HULL_W;
        let right = -1;
        for (let x = 0; x < TIEBAO_HULL_W; x++) {
          if ((sample[x] ?? -1) < 0) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
        carWidth = right - left + 1;
      }
      expect(carWidth).toBeGreaterThan(20);
      expect(carWidth).toBeLessThanOrEqual(48);
      for (let y = lead; y < lead + TIEBAO_CAR_H; y++) {
        expect(hull[y]?.[cx]).toBeGreaterThanOrEqual(0);
      }
      expect(TIEBAO_LOCO_H).toBeGreaterThan(TIEBAO_CAR_H + TIEBAO_CAR_GAP);
      let locoMuzzle = false;
      for (let y = 30; y < TIEBAO_LOCO_H; y++) {
        if (hull[y]?.[cx] === COLOR.EXPLOSION_YELLOW) locoMuzzle = true;
      }
      expect(locoMuzzle).toBe(true);
      for (let car = 0; car < TIEBAO_CARS; car++) {
        const top = tiebaoCarBodyY(car);
        let muzzles = 0;
        for (let y = top; y < top + TIEBAO_CAR_H; y++) {
          for (let x = 16; x < 64; x++) {
            if (hull[y]?.[x] === COLOR.EXPLOSION_YELLOW) muzzles++;
          }
        }
        expect(muzzles).toBeGreaterThan(0);
      }
      expect(hashSprite(buildTiebaoHull(id, true))).not.toBe(hashSprite(hull));
    }
  });

  it('bakes one tail-lamp pair on the buffer and no second yellow block there', () => {
    const hull = buildTiebaoHull('A', false);
    const lampY = TIEBAO_FULL_H - TIEBAO_TAIL_LAMP_Y_FROM_BOTTOM;
    const owned = new Set<string>();
    for (const sx of TIEBAO_TAIL_LAMP_X) {
      let yellow = 0;
      for (let y = lampY; y < lampY + TIEBAO_TAIL_LAMP_H; y++) {
        for (let x = sx; x < sx + TIEBAO_TAIL_LAMP_W; x++) {
          owned.add(`${x},${y}`);
          const cell = hull[y]?.[x];
          expect(cell === COLOR.EXPLOSION_YELLOW || cell === COLOR.WHITE).toBe(true);
          if (cell === COLOR.EXPLOSION_YELLOW) yellow++;
        }
      }
      expect(yellow).toBe(TIEBAO_TAIL_LAMP_W * TIEBAO_TAIL_LAMP_H - 1);
    }
    for (let y = TIEBAO_FULL_H - TIEBAO_BUFFER; y < TIEBAO_FULL_H; y++) {
      for (let x = 0; x < TIEBAO_HULL_W; x++) {
        if (owned.has(`${x},${y}`)) continue;
        expect(hull[y]?.[x]).not.toBe(COLOR.EXPLOSION_YELLOW);
      }
    }
  });
});
