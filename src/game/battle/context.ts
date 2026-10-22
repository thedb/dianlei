/**
 * Shared state for one battle scene. The scene modules (`player`, `combat`,
 * `world`, `bossFight`, `range`, `render`, `hud`) are plain functions over this
 * object, so the scene file only wires the frame order together.
 */

import type { SceneContext } from '@/game/scenes/types';
import type { InputState } from '@/engine/input';
import type { StageData, BossDef } from '@/game/levels/types';
import type { GameAssets } from '@/game/art';
import { ObjectPool } from '@/engine/pool';
import { clockSeed, createRng, type Rng } from '@/engine/rng';
import {
  BOMBS_START,
  ENEMY_BULLET_CAP,
  EXTEND_EVERY,
  LIVES_START,
  LOGICAL_W,
  PLAYER_SPAWN_Y,
} from '@/game/config';
import { getStage } from '@/game/levels/registry';
import { difficultyProfile, type Difficulty, type DifficultyProfile } from '@/game/difficulty';
import { createBullet } from '@/game/entities/bullet';
import { createEnemy, type Enemy } from '@/game/entities/enemy';
import {
  createEnemyBullet,
  spawnEnemyBullet,
  type BulletSpawner,
} from '@/game/entities/enemyBullet';
import { createItem } from '@/game/entities/item';
import {
  createHomingMissile,
  spawnHomingMissile,
  type HomingTarget,
} from '@/game/entities/homingMissile';
import { BuildingScheduler, createBuilding } from '@/game/entities/building';
import { SpatialGrid } from '@/game/systems/collision';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import { getAudioSystem, type SfxType } from '@/game/systems/audio';
import type { Loadout, WeaponEmitter } from '@/game/systems/playerWeapons';
import type { BossRuntime } from '@/game/systems/boss';
import type { RunReport } from '@/game/systems/score';
import { createVictoryExit, type VictoryExit } from '@/game/systems/victoryExit';
import { Scroller, backgroundFade, type ScrollFrame } from '@/game/systems/background';
import { createPauseMenu, type PauseMenu } from '@/game/ui/pauseMenu';
import {
  createDamageMeter,
  createWeaponTestTune,
  type DamageMeter,
  type WeaponTestTune,
} from '@/game/scenes/weaponTest';
import { createFx, type Fx } from './fx';
import { playModeRules, type PlayModeRules } from './playMode';

export interface PlayerShip {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  bank: number;
  targetBank: number;
  lastBankFrame: number;
  velocityY: number;
}

/** Run state. `main` / `sub` are the weapon slots (see playerWeapons.ts). */
export interface GameState extends Loadout {
  lives: number;
  bombs: number;
  score: number;
  bombCooldown: number;
  bombInvincible: number;
  bombFlashTimer: number;
  respawnTimer: number;
  respawnInvincible: number;
  isDead: boolean;
  isFlying: boolean;
  gameOver: boolean;
  deaths: number;
  nextExtendScore: number;
}

export interface BombWave {
  active: boolean;
  x: number;
  y: number;
  t: number;
}

export interface Battle {
  readonly scene: SceneContext;
  /** Live rules for `scene.playMode`, which can change between runs. */
  rules(): PlayModeRules;
  /** Gameplay randomness: the context's seeded generator, else a clock-seeded one. */
  readonly rng: Rng;
  sfx(id: SfxType): void;
  readonly pause: PauseMenu;
  readonly player: PlayerShip;
  readonly state: GameState;
  readonly bullets: ObjectPool<ReturnType<typeof createBullet>>;
  readonly missiles: ObjectPool<ReturnType<typeof createHomingMissile>>;
  readonly enemies: ObjectPool<Enemy>;
  readonly enemyBullets: ObjectPool<ReturnType<typeof createEnemyBullet>>;
  readonly items: ObjectPool<ReturnType<typeof createItem>>;
  readonly buildings: ObjectPool<ReturnType<typeof createBuilding>>;
  readonly fx: Fx;
  readonly bombWave: BombWave;
  readonly homingTargets: HomingTarget[];
  readonly enemyGrid: SpatialGrid<Enemy>;
  readonly spawner: BulletSpawner;
  readonly emitter: WeaponEmitter;
  readonly victory: VictoryExit;
  readonly tune: WeaponTestTune;
  readonly meter: DamageMeter;
  /** Fire clocks, one per weapon slot. */
  readonly guns: { main: number; sub: number };
  readonly controls: { fireHeld: boolean; bombPressed: boolean; lastBombInput: boolean };
  stage: StageData;
  bossCfg: BossDef;
  boss: BossRuntime | null;
  waves: WaveScheduler | null;
  buildingScheduler: BuildingScheduler;
  scroller: Scroller;
  scrollFrame: ScrollFrame;
  gameTime: number;
  warningPlayed: boolean;
  finishedAt: number | null;
  assets: GameAssets | null;
}

