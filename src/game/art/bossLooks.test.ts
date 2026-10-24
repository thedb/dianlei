import { describe, expect, it } from 'vitest';
import { TIEBAO_HULL_H, TIEBAO_HULL_W } from '@/game/config';
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
    expect(TIEBAO_LOOK_NAMES.A).toBe('弹舱棚车');
    expect(TIEBAO_LOOK_NAMES.B).toBe('纵置油罐');
    expect(TIEBAO_LOOK_NAMES.C).toBe('敞车弹架');
    expect(TIEBAO_LOOK_NAMES.D).toBe('指挥守车');
    expect(TIEBAO_LOOK_NAMES.E).toBe('三节联挂');

    const floors = FACTORY_LOOK_IDS.map((id) => hashSprite(paintFactoryLook(id).floor));
    const walls = FACTORY_LOOK_IDS.map((id) => hashSprite(paintFactoryLook(id).wall));
    const windows = FACTORY_LOOK_IDS.map((id) => hashSprite(paintFactoryLook(id).window));
    const hulls = TIEBAO_LOOK_IDS.map((id) => hashSprite(buildTiebaoHull(id, false)));
    expect(new Set(floors).size).toBe(5);
    expect(new Set(walls).size).toBe(5);
    expect(new Set(windows).size).toBe(5);
    expect(new Set(hulls).size).toBe(5);
    for (const id of TIEBAO_LOOK_IDS) {
      const hull = buildTiebaoHull(id, false);
      expect(hull).toHaveLength(TIEBAO_HULL_H);
      expect(hull[0]).toHaveLength(TIEBAO_HULL_W);
      expect(hull[34]?.[50]).toBeGreaterThanOrEqual(0);
      expect(hull[102]?.[30]).toBeGreaterThanOrEqual(0);
      expect(hull[124]?.[40]).toBeGreaterThanOrEqual(0);
      expect(hashSprite(buildTiebaoHull(id, true))).not.toBe(hashSprite(hull));
    }
  });
});
