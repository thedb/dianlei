import { describe, expect, it, vi } from 'vitest';
import type { ControlsView } from '@/engine/input';
import { ATTRACT_LOOP_SECONDS, BOMBS_START, LIVES_START } from '@/game/config';
import { computeControlLayout } from '@/game/controls';
import { getStage } from '@/game/levels/registry';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import { makeInput } from '@/test/fakes';
import { DIFFICULTY_EASY_BUTTON } from '@/game/ui/difficultySelect';
import { START_BUTTON } from '@/game/ui/startButton';
import { createBattleScene } from './battle';
import { createTitleScene } from './title';
import type { SceneContext } from './types';
import { attractInput, createTitleAttract } from './titleAttract';

const stage1 = getStage('1');

vi.mock('@/game/art', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/game/art')>();
  return { ...actual, createGameAssets: () => ({}) };
});

const { playSfx } = vi.hoisted(() => ({ playSfx: vi.fn() }));

vi.mock('@/game/systems/audio', () => {
  const sfx = {
    init: () => undefined,
    unlock: () => undefined,
    play: (id: string): void => {
      playSfx(id);
    },
    setMuted: () => undefined,
    isMuted: () => false,
    bindBackend: () => undefined,
    setBgmEnabled: () => undefined,
    setBgmVolume: () => undefined,
    tick: () => undefined,
  };
  return { getAudioSystem: () => sfx, createAudioSystem: () => sfx };
});

const DT = 1 / 60;

function battleContext(playMode: 'play' | 'attract'): SceneContext {
  const storage = createMemoryStorage();
  const settings = createSettingsStore(storage);
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const view: ControlsView = {
    layout,
    settings: settings.get(),
    joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 0 },
    buttonAPressed: false,
    buttonBPressed: false,
  };
  return {
    playMode,
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage,
    run: { report: null },
    battleEntry: 'stage',
    input: { setControlsEnabled: () => undefined, getControlsView: () => view },
  };
}

