/**
 * Destructible buildings (design §6.1.1, wave table §4.7).
 * Fixed to the tile map: position comes straight from the world scroll, so a
 * building moves in whole pixels with the tiles. Destroyed ones stay as a wreck
 * with no hitbox until they scroll off.
 */

import type { Poolable } from '@/engine/pool';
import type { BuildingPlacement, BuildingType, Fire, WaveDifficulty } from '@/game/levels/types';
import type { BulletSpawner } from '@/game/entities/enemyBullet';
import { executeFirePattern, fireAimsDown, fireInterval } from '@/game/systems/danmaku';
import { footprintOn } from '@/game/maps/terrain';
import { layerIndexOf, type BackgroundTrack } from '@/game/maps/track';
import type { TileGrid } from '@/game/maps/types';
import {
  LOGICAL_H,
  MAP_CROP_X,
  TILE_SIZE,
  HIT_FLASH_TIME,
  TURRET_TURN_RATE,
  SCORE_BUILDING,
  BUILDING_HP,
  CRUISER_GUN_BULLET_SPEED,
  CRUISER_GUN_FIRE_INTERVAL,
  CRUISER_GUN_GAP,
  CRUISER_GUN_HP,
  SEA_GUN_FIRE_INTERVAL,
  BUILDING_FIRE_MIN_Y,
  BUILDING_HIT_INSET,
  BUILDING_TANK_CLEARANCE,
} from '@/game/config';

/** Terrain the whole footprint must stand on (`maps/terrain.ts`). */
export type BuildingTerrain = 'land' | 'water';

export interface BuildingSpec {
  /** Footprint in tiles */
  cols: number;
  rows: number;
  terrain: BuildingTerrain;
  /**
   * Body HP before `scaleHp`. Omit to use `BUILDING_HP`.
   * Cruiser guns set this so the global building HP stays put.
   */
  hp?: number;
  /** Gun on the roof. A pattern that aims down does not track the player. */
  fire?: Fire;
}

/** Authored body HP for this building, before the difficulty scale. */
export function buildingMaxHp(type: BuildingType): number {
  return BUILDING_SPECS[type].hp ?? BUILDING_HP;
}

/**
 * Placements this difficulty actually fields. Omit `difficulty` and every
 * placement is kept (stage tests that do not filter). A written
 * `difficulties` list is exclusive. Call this before the scheduler.
 */
export function placementsForDifficulty(
  placements: readonly BuildingPlacement[],
  difficulty?: WaveDifficulty
): BuildingPlacement[] {
  if (!difficulty) return [...placements];
  return placements.filter((p) => !p.difficulties || p.difficulties.includes(difficulty));
}

export const BUILDING_SPECS: Record<BuildingType, BuildingSpec> = {
  pillbox: { cols: 2, rows: 2, terrain: 'land' },
  fuel_depot: { cols: 3, rows: 2, terrain: 'land' },
  radar_station: { cols: 2, rows: 2, terrain: 'land' },
  sea_gun: {
    cols: 2,
    rows: 2,
    terrain: 'water',
    fire: { kind: 'fixed2', interval: SEA_GUN_FIRE_INTERVAL },
  },
  /** Stage-4 cruiser secondary. Twin barrels locked down; the deck tile draws no barrel. */
  cruiser_gun: {
    cols: 2,
    rows: 2,
    terrain: 'water',
    hp: CRUISER_GUN_HP,
    fire: {
      kind: 'pattern',
      pattern: {
        shape: 'parallel',
        count: 2,
        gap: CRUISER_GUN_GAP,
        aim: 'down',
        bullet: 'small',
        speed: CRUISER_GUN_BULLET_SPEED,
      },
      interval: CRUISER_GUN_FIRE_INTERVAL,
    },
  },
};

export function buildingSize(type: BuildingType): { width: number; height: number } {
  const spec = BUILDING_SPECS[type];
  return { width: spec.cols * TILE_SIZE, height: spec.rows * TILE_SIZE };
}

/**
 * A placement tied to the track it scrolls on: `layer` indexes
 * `track.layers`, `origin` is that layer's world-scroll origin.
 */