export function createBattle(scene: SceneContext): Battle {
  const stage = getStage();
  const fallbackRng = createRng(clockSeed());
  const audio = getAudioSystem();
  const rules = (): PlayModeRules => playModeRules(scene.playMode);
  const enemyBullets = new ObjectPool(createEnemyBullet, 200);
  const bullets = new ObjectPool(createBullet, 100);
  const missiles = new ObjectPool(createHomingMissile, 24);

  const battle: Battle = {
    scene,
    rules,
    rng: () => (scene.rng ?? fallbackRng)(),
    sfx(id) {
      if (!rules().silent) audio.play(id);
    },
    pause: createPauseMenu(scene.settings, { exitMode: () => rules().pauseExit }),
    player: {
      x: LOGICAL_W / 2,
      y: PLAYER_SPAWN_Y,
      prevX: LOGICAL_W / 2,
      prevY: PLAYER_SPAWN_Y,
      bank: 0,
      targetBank: 0,
      lastBankFrame: 5,
      velocityY: 0,
    },
    state: {
      lives: LIVES_START,
      bombs: BOMBS_START,
      score: 0,
      main: { id: 'vulcan', level: 1 },
      sub: null,
      bombCooldown: 0,
      bombInvincible: 0,
      bombFlashTimer: 0,
      respawnTimer: 0,
      respawnInvincible: 0,
      isDead: false,
      isFlying: false,
      gameOver: false,
      deaths: 0,
      nextExtendScore: EXTEND_EVERY,
    },
    bullets,
    missiles,
    enemies: new ObjectPool(createEnemy, 64),
    enemyBullets,
    items: new ObjectPool(createItem, 10),
    buildings: new ObjectPool(createBuilding, 16),
    fx: createFx(),
    bombWave: { active: false, x: 0, y: 0, t: 0 },
    homingTargets: [],
    enemyGrid: new SpatialGrid<Enemy>(64),
    spawner: {
      spawnBullet(x, y, vx, vy, type, homing = 0) {
        if (enemyBullets.getActiveCount() < ENEMY_BULLET_CAP) {
          const k = runProfile(battle).bulletSpeedScale;
          spawnEnemyBullet(enemyBullets.acquire(), x, y, vx * k, vy * k, type, homing);
        }
      },
      getBulletCount() {
        return enemyBullets.getActiveCount();
      },
    },
    emitter: {
      bullet(x, y, vx, vy, damage) {
        const bullet = bullets.acquire();
        bullet.x = x;
        bullet.y = y;
        bullet.prevX = x;
        bullet.prevY = y;
        bullet.vx = vx;
        bullet.vy = vy;
        bullet.damage = damage;
      },
      missile(x, y, angle, damage) {
        spawnHomingMissile(missiles.acquire(), x, y, angle, damage);
      },
    },
    victory: createVictoryExit(),
    tune: createWeaponTestTune(),
    meter: createDamageMeter(),
    guns: { main: 0, sub: 0 },
    controls: { fireHeld: false, bombPressed: false, lastBombInput: false },
    stage,
    bossCfg: stage.boss,
    boss: null,
    waves: null,
    buildingScheduler: new BuildingScheduler(stage.buildings, stage.warningAt),
    scroller: new Scroller(stage.sections),
    scrollFrame: {
      scroll: 0,
      tileDelta: 0,
      fade: backgroundFade(0, stage.warningAt, stage.sections),
      starScroll: [0, 0, 0],
    },
    gameTime: 0,
    warningPlayed: false,
    finishedAt: null,
    assets: null,
  };
  return battle;
}

/** Difficulty for this run. Attract and the range force their own. */
export function runDifficulty(b: Battle): Difficulty {
  return b.rules().difficulty ?? b.scene.difficulty ?? 'easy';
}

export function runProfile(b: Battle): DifficultyProfile {
  return difficultyProfile(runDifficulty(b));
}

/** Leaving for the title always drops back to a normal run. */
export function leaveToTitle(b: Battle): 'title' {
  b.scene.playMode = 'play';
  return 'title';
}

/** First input unlocks audio. The silent demo never touches the audio graph. */
export function unlockAudio(b: Battle, input: InputState): void {
  if (b.rules().silent) return;
  if (input.buttonA || input.buttonB || input.joystickMagnitude > 0.1 || input.taps.length) {
    getAudioSystem().unlock();
  }
}

export function initAudio(b: Battle): void {
  if (!b.rules().silent) getAudioSystem().init();
}

/** Writes the run report for the result / game-over scenes. */
export function publishRun(b: Battle, outcome: RunReport['outcome']): void {
  if (!b.rules().publishesRun) return;
  const info = b.waves?.getDebugInfo();
  b.scene.run.report = {
    outcome,
    baseScore: b.state.score,
    kills: info?.killed ?? 0,
    spawned: info?.spawned ?? 0,
    deaths: b.state.deaths,
    time: outcome === 'clear' ? (b.finishedAt ?? b.gameTime) : b.gameTime,
  };
}

/** Every pool back to empty. Enter, exit, and the boss-practice jump use this. */
export function releaseAllPools(b: Battle): void {
  b.bullets.releaseAll();
  b.missiles.releaseAll();
  b.enemies.releaseAll();
  b.enemyBullets.releaseAll();
  b.items.releaseAll();
  b.buildings.releaseAll();
}

/** Count and clear every live enemy bullet. */
export function clearEnemyBullets(b: Battle): number {
  const cleared = b.enemyBullets.getActiveCount();
  b.enemyBullets.releaseAll();
  return cleared;
}