describe('title attract demo', () => {
  it('tracks a real battle scene driven by the same stage waves and factories', () => {
    playSfx.mockClear();
    const attract = createTitleAttract('auto', { rng: () => 0 });
    const ctx = battleContext('attract');
    const battle = createBattleScene(ctx);
    const waves = new WaveScheduler({ mvpOnly: false });
    attract.start();
    battle.enter();
    expect(attract.plan().routeId).toBe(0);

    const steps = Math.ceil(8 / DT);
    for (let i = 0; i < steps; i++) {
      const time = battle.getDebugInfo?.().gameTime ?? 0;
      const world = battle.getBattleView();
      const demoWorld = attract.pilotView();
      expect(demoWorld.player.x).toBe(world.player.x);
      expect(demoWorld.player.y).toBe(world.player.y);
      expect(demoWorld.enemies.length).toBe(world.enemies.length);
      expect(demoWorld.bullets.length).toBe(world.bullets.length);
      const input = attractInput(time, 'auto', { plan: attract.plan(), world });
      attract.update(DT);
      battle.update(DT, input);
      waves.update(DT);

      const demo = attract.stats();
      const live = battle.getDebugInfo?.();
      expect(demo.sceneId).toBe(battle.id);
      expect(demo.sceneId).toBe('battle');
      expect(demo.time).toBeCloseTo(live?.gameTime ?? -1);
      expect(demo.enemies).toBe(live?.enemyCount);
      expect(demo.bullets).toBe(live?.bulletCount);
      expect(demo.enemyBullets).toBe(live?.enemyBulletCount);
      expect(demo.spawned).toBe(live?.waveSpawned);
      expect(demo.spawned).toBe(waves.getDebugInfo().spawned);
    }

    const done = attract.stats();
    expect(done.spawned).toBeGreaterThan(0);
    expect(done.bullets).toBeGreaterThan(0);
    expect(done.bombs).toBe(BOMBS_START);
    expect(ctx.run.report).toBeNull();
    expect(ctx.storage.getStorage('dianlei.highscore.v1')).toBeNull();
    // Same stage list the battle scene schedules. Spawn counts above already
    // matched a scheduler of that list and a second createBattleScene.
    expect(stage1.waves[0]?.id).toBe('W01');
    expect(stage1.waves.some((wave) => wave.t >= ATTRACT_LOOP_SECONDS)).toBe(true);
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('dies like a real run, then fades and restarts the loop', () => {
    playSfx.mockClear();
    const attract = createTitleAttract('idle');
    const playCtx = battleContext('play');
    const play = createBattleScene(playCtx);
    attract.start();
    play.enter();

    let deathStep = -1;
    let sawExplosion = false;
    let peakFade = 0;
    let restarted = false;
    const limit = Math.ceil(16 / DT);

    for (let i = 0; i < limit && !restarted; i++) {
      if (deathStep < 0) {
        const playTime = play.getDebugInfo?.().gameTime ?? 0;
        expect(attract.stats().time).toBeCloseTo(playTime);
        attract.update(DT);
        play.update(DT, attractInput(playTime, 'idle'));
      } else {
        attract.update(DT);
      }

      const demo = attract.stats();
      const live = play.getDebugInfo?.();
      if (demo.explosions > 0) sawExplosion = true;
      if (demo.fade > peakFade) peakFade = demo.fade;

      if (deathStep < 0 && demo.playerDead) {
        deathStep = i;
        expect(live?.playerDead).toBe(true);
        expect(demo.lives).toBe(LIVES_START - 1);
        expect(live?.lives).toBe(LIVES_START - 1);
        expect(demo.enemies).toBe(live?.enemyCount);
        expect(demo.bombs).toBe(BOMBS_START);
      }

      if (
        deathStep >= 0 &&
        demo.fade === 0 &&
        demo.lives === LIVES_START &&
        demo.time < 1 &&
        i > deathStep
      ) {
        restarted = true;
      }
    }

    expect(deathStep).toBeGreaterThan(0);
    expect(sawExplosion).toBe(true);
    expect(peakFade).toBeGreaterThan(0.5);
    expect(restarted).toBe(true);
    expect(playCtx.run.report).toBeNull();

    // A real run respawns the ship instead of restarting the stage.
    const recover = Math.ceil(2 / DT);
    for (let i = 0; i < recover; i++) play.update(DT, makeInput());
    const after = play.getDebugInfo?.();
    expect(after?.playerDead).toBe(false);
    expect(after?.lives).toBe(LIVES_START - 1);
    expect(playSfx).toHaveBeenCalled();
    playSfx.mockClear();

    const silent = createTitleAttract('idle');
    silent.start();
    for (let i = 0; i < Math.ceil(12 / DT); i++) silent.update(DT);
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('keeps the title buttons live while the death fade is on screen', () => {
    const attract = createTitleAttract('idle');
    const title = createTitleScene(battleContext('play'), attract);
    title.enter();

    let fade = 0;
    for (let i = 0; i < Math.ceil(16 / DT) && fade <= 0; i++) {
      title.update(DT, makeInput());
      fade = attract.stats().fade;
    }
    expect(fade).toBeGreaterThan(0);
    expect(attract.stats().playerDead).toBe(true);

    const center = {
      x: START_BUTTON.x + START_BUTTON.w / 2,
      y: START_BUTTON.y + START_BUTTON.h / 2,
    };
    expect(title.update(DT, makeInput({ taps: [center] }))).toBeNull();
    expect(attract.stats().fade).toBeGreaterThan(0);
    const easy = {
      x: DIFFICULTY_EASY_BUTTON.x + DIFFICULTY_EASY_BUTTON.w / 2,
      y: DIFFICULTY_EASY_BUTTON.y + DIFFICULTY_EASY_BUTTON.h / 2,
    };
    expect(title.update(DT, makeInput({ taps: [easy] }))).toBe('battle');
    expect(attract.stats().fade).toBeGreaterThan(0);
  });

  it('restarts at the loop point without reaching the boss', () => {
    const attract = createTitleAttract('auto', { rng: () => 0 });
    attract.start();
    const steps = Math.ceil((ATTRACT_LOOP_SECONDS + 2) / DT);
    let maxTime = 0;
    for (let i = 0; i < steps; i++) {
      attract.update(DT);
      maxTime = Math.max(maxTime, attract.stats().time);
    }
    expect(maxTime).toBeLessThan(ATTRACT_LOOP_SECONDS);
    expect(attract.stats().time).toBeLessThan(ATTRACT_LOOP_SECONDS);
    expect(attract.stats().sceneId).toBe('battle');
  });

  it('picks a new route when the loop restarts a living ship', () => {
    let n = 0;
    const rng = () => {
      n += 1;
      if (n <= 2) return 0;
      if (n === 3) return 2 / 6 + 0.01;
      return 0.1;
    };
    const loopSeconds = 8;
    const attract = createTitleAttract('auto', { rng, loopSeconds });
    attract.start();
    expect(attract.plan().routeId).toBe(0);

    let looped = false;
    for (let i = 0; i < Math.ceil((loopSeconds + 2) / DT) && !looped; i++) {
      const before = attract.stats();
      attract.update(DT);
      const after = attract.stats();
      if (!before.playerDead && before.time >= loopSeconds - DT * 2 && after.time < 1) {
        looped = true;
        expect(after.playerDead).toBe(false);
        expect(after.fade).toBe(0);
      }
    }
    expect(looped).toBe(true);
    expect(attract.plan().routeId).toBe(2);
  });

  it('picks a new route after the death fade restarts the demo', () => {
    let n = 0;
    const rng = () => {
      n += 1;
      if (n === 1) return 0;
      if (n === 2) return 0.2;
      if (n === 3) return 0.5;
      return 0.3;
    };
    const attract = createTitleAttract('idle', { rng });
    attract.start();
    expect(attract.plan().routeId).toBe(0);

    let restarted = false;
    for (let i = 0; i < Math.ceil(16 / DT) && !restarted; i++) {
      attract.update(DT);
      const demo = attract.stats();
      if (
        attract.plan().routeId !== 0 &&
        demo.fade === 0 &&
        demo.time < 1 &&
        demo.lives === LIVES_START
      ) {
        restarted = true;
      }
    }
    expect(restarted).toBe(true);
    expect(attract.plan().routeId).toBe(3);
  });

  it('fires while the autopilot steers and never spends a bomb', () => {
    const input = attractInput(1.2, 'auto', {
      plan: { routeId: 1, seed: 4 },
      world: {
        player: { x: 300, y: 450 },
        enemies: [{ x: 80, y: 100 }],
        bullets: [],
      },
    });
    expect(input.buttonA).toBe(true);
    expect(input.buttonB).toBe(false);
    expect(input.keyBomb).toBe(false);
    expect(input.joystickMagnitude).toBeGreaterThan(0);
    expect(input.joystickMagnitude).toBeLessThanOrEqual(1);
    expect(attractInput(1.2, 'idle').buttonA).toBe(false);
  });
});
