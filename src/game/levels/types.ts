/**
 * Stage/level data types from wave table §8.1
 */

import type { PatternSpec } from '@/game/systems/danmaku';
import type { DropRule, PlacementDrop } from '@/game/systems/dropRules';

export type { EnemyType } from '@/game/entities/enemyDefs';
import type { EnemyType } from '@/game/entities/enemyDefs';

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

/** Shot timing shared by every non-ring fire. */
interface ShotTiming {
  interval?: number;
  firstDelay?: number;
  maxShots?: number;
  atY?: number;
  /** Flight speed in pixels/second. Omit to use the pattern's default. */
  speed?: number;
}

/**
 * How a shooter fires. Named kinds are rows in `FIRE_PRESETS`
 * (`systems/danmaku.ts`); `pattern` carries its own parameters.
 */
export type Fire =
  | { kind: 'none' }
  | ({ kind: 'aimed1' | 'aimed3burst' | 'missile' | 'aimed_fast3' | 'fixed2' } & ShotTiming)
  | { kind: 'fan3' | 'fan5' | 'fan7wide'; spread: number; interval: number; firstDelay?: number }
  | { kind: 'ring8' | 'ring16'; interval: number; rotStep: number }
  | { kind: 'spiral'; interval: number; arms: number; rotStep: number; speed?: number }
  | ({ kind: 'pattern'; pattern: PatternSpec; spread?: number; rotStep?: number } & ShotTiming);

export type FireKind = Fire['kind'];

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

/** Wave-table section a wave belongs to (wave table §1.1). A label only; scenery comes from `StageData.maps`. */
export type StageSection = 'ground' | 'coast' | 'base';

/** One map in a stage's pre-boss run. */
export interface StageMapEntry {
  /** Map registry id (`maps/registry.ts`). */
  map: string;
  /** Handover time (s): this map blends in around here. The first entry is at 0. */
  at: number;
}

/**
 * Which map assets a stage scrolls through and when. `run` plays from the
 * start to the warning. `boss` is the arena the warning hands off to: a tile
 * map (approach strip, then a seamless loop) or a starfield on a real space
 * stage. Stage 1's boss is land, not 宇宙A.
 */
export interface StageMaps {
  run: readonly StageMapEntry[];
  boss: string;
}

/**
 * When a story line is shown.
 * `mid` and `cutscene` are reserved for later beats (s4_wreck, s4_ufo, s5)
 * and are not fired yet — `activeCaption` draws nothing for them.
 */
export type CaptionAt = 'open' | 'clear' | 'mid' | 'cutscene';

/** One story cue. The Chinese line lives in `story/captions.ts`, keyed by `id`. */
export interface StageCaption {
  id: string;
  at: CaptionAt;
}

export interface Wave {
  id: string;
  t: number;
  section: StageSection;
  mvp: boolean | 'partial';
  condition?: 'powerBelowMax';
  groups: SpawnGroup[];
}

