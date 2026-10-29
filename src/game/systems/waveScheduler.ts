/**
 * Wave scheduler system
 * Spawns enemies according to a stage's wave table (default: the registry's default stage).
 */

import type { Difficulty } from '@/game/difficulty';
import type {
  Wave,
  EnemyType,
  Move,
  Fire,
  SpawnGroup,
  StageData,
  RiskCrateSpawn,
} from '@/game/levels/types';
import { getStage } from '@/game/levels/registry';
import { mvpSkipsGroup } from '@/game/levels/stageStats';
import {
  groupEnabled,
  resolveFireOnly,
  resolveGroupCount,
  resolveGroupFire,
  waveEnabled,
} from '@/game/levels/wavePlan';
import {
  LOGICAL_H,
  LOGICAL_W,
  REAR_DIAG_SPAWN_X_LEFT,
  REAR_DIAG_SPAWN_X_RIGHT,
  RISK_CRATE_HOLD,
  RISK_CRATE_STOP_Y,
} from '@/game/config';
import { ENEMY_DEFS } from '@/game/entities/enemyDefs';
import { withFireStagger } from '@/game/systems/danmaku';

export interface WaveSchedulerConfig {
  mvpOnly: boolean;
  /** Omit for the default stage. */
  stage?: StageData;
  /**
   * Arms that difficulty's risk crates on this clock. Omit to schedule none,
   * so tests of the 148-ship table stay on the wave list alone.
   */
  difficulty?: Difficulty;
}

/** Crates this difficulty actually fields, in time order. */
export function riskCratesFor(
  crates: readonly RiskCrateSpawn[],
  difficulty: Difficulty
): RiskCrateSpawn[] {
  return crates
    .filter((crate) => crate.difficulties.includes(difficulty))
    .sort((a, b) => a.t - b.t);
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
  /** False for risk crates: they are not part of the wave kill-rate denominator. */
  countInWave: boolean;
  request: SpawnRequest;
}

export class WaveScheduler {
  private waves: Wave[];
  private readonly mvpOnly: boolean;
  private readonly difficulty: Difficulty | undefined;
  private readonly riskCrates: RiskCrateSpawn[];
  private currentWaveIndex: number = 0;
  private nextRisk: number = 0;
  private pendingSpawns: PendingSpawn[] = [];
  private waveTimer: number = 0;
  private spawnedCount: number = 0;
  private killedCount: number = 0;
  private stageComplete: boolean = false;
  private powerLevel: number = 1;

  constructor(config: WaveSchedulerConfig) {
    this.mvpOnly = config.mvpOnly;
    this.difficulty = config.difficulty;
    const stage = config.stage ?? getStage();
    if (config.mvpOnly) {
      this.waves = stage.waves.filter((w) => w.mvp === true || w.mvp === 'partial');
    } else {
      this.waves = stage.waves;
    }
    this.riskCrates = config.difficulty
      ? riskCratesFor(stage.riskCrates ?? [], config.difficulty)
      : [];
  }

  /** Reset scheduler to beginning */
  reset(): void {
    this.currentWaveIndex = 0;
    this.nextRisk = 0;
    this.pendingSpawns = [];
    this.waveTimer = 0;
    this.spawnedCount = 0;
    this.killedCount = 0;
    this.stageComplete = false;
    this.powerLevel = 1;
  }

  /**
   * Jump the timeline without spawning the ships that were skipped.
   * Kill rate only counts enemies that actually entered (wave table §8.3).
   */
  seek(time: number): void {
    if (time < this.waveTimer) {
      const power = this.powerLevel;
      this.reset();
      this.powerLevel = power;
    }

    this.waveTimer = time;
    while (this.currentWaveIndex < this.waves.length) {
      const wave = this.waves[this.currentWaveIndex];
      if (!wave || this.waveTimer + 1e-9 < wave.t) break;
      if (!(wave.condition === 'powerBelowMax' && this.powerLevel >= 3)) {
        this.scheduleWave(wave);
      }
      this.currentWaveIndex++;
    }
    this.armDueRiskCrates();

    this.pendingSpawns = this.pendingSpawns.filter((spawn) => spawn.time > this.waveTimer);
    this.stageComplete = this.wavesAreDone();
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
    this.armDueRiskCrates();

    // THEN process pending spawns (including newly scheduled ones)
    const stillPending: PendingSpawn[] = [];
    for (const spawn of this.pendingSpawns) {
      if (this.waveTimer >= spawn.time) {
        requests.push(spawn.request);
        if (spawn.countInWave) this.spawnedCount++;
      } else {
        stillPending.push(spawn);
      }
    }
    this.pendingSpawns = stillPending;

    // Check if stage is complete
    if (this.wavesAreDone()) this.stageComplete = true;

    return requests;
  }

