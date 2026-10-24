/**
 * Stage registry. The only module that imports concrete stage tables.
 * Everything else (battle, wave scheduler, 挑战 Boss list, tests) asks here.
 *
 * Adding a stage: write `levels/stageN.ts` exporting a `StageData` with a new
 * `id`, then add it to `STAGES`. The 挑战 Boss picker lists it automatically.
 */

import { stage1 } from './stage1';
import { stage2 } from './stage2';
import type { StageData } from './types';

export const DEFAULT_STAGE_ID = '1';

const STAGES: readonly StageData[] = [stage1, stage2];

/** Every registered stage, in play order. */
export function listStages(): readonly StageData[] {
  return STAGES;
}

/** Stage by id. Omitted or unknown ids fall back to the default stage. */
export function getStage(id: string = DEFAULT_STAGE_ID): StageData {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0]!;
}

export { stageEnemyCount, stageMvpEnemyCount, stageMvpWaves } from './stageStats';
