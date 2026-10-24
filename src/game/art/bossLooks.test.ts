import { describe, expect, it } from 'vitest';
import {
  TIEBAO_CORE,
  TIEBAO_HULL_H,
  TIEBAO_HULL_W,
  TIEBAO_ROOF_CAR,
  TIEBAO_ROOF_LOCO,
} from '@/game/config';
import { FACTORY_LOOK_IDS, FACTORY_LOOK_NAMES, paintFactoryLook } from '@/game/art/factoryLooks';
import { TIEBAO_LOOK_IDS, TIEBAO_LOOK_NAMES, buildTiebaoHull } from '@/game/art/tiebaoLooks';
import type { SpriteData } from '@/game/art/types';

function hashSprite(grid: SpriteData): number {
  let n = 2166136261;
  for (const row of grid) {
    for (const cell of row) n = Math.imul(n ^ (cell + 2), 16777619);
  }
  return n >>> 0;
}

describe('铁堡外观待选', () => {
  it('keeps five named factory looks and five named hulls, defaulting to A', () => {
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
    const cy = Math.floor(TIEBAO_HULL_H / 2);
    const anchors = [TIEBAO_CORE, TIEBAO_ROOF_LOCO, TIEBAO_ROOF_CAR];
    for (const id of TIEBAO_LOOK_IDS) {
      const hull = buildTiebaoHull(id, false);
      expect(hull).toHaveLength(TIEBAO_HULL_H);
      expect(hull[0]).toHaveLength(TIEBAO_HULL_W);
      for (const offset of anchors) {
        expect(hull[cy + offset.y]?.[cx + offset.x]).toBeGreaterThanOrEqual(0);
      }
      expect(hull[4]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[222]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[68]?.[4]).toBe(-1);
      expect(hull[68]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hull[150]?.[4]).toBe(-1);
      expect(hull[150]?.[cx]).toBeGreaterThanOrEqual(0);
      let carWidth = 0;
      const mid = hull[110];
      if (mid) {
        let left = TIEBAO_HULL_W;
        let right = -1;
        for (let x = 0; x < TIEBAO_HULL_W; x++) {
          if ((mid[x] ?? -1) < 0) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
        carWidth = right - left + 1;
      }
      expect(carWidth).toBeGreaterThan(20);
      expect(carWidth).toBeLessThanOrEqual(48);
      for (let y = 74; y < 146; y++) expect(hull[y]?.[cx]).toBeGreaterThanOrEqual(0);
      expect(hashSprite(buildTiebaoHull(id, true))).not.toBe(hashSprite(hull));
    }
  });
});