  /**
   * Schedule all spawns from a wave.
   * A clear-wave bonus or a timed supply ship is not read (stage 2 §5.3).
   * `powerBelowMax` is the relief carrier, not that supply ship.
   */
  private scheduleWave(wave: Wave): void {
    if (!waveEnabled(wave, this.difficulty)) return;

    for (let gi = 0; gi < wave.groups.length; gi++) {
      const group = wave.groups[gi]!;
      if (!groupEnabled(group, this.difficulty)) continue;

      // P1 partial waves drop non-fighter groups. The full stage keeps them.
      if (this.mvpOnly && mvpSkipsGroup(wave, group.enemy)) continue;

      const count = resolveGroupCount(group, this.difficulty);
      const pattern = resolveGroupFire(group, this.difficulty);
      const only = resolveFireOnly(group, this.difficulty);

      for (let i = 0; i < count; i++) {
        const spawnTime = wave.t + (group.delay ?? 0) + (group.interval ?? 0) * i;
        const pos = resolveSpawnPosition(group, i);

        const canFire = !only || only.includes(i);

        let drop: 'P' | 'B' | null = null;
        if (group.drops) {
          const dropInfo = group.drops.find((d) => d.index === i);
          if (dropInfo) {
            drop = dropInfo.item;
          }
        }

        const stagger = (group.fireStagger ?? 0) * i;
        const fire = canFire ? withFireStagger(pattern, stagger) : { kind: 'none' as const };

        this.pendingSpawns.push({
          waveId: wave.id,
          groupIndex: gi,
          spawnIndex: i,
          time: spawnTime,
          countInWave: true,
          request: {
            type: group.enemy,
            x: pos.x,
            y: pos.y,
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

  private wavesAreDone(): boolean {
    return (
      this.currentWaveIndex >= this.waves.length &&
      this.nextRisk >= this.riskCrates.length &&
      this.pendingSpawns.length === 0
    );
  }

  /** Queue risk crates whose clock has arrived. Seek then drops the ones already due. */
  private armDueRiskCrates(): void {
    while (this.nextRisk < this.riskCrates.length) {
      const crate = this.riskCrates[this.nextRisk]!;
      if (this.waveTimer + 1e-9 < crate.t) break;
      this.pendingSpawns.push({
        waveId: 'risk',
        groupIndex: 0,
        spawnIndex: this.nextRisk,
        time: crate.t,
        countInWave: false,
        request: {
          type: 'risk_crate',
          x: crate.x,
          // Same off-screen entry as other air units (wave table: y = −20).
          y: -20,
          move: { kind: 'hover', stopY: RISK_CRATE_STOP_Y, hold: RISK_CRATE_HOLD },
          fire: { kind: 'none' },
          canFire: false,
          drop: null,
          hp: undefined,
          score: undefined,
        },
      });
      this.nextRisk++;
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

/** Screen position for one ship in a group. Ground tanks use `move.entry`. */
export function resolveSpawnPosition(group: SpawnGroup, index: number): { x: number; y: number } {
  const laneX = group.xs[index % group.xs.length] ?? 180;
  if (group.move.kind === 'side_arc') return { x: laneX, y: group.y ?? group.move.y0 };
  if (group.move.kind === 'rear_diag') {
    return {
      x: group.move.side === 'left' ? REAR_DIAG_SPAWN_X_LEFT : REAR_DIAG_SPAWN_X_RIGHT,
      y: group.y ?? group.move.y0,
    };
  }
  if (group.move.kind === 'ground') return resolveGroundSpawn(group, index, laneX);
  if (group.move.kind === 'wake_climb') return { x: laneX, y: group.y ?? LOGICAL_H + 32 };
  if (group.move.kind === 'cross_skim') {
    return {
      x: group.move.side === 'left' ? -36 : LOGICAL_W + 36,
      y: group.y ?? group.move.y,
    };
  }
  return { x: laneX, y: group.y ?? -20 };
}

function resolveGroundSpawn(
  group: SpawnGroup,
  _index: number,
  laneX: number
): { x: number; y: number } {
  const move = group.move;
  if (move.kind !== 'ground') return { x: laneX, y: group.y ?? -20 };
  const stats = ENEMY_DEFS[group.enemy];
  const halfW = Math.ceil(stats.width / 2);
  const halfH = Math.ceil(stats.height / 2);
  switch (move.entry ?? 'top') {
    case 'left':
      return { x: -halfW - 2, y: group.y ?? 220 };
    case 'right':
      return { x: LOGICAL_W + halfW + 2, y: group.y ?? 220 };
    case 'bottomLeft':
    case 'bottomRight':
      return { x: laneX, y: group.y ?? LOGICAL_H + halfH + 2 };
    default:
      return { x: laneX, y: group.y ?? -halfH - 1 };
  }
}
