/**
 * 黑曜 hull, 80×96, nose down. Dark metal. The cockpit is warm in the main
 * fight and warning yellow on the overload. The wreck keeps the silhouette,
 * kills the nozzles, and opens a few holes. No player cyan.
 */

import { OBSIDIAN_HULL_H, OBSIDIAN_HULL_W } from '@/game/config';
import { COLOR } from '@/game/palette';
import { createGrid, fillRect, outline, plot } from './pixelDraw';
import type { SpriteData } from './types';

export type ObsidianHullKind = 'warm' | 'warn' | 'wreck';

function paint(kind: ObsidianHullKind): SpriteData {
  const g = createGrid(OBSIDIAN_HULL_W, OBSIDIAN_HULL_H, -1);
  const K = COLOR.BLACK;
  const D = COLOR.DARK_GRAY;
  const M = COLOR.MEDIUM_GRAY;
  const G = COLOR.GRAY;
  const L = COLOR.LIGHT_GRAY;
  const nozzle = kind === 'wreck' ? COLOR.SHADOW : L;

  fillRect(g, 34, 4, 12, 16, D);
  fillRect(g, 36, 6, 8, 10, M);
  fillRect(g, 30, 8, 6, 8, nozzle);
  fillRect(g, 44, 8, 6, 8, nozzle);
  fillRect(g, 32, 10, 2, 4, kind === 'wreck' ? K : COLOR.PALE_GRAY);
  fillRect(g, 46, 10, 2, 4, kind === 'wreck' ? K : COLOR.PALE_GRAY);

  fillRect(g, 32, 18, 16, 54, D);
  fillRect(g, 34, 20, 12, 48, M);
  fillRect(g, 36, 22, 8, 40, G);

  const canopy = kind === 'warn' ? COLOR.EXPLOSION_YELLOW : COLOR.GROUND_TAN;
  const lamp = kind === 'warn' ? COLOR.EXPLOSION_ORANGE_YELLOW : COLOR.EXPLOSION_ORANGE;
  fillRect(g, 36, 26, 8, 10, canopy);
  fillRect(g, 38, 28, 4, 6, lamp);

  fillRect(g, 8, 40, 64, 8, D);
  fillRect(g, 12, 42, 56, 4, M);
  fillRect(g, 4, 46, 72, 6, D);
  fillRect(g, 10, 48, 60, 3, G);
  fillRect(g, 18, 52, 44, 4, M);

  fillRect(g, 30, 70, 20, 8, D);
  fillRect(g, 34, 76, 12, 8, M);
  fillRect(g, 36, 82, 8, 6, G);
  fillRect(g, 38, 88, 4, 5, L);

  if (kind === 'wreck') {
    fillRect(g, 14, 46, 6, 4, K);
    fillRect(g, 58, 44, 5, 5, K);
    fillRect(g, 36, 48, 6, 8, K);
    plot(g, 20, 47, COLOR.MEDIUM_GRAY);
    plot(g, 60, 46, COLOR.GRAY);
    plot(g, 40, 34, K);
    plot(g, 41, 35, K);
  }

  outline(g, K);
  return g;
}

export function buildObsidianHull(kind: ObsidianHullKind): SpriteData {
  return paint(kind);
}
