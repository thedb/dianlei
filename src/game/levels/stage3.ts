/**
 * Stage 3 stub. The run is 河流A until the warning, then 炉心浮台.
 * Waves, buildings, and risk crates stay empty until P33.
 * `STAGE3_WARNING_AT` and `FURNACE_ENTER_AT` are not the stage 2 clocks.
 */

import { BG_SCROLL_SPEED, STAGE3_WARNING_AT } from '@/game/config';
import { FURNACE } from './bosses/furnace';
import type { StageData } from './types';

export const stage3: StageData = {
  id: '3',
  label: '3',
  name: '叛军心脏',
  stage: 3,
  scrollSpeed: BG_SCROLL_SPEED,
  warningAt: STAGE3_WARNING_AT,
  maps: { run: [{ map: 'riverA', at: 0 }], boss: 'furnaceBoss' },
  captions: [
    { id: 's3_open', at: 'open' },
    { id: 's3_end', at: 'clear' },
  ],
  waves: [],
  buildings: [],
  boss: FURNACE,
};
