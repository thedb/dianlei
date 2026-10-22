/**
 * Shared harness for battle-scene replay tests: a local seeded generator, an
 * FNV digest, a scene context, and the look-ahead dodge pilot. Kept free of
 * game randomness so a harness bug can never mask a gameplay change.
 */

import { vi } from 'vitest';
import { makeInput } from './fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import type { Difficulty } from '@/game/difficulty';
import type { ControlsView, InputState } from '@/engine/input';
import type { BattleEntry, SceneContext } from '@/game/scenes/types';
import type { BattleScene } from '@/game/scenes/battle';

export const DT = 1 / 60;

/** mulberry32 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fnv(hash: number, text: string): number {
  let h = hash;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function forbidMathRandom(): void {
  vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('gameplay called Math.random');
  });
}

export function battleContext(
  entry: BattleEntry,
  difficulty: Difficulty,
  rng: () => number
): SceneContext {
  const settings = createSettingsStore(createMemoryStorage());
  const layout = computeControlLayout(settings.get(), { top: 0, bottom: 0 });
  const view: ControlsView = {
    layout,
    settings: settings.get(),
    joystick: { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, alpha: 1 },
    buttonAPressed: false,
    buttonBPressed: false,
  };
  forbidMathRandom();
  return {
    rng,
    showDebug: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    settings,
    storage: createMemoryStorage(),
    run: { report: null },
    battleEntry: entry,
    difficulty,
    ...(entry === 'boss' ? { challengeStage: '1' } : {}),
    input: { setControlsEnabled: () => undefined, getControlsView: () => view },
  };
}

const STICKS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
];

/** Same look-ahead dodger as `battle.replay.test.ts`. */
export function dodgePilot(scene: BattleScene, seed: number, frame: number): InputState {
  const info = scene.getDebugInfo!();
  const world = scene.getBattleView();
  const { x: px, y: py } = world.player;
  const speed = 230;
  let target = 180 + Math.sin((frame / 60) * 0.7 + seed) * 90;
  let nearest = Infinity;
  for (const e of world.enemies) {
    if (e.y < py - 60 && e.y > 0) {
      const d = Math.abs(e.x - px) + (py - e.y) * 0.2;
      if (d < nearest) {
        nearest = d;
        target = e.x;
      }
    }
  }
  const homeY = 540;
  let best = 0;
  let bestScore = -Infinity;
  let bestDanger = Infinity;
  for (let i = 0; i < STICKS.length; i++) {
    const [sx, sy] = STICKS[i]!;
    let minD = Infinity;
    for (let k = 1; k <= 8; k++) {
      const t = k * 0.05;
      const qx = Math.max(18, Math.min(342, px + sx * speed * t));
      const qy = Math.max(18, Math.min(622, py + sy * speed * t));
      for (const b of world.bullets) {
        const dx = b.x + b.vx * t - qx;
        const dy = b.y + b.vy * t - qy;
        const d = Math.sqrt(dx * dx + dy * dy) - 5;
        if (d < minD) minD = d;
      }
      for (const e of world.enemies) {
        const dx = e.x - qx;
        const dy = e.y - qy;
        const d = Math.sqrt(dx * dx + dy * dy) - 22;
        if (d < minD) minD = d;
      }
    }
    const nx = px + sx * 20;
    const ny = py + sy * 20;
    const score =
      Math.min(minD, 40) * 4 - Math.abs(nx - target) * 0.15 - Math.abs(ny - homeY) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
      bestDanger = minD;
    }
  }
  const [jx, jy] = STICKS[best]!;
  const bomb = bestDanger < 4 && info.bombs > 0 && frame % 2 === 0;
  return makeInput({
    joystickX: jx,
    joystickY: jy,
    joystickMagnitude: jx === 0 && jy === 0 ? 0 : 1,
    buttonA: true,
    buttonB: bomb,
  });
}
