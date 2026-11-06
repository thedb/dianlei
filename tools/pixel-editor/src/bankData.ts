import type { EntityFile, EntityStage } from '@/game/art/entityFile';

export const BANK_STAGE_IDS = ['t0', 't1', 't2', 't3', 't4', 't5'] as const;
const RIGHT_BANK_STAGE_IDS = new Set<string>(BANK_STAGE_IDS.slice(1));

export interface ClearedBankData {
  removedStageIds: string[];
  clearedT0Bank: boolean;
}

/** True when the entity contains generated, hand-tuned, or legacy bank data. */
export function hasBankData(entity: EntityFile | null): boolean {
  return entity?.stages.some(isBankStage) ?? false;
}

/**
 * Remove right-bank poses so the existing generator can rebuild all of them.
 * t0, unrelated stages, grids, and their parts stay untouched.
 */
export function clearBankData(entity: EntityFile): ClearedBankData {
  const removed = entity.stages.filter(
    (stage) => stage.id !== 't0' && (RIGHT_BANK_STAGE_IDS.has(stage.id) || stage.bank !== undefined)
  );
  const removedStages = new Set<EntityStage>(removed);
  entity.stages = entity.stages.filter((stage) => !removedStages.has(stage));

  const t0 = entity.stages.find((stage) => stage.id === 't0');
  const clearedT0Bank = t0?.bank !== undefined;
  if (t0) delete t0.bank;

  return {
    removedStageIds: removed.map((stage) => stage.id),
    clearedT0Bank,
  };
}

function isBankStage(stage: EntityStage): boolean {
  return stage.bank !== undefined || RIGHT_BANK_STAGE_IDS.has(stage.id);
}
