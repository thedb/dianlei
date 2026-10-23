import { describe, expect, it } from 'vitest';
import { ITEM_B_FALL_SPEED, ITEM_P_SPEED } from '@/game/config';
import { ITEM_DEFS, createItem, spawnItem } from './item';

describe('item motion', () => {
  it('bounces M like P and T, and does not fall like B', () => {
    expect(ITEM_DEFS.M.effect).toBe('mate');
    expect(ITEM_DEFS.M.motion).toBe('bounce');
    expect(ITEM_DEFS.P.motion).toBe('bounce');
    expect(ITEM_DEFS.T.motion).toBe('bounce');
    expect(ITEM_DEFS.B.motion).toBe('fall');

    const item = createItem();
    spawnItem(item, 'M', 100, 100, () => 0);
    expect(item.vx).toBeCloseTo(ITEM_P_SPEED);
    expect(item.vy).toBeCloseTo(0);

    spawnItem(item, 'B', 100, 100, () => 0);
    expect(item.vx).toBe(0);
    expect(item.vy).toBe(ITEM_B_FALL_SPEED);
  });
});
