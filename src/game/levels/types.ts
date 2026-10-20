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
  | { kind: 'ground'; vx?: number };

export type Fire =
  | { kind: 'none' }
  | {
      kind: 'aimed1' | 'aimed3burst' | 'missile' | 'aimed_fast3' | 'fixed2';
      interval?: number;
      firstDelay?: number;
      maxShots?: number;
      atY?: number;
    }
  | { kind: 'fan3' | 'fan5' | 'fan7wide'; spread: number; interval: number; firstDelay?: number }
  | { kind: 'ring8' | 'ring16'; interval: number; rotStep: number };

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
  death: {
    duration: number;
    explosions: number;
  };
}

export interface StageData {
  stage: number;
  scrollSpeed: number;
  warningAt: number;
  waves: Wave[];
  boss: BossConfig;
}
