/**
 * Render replays. The same seeded runs as `battle.replay.test.ts`, but every
 * few frames the scene draws into a recording canvas. Sprite assets are stubs
 * named by their path, and the art draw helpers log their arguments, so the
 * digest covers what the battle scene draws, in which order, with which
 * values. Captured on the pre-split battle scene: a change here is a visual
 * change.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { DT, battleContext, dodgePilot, seeded } from '@/test/battleHarness';
import type { Renderer } from '@/engine/renderer';
import type { Difficulty } from '@/game/difficulty';
import type { InputState } from '@/engine/input';
import { attractInput } from './titleAttract';
import { weaponTestMainRect, weaponTestSubRect, weaponTestTuneIncRect } from './weaponTest';
import type { BattleEntry, SceneContext } from './types';
import { createBattleScene, type BattleScene } from './battle';

const rec = vi.hoisted(() => {
  const PATH = Symbol('path');
  const state = { hash: 2166136261, calls: 0 };

  function num(n: number): string {
    const s = n.toFixed(4);
    return s === '-0.0000' ? '0.0000' : s;
  }

  function ser(v: unknown, depth = 0): string {
    if (typeof v === 'number') return num(v);
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'boolean' || v === null || v === undefined) return String(v);
    if (typeof v === 'function') {
      const path = (v as unknown as Record<symbol, unknown>)[PATH];
      return typeof path === 'string' ? `<${path}>` : '<fn>';
    }
    if (depth > 2) return '{…}';
    if (Array.isArray(v)) return `[${v.map((x) => ser(x, depth + 1)).join(',')}]`;
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => k !== 'def')
      .map((k) => `${k}:${ser(obj[k], depth + 1)}`)
      .join(',')}}`;
  }

  function log(name: string, args: readonly unknown[]): void {
    const line = `${name}(${args.map((a) => ser(a)).join(',')})`;
    let h = state.hash;
    for (let i = 0; i < line.length; i++) {
      h ^= line.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    state.hash = h;
    state.calls++;
  }

  /** Any property is another stub; frames report fixed sizes. */
  function stub(path: string): unknown {
    const target = function stubTarget(): void {};
    return new Proxy(target, {
      get(_t, p) {
        if (p === PATH) return path;
        if (p === Symbol.iterator) return function* empty(): Generator<never> {};
        if (typeof p === 'symbol') return undefined;
        if (p === 'length') return 4;
        if (p === 'width' || p === 'height') return 16;
        if (p === 'anchorX' || p === 'anchorY') return 8;
        if (p === 'nozzles') return [{ x: 1, y: 2 }];
        if (p === 'then') return undefined;
        return stub(`${path}.${p}`);
      },
    });
  }

  function context(): CanvasRenderingContext2D {
    const props: Record<string, unknown> = {};
    return new Proxy(
      {},
      {
        get(_t, p) {
          if (typeof p === 'symbol') return undefined;
          if (p in props) return props[p];
          if (p === 'canvas') return { width: 360, height: 640 };
          if (p === 'measureText') return (t: string) => ({ width: t.length * 6 });
          return (...args: unknown[]) => {
            log(`ctx.${p}`, args);
            return stub(`ret.${p}`);
          };
        },
        set(_t, p, value) {
          if (typeof p === 'symbol') return true;
          props[p] = value;
          log(`ctx.${p}=`, [value]);
          return true;
        },
      }
    ) as CanvasRenderingContext2D;
  }

  function renderer(ctx: CanvasRenderingContext2D): Renderer {
    return new Proxy(
      {},
      {
        get(_t, p) {
          if (p === 'getContext') return () => ctx;
          return (...args: unknown[]) => log(`r.${String(p)}`, args);
        },
      }
    ) as Renderer;
  }

  return { state, log, stub, context, renderer };
});

vi.mock('@/game/art', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/game/art')>();
  const logged =
    (name: string) =>
    (...args: unknown[]): void =>
      rec.log(name, args.slice(name === 'drawBossWorld' ? 2 : 1));
  return {
    ...actual,
    createGameAssets: () => ({
      background: {},
      player: rec.stub('player'),
      enemies: rec.stub('enemies'),
      buildings: rec.stub('buildings'),
      bullets: rec.stub('bullets'),
      items: rec.stub('items'),
      explosions: rec.stub('explosions'),
      bosses: rec.stub('bosses'),
    }),
    drawPlayerFlames: logged('drawPlayerFlames'),
    drawEnemyFlame: logged('drawEnemyFlame'),
    drawBulletGlow: logged('drawBulletGlow'),
    drawBackground: logged('drawBackground'),
    drawBossWorld: logged('drawBossWorld'),
    drawBossHpBar: logged('drawBossHpBar'),
    drawBossLaser: logged('drawBossLaser'),
    drawBombShockwave: logged('drawBombShockwave'),
    drawHomingExhaust: logged('drawHomingExhaust'),
  };
});

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

afterEach(() => {
  vi.restoreAllMocks();
});

interface RenderResult {
  outcome: string;
  frames: number;
  renders: number;
  calls: number;
  hash: number;
}

