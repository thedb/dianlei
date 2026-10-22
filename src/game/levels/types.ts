/**
 * Stage/level data types from wave table §8.1
 */

export type EnemyType =
  'small' | 'medium' | 'interceptor' | 'bomber' | 'drone' | 'tank' | 'turret2' | 'missile_car';

export type MoveKind =
  | 'straight'
  | 'sine'
  | 'v_dive'
  | 'cross'
  | 'hover'
  | 'side_arc'
  | 'orbit'
  | 'slow_push'
  | 'ground';

/**
 * How a ground unit enters.
 * `top` scrolls in with the map. Tanks also use the four side and corner entries.
 */
export type GroundEntry = 'top' | 'left' | 'right' | 'bottomLeft' | 'bottomRight';

export type FireKind =
  | 'none'
  | 'aimed1'
  | 'aimed3burst'
  | 'fan3'
  | 'fan5'
  | 'fan7wide'
  | 'ring8'
  | 'ring16'
  | 'fixed2'
  | 'missile'
  | 'aimed_fast3'
  | 'spiral'
  | 'laser_sweep';

export type Move =
  | { kind: 'straight'; speed: number; angle?: number }
  | { kind: 'sine'; vy: number; amp: number; period: number }
  | { kind: 'v_dive'; speed: number; stopY: number }
  | { kind: 'cross'; from: 'topLeft' | 'topRight'; speed: number }
  | { kind: 'hover'; stopY: number; hold: number }
  | { kind: 'side_arc'; side: 'left' | 'right'; y0: number; speed: number }
  | { kind: 'orbit'; anchor: { x: number; y: number }; r: number; period: number; hold: number }
  | { kind: 'slow_push'; stopY: number; hold: number }
  | { kind: 'ground'; vx?: number; entry?: GroundEntry };

export type Fire =
  | { kind: 'none' }
  | {
      kind: 'aimed1' | 'aimed3burst' | 'missile' | 'aimed_fast3' | 'fixed2';
      interval?: number;
      firstDelay?: number;
      maxShots?: number;
      atY?: number;
      /** Flight speed in pixels/second. Omit to use the kind's default. */
      speed?: number;
    }
  | { kind: 'fan3' | 'fan5' | 'fan7wide'; spread: number; interval: number; firstDelay?: number }
  | { kind: 'ring8' | 'ring16'; interval: number; rotStep: number }
  | { kind: 'spiral'; interval: number; arms: number; rotStep: number; speed?: number };

export interface SpawnDrop {
  index: number;
  item: 'P' | 'B';
}

export interface SpawnGroup {
  enemy: EnemyType;
  count: number;
  xs: number[];
  y?: number;
  interval?: number;
  move: Move;
  fire: Fire;
  fireOnly?: number[];
  hp?: number;
  score?: number;
  drops?: SpawnDrop[];
  /** Extra delay before this group's first spawn, added on top of the wave time. */
  delay?: number;
  /** Added to each ship's first-shot delay, multiplied by its index in the group. */
  fireStagger?: number;
}

export type StageSection = 'ground' | 'coast' | 'base';

export interface Wave {
  id: string;
  t: number;
  section: StageSection;
  mvp: boolean | 'partial';
  condition?: 'powerBelowMax';
  groups: SpawnGroup[];
}

export type BossPartId = 'turretL' | 'turretR' | 'core';

export interface BossPart {
  id: BossPartId;
  offset: { x: number; y: number };
  radius: number;
  hp: number;
  score: number;
  phase: 1 | 2;
}

export interface LaserConfig {
  every: number;
  telegraph: number;
  sweep: number;
  fromDeg: number;
  toDeg: number;
  width: number;
  hitWidth: number;
}

/**
 * Hard-only extra HP segment, plus the spiral ↔ aimed pattern.
 * Every difficulty plays that pattern in phase 2. Hard phase 3 plays
 * `BossConfig.phase2`'s ring and laser on this segment's HP.
 */
export interface BossPhase3Config {
  hp: number;
  /** Invulnerable beat after the phase-2 core breaks, before the ring and laser. */
  transition: number;
  /** Seconds on spiral, then the same on aimed, then repeat. Phase 2. */
  patternHold: number;
  spiral: { kind: 'spiral'; interval: number; arms: number; rotStep: number; speed: number };
  aimed: { kind: 'aimed_fast3'; interval: number; speed: number };
}

export interface BossConfig {
  enterAt: number;
  enterDuration: number;
  parkY: number;
  drift: { amp: number; period: number };
  parts: BossPart[];
  phase1: {
    turretL: Fire;
    turretR: Fire;
    hull: Fire;
    survivorRateMul: number;
  };
  transition: {
    duration: number;
    bulletsToScore: number;
  };
  phase2: {
    ring: Fire;
    aimed: Fire;
    laser: LaserConfig;
    enrageAtHpRatio: number;
    enrage: {
      ringInterval: number;
      laserEvery: number;
      sweep: number;
    };
  };
  /** Present in the stage data. Only a hard run arms it. */
  phase3?: BossPhase3Config;
  death: {
    duration: number;
    explosions: number;
  };
}

export type BuildingType = 'pillbox' | 'fuel_depot' | 'radar_station' | 'sea_gun';

/**
 * A destructible building fixed to the tile map (wave table §4.7).
 * `row` is the lowest map row of the footprint (rows grow toward the top of the
 * screen), `col` the leftmost column. Both index the section's own tile grid.
 */
export interface BuildingPlacement {
  id: string;
  type: BuildingType;
  section: StageSection;
  row: number;
  col: number;
}

export interface StageData {
  stage: number;
  scrollSpeed: number;
  warningAt: number;
  waves: Wave[];
  buildings: BuildingPlacement[];
  boss: BossConfig;
}
