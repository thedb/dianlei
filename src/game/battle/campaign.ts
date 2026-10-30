/**
 * Clear handoff shared by a normal stage run and Boss连战.
 * Debug 挑战 Boss is one fight: it does not set `bossRush` and does not chain.
 */

import { nextStageId } from '@/game/levels/registry';
import type { CarriedRun, SceneContext } from '@/game/scenes/types';

/**
 * A stage clear, or a Boss连战 clear, points at the next id and keeps the stock.
 * The last stage, and a single 挑战 Boss clear, leave no `campaignNext`.
 */
export function assignClearHandoff(
  scene: SceneContext,
  stageId: string,
  carried: CarriedRun
): void {
  const chains = scene.battleEntry === 'stage' || scene.bossRush === true;
  const next = chains ? nextStageId(stageId) : undefined;
  if (!next) {
    delete scene.campaignNext;
    delete scene.carriedRun;
    return;
  }
  scene.campaignNext = next;
  scene.carriedRun = carried;
}

/**
 * The black card finished. A stage run writes `runStage` and enters at t = 0.
 * Boss连战 writes the next boss id and stays on `battleEntry: 'boss'`.
 */
export function continueCampaign(scene: SceneContext): void {
  const next = scene.campaignNext;
  if (!next) return;
  if (scene.bossRush) {
    scene.challengeStage = next;
    scene.battleEntry = 'boss';
  } else {
    scene.runStage = next;
    scene.battleEntry = 'stage';
    delete scene.challengeStage;
  }
  delete scene.campaignNext;
}