function draw(scene: BattleScene, frame: number): void {
  const ctx = rec.context();
  rec.log('frame', [frame]);
  scene.render(rec.renderer(ctx), (frame % 7) / 7);
}

function run(
  ctx: SceneContext,
  seconds: number,
  every: number,
  pilot: (scene: BattleScene, frame: number) => InputState
): RenderResult {
  rec.state.hash = 2166136261;
  rec.state.calls = 0;
  const scene = createBattleScene(ctx);
  scene.enter();
  let renders = 0;
  let outcome = 'timeout';
  let frame = 0;
  const maxFrames = Math.round(seconds / DT);
  for (; frame < maxFrames; frame++) {
    const next = scene.update(DT, pilot(scene, frame));
    if (frame % every === 0 || next) {
      draw(scene, frame);
      renders++;
    }
    if (next) {
      outcome = next;
      break;
    }
  }
  return { outcome, frames: frame, renders, calls: rec.state.calls, hash: rec.state.hash };
}

function stageRun(
  entry: BattleEntry,
  difficulty: Difficulty,
  seed: number,
  seconds: number,
  pilot: 'dodge' | 'demo'
): RenderResult {
  const ctx = battleContext(entry, difficulty, seeded(seed));
  const plan = { routeId: seed % 6, seed: (seed % 997) + 1 };
  return run(ctx, seconds, 23, (scene, frame) =>
    pilot === 'dodge'
      ? dodgePilot(scene, plan.seed, frame)
      : attractInput(scene.getDebugInfo!().gameTime ?? 0, 'auto', {
          plan,
          world: scene.getBattleView(),
        })
  );
}

const EXPECTED: Record<string, RenderResult> = {
  'stage easy': { outcome: 'result', frames: 12957, renders: 565, calls: 84948, hash: 1970209475 },
  'stage hard': { outcome: 'result', frames: 13885, renders: 605, calls: 90982, hash: 1537338769 },
  'stage demo': { outcome: 'gameover', frames: 4956, renders: 217, calls: 30352, hash: 3569853036 },
  'boss hard': { outcome: 'result', frames: 5205, renders: 228, calls: 34209, hash: 2214869741 },
  attract: { outcome: 'timeout', frames: 5400, renders: 318, calls: 24665, hash: 2185208717 },
  weaponTest: { outcome: 'timeout', frames: 600, renders: 55, calls: 23578, hash: 1094835362 },
  pause: { outcome: 'timeout', frames: 720, renders: 56, calls: 5607, hash: 1977861426 },
};

function check(name: string, got: RenderResult): void {
  if (process.env.REPLAY_CAPTURE) {
    // eslint-disable-next-line no-console
    console.log('CAPTURE ' + JSON.stringify({ [name]: got }));
    return;
  }
  expect(got).toEqual(EXPECTED[name]);
}

describe('render replay', () => {
  it('stage 1 easy, full clear', () => {
    check('stage easy', stageRun('stage', 'easy', 11, 240, 'dodge'));
  });

  it('stage 1 hard, phase 3 and deaths', () => {
    check('stage hard', stageRun('stage', 'hard', 37, 240, 'dodge'));
  });

  it('stage 1 easy, demo pilot game over', () => {
    check('stage demo', stageRun('stage', 'easy', 11, 240, 'demo'));
  });

  it('boss practice 困难', () => {
    check('boss hard', stageRun('boss', 'hard', 9, 150, 'dodge'));
  });

  it('attract play mode', () => {
    const ctx = { ...battleContext('stage', 'easy', seeded(71)), playMode: 'attract' as const };
    const plan = { routeId: 1, seed: 42 };
    check(
      'attract',
      run(ctx, 90, 17, (scene) =>
        attractInput(scene.getDebugInfo!().gameTime ?? 0, 'auto', {
          plan,
          world: scene.getBattleView(),
        })
      )
    );
  });

  it('weapon test range with taps, bomb, and pause', () => {
    const ctx = { ...battleContext('stage', 'easy', seeded(3)), playMode: 'weaponTest' as const };
    const tap = (r: { x: number; y: number; w: number; h: number }) =>
      makeInput({ taps: [{ x: r.x + r.w / 2, y: r.y + r.h / 2 }] });
    check(
      'weaponTest',
      run(ctx, 10, 11, (_scene, frame) => {
        if (frame === 5) return tap(weaponTestMainRect(3));
        if (frame === 6) return tap(weaponTestSubRect(2));
        if (frame === 7) return tap(weaponTestTuneIncRect('mainRate'));
        if (frame === 200) return makeInput({ buttonA: true, buttonB: true });
        if (frame === 560) return makeInput({ pausePressed: true });
        const sx = Math.sin(frame / 40);
        return makeInput({ buttonA: true, joystickX: sx, joystickMagnitude: Math.abs(sx) });
      })
    );
  });

  it('stage pause menu', () => {
    const ctx = battleContext('stage', 'medium', seeded(23));
    check(
      'pause',
      run(ctx, 12, 13, (scene, frame) =>
        frame === 400 ? makeInput({ pausePressed: true }) : dodgePilot(scene, 24, frame)
      )
    );
  });
});
