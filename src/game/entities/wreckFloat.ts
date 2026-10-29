/**
 * Stage-4 wreck floaters. A prop pool anchored to map cells, not an enemy:
 * no guns, no drop, not in the kill rate. Player bullets and the bomb can
 * destroy one. Body contact does not kill the ship.
 */

import type { Poolable } from '@/engine/pool';
import {
  HIT_FLASH_TIME,
  LOGICAL_H,
  MAP_CROP_X,
  TILE_SIZE,
  WRECK_FLOAT_HIT_RADIUS,
  WRECK_FLOAT_SIZE,
} from '@/game/config';
import type { WreckFloatAnchor } from '@/game/levels/types';
import { layerIndexOf, type BackgroundTrack } from '@/game/maps/track';
import { checkBulletEnemyCollision } from '@/game/systems/collision';

export interface PlacedWreckFloat extends WreckFloatAnchor {
  layer: number;
  origin: number;
}

/** Resolve anchors against the stage track. Throws when `map` is not on it. */
export function placeWreckFloats(
  anchors: readonly WreckFloatAnchor[],
  track: BackgroundTrack
): PlacedWreckFloat[] {
  return anchors.map((anchor) => {
    const layer = layerIndexOf(track, anchor.map);
    if (layer < 0)
      throw new Error(`wreck float ${anchor.id}: map ${anchor.map} is not on the track`);
    return { ...anchor, layer, origin: track.layers[layer]!.origin };
  });
}

/** World scroll at which the cell's bottom edge reaches the top of the screen. */
export function wreckFloatSpawnScroll(anchor: PlacedWreckFloat): number {
  return anchor.origin + anchor.row * TILE_SIZE - LOGICAL_H;
}

/** Sprite center, locked to the cell the same way a building center is. */
export function wreckFloatCenter(
  anchor: PlacedWreckFloat,
  scroll: number
): { x: number; y: number } {
  const local = Math.floor(scroll) - anchor.origin;
  return {
    x: anchor.col * TILE_SIZE - MAP_CROP_X + WRECK_FLOAT_SIZE / 2,
    y: local + LOGICAL_H - anchor.row * TILE_SIZE - WRECK_FLOAT_SIZE / 2,
  };
}

/**
 * Emits each anchor once, when the scroll brings it to the top of the screen.
 * Nothing new spawns from the boss warning on. Floaters already out stay
 * until they are destroyed or leave the bottom.
 */
export class WreckFloatScheduler {
  private readonly queue: PlacedWreckFloat[];
  private next = 0;

  constructor(
    anchors: readonly PlacedWreckFloat[],
    private readonly warningAt: number
  ) {
    this.queue = [...anchors].sort((a, b) => wreckFloatSpawnScroll(a) - wreckFloatSpawnScroll(b));
  }

  reset(): void {
    this.next = 0;
  }

  update(scroll: number, gameTime: number): PlacedWreckFloat[] {
    if (gameTime >= this.warningAt) {
      this.next = this.queue.length;
      return [];
    }
    const out: PlacedWreckFloat[] = [];
    while (
      this.next < this.queue.length &&
      wreckFloatSpawnScroll(this.queue[this.next]!) <= scroll
    ) {
      out.push(this.queue[this.next]!);
      this.next++;
    }
    return out;
  }
}

export interface WreckFloat extends Poolable {
  anchor: PlacedWreckFloat;
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  score: number;
  hitRadius: number;
  hitFlashTimer: number;
  /** Seconds until the bomb shockwave arrives; negative when none is pending. */
  bombHitIn: number;
}

const PLACEHOLDER: PlacedWreckFloat = {
  id: '',
  map: '',
  row: 0,
  col: 0,
  layer: 0,
  origin: 0,
};

export function createWreckFloat(): WreckFloat {
  return {
    active: false,
    anchor: PLACEHOLDER,
    layer: 0,
    x: 0,
    y: 0,
    width: WRECK_FLOAT_SIZE,
    height: WRECK_FLOAT_SIZE,
    hp: 0,
    maxHp: 0,
    score: 0,
    hitRadius: WRECK_FLOAT_HIT_RADIUS,
    hitFlashTimer: 0,
    bombHitIn: -1,

    reset() {
      this.anchor = PLACEHOLDER;
      this.layer = 0;
      this.x = 0;
      this.y = 0;
      this.width = WRECK_FLOAT_SIZE;
      this.height = WRECK_FLOAT_SIZE;
      this.hp = 0;
      this.maxHp = 0;
      this.score = 0;
      this.hitRadius = WRECK_FLOAT_HIT_RADIUS;
      this.hitFlashTimer = 0;
      this.bombHitIn = -1;
    },
  };
}

export function spawnWreckFloat(
  floater: WreckFloat,
  anchor: PlacedWreckFloat,
  scroll: number,
  hp: number,
  score: number
): void {
  const { x, y } = wreckFloatCenter(anchor, scroll);
  floater.anchor = anchor;
  floater.layer = anchor.layer;
  floater.x = x;
  floater.y = y;
  floater.width = WRECK_FLOAT_SIZE;
  floater.height = WRECK_FLOAT_SIZE;
  floater.hp = hp;
  floater.maxHp = hp;
  floater.score = score;
  floater.hitRadius = WRECK_FLOAT_HIT_RADIUS;
  floater.hitFlashTimer = 0;
  floater.bombHitIn = -1;
}

/** Follow the scroll. True once the sprite has left the bottom of the screen. */
export function updateWreckFloat(floater: WreckFloat, dt: number, scroll: number): boolean {
  const pos = wreckFloatCenter(floater.anchor, scroll);
  floater.x = pos.x;
  floater.y = pos.y;
  if (floater.hitFlashTimer > 0) floater.hitFlashTimer = Math.max(0, floater.hitFlashTimer - dt);
  return floater.y - floater.height / 2 > LOGICAL_H;
}

/** Apply damage. True on the hit that destroys it. */
export function damageWreckFloat(floater: WreckFloat, damage: number): boolean {
  floater.hp -= damage;
  floater.hitFlashTimer = HIT_FLASH_TIME;
  return floater.hp <= 0;
}

/** Player bullet rectangle vs the hit circle. */
export function bulletHitsWreckFloat(
  floater: WreckFloat,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return checkBulletEnemyCollision(bx, by, bw, bh, floater.x, floater.y, floater.hitRadius);
}
