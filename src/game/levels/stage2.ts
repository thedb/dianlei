/**
 * Stage 2 stub for the 铁堡 fight. Waves, buildings, and risk crates are a
 * later pass. The run map is 陆地B so the boss approach can stitch onto its
 * last row. Challenge Boss 「2」 seeks `enterAt` on this table.
 */

import { BG_SCROLL_SPEED, STAGE2_WARNING_AT } from '@/game/config';
import { TIEBAO } from './bosses/tiebao';
import type { StageData } from './types';

export const stage2: StageData = {
  id: '2',
  label: '2',
  stage: 2,
  scrollSpeed: BG_SCROLL_SPEED,
  warningAt: STAGE2_WARNING_AT,
  maps: { run: [{ map: 'landB', at: 0 }], boss: 'factoryBoss' },
  captions: [
    { id: 's2_open', at: 'open' },
    { id: 's2_end', at: 'clear' },
  ],
  waves: [],
  buildings: [],
  boss: TIEBAO,
};
