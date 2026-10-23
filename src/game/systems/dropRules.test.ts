import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import { BUILDING_DROP_P_SHARE, POWER_MAX } from '@/game/config';
import { getStage } from '@/game/levels/registry';
import {
  chooseBuildingDrop,
  previewDefaultBuildingDrop,
  resolvePlacementDrops,
  type DropRule,
} from './dropRules';

const stage1 = getStage('1');
const OPEN = ['B02', 'B03', 'B04', 'B09', 'B10', 'B11'] as const;

function scripted(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i];
    i += 1;
    if (value === undefined) throw new Error('scripted rng ran out');
    return value;
  };
}

describe('stage 1 building drops', () => {
  it('locks B01 and B05 to T, and B06 to M', () => {
    const byId = new Map(stage1.buildings.map((b) => [b.id, b.drop]));
    expect(byId.get('B01')).toBe('T');
    expect(byId.get('B05')).toBe('T');
    expect(byId.get('B06')).toBe('M');
    for (const id of OPEN) expect(byId.get(id)).toBeUndefined();
  });

  it('puts B07 then B08 in one exclusive M group', () => {
    const members = stage1.buildings.filter((b) => typeof b.drop === 'object');
    expect(members.map((b) => b.id)).toEqual(['B07', 'B08']);
    expect(members.map((b) => b.drop)).toEqual([
      { exclusive: 's1-sea-mate', item: 'M' },
      { exclusive: 's1-sea-mate', item: 'M' },
    ]);
  });

  it('gives exactly one of B07/B08 an M, stable for a seed, and both ids win sometimes', () => {
    const winners = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const fixed = resolvePlacementDrops(stage1.buildings, createRng(seed));
      const again = resolvePlacementDrops(stage1.buildings, createRng(seed));
      expect([...again.entries()].sort()).toEqual([...fixed.entries()].sort());
      expect(fixed.get('B01')).toBe('T');
      expect(fixed.get('B05')).toBe('T');
      expect(fixed.get('B06')).toBe('M');
      for (const id of OPEN) expect(fixed.has(id)).toBe(false);
      const m7 = fixed.get('B07') === 'M';
      const m8 = fixed.get('B08') === 'M';
      expect(Number(m7) + Number(m8)).toBe(1);
      expect(fixed.has(m7 ? 'B08' : 'B07')).toBe(false);
      winners.add(m7 ? 'B07' : 'B08');
    }
    expect(winners).toEqual(new Set(['B07', 'B08']));
  });

  it('picks B07 when the coin flip is 0 and B08 when it is the other half', () => {
    const low = resolvePlacementDrops(stage1.buildings, scripted([0]));
    expect(low.get('B07')).toBe('M');
    expect(low.has('B08')).toBe(false);
    const high = resolvePlacementDrops(stage1.buildings, scripted([0.5]));
    expect(high.get('B08')).toBe('M');
    expect(high.has('B07')).toBe(false);
  });

  it('rolls the other buildings 50/50 P or B, and B only at max power', () => {
    expect(BUILDING_DROP_P_SHARE).toBe(0.5);
    const fixed = resolvePlacementDrops(stage1.buildings, scripted([0]));
    const sub = { id: 'homing' as const, level: 2 };
    expect(chooseBuildingDrop({ id: 'B08', mainLevel: 1, sub, rng: scripted([0]), fixed })).toBe(
      'P'
    );
    expect(chooseBuildingDrop({ id: 'B08', mainLevel: 1, sub, rng: scripted([0.49]), fixed })).toBe(
      'P'
    );
    expect(
      chooseBuildingDrop({ id: 'B02', mainLevel: 1, sub: null, rng: scripted([0.5]), fixed })
    ).toBe('B');
    expect(chooseBuildingDrop({ id: 'B11', mainLevel: 2, sub, rng: scripted([0.99]), fixed })).toBe(
      'B'
    );

    let draws = 0;
    const rng = (): number => {
      draws += 1;
      return 0;
    };
    for (const id of ['B02', 'B04', 'B09', 'B08']) {
      expect(chooseBuildingDrop({ id, mainLevel: POWER_MAX, sub, rng, fixed })).toBe('B');
    }
    expect(draws).toBe(0);
    expect(previewDefaultBuildingDrop(1)).toBe('P/B');
    expect(previewDefaultBuildingDrop(POWER_MAX)).toBe('B');
  });

  it('does not roll a locked building, even when a custom rule list says otherwise', () => {
    const fixed = resolvePlacementDrops(stage1.buildings, scripted([0.5]));
    let draws = 0;
    const rng = (): number => {
      draws += 1;
      return 0;
    };
    const rules: DropRule[] = [{ item: 'T' }];
    expect(chooseBuildingDrop({ id: 'B01', mainLevel: 1, sub: null, rng, fixed, rules })).toBe('T');
    expect(chooseBuildingDrop({ id: 'B06', mainLevel: POWER_MAX, sub: null, rng, fixed })).toBe(
      'M'
    );
    expect(chooseBuildingDrop({ id: 'B08', mainLevel: 1, sub: null, rng, fixed, rules })).toBe('M');
    expect(draws).toBe(0);
    expect(
      chooseBuildingDrop({ id: 'B02', mainLevel: POWER_MAX, sub: null, rng, fixed, rules })
    ).toBe('T');
  });

  it('splits a seeded run of open buildings evenly between P and B', () => {
    const rng = createRng(1);
    let p = 0;
    for (let i = 0; i < 1000; i++) {
      const item = chooseBuildingDrop({
        id: 'B03',
        mainLevel: 1,
        sub: null,
        rng,
      });
      if (item === 'P') p += 1;
      else expect(item).toBe('B');
    }
    expect(p).toBe(505);
    expect(1000 - p).toBe(495);
  });
});

describe('exclusive groups', () => {
  it('assigns one member per group, groups in sorted key order', () => {
    const calls: number[] = [];
    const rng = (): number => {
      calls.push(1);
      return 0.99;
    };
    const fixed = resolvePlacementDrops(
      [
        { id: 'a', drop: { exclusive: 'z', item: 'M' } },
        { id: 'b', drop: { exclusive: 'a', item: 'T' } },
        { id: 'c', drop: 'P' },
        { id: 'd', drop: { exclusive: 'z', item: 'M' } },
        { id: 'e', drop: { exclusive: 'a', item: 'T' } },
      ],
      rng
    );
    expect(calls).toHaveLength(2);
    expect(fixed.get('c')).toBe('P');
    expect(fixed.get('e')).toBe('T');
    expect(fixed.has('b')).toBe(false);
    expect(fixed.get('d')).toBe('M');
    expect(fixed.has('a')).toBe(false);
  });
});
