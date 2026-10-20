/**
 * Wave scheduler system
 * Spawns enemies according to wave data from stage1.ts
 */

import type { Wave, EnemyType, Move, Fire } from '@/game/levels/types';
import { stage1 } from '@/game/levels/stage1';

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
  private currentWaveIndex: number = 0;
  private pendingSpawns: PendingSpawn[] = [];
  private waveTimer: number = 0;
  // Reserved for future use
  // private _totalEnemyCount: number = 0;
  private spawnedCount: number = 0;
  private killedCount: number = 0;
  private stageComplete: boolean = false;
  private powerLevel: number = 1;

  constructor(config: WaveSchedulerConfig) {
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

      // For partial MVP waves, only spawn small/medium
      if (wave.mvp === 'partial' && group.enemy !== 'small' && group.enemy !== 'medium') {
        continue;
      }

      for (let i = 0; i < group.count; i++) {
        const spawnTime = wave.t + (group.interval ?? 0) * i;
        const x = group.xs[i % group.xs.length] ?? 180;
        const y = group.y ?? -20;

        // Determine if this enemy should fire
        const canFire = !group.fireOnly || group.fireOnly.includes(i);

        // Check for drop
        let drop: 'P' | 'B' | null = null;
        if (group.drops) {
          const dropInfo = group.drops.find((d) => d.index === i);
          if (dropInfo) {
            drop = dropInfo.item;
          }
        }

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
            fire: group.fire,
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
