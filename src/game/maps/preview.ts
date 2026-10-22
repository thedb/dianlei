/**
 * 地图预览 targets (hidden debug layer). The list is one row per registered
 * map. `buildPreviewTrack` still accepts `stage:<id>` (a stage's pre-boss run)
 * when a caller passes that target; the debug list does not offer it.
 */

import { getStage } from '@/game/levels/registry';
import type { StageData } from '@/game/levels/types';
import { listMaps } from './registry';
import { buildMapTrack, buildStageRunTrack, type BackgroundTrack } from './track';

export type MapPreviewTarget = `map:${string}` | `stage:${string}`;

const NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export function stageRunLabel(stage: StageData): string {
  return `第${NUMERALS[stage.stage] ?? stage.stage}关全程`;
}

export function listMapPreviews(): ReadonlyArray<{ target: MapPreviewTarget; label: string }> {
  return listMaps().map((map) => ({ target: `map:${map.id}` as const, label: map.label }));
}

/** Track for a preview target. Unknown or missing targets play the first stage's run. */
export function buildPreviewTrack(target: string | undefined): BackgroundTrack {
  if (target?.startsWith('map:')) return buildMapTrack(target.slice(4));
  const stage = getStage(target?.startsWith('stage:') ? target.slice(6) : undefined);
  return buildStageRunTrack(stage, stageRunLabel(stage));
}
