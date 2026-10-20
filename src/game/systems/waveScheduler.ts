/**
 * Wave scheduler system
 * Spawns enemies according to wave data from stage1.ts
 */

import type { Wave, EnemyType, Move, Fire, SpawnGroup } from '@/game/levels/types';
import { stage1 } from '@/game/levels/stage1';
import { ENEMY_STATS } from '@/game/entities/enemy';

export interface WaveSchedulerConfig {
  mvpOnly: boolean;
}

export interface SpawnRequest {
  type: EnemyType;
  x: number;
  y: number;
  move: Move;
  fire: Fire;
  canFire: boolean;
  drop: 'P' | 'B' | null;
  hp: number | undefined;
  score: number | undefined;
}

interface PendingSpawn {
  waveId: string;
  groupIndex: number;
  spawnIndex: number;
  time: number;
  request: SpawnRequest;
}

export class WaveScheduler {
  private waves: Wave[];
  private readonly mvpOnly: boolean;
  private currentWaveIndex: number = 0;
  private pendingSpawns: PendingSpawn[] = [];
  private waveTimer: number = 0;
  private spawnedCount: number = 0;
  private killedCount: number = 0;
  private stageComplete: boolean = false;
  private powerLevel: number = 1;

  constructor(config: WaveSchedulerConfig) {
    this.mvpOnly = config.mvpOnly;
    if (config.mvpOnly) {
      this.waves = stage1.waves.filter((w) => w.mvp === true || w.mvp === 'partial');
    } else {
      this.waves = stage1.waves;
    }
  }

  /** Reset scheduler to beginning */
  reset(): void {
    this.currentWaveIndex = 0;
    this.pendingSpawns = [];
    this.waveTimer = 0;
    this.spawnedCount = 0;
    this.killedCount = 0;
    this.stageComplete = false;
    this.powerLevel = 1;
  }

  /** Set current player power level (for conditional waves) */
  setPowerLevel(level: number): void {
    this.powerLevel = level;
  }

  /** Record enemy kill */
  recordKill(): void {
    this.killedCount++;
  }

  /** Get kill rate percentage */
  getKillRate(): number {
    if (this.spawnedCount === 0) return 0;
    return (this.killedCount / this.spawnedCount) * 100;
  }

  /** Check if all waves are done */
  isComplete(): boolean {
    return this.stageComplete;
  }

  /** Get current wave ID */
  getCurrentWaveId(): string {
    if (this.currentWaveIndex >= this.waves.length) return 'END';
    return this.waves[this.currentWaveIndex]?.id ?? 'NONE';
  }

  /** Update scheduler and return spawn requests */
  update(dt: number): SpawnRequest[] {
    this.waveTimer += dt;
    const requests: SpawnRequest[] = [];

    // Check for new waves to activate FIRST
    while (this.currentWaveIndex < this.waves.length) {
      const wave = this.waves[this.currentWaveIndex]!;

      if (this.waveTimer >= wave.t) {
        // Check condition
        if (wave.condition === 'powerBelowMax' && this.powerLevel >= 3) {
          // Skip this wave
          this.currentWaveIndex++;
          continue;
        }

        // Schedule spawns from this wave
        this.scheduleWave(wave);
        this.currentWaveIndex++;
      } else {
        break;
      }
    }

    // THEN process pending spawns (including newly scheduled ones)
    const stillPending: PendingSpawn[] = [];
    for (const spawn of this.pendingSpawns) {
      if (this.waveTimer >= spawn.time) {
        requests.push(spawn.request);
        this.spawnedCount++;
      } else {
        stillPending.push(spawn);
      }
    }
    this.pendingSpawns = stillPending;

    // Check if stage is complete
    if (this.currentWaveIndex >= this.waves.length && this.pendingSpawns.length === 0) {
      this.stageComplete = true;
    }

    return requests;
  }

  /** Schedule all spawns from a wave */
  private scheduleWave(wave: Wave): void {
    for (let gi = 0; gi < wave.groups.length; gi++) {
      const group = wave.groups[gi]!;

      // P1 partial waves drop non-fighter groups. The full stage keeps them.
      if (
        this.mvpOnly &&
        wave.mvp === 'partial' &&
        group.enemy !== 'small' &&
        group.enemy !== 'medium'
      ) {
        continue;
      }

      for (let i = 0; i < group.count; i++) {
        const spawnTime = wave.t + (group.delay ?? 0) + (group.interval ?? 0) * i;
        const x = group.xs[i % group.xs.length] ?? 180;
        const y = resolveSpawnY(group);

        const canFire = !group.fireOnly || group.fireOnly.includes(i);

        let drop: 'P' | 'B' | null = null;
        if (group.drops) {
          const dropInfo = group.drops.find((d) => d.index === i);
          if (dropInfo) {
            drop = dropInfo.item;
          }
        }

        const stagger = (group.fireStagger ?? 0) * i;
        const fire = canFire ? withFireStagger(group.fire, stagger) : { kind: 'none' as const };

        this.pendingSpawns.push({
          waveId: wave.id,
          groupIndex: gi,
          spawnIndex: i,
          time: spawnTime,
          request: {
            type: group.enemy,
            x,
            y,
            move: group.move,
            fire,
            canFire,
            drop,
            hp: group.hp,
            score: group.score,
          },
        });
      }
    }
  }

  /** Get debug info */
  getDebugInfo(): {
    waveId: string;
    time: number;
    spawned: number;
    killed: number;
    pending: number;
  } {
    return {
      waveId: this.getCurrentWaveId(),
      time: this.waveTimer,
      spawned: this.spawnedCount,
      killed: this.killedCount,
      pending: this.pendingSpawns.length,
    };
  }
}

function resolveSpawnY(group: SpawnGroup): number {
  if (group.y !== undefined) return group.y;
  if (group.move.kind === 'side_arc') return group.move.y0;
  if (group.move.kind === 'ground') {
    return -Math.ceil(ENEMY_STATS[group.enemy].height / 2) - 1;
  }
  return -20;
}

/** Offset each ship in a group so their first shots don't land on the same frame. */
function withFireStagger(fire: Fire, extra: number): Fire {
  if (extra === 0 || fire.kind === 'none') return fire;
  switch (fire.kind) {
    case 'ring8':
    case 'ring16':
      return fire;
    case 'fan3':
    case 'fan5':
    case 'fan7wide':
    case 'aimed1':
    case 'aimed3burst':
    case 'missile':
    case 'aimed_fast3':
    case 'fixed2': {
      const interval = fire.interval;
      const base = fire.firstDelay ?? interval ?? 0;
      return { ...fire, firstDelay: base + extra };
    }
    default:
      return fire;
  }
}
