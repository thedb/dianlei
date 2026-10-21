import { describe, expect, it, vi } from 'vitest';
import type { ControlsView } from '@/engine/input';
import { ATTRACT_LOOP_SECONDS, BOMBS_START, LIVES_START } from '@/game/config';
import { computeControlLayout } from '@/game/controls';
import { stage1 } from '@/game/levels/stage1';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { WaveScheduler } from '@/game/systems/waveScheduler';
import { makeInput } from '@/test/fakes';
import { START_BUTTON } from '@/game/ui/startButton';
import { createBattleScene } from './battle';
import { createTitleScene } from './title';
import type { SceneContext } from './types';
import { attractInput, createTitleAttract } from './titleAttract';

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
    const attract = createTitleAttract('auto');
    const ctx = battleContext('attract');
    const battle = createBattleScene(ctx);
    const waves = new WaveScheduler({ mvpOnly: false });
    attract.start();
    battle.enter();

    const steps = Math.ceil(8 / DT);
    for (let i = 0; i < steps; i++) {
      const time = battle.getDebugInfo?.().gameTime ?? 0;
      const input = attractInput(time, 'auto');
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
    expect(title.update(DT, makeInput({ taps: [center] }))).toBe('battle');
    expect(attract.stats().fade).toBeGreaterThan(0);
  });

  it('restarts at the loop point without reaching the boss', () => {
    const attract = createTitleAttract('auto');
    attract.start();
    const steps = Math.ceil((ATTRACT_LOOP_SECONDS + 2) / DT);
    for (let i = 0; i < steps; i++) attract.update(DT);
    expect(attract.stats().time).toBeGreaterThanOrEqual(0);
    expect(attract.stats().time).toBeLessThan(ATTRACT_LOOP_SECONDS);
    expect(attract.stats().sceneId).toBe('battle');
  });
});
