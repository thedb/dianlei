import { describe, expect, it } from 'vitest';
import {
  cloneStage,
  defaultBank,
  sampleAssemblyEntity,
  type EntityStage,
} from '../../../src/game/art/entityFile';
import { clearBankData, hasBankData } from '../src/bankData';

describe('pixel editor bank cleanup', () => {
  it('removes generated and hand-tuned bank frames while preserving source data', () => {
    const entity = sampleAssemblyEntity();
    const source = cloneStage(entity.stages[0] as EntityStage, 't0');
    const sourceParts = structuredClone(source.parts);
    const grids = structuredClone(entity.grids);
    entity.stages.push(
      source,
      { ...cloneStage(source, 't1'), bank: defaultBank('t0', 1) },
      cloneStage(source, 't2'),
      { ...cloneStage(source, 'bank-preview'), bank: defaultBank('t0', 3) }
    );

    expect(hasBankData(entity)).toBe(true);
    const result = clearBankData(entity);

    expect(result).toEqual({
      removedStageIds: ['t1', 't2', 'bank-preview'],
      clearedT0Bank: false,
    });
    expect(entity.stages.map((stage) => stage.id)).toEqual(['folded', 'half', 'open', 't0']);
    expect(entity.stages.find((stage) => stage.id === 't0')?.parts).toEqual(sourceParts);
    expect(entity.grids).toEqual(grids);
    expect(hasBankData(entity)).toBe(false);
  });

  it('keeps t0 but removes a legacy bank field from it', () => {
    const entity = sampleAssemblyEntity();
    const t0 = cloneStage(entity.stages[1] as EntityStage, 't0');
    t0.bank = defaultBank('folded', 1);
    entity.stages.push(t0);

    expect(clearBankData(entity)).toEqual({
      removedStageIds: [],
      clearedT0Bank: true,
    });
    expect(entity.stages.at(-1)).toMatchObject({ id: 't0' });
    expect(entity.stages.at(-1)?.bank).toBeUndefined();
  });

  it('leaves an entity without bank data unchanged', () => {
    const entity = sampleAssemblyEntity();
    const before = structuredClone(entity);

    expect(hasBankData(entity)).toBe(false);
    expect(clearBankData(entity)).toEqual({
      removedStageIds: [],
      clearedT0Bank: false,
    });
    expect(entity).toEqual(before);
  });
});