export interface PlacedBuilding extends BuildingPlacement {
  layer: number;
  origin: number;
}

/** Resolve a stage's placements against its track. Throws on a map the track does not use. */
export function placeBuildings(
  placements: readonly BuildingPlacement[],
  track: BackgroundTrack
): PlacedBuilding[] {
  return placements.map((p) => {
    const layer = layerIndexOf(track, p.map);
    if (layer < 0) throw new Error(`building ${p.id}: map ${p.map} is not on the track`);
    return { ...p, layer, origin: track.layers[layer]!.origin };
  });
}

/**
 * True when every cell under the footprint has the building's terrain: land
 * buildings on open land (no road, decor, or rock), sea buildings on water.
 */
export function validateBuildingFootprint(grid: TileGrid, p: BuildingPlacement): boolean {
  const spec = BUILDING_SPECS[p.type];
  return footprintOn(grid, spec.terrain, p.row, p.col, spec.rows, spec.cols);
}

/** World scroll at which the footprint's bottom edge reaches the top of the screen. */
export function buildingSpawnScroll(p: PlacedBuilding): number {
  return p.origin + p.row * TILE_SIZE - LOGICAL_H;
}

/** World scroll at which the footprint's top edge leaves the bottom of the screen. */
export function buildingExitScroll(p: PlacedBuilding): number {
  return p.origin + (p.row + BUILDING_SPECS[p.type].rows) * TILE_SIZE;
}

/** Footprint center on screen. Whole pixels, locked to the tile blit. */
export function buildingCenter(p: PlacedBuilding, scroll: number): { x: number; y: number } {
  const { width, height } = buildingSize(p.type);
  const local = Math.floor(scroll) - p.origin;
  return {
    x: p.col * TILE_SIZE - MAP_CROP_X + width / 2,
    y: local + LOGICAL_H - p.row * TILE_SIZE - height / 2,
  };
}

/**
 * Emits each placement once, when the world scroll brings it to the top of the
 * screen. Nothing spawns from the boss warning on.
 */
export class BuildingScheduler {
  private readonly queue: PlacedBuilding[];
  private next = 0;

  constructor(
    placements: readonly PlacedBuilding[],
    private readonly warningAt: number
  ) {
    this.queue = [...placements].sort((a, b) => buildingSpawnScroll(a) - buildingSpawnScroll(b));
  }

  reset(): void {
    this.next = 0;
  }

  update(scroll: number, gameTime: number): PlacedBuilding[] {
    if (gameTime >= this.warningAt) {
      this.next = this.queue.length;
      return [];
    }
    const out: PlacedBuilding[] = [];
    while (this.next < this.queue.length && buildingSpawnScroll(this.queue[this.next]!) <= scroll) {
      out.push(this.queue[this.next]!);
      this.next++;
    }
    return out;
  }
}

export interface Building extends Poolable {
  placement: PlacedBuilding;
  type: BuildingType;
  /** Track layer it rides; its alpha is the building's. */
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  score: number;
  wrecked: boolean;
  hitFlashTimer: number;
  /** Barrel angle for the sea gun, radians (0 = right, +y down). */
  aimAngle: number;
  fireTimer: number;
  shotsFired: number;
  /** Seconds until the bomb shockwave reaches this building; negative when none is pending. */
  bombHitIn: number;
}

const PLACEHOLDER: PlacedBuilding = {
  id: '',
  type: 'pillbox',
  map: '',
  row: 0,
  col: 0,
  layer: 0,
  origin: 0,
};

export function createBuilding(): Building {
  return {
    active: false,
    placement: PLACEHOLDER,
    type: 'pillbox',
    layer: 0,
    x: 0,
    y: 0,
    width: 32,
    height: 32,
    hp: BUILDING_HP,
    score: SCORE_BUILDING,
    wrecked: false,
    hitFlashTimer: 0,
    aimAngle: Math.PI / 2,
    fireTimer: 0,
    shotsFired: 0,
    bombHitIn: -1,

    reset() {
      this.placement = PLACEHOLDER;
      this.type = 'pillbox';
      this.layer = 0;
      this.x = 0;
      this.y = 0;
      this.width = 32;
      this.height = 32;
      this.hp = BUILDING_HP;
      this.score = SCORE_BUILDING;
      this.wrecked = false;
      this.hitFlashTimer = 0;
      this.aimAngle = Math.PI / 2;
      this.fireTimer = 0;
      this.shotsFired = 0;
      this.bombHitIn = -1;
    },
  };
}