export interface BossPartDef {
  id: string;
  offset: { x: number; y: number };
  radius: number;
  hp: number;
  /** Paid when the part dies for good (not when a later phase revives it). */
  score: number;
  /** Baked sprite drawn over the hull. Omit for parts that are only a glow. */
  sprite?: string;
  /** `fall`: drops off with a medium blast and a small shake when destroyed. */
  onDestroy?: 'fall';
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

/** A gun fixed to a part (or the hull) that fires one `Fire` on its own clock. */
export interface BossGunAttack {
  kind: 'gun';
  id: string;
  /** Part id, or `hull` for the boss center. A dead part's gun stops. */
  from: string;
  fire: Fire;
  /** Interval while the phase is enraged. */
  enrageInterval?: number;
  /** Hold fire while this phase's laser is sweeping. */
  pauseWhileLaserSweeps?: boolean;
  /** Fire only while this phase's laser is idle. */
  onlyWhileLaserIdle?: boolean;
  /** A tick in which this gun fires skips the attacks listed after it. */
  yieldOnFire?: boolean;
}

/** Steps fire in turn, each for `hold` seconds, sharing one rotation. */
export interface BossCycleAttack {
  kind: 'cycle';
  id: string;
  from: string;
  hold: number;
  steps: { label: string; fire: Fire }[];
}

export interface BossLaserAttack {
  kind: 'laser';
  id: string;
  from: string;
  laser: LaserConfig;
  /** Cooldown and sweep time while the phase is enraged. */
  enraged: { every: number; sweep: number };
}

export type BossAttack = BossGunAttack | BossCycleAttack | BossLaserAttack;

/**
 * One fight phase. Phases run in order; a gated phase runs only when the run's
 * difficulty profile lists its gate (`DifficultyProfile.bossGates`).
 */
export interface BossPhaseDef {
  /** Runtime phase name while fighting (`boss.phase`). */
  id: string;
  /** Parts that must die to leave the phase. Bullets and bombs hit only these. */
  targets: string[];
  /** HP (before the difficulty scale) for targets revived from an earlier phase. */
  segmentHp?: number;
  /** Invulnerable beat before the phase, named for `boss.phase`. The first phase uses the entry. */
  transition?: { id: string; duration: number };
  gate?: string;
  attacks: BossAttack[];
  /** Enrage once the first target drops to this fraction of its max HP. */
  enrageAtHpRatio?: number;
  /** When one target dies, the others fire this much faster (1.25 → 0.8× interval). */
  survivorRateMul?: number;
  look: {
    hull: 'closed' | 'open';
    /** Code-drawn pulse on a part while the phase (or its transition) runs. */
    glow?: { part: string; color: 'magenta' | 'yellow' };
  };
  /** `extra` phases get their own slot on the HP bar (Hard phase 3). */
  bar: 'main' | 'extra';
}

export interface BossDef {
  id: string;
  /** Key into the boss art registry (`art/bossSprite.ts`). */
  art: string;
  enterAt: number;
  enterDuration: number;
  /** Entry starts at (anchorX, enterY) and lands on parkY. */
  anchorX: number;
  enterY: number;
  parkY: number;
  drift: { amp: number; period: number };
  hull: { w: number; h: number };
  parts: BossPartDef[];
  phases: BossPhaseDef[];
  /** Score per enemy bullet converted when a phase breaks. */
  bulletsToScore: number;
  death: {
    duration: number;
    explosions: number;
    /** Blast offsets from the hull center, cycled. */
    offsets: readonly (readonly [number, number])[];
  };
}

export type BuildingType = 'pillbox' | 'fuel_depot' | 'radar_station' | 'sea_gun';

/**
 * A destructible building fixed to the tile map (wave table §4.7).
 * `row` is the lowest map row of the footprint (rows grow toward the top of the
 * screen), `col` the leftmost column. Both index the grid of `map`, which must
 * be in the stage's `maps.run`.
 */
export interface BuildingPlacement {
  id: string;
  type: BuildingType;
  map: string;
  row: number;
  col: number;
  /**
   * Locked drop for this placement. A letter always drops that item.
   * `{ exclusive, item }` joins a group: battle enter draws one member with
   * the stage RNG, and only that member drops `item`. Omit to use the
   * stage's default building-drop rules.
   */
  drop?: PlacementDrop;
}

/**
 * One risk crate (P20b). The stage lists every slot. The difficulty profile
 * keeps a prefix of that list, in this order, not in time order.
 */
export interface RiskCrateSlot {
  id: string;
  /** Stage time in seconds, from the start of the run. */
  t: number;
  /** X when the sway is at zero. Fixed; spawning does not roll it. */
  x: number;
}

export interface StageData {
  /** Registry key (`levels/registry.ts`). */
  id: string;
  /** Shown in the STAGE intro banner and the pause menu. */
  label: string;
  stage: number;
  scrollSpeed: number;
  warningAt: number;
  maps: StageMaps;
  waves: Wave[];
  buildings: BuildingPlacement[];
  /**
   * Risk crates, in difficulty-prefix order. Omit for none. Easy keeps 0,
   * Medium the first `riskCrateCount`, Hard the longer prefix. Times may be
   * out of order; the scheduler sorts its own copy.
   */
  riskCrates?: readonly RiskCrateSlot[];
  boss: BossDef;
  /** Building drop rules. Omit for `BUILDING_DROP_RULES`. */
  buildingDrops?: readonly DropRule[];
  /**
   * Story lines for this stage. `open` after the clock starts, `clear` when
   * the boss is beaten. Omit to stay silent. Later triggers are stubs.
   */
  captions?: readonly StageCaption[];
}
