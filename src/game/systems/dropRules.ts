/**
 * Item drop rules (AGENTS.md "Weapons" / "Drops").
 *
 * Every destroyed building drops exactly one item.
 *
 * 1. Placement locks win. `BuildingPlacement.drop` is a letter (always that
 *    item) or `{ exclusive, item }`. At battle enter, `resolvePlacementDrops`
 *    draws once per exclusive group from the stage RNG. Members stay in
 *    placement-array order, groups run in sorted key order, and
 *    `floor(rng() * count)` is the member that drops `item`. The others fall
 *    through. Stage 1's `s1-sea-mate` group is B07 then B08, so that single
 *    roll is the coin flip for which sea gun drops M.
 * 2. Otherwise the first matching `DropRule` wins. The default table is
 *    `BUILDING_DROP_P_SHARE` P and the rest B while main power is below
 *    `POWER_MAX`; at max the drop is B and the roll is skipped. A stage or a
 *    difficulty profile may pass its own rule list. Locks still win over it.
 *
 * Wave-table carriers drop whatever their `SpawnGroup.drops` row names.
 */

import type { Rng } from '@/engine/rng';
import { BUILDING_DROP_P_SHARE, POWER_MAX } from '@/game/config';
import type { ItemType } from '@/game/entities/item';
import type { EquippedWeapon } from '@/game/systems/playerWeapons';

/** A letter, or membership in a group that drops `item` for exactly one member. */
export type PlacementDrop = ItemType | { exclusive: string; item: ItemType };

export interface DropContext {
  /** Live main-weapon level at the moment of the kill. */
  mainLevel: number;
  /** Live sub slot. The default table ignores it; a stage rule may read it. */
  sub: EquippedWeapon | null;
  rng: Rng;
}

export interface DropRule {
  item: ItemType;
  when?: (ctx: DropContext) => boolean;
}

/**
 * Default building table. Below POWER_MAX, P with probability
 * BUILDING_DROP_P_SHARE and otherwise B. At POWER_MAX, B, and `when` does
 * not call `rng` (the comparison short-circuits).
 */
export const BUILDING_DROP_RULES: readonly DropRule[] = [
  {
    item: 'P',
    when: ({ mainLevel, rng }) => mainLevel < POWER_MAX && rng() < BUILDING_DROP_P_SHARE,
  },
  { item: 'B' },
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

/**
 * Debug preview of the default table. Does not roll, so a HUD poll cannot
 * change the run. Fixed placement locks are resolved only when that building dies.
 */
export function previewDefaultBuildingDrop(mainLevel: number): 'B' | 'P/B' {
  return mainLevel >= POWER_MAX ? 'B' : 'P/B';
}

function isExclusive(drop: PlacementDrop): drop is { exclusive: string; item: ItemType } {
  return typeof drop !== 'string';
}

/**
 * Run-start lock table. One `rng()` call per exclusive group, none for a
 * plain letter. The same seed always picks the same ids.
 */
export function resolvePlacementDrops(
  placements: readonly { id: string; drop?: PlacementDrop }[],
  rng: Rng
): Map<string, ItemType> {
  const fixed = new Map<string, ItemType>();
  const groups = new Map<string, { id: string; item: ItemType }[]>();
  for (const placement of placements) {
    const drop = placement.drop;
    if (drop === undefined) continue;
    if (!isExclusive(drop)) {
      fixed.set(placement.id, drop);
      continue;
    }
    const list = groups.get(drop.exclusive);
    if (list) list.push({ id: placement.id, item: drop.item });
    else groups.set(drop.exclusive, [{ id: placement.id, item: drop.item }]);
  }
  for (const key of [...groups.keys()].sort()) {
    const members = groups.get(key)!;
    const index = Math.floor(rng() * members.length);
    const chosen = members[index]!;
    fixed.set(chosen.id, chosen.item);
  }
  return fixed;
}

export interface BuildingDropInput {
  id: string;
  mainLevel: number;
  sub: EquippedWeapon | null;
  rng: Rng;
  /** Ids locked for this run. Omit when the stage has no locks. */
  fixed?: ReadonlyMap<string, ItemType>;
  /** Replaces `BUILDING_DROP_RULES` when the stage or difficulty supplies one. */
  rules?: readonly DropRule[];
}

/** The one item a building drops right now. A lock wins before the rule list. */
export function chooseBuildingDrop(input: BuildingDropInput): ItemType {
  const locked = input.fixed?.get(input.id);
  if (locked) return locked;
  return pickDrop(input.rules ?? BUILDING_DROP_RULES, {
    mainLevel: input.mainLevel,
    sub: input.sub,
    rng: input.rng,
  });
}
