import { describe, expect, it } from 'vitest';
import { LOGICAL_H, SCORE_WRECK_FLOAT, TILE_SIZE, WRECK_FLOAT_HP } from '@/game/config';
import { getStage } from '@/game/levels/registry';
import { buildStageTrack } from '@/game/maps/track';
import {
  WreckFloatScheduler,
  bulletHitsWreckFloat,
  createWreckFloat,
  damageWreckFloat,
  placeWreckFloats,
  spawnWreckFloat,
  wreckFloatSpawnScroll,
} from './wreckFloat';

describe('wreck floats', () => {
  const stage = getStage('4');
  const placed = placeWreckFloats(stage.wreckFloats ?? [], buildStageTrack(stage));
  const first = placed.find((anchor) => anchor.id === 'F01')!;

  it('spawns from the map cell and stops at the warning', () => {
    expect(placed).toHaveLength(8);
    expect(wreckFloatSpawnScroll(first)).toBe(first.origin + first.row * TILE_SIZE - LOGICAL_H);
    const scheduler = new WreckFloatScheduler(placed, stage.warningAt);
    expect(scheduler.update(wreckFloatSpawnScroll(first) - 1, 10)).toEqual([]);
    expect(scheduler.update(wreckFloatSpawnScroll(first), 10).map((anchor) => anchor.id)).toEqual([
      'F01',
    ]);
    expect(scheduler.update(100_000, stage.warningAt)).toEqual([]);
    scheduler.reset();
    expect(scheduler.update(100_000, stage.warningAt - 1)).toHaveLength(8);
  });

  it('takes bullet damage without a ship-contact kill', () => {
    const floater = createWreckFloat();
    spawnWreckFloat(
      floater,
      first,
      wreckFloatSpawnScroll(first),
      WRECK_FLOAT_HP,
      SCORE_WRECK_FLOAT
    );
    expect(floater.hp).toBe(4);
    expect(floater.score).toBe(200);
    expect(bulletHitsWreckFloat(floater, floater.x, floater.y, 4, 12)).toBe(true);
    expect(bulletHitsWreckFloat(floater, floater.x + 80, floater.y, 4, 12)).toBe(false);
    expect(damageWreckFloat(floater, 3)).toBe(false);
    expect(damageWreckFloat(floater, 1)).toBe(true);
  });
});