export function spawnBuilding(
  b: Building,
  p: PlacedBuilding,
  scroll: number,
  hp: number = BUILDING_HP
): void {
  const { width, height } = buildingSize(p.type);
  const { x, y } = buildingCenter(p, scroll);
  b.placement = p;
  b.type = p.type;
  b.layer = p.layer;
  b.x = x;
  b.y = y;
  b.width = width;
  b.height = height;
  b.hp = hp;
  b.score = SCORE_BUILDING;
  b.wrecked = false;
  b.hitFlashTimer = 0;
  b.aimAngle = Math.PI / 2;
  b.fireTimer = 0;
  b.shotsFired = 0;
  b.bombHitIn = -1;
}

function wrapPi(rad: number): number {
  let d = rad;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Follow the scroll, track and fire (sea gun only). Returns true once the
 * footprint has left the bottom of the screen.
 * `fireEnabled` is false during the warning.
 */
export function updateBuilding(
  b: Building,
  dt: number,
  scroll: number,
  playerX: number,
  playerY: number,
  spawner: BulletSpawner,
  fireEnabled: boolean
): boolean {
  const pos = buildingCenter(b.placement, scroll);
  b.x = pos.x;
  b.y = pos.y;
  if (b.hitFlashTimer > 0) b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);

  const fire = BUILDING_SPECS[b.type].fire;
  if (!b.wrecked && fire) {
    if (fireAimsDown(fire)) {
      b.aimAngle = Math.PI / 2;
    } else {
      const desired = Math.atan2(playerY - b.y, playerX - b.x);
      const maxStep = ((TURRET_TURN_RATE * Math.PI) / 180) * dt;
      const diff = wrapPi(desired - b.aimAngle);
      b.aimAngle = wrapPi(b.aimAngle + Math.max(-maxStep, Math.min(maxStep, diff)));
    }

    const top = b.y - b.height / 2;
    if (fireEnabled && top >= BUILDING_FIRE_MIN_Y && b.y <= LOGICAL_H) {
      const interval = fireInterval(fire);
      b.fireTimer += dt;
      if (b.fireTimer >= interval) {
        b.fireTimer -= interval;
        b.shotsFired++;
        executeFirePattern(fire, b.x, b.y, playerX, playerY, spawner, { aimAngle: b.aimAngle });
      }
    }
  }

  return b.y - b.height / 2 > LOGICAL_H;
}

/** Apply damage. Returns true on the hit that turns it into a wreck. */
export function damageBuilding(b: Building, damage: number): boolean {
  if (b.wrecked) return false;
  b.hp -= damage;
  b.hitFlashTimer = HIT_FLASH_TIME;
  if (b.hp > 0) return false;
  b.wrecked = true;
  b.hitFlashTimer = 0;
  return true;
}

/** Player bullet rectangle vs the inset footprint. Wrecks never hit. */
export function bulletHitsBuilding(
  b: Building,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  if (b.wrecked) return false;
  const halfW = b.width / 2 - BUILDING_HIT_INSET;
  const halfH = b.height / 2 - BUILDING_HIT_INSET;
  return Math.abs(bx - b.x) < halfW + bw / 2 && Math.abs(by - b.y) < halfH + bh / 2;
}

/** Any part of the footprint is on screen. */
export function buildingOnScreen(b: Building): boolean {
  return b.y + b.height / 2 > 0 && b.y - b.height / 2 < LOGICAL_H;
}

/** Intact buildings keep tank centers half a tank outside the footprint. */
export function buildingBlocksTank(b: Building, x: number, y: number): boolean {
  if (b.wrecked) return false;
  return (
    Math.abs(x - b.x) < b.width / 2 + BUILDING_TANK_CLEARANCE &&
    Math.abs(y - b.y) < b.height / 2 + BUILDING_TANK_CLEARANCE
  );
}
