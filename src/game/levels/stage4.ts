/**
 * Stage 4 map shell. Waves, guns, floaters, and the obsidian fight are not
 * in this pass. The run scrolls 海面B from t = 0. 挑战 Boss seeks
 * `OBSIDIAN_ENTER_AT` and loops the empty enemy deck.
 *
 * `s4_wreck` and `s4_ufo` are in the caption catalog. Their clocks are not
 * wired yet (`mid` / `cutscene` still draw nothing).
 */

import { BG_SCROLL_SPEED, STAGE4_WARNING_AT } from '@/game/config';
import { OBSIDIAN } from './bosses/obsidian';
import type { StageData } from './types';

export const stage4: StageData = {
  id: '4',
  label: '4',
  name: '航母出击',
  stage: 4,
  scrollSpeed: BG_SCROLL_SPEED,
  warningAt: STAGE4_WARNING_AT,
  maps: { run: [{ map: 'seaB', at: 0 }], boss: 'obsidianBoss' },
  captions: [{ id: 's4_open', at: 'open' }],
  waves: [],
  buildings: [],
  boss: OBSIDIAN,
};
