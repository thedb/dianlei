/**
 * Stage boss glue: arms the difficulty-scaled `BossDef`, applies the runner's
 * events (score, shots, explosions, shake) to the battle, and
 * runs the victory fly-off that hands over to the result screen.
 */

import { LOGICAL_W, PLAYER_SPAWN_Y } from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { executeFirePattern } from '@/game/entities/enemyBullet';
import {
  createBoss,
  releaseBossResult,
  updateBoss,
  type BossEvents,
  type BossRuntime,
} from '@/game/systems/boss';
import { nextStageId } from '@/game/levels/registry';
import { stepVictoryExit, victoryExitBlocksInput } from '@/game/systems/victoryExit';
import { publishRun, runDifficulty, runProfile, type Battle } from './context';
import { spawnExplosion, triggerShake } from './fx';
import { isPlayerVulnerable, killPlayer, neutralizePlayerPose, snapshotRun } from './player';

/** Fight-start WARNING, once per boss. Separate from the pre-enter cue. */
const fightWarningPlayed = new WeakSet<BossRuntime>();

/** Scale the stage boss for this run's difficulty. Call at enter. */
export function armBoss(b: Battle): void {
  b.bossCfg = prepareBossConfig(b.stage.boss, runDifficulty(b));
}

export function spawnBoss(b: Battle): BossRuntime {
  return createBoss(b.bossCfg, { gates: runProfile(b).bossGates });
}

export function applyBossEvents(b: Battle, ev: BossEvents): void {
  if (ev.score) b.state.score += ev.score;
  // Sheds, phase changes, rail moves, and death must not touch the pool.
  // The B bomb is the only gameplay clear (`activateBomb`).
  for (const shot of ev.shots) {
    executeFirePattern(shot.fire, shot.x, shot.y, b.player.x, b.player.y, b.spawner, {
      rotation: shot.rotation,
    });
  }
  for (const bolt of ev.bolts) {
    if (bolt.fuse !== undefined) {
      b.spawner.spawnBullet(
        bolt.x,
        bolt.y,
        bolt.vx,
        bolt.vy,
        bolt.type,
        bolt.homing,
        bolt.hitRadius,
        bolt.fuse
      );
    } else if (bolt.hitRadius !== undefined) {
      b.spawner.spawnBullet(
        bolt.x,
        bolt.y,
        bolt.vx,
        bolt.vy,
        bolt.type,
        bolt.homing,
        bolt.hitRadius
      );
    } else {
      b.spawner.spawnBullet(bolt.x, bolt.y, bolt.vx, bolt.vy, bolt.type, bolt.homing);
    }
  }
  for (const boom of ev.explosions) {
    spawnExplosion(b.fx, boom.x, boom.y, boom.size, boom.delay, boom.frameTime);
  }
  if (ev.chaseBoost !== undefined) b.chaseBoost = ev.chaseBoost;
  if (ev.shake) triggerShake(b.fx, ev.shake.intensity, ev.shake.duration);
  if (ev.explosions.length > 0) b.sfx('enemyExplode');
}

/** Boss frame plus the victory fly-off. Returns 'result' once the ship has left. */
export function stepBoss(b: Battle, dt: number): 'result' | null {
  const boss = b.boss;
  if (!boss || boss.phase === 'done') return null;
  const ev = updateBoss(boss, dt, {
    playerX: b.player.x,
    playerY: b.player.y,
    rng: b.rng,
    scroll: b.scrollFrame.scroll,
  });
  applyBossEvents(b, ev);
  if (ev.cutscene && b.cutsceneAt === null) b.cutsceneAt = b.gameTime;
  if (ev.hurtPlayer && isPlayerVulnerable(b)) killPlayer(b);
  const warnFor = boss.def.fightWarning;
  if (
    warnFor !== undefined &&
    !fightWarningPlayed.has(boss) &&
    boss.stage === 'fight' &&
    boss.phaseIndex === 0 &&
    boss.phaseTime < warnFor
  ) {
    fightWarningPlayed.add(boss);
    b.sfx('warning');
  }
  if (boss.phase === 'clear' && b.finishedAt === null) b.finishedAt = b.gameTime;
  if (!b.rules().victoryExit) return null;

  const { victory, player } = b;
  const cue = stepVictoryExit(
    victory,
    boss.phase,
    dt,
    player.x,
    player.y,
    LOGICAL_W / 2,
    PLAYER_SPAWN_Y
  );
  if (victoryExitBlocksInput(victory.phase)) {
    player.x = victory.x;
    player.y = victory.y;
    // The ship step already ran this frame. On the step the exit leaves idle
    // that step was still steering, so the snap has to happen here, before
    // render, or the banked frame is carried into the wait and the climb.
    neutralizePlayerPose(player);
    player.velocityY = 0;
  }
  if (cue === 'victory') {
    const done = releaseBossResult(boss);
    applyBossEvents(b, done);
    if (done.enterResult) {
      publishRun(b, 'clear');
      // A normal clear with a later stage holds on the black card. 挑战 Boss
      // and the last stage still open the result screen. The return stays
      // 'result' so stage-1 replay digests keep the same outcome frame.
      if (b.scene.battleEntry === 'stage') {
        const next = nextStageId(b.stage.id);
        if (next) {
          b.scene.campaignNext = next;
          b.scene.carriedRun = snapshotRun(b.state);
        } else {
          delete b.scene.campaignNext;
          delete b.scene.carriedRun;
        }
      } else {
        delete b.scene.campaignNext;
        delete b.scene.carriedRun;
      }
      return 'result';
    }
  }
  return null;
}
