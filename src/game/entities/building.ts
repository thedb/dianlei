/**
 * Destructible buildings (design §6.1.1, wave table §4.7).
 * Fixed to the tile map: position comes straight from the world scroll, so a
 * building moves in whole pixels with the tiles. Destroyed ones stay as a wreck
 * with no hitbox until they scroll off.
 */

import type { Poolable } from '@/engine/pool';
import type { EquippedWeapon } from '@/game/systems/playerWeapons';
import type { ItemType } from '@/game/entities/item';
import type { BuildingPlacement, BuildingType, Fire, StageSection } from '@/game/levels/types';
import type { BulletSpawner } from '@/game/entities/enemyBullet';
import { executeFirePattern, fireInterval } from '@/game/systems/danmaku';
import { BUILDING_DROP_RULES, pickDrop, type DropRule } from '@/game/systems/dropRules';
import { TileId, mapLayerSpecs, type TerrainGrids } from '@/game/art/tiles';
import {
  LOGICAL_H,
  MAP_CROP_X,
  TILE_SIZE,
  HIT_FLASH_TIME,
  TURRET_TURN_RATE,
  SCORE_BUILDING,
  BUILDING_HP,
  SEA_GUN_FIRE_INTERVAL,
  BUILDING_FIRE_MIN_Y,
  BUILDING_HIT_INSET,
  BUILDING_TANK_CLEARANCE,
} from '@/game/config';

export type BuildingTerrain = 'land' | 'water';

export interface BuildingSpec {
  /** Footprint in tiles */
  cols: number;
  rows: number;
  terrain: BuildingTerrain;
  /** Gun on the roof. Barrel patterns track the player at TURRET_TURN_RATE. */
  fire?: Fire;
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
};

export function buildingSize(type: BuildingType): { width: number; height: number } {
  const spec = BUILDING_SPECS[type];
  return { width: spec.cols * TILE_SIZE, height: spec.rows * TILE_SIZE };
}

/**
 * Tiles a land building may cover: open grass, scrub, trees, bare dirt and
 * concrete apron. Roads, water, edge rocks and every decor tile (barracks,
 * bunker, hangar, pads, radar) are excluded so decor stays untouched.
 */
const LAND_TILES: ReadonlySet<TileId> = new Set<TileId>([
  TileId.grass,
  TileId.grassDark,
  TileId.grassB,
  TileId.bush,
  TileId.tree,
  TileId.treePine,
  TileId.dirt,
  TileId.concrete,
  TileId.concreteDark,
]);

const WATER_TILES: ReadonlySet<TileId> = new Set<TileId>([
  TileId.water,
  TileId.waterB,
  TileId.shallow,
]);

export function footprintTileOk(terrain: BuildingTerrain, id: TileId): boolean {
  return terrain === 'land' ? LAND_TILES.has(id) : WATER_TILES.has(id);
}

/** True when every tile under the footprint suits the building's terrain. */
export function validateBuildingFootprint(grids: TerrainGrids, p: BuildingPlacement): boolean {
  const spec = BUILDING_SPECS[p.type];
  const grid = grids[p.section];
  for (let r = p.row; r < p.row + spec.rows; r++) {
    const line = grid[r];
    if (!line) return false;
    for (let c = p.col; c < p.col + spec.cols; c++) {
      const id = line[c];
      if (id === undefined || !footprintTileOk(spec.terrain, id)) return false;
    }
  }
  return true;
}

function sectionOrigin(section: StageSection): number {
  return mapLayerSpecs()[section].origin;
}

/** World scroll at which the footprint's bottom edge reaches the top of the screen. */
export function buildingSpawnScroll(p: BuildingPlacement): number {
  return sectionOrigin(p.section) + p.row * TILE_SIZE - LOGICAL_H;
}

/** World scroll at which the footprint's top edge leaves the bottom of the screen. */
export function buildingExitScroll(p: BuildingPlacement): number {
  return sectionOrigin(p.section) + (p.row + BUILDING_SPECS[p.type].rows) * TILE_SIZE;
}

/** Footprint center on screen. Whole pixels, locked to the tile blit. */
export function buildingCenter(p: BuildingPlacement, scroll: number): { x: number; y: number } {
  const { width, height } = buildingSize(p.type);
  const local = Math.floor(scroll) - sectionOrigin(p.section);
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
  private readonly queue: BuildingPlacement[];
  private next = 0;

  constructor(
    placements: readonly BuildingPlacement[],
    private readonly warningAt: number
  ) {
    this.queue = [...placements].sort((a, b) => buildingSpawnScroll(a) - buildingSpawnScroll(b));
  }

  reset(): void {
    this.next = 0;
  }

  update(scroll: number, gameTime: number): BuildingPlacement[] {
    if (gameTime >= this.warningAt) {
      this.next = this.queue.length;
      return [];
    }
    const out: BuildingPlacement[] = [];
    while (this.next < this.queue.length && buildingSpawnScroll(this.queue[this.next]!) <= scroll) {
      out.push(this.queue[this.next]!);
      this.next++;
    }
    return out;
  }
}

export interface Building extends Poolable {
  placement: BuildingPlacement;
  type: BuildingType;
  section: StageSection;
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

const PLACEHOLDER: BuildingPlacement = {
  id: '',
  type: 'pillbox',
  section: 'ground',
  row: 0,
  col: 0,
};

export function createBuilding(): Building {
  return {
    active: false,
    placement: PLACEHOLDER,
    type: 'pillbox',
    section: 'ground',
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
      this.section = 'ground';
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
  p: BuildingPlacement,
  scroll: number,
  hp: number = BUILDING_HP
): void {
  const { width, height } = buildingSize(p.type);
  const { x, y } = buildingCenter(p, scroll);
  b.placement = p;
  b.type = p.type;
  b.section = p.section;
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
    const desired = Math.atan2(playerY - b.y, playerX - b.x);
    const maxStep = ((TURRET_TURN_RATE * Math.PI) / 180) * dt;
    const diff = wrapPi(desired - b.aimAngle);
    b.aimAngle = wrapPi(b.aimAngle + Math.max(-maxStep, Math.min(maxStep, diff)));

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

export type BuildingDrop = ItemType;

/**
 * The one item a destroyed building drops (`BUILDING_DROP_RULES`).
 * Pass the live sub slot (`state.sub` at the moment of the kill). A copy taken
 * earlier in the run is stale: equipping or leveling T must change the next drop.
 * No sub, level 0, or T below HOMING_MAX_LEVEL → T. Homing already at max → B.
 * Buildings never drop P. Wave-table carriers still drop only P and B.
 */
export function chooseBuildingDrop(
  sub: EquippedWeapon | null,
  rules: readonly DropRule[] = BUILDING_DROP_RULES
): BuildingDrop {
  return pickDrop(rules, { sub });
}
