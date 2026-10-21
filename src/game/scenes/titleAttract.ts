/**
 * Title / boot attract mode.
 * The world is a real battle scene (same stage data, entities, sprites, and
 * rules). Only the scripted stick and the loop / death-fade / restart live here.
 * The demo never writes a run report, high score, or settings, and it plays no SFX.
 */

import type { InputState } from '@/engine/input';
import type { Renderer } from '@/engine/renderer';
import {
  ATTRACT_DEATH_FADE,
  ATTRACT_LOOP_SECONDS,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_SPAWN_Y,
} from '@/game/config';
import { computeControlLayout } from '@/game/controls';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { attractStick, pickAttractPlan, type AttractPlan, type PilotWorld } from './attractPilot';
import { createBattleScene } from './battle';
import type { SceneContext } from './types';

/** `idle` stands still so tests can force the real death rules. The title uses `auto`. */
export type AttractDrive = 'auto' | 'idle';

export interface AttractStats {
  time: number;
  spawned: number;
  bullets: number;
  enemies: number;
  enemyBullets: number;
  playerDead: boolean;
  explosions: number;
  lives: number;
  bombs: number;
  /** 0–1 black fade after the death explosion. Buttons stay above this. */
  fade: number;
  sceneId: string;
}

const BLANK_INPUT: InputState = {
  joystickX: 0,
  joystickY: 0,
  joystickMagnitude: 0,
  buttonA: false,
  buttonB: false,
  keyUp: false,
  keyDown: false,
  keyLeft: false,
  keyRight: false,
  keyFire: false,
  keyBomb: false,
  pausePressed: false,
  menuUp: false,
  menuDown: false,
  menuLeft: false,
  menuRight: false,
  menuConfirm: false,
  menuBack: false,
  debugWarning: false,
  debugBoss: false,
  taps: [],
  pointers: [],
};

/** World the autopilot aims from. Omitted calls use route 0 at the spawn point. */
export interface AttractAim {
  plan: AttractPlan;
  world: PilotWorld;
}

/** Scripted stick for the demo. `time` is the battle clock before this step. */
export function attractInput(
  time: number,
  drive: AttractDrive = 'auto',
  aim?: AttractAim
): InputState {
  if (drive === 'idle') return BLANK_INPUT;
  const plan = aim?.plan ?? { routeId: 0, seed: 1 };
  const world = aim?.world ?? {
    player: { x: LOGICAL_W / 2, y: PLAYER_SPAWN_Y },
    enemies: [],
    bullets: [],
  };
  const stick = attractStick(plan, time, world);
  return {
    ...BLANK_INPUT,
    joystickX: stick.joystickX,
    joystickY: stick.joystickY,
    joystickMagnitude: stick.joystickMagnitude,
    buttonA: true,
  };
}

function attractContext(): SceneContext {
  const storage = createMemoryStorage();
  const settings = createSettingsStore(storage);
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  return {
    playMode: 'attract',
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage,
    run: { report: null },
    battleEntry: 'stage',
    input: {
      setControlsEnabled: () => undefined,
      getControlsView: () => ({
        layout,
        settings: settings.get(),
        joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 0 },
        buttonAPressed: false,
        buttonBPressed: false,
      }),
    },
  };
}

export interface TitleAttractOptions {
  /** Route picks. Defaults to Math.random. Each start and restart draws twice. */
  rng?: () => number;
  /** Seconds before a living demo restarts. Defaults to ATTRACT_LOOP_SECONDS. */
  loopSeconds?: number;
}

export interface TitleAttract {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  update(dt: number): void;
  render(renderer: Renderer, alpha: number): void;
  stats(): AttractStats;
  /** Route chosen for the run that is on screen. Redrawn on every restart. */
  plan(): AttractPlan;
  pilotView(): PilotWorld;
}

export function createTitleAttract(
  drive: AttractDrive = 'auto',
  options: TitleAttractOptions = {}
): TitleAttract {
  const rng = options.rng ?? Math.random;
  const loopSeconds = options.loopSeconds ?? ATTRACT_LOOP_SECONDS;
  const battle = createBattleScene(attractContext());
  let running = false;
  let fading = false;
  let fade = 0;
  let plan: AttractPlan = { routeId: 0, seed: 1 };

  function restart(): void {
    plan = pickAttractPlan(rng);
    fading = false;
    fade = 0;
    battle.enter();
  }

  return {
    start(): void {
      running = true;
      restart();
    },

    stop(): void {
      running = false;
      fading = false;
      fade = 0;
      battle.exit();
    },

    isRunning: () => running,

    update(dt: number): void {
      if (!running) return;
      if (fading) {
        fade = Math.min(1, fade + dt / ATTRACT_DEATH_FADE);
        if (fade >= 1) restart();
        return;
      }

      const time = battle.getDebugInfo?.().gameTime ?? 0;
      const world = battle.getBattleView();
      // Scene changes (game over, pause exit) belong to a real run.
      battle.update(dt, attractInput(time, drive, { plan, world }));
      const info = battle.getDebugInfo?.();
      if (!info) return;

      if (info.playerDead && (info.activeExplosions ?? 0) === 0) {
        fading = true;
        fade = Math.min(1, dt / ATTRACT_DEATH_FADE);
        return;
      }
      if (!info.playerDead && (info.gameTime ?? 0) >= loopSeconds) restart();
    },

    render(renderer: Renderer, alpha: number): void {
      battle.render(renderer, alpha);
      if (fade > 0) {
        renderer.fillRect(0, 0, LOGICAL_W, LOGICAL_H, `rgba(0, 0, 0, ${fade})`);
      }
    },

    stats(): AttractStats {
      const info = battle.getDebugInfo?.();
      return {
        time: info?.gameTime ?? 0,
        spawned: info?.waveSpawned ?? 0,
        bullets: info?.bulletCount ?? 0,
        enemies: info?.enemyCount ?? 0,
        enemyBullets: info?.enemyBulletCount ?? 0,
        playerDead: info?.playerDead ?? false,
        explosions: info?.activeExplosions ?? 0,
        lives: info?.lives ?? 0,
        bombs: info?.bombs ?? 0,
        fade,
        sceneId: battle.id,
      };
    },

    plan: () => plan,

    pilotView: () => battle.getBattleView(),
  };
}

let shared: TitleAttract | null = null;

/** One battle scene for boot and title, so the sprite bake is not duplicated. */
export function sharedTitleAttract(): TitleAttract {
  if (!shared) shared = createTitleAttract('auto');
  return shared;
}
