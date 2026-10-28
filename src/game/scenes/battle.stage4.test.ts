/**
 * Stage 4 map smoke. Waves are empty and the boss is a parked stub, so this
 * only checks that both entries bake, scroll, and draw.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DT, battleContext, seeded } from '@/test/battleHarness';
import { FakeOffscreenCanvas, fakeRenderer } from '@/test/fakeCanvas';
import { makeInput } from '@/test/fakes';
import {
  BG_SCROLL_SPEED,
  CARRIER_LIGHTS_TIME,
  CARRIER_PARK_Y,
  CARRIER_RUSH_TIME,
  LOGICAL_H,
  LOGICAL_W,
  OBSIDIAN_ENTER_AT,
  PLAYER_SPAWN_Y,
} from '@/game/config';
import type { CarriedRun, SceneContext } from './types';
import { createBattleScene } from './battle';

vi.mock('@/game/systems/audio', () => {
  const sfx = {
    init: () => undefined,
    unlock: () => undefined,
    play: () => undefined,
    setMuted: () => undefined,
    isMuted: () => false,
  };
  return { getAudioSystem: () => sfx, createAudioSystem: () => sfx };
});

beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stageRun(): SceneContext {
  return { ...battleContext('stage', 'easy', seeded(4)), runStage: '4' };
}

function challenge(): SceneContext {
  return { ...battleContext('boss', 'easy', seeded(41)), challengeStage: '4' };
}

function carried(): CarriedRun {
  return {
    score: 42000,
    lives: 2,
    bombs: 1,
    deaths: 3,
    main: { id: 'vulcan', level: 3 },
    sub: { id: 'homing', level: 2 },
    mate: 1,
    nextExtendScore: 50000,
  };
}

const held = makeInput({
  joystickX: 1,
  joystickMagnitude: 1,
  buttonA: true,
  buttonB: true,
});

describe('stage 4 map entry', () => {
  it('starts 航母出击 at t = 0 on an empty run', () => {
    const scene = createBattleScene(stageRun());
    expect(() => scene.enter()).not.toThrow();
    expect(scene.getDebugInfo!().gameTime).toBe(0);
    expect(scene.getDebugInfo!().enemyCount).toBe(0);
    expect(() => scene.render(fakeRenderer(), 0)).not.toThrow();
    expect(() => scene.update(DT, makeInput())).not.toThrow();
    expect(scene.getDebugInfo!().enemyCount).toBe(0);
    scene.exit?.();
  });

  it('opens 挑战 Boss 4 on the enemy deck', () => {
    const scene = createBattleScene(challenge());
    expect(() => scene.enter()).not.toThrow();
    const info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(OBSIDIAN_ENTER_AT);
    expect(info.enemyCount).toBe(0);
    expect(() => scene.render(fakeRenderer(), 0)).not.toThrow();
    scene.update(DT, held);
    expect(scene.getDebugInfo!().bossMaxHp).toBeGreaterThan(0);
    expect(scene.getDebugInfo!().enemyCount).toBe(0);
    expect(scene.getBattleView().player.x).not.toBe(LOGICAL_W / 2);
    expect(scene.getDebugInfo!().gameTime).toBeGreaterThan(OBSIDIAN_ENTER_AT);
    scene.exit?.();
  });

  it('plays the catapult launch on a stage start and ignores the stick until it ends', () => {
    const scene = createBattleScene(stageRun());
    scene.enter();
    const parked = scene.getBattleView().player;
    expect(parked.x).toBe(LOGICAL_W / 2);
    expect(parked.y).toBe(CARRIER_PARK_Y);
    expect(parked.y).toBeLessThan(LOGICAL_H);
    const bombs = scene.getDebugInfo!().bombs;

    const lightFrames = Math.round(CARRIER_LIGHTS_TIME / DT);
    for (let i = 0; i < lightFrames - 1; i++) scene.update(DT, held);
    let info = scene.getDebugInfo!();
    expect(info.gameTime).toBe(0);
    expect(scene.getScroll()).toBe(0);
    expect(info.bulletCount).toBe(0);
    expect(info.bombs).toBe(bombs);
    expect(scene.getBattleView().player).toEqual({ x: LOGICAL_W / 2, y: CARRIER_PARK_Y });

    scene.update(DT, held);
    info = scene.getDebugInfo!();
    expect(info.gameTime).toBeCloseTo(DT, 8);
    expect(scene.getScroll()).toBeCloseTo(BG_SCROLL_SPEED * DT, 5);
    expect(scene.getBattleView().player.y).toBe(CARRIER_PARK_Y);
    expect(info.bulletCount).toBe(0);

    const rushFrames = Math.round(CARRIER_RUSH_TIME / DT);
    for (let i = 0; i < rushFrames - 1; i++) scene.update(DT, held);
    const rushing = scene.getBattleView().player;
    expect(rushing.x).toBe(LOGICAL_W / 2);
    expect(rushing.y).toBeLessThan(CARRIER_PARK_Y);
    expect(rushing.y).toBeGreaterThan(PLAYER_SPAWN_Y);
    info = scene.getDebugInfo!();
    expect(info.bulletCount).toBe(0);
    expect(info.bombs).toBe(bombs);
    expect(scene.getScroll()).toBeCloseTo(BG_SCROLL_SPEED * (info.gameTime ?? 0), 4);

    scene.update(DT, held);
    const live = scene.getBattleView().player;
    info = scene.getDebugInfo!();
    expect(live.y).toBeCloseTo(PLAYER_SPAWN_Y, 5);
    expect(live.x).toBeGreaterThan(LOGICAL_W / 2);
    expect(info.bulletCount).toBeGreaterThan(0);
    expect(info.bombs).toBe(bombs);
    expect(scene.getScroll()).toBeCloseTo(BG_SCROLL_SPEED * (info.gameTime ?? 0), 4);
    scene.exit?.();
  });

  it('parks a carried stage-4 handoff instead of flying in from below', () => {
    const ctx = stageRun();
    ctx.carriedRun = carried();
    const scene = createBattleScene(ctx);
    scene.enter();
    const info = scene.getDebugInfo!();
    expect(info.score).toBe(42000);
    expect(info.power).toBe(3);
    expect(info.mateLevel).toBe(1);
    expect(info.bombs).toBe(1);
    expect(scene.getBattleView().player.y).toBe(CARRIER_PARK_Y);
    scene.exit?.();
  });

  it('does not launch during 地图预览 or on stage 1', () => {
    const preview = createBattleScene({
      ...battleContext('stage', 'easy', seeded(7)),
      playMode: 'mapPreview',
      runStage: '4',
      previewMap: 'map:seaB',
    });
    preview.enter();
    expect(preview.getBattleView().player.y).toBe(LOGICAL_H + 40);
    preview.update(DT, held);
    expect(preview.getDebugInfo!().gameTime).toBeCloseTo(DT, 8);
    expect(preview.getScroll()).toBeGreaterThan(0);
    expect(preview.getBattleView().player.y).toBeLessThan(LOGICAL_H + 40);
    preview.exit?.();

    const stage1 = createBattleScene(battleContext('stage', 'easy', seeded(1)));
    stage1.enter();
    expect(stage1.getBattleView().player.y).toBe(LOGICAL_H + 40);
    stage1.update(DT, makeInput());
    expect(stage1.getDebugInfo!().gameTime).toBeCloseTo(DT, 8);
    expect(stage1.getScroll()).toBeGreaterThan(0);
    expect(stage1.getBattleView().player.y).toBeLessThan(LOGICAL_H + 40);
    stage1.exit?.();
  });
});
