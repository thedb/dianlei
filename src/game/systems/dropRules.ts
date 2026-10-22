/**
 * Item drop rules (AGENTS.md "Weapons").
 *
 * Buildings always drop exactly one item. The first rule whose `when` matches
 * the live loadout wins; a rule without `when` is the fallback. Wave-table
 * carriers drop whatever their `SpawnGroup.drops` row names, so they need no
 * rule here.
 *
 * A stage may pass its own rule list (`StageData.buildingDrops`).
 */

import { HOMING_MAX_LEVEL } from '@/game/config';
import type { ItemType } from '@/game/entities/item';
import { WEAPONS, type EquippedWeapon } from '@/game/systems/playerWeapons';

export interface DropContext {
  /** Live sub slot at the moment of the kill. */
  sub: EquippedWeapon | null;
}

export interface DropRule {
  item: ItemType;
  when?: (ctx: DropContext) => boolean;
}

/** T until homing is maxed, then B. Buildings never drop P. */
export const BUILDING_DROP_RULES: readonly DropRule[] = [
  {
    item: 'B',
    when: ({ sub }) =>
      sub !== null && sub.id === WEAPONS.homing.id && sub.level >= HOMING_MAX_LEVEL,
  },
  { item: 'T' },
];

/** First matching rule's item. Falls back to the last rule when none match. */
export function pickDrop(rules: readonly DropRule[], ctx: DropContext): ItemType {
  for (const rule of rules) {
    if (!rule.when || rule.when(ctx)) return rule.item;
  }
  const last = rules[rules.length - 1];
  if (!last) throw new Error('drop rule list is empty');
  return last.item;
}
