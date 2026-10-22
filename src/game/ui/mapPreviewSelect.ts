/**
 * Debug 「地图预览」 list (P12): one row per map asset, then 「第N关全程」 per
 * stage, then 返回. Same overlay as 挑战 Boss, with compact rows.
 */

import { listMapPreviews, type MapPreviewTarget } from '@/game/maps/preview';
import {
  choiceButton,
  createChoiceOverlay,
  type ChoiceOverlay,
  type ChoiceRow,
} from './choiceOverlay';

export const MAP_PREVIEW_ROWS: ReadonlyArray<ChoiceRow<MapPreviewTarget>> = [
  ...listMapPreviews().map((p) => ({ action: p.target, title: p.label, sub: '' })),
  { action: 'back', title: '返回', sub: '' },
];

export function mapPreviewButton(target: MapPreviewTarget | 'back') {
  const index = MAP_PREVIEW_ROWS.findIndex((row) => row.action === target);
  return choiceButton(index, true);
}

export function createMapPreviewSelect(): ChoiceOverlay<MapPreviewTarget> {
  return createChoiceOverlay({ heading: '地图预览', rows: MAP_PREVIEW_ROWS, compact: true });
}
