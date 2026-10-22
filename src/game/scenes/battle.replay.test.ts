/**
 * Deterministic replays. A fixed seed plus a scripted pilot drives the real
 * battle scene through Stage 1 and boss practice; each run must land on the
 * same outcome, score, kills, boss phase timeline, and per-frame digest.
 * The expected values were captured on the pre-P11 code path (with the same
 * seeded generator standing in for `Math.random`), so any change here is a
 * gameplay change.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeInput } from '@/test/fakes';
import { createMemoryStorage, createSettingsStore } from '@/game/settings';
import { computeControlLayout } from '@/game/controls';
import type { Difficulty } from '@/game/difficulty';
import type { ControlsView, InputState } from '@/engine/input';
import { attractInput, createTitleAttract } from './titleAttract';
import { weaponTestMainRect, weaponTestSubRect } from './weaponTest';
import type { AttractPlan } from './attractPilot';
import type { BattleEntry, SceneContext } from './types';
import { createBattleScene, type BattleScene } from './battle';

vi.mock('@/game/art', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/game/art')>();
  return { ...actual, createGameAssets: () => ({ background: {} }) };
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

const DT = 1 / 60;

/** mulberry32, kept local so the harness never depends on game code it is checking. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fnv(hash: number, text: string): number {
  let h = hash;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Gameplay randomness must come from the injected `rng`, never `Math.random`. */
function forbidMathRandom(): void {
  vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('gameplay called Math.random');
  });
}

function context(entry: BattleEntry, difficulty: Difficulty, rng: () => number): SceneContext {
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

/**
 * Look-ahead dodger. Scores each stick by the closest enemy bullet or air body
 * over the next 0.4s, drifts toward a lane under the nearest enemy, and bombs
 * on a one-frame edge when nothing is safe.
 */
function dodgePilot(scene: BattleScene, plan: AttractPlan, frame: number): InputState {
  const info = scene.getDebugInfo!();
  const world = scene.getBattleView();
  const { x: px, y: py } = world.player;
  const speed = 230;
  let target = 180 + Math.sin((frame / 60) * 0.7 + plan.seed) * 90;
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
    const danger = minD;
    const score =
      Math.min(minD, 40) * 4 - Math.abs(nx - target) * 0.15 - Math.abs(ny - homeY) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = i;
      bestDanger = danger;
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

/** The title demo's stick with A held. Weaker, so it covers deaths and game over. */
function demoPilot(scene: BattleScene, plan: AttractPlan): InputState {
  const time = scene.getDebugInfo!().gameTime ?? 0;
  return attractInput(time, 'auto', { plan, world: scene.getBattleView() });
}

type Pilot = 'dodge' | 'demo';

interface ReplayResult {
  outcome: string;
  frames: number;
  score: number;
  lives: number;
  report: SceneContext['run']['report'];
  bossPhases: string[];
  digest: number;
}

function replay(
  entry: BattleEntry,
  difficulty: Difficulty,
  seed: number,
  maxSeconds: number,
  pilot: Pilot = 'dodge'
): ReplayResult {
  const ctx = context(entry, difficulty, seeded(seed));
  const scene = createBattleScene(ctx);
  scene.enter();
  const plan: AttractPlan = { routeId: seed % 6, seed: (seed % 997) + 1 };
  const phases: string[] = [];
  let lastPhase = '';
  let digest = 2166136261;
  let outcome = 'timeout';
  let frame = 0;
  const maxFrames = Math.round(maxSeconds / DT);
  for (; frame < maxFrames; frame++) {
    const input = pilot === 'dodge' ? dodgePilot(scene, plan, frame) : demoPilot(scene, plan);
    const next = scene.update(DT, input);
    const info = scene.getDebugInfo!();
    const phase = info.bossPhase ?? '';
    if (phase !== lastPhase) {
      phases.push(`${phase}@${frame}`);
      lastPhase = phase;
    }
    if (frame % 15 === 0 || next) {
      const view = scene.getBattleView();
      let ex = 0;
      for (const e of view.enemies) ex += e.x * 3 + e.y;
      let bx = 0;
      for (const b of view.bullets) bx += b.x * 3 + b.y + b.vx * 7 + b.vy;
      digest = fnv(
        digest,
        [
          frame,
          info.score,
          info.lives,
          info.bombs,
          info.power,
          info.subLevel,
          info.enemyCount,
          info.enemyBulletCount,
          info.bulletCount,
          info.missileCount,
          info.buildingCount,
          info.activeExplosions,
          phase,
          view.player.x.toFixed(6),
          view.player.y.toFixed(6),
          ex.toFixed(6),
          bx.toFixed(6),
        ].join('|')
      );
    }
    if (next) {
      outcome = next;
      break;
    }
  }
  const info = scene.getDebugInfo!();
  return {
    outcome,
    frames: frame,
    score: info.score ?? 0,
    lives: info.lives ?? 0,
    report: ctx.run.report,
    bossPhases: phases,
    digest,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const CASES: ReadonlyArray<{
  name: string;
  entry: BattleEntry;
  difficulty: Difficulty;
  seed: number;
  seconds: number;
  pilot: Pilot;
}> = [
  {
    name: 'stage 1 easy, full clear',
    entry: 'stage',
    difficulty: 'easy',
    seed: 11,
    seconds: 240,
    pilot: 'dodge',
  },
  {
    name: 'stage 1 medium, full clear',
    entry: 'stage',
    difficulty: 'medium',
    seed: 23,
    seconds: 240,
    pilot: 'dodge',
  },
  {
    name: 'stage 1 hard, full clear with phase 3',
    entry: 'stage',
    difficulty: 'hard',
    seed: 37,
    seconds: 240,
    pilot: 'dodge',
  },
  {
    name: 'stage 1 easy, demo pilot game over',
    entry: 'stage',
    difficulty: 'easy',
    seed: 11,
    seconds: 240,
    pilot: 'demo',
  },
  {
    name: 'stage 1 hard, demo pilot game over',
    entry: 'stage',
    difficulty: 'hard',
    seed: 37,
    seconds: 240,
    pilot: 'demo',
  },
  {
    name: 'boss practice 普通',
    entry: 'boss',
    difficulty: 'easy',
    seed: 5,
    seconds: 150,
    pilot: 'dodge',
  },
  {
    name: 'boss practice 困难',
    entry: 'boss',
    difficulty: 'hard',
    seed: 9,
    seconds: 150,
    pilot: 'dodge',
  },
];

const EXPECTED: Record<string, ReplayResult> = {
  'stage 1 easy, full clear': {
    outcome: 'result',
    frames: 12957,
    score: 88520,
    lives: 3,
    report: {
      outcome: 'clear',
      baseScore: 88520,
      kills: 131,
      spawned: 149,
      deaths: 0,
      time: 213.1333333333951,
    },
    bossPhases: [
      'enter@9299',
      'phase1@9479',
      'transition@10483',
      'phase2@10574',
      'death@12636',
      'clear@12787',
      'done@12957',
    ],
    digest: 2911893839,
  },
  'stage 1 medium, full clear': {
    outcome: 'result',
    frames: 12060,
    score: 88560,
    lives: 3,
    report: {
      outcome: 'clear',
      baseScore: 88560,
      kills: 130,
      spawned: 148,
      deaths: 0,
      time: 198.20000000004987,
    },
    bossPhases: [
      'enter@9299',
      'phase1@9479',
      'transition@10187',
      'phase2@10278',
      'death@11740',
      'clear@11891',
      'done@12060',
    ],
    digest: 3486602057,
  },
  'stage 1 hard, full clear with phase 3': {
    outcome: 'result',
    frames: 13885,
    score: 87650,
    lives: 1,
    report: {
      outcome: 'clear',
      baseScore: 87650,
      kills: 137,
      spawned: 149,
      deaths: 2,
      time: 228.71666666674082,
    },
    bossPhases: [
      'enter@9299',
      'phase1@9479',
      'transition@10335',
      'phase2@10426',
      'transition3@12262',
      'phase3@12334',
      'death@13571',
      'clear@13722',
      'done@13885',
    ],
    digest: 4037038383,
  },
  'stage 1 easy, demo pilot game over': {
    outcome: 'gameover',
    frames: 4956,
    score: 11600,
    lives: 0,
    report: {
      outcome: 'gameover',
      baseScore: 11600,
      kills: 35,
      spawned: 73,
      deaths: 3,
      time: 82.61666666666326,
    },
    bossPhases: [],
    digest: 1908201645,
  },
  'stage 1 hard, demo pilot game over': {
    outcome: 'gameover',
    frames: 5029,
    score: 6600,
    lives: 0,
    report: {
      outcome: 'gameover',
      baseScore: 6600,
      kills: 12,
      spawned: 73,
      deaths: 3,
      time: 83.83333333332986,
    },
    bossPhases: [],
    digest: 2281493793,
  },
  'boss practice 普通': {
    outcome: 'result',
    frames: 3221,
    score: 40220,
    lives: 3,
    report: {
      outcome: 'clear',
      baseScore: 40220,
      kills: 0,
      spawned: 0,
      deaths: 0,
      time: 205.9000000000405,
    },
    bossPhases: [
      'enter@0',
      'phase1@180',
      'transition@1042',
      'phase2@1133',
      'death@2902',
      'clear@3053',
      'done@3221',
    ],
    digest: 3466715180,
  },
  'boss practice 困难': {
    outcome: 'result',
    frames: 5205,
    score: 40520,
    lives: 1,
    report: {
      outcome: 'clear',
      baseScore: 40520,
      kills: 0,
      spawned: 0,
      deaths: 2,
      time: 239.00000000006685,
    },
    bossPhases: [
      'enter@0',
      'phase1@180',
      'transition@1329',
      'phase2@1420',
      'transition3@3629',
      'phase3@3701',
      'death@4888',
      'clear@5039',
      'done@5205',
    ],
    digest: 3812299598,
  },
};

describe('deterministic replay', () => {
  it('replays the same run twice from one seed', () => {
    const a = replay('stage', 'easy', 11, 60);
    const b = replay('stage', 'easy', 11, 60);
    expect(b).toEqual(a);
  });

  for (const c of CASES) {
    it(c.name, () => {
      const got = replay(c.entry, c.difficulty, c.seed, c.seconds, c.pilot);
      if (process.env.REPLAY_CAPTURE) {
        // eslint-disable-next-line no-console
        console.log('CAPTURE ' + JSON.stringify({ [c.name]: got }));
        return;
      }
      expect(got).toEqual(EXPECTED[c.name]);
    });
  }
});

const EXPECTED_MODES: Record<string, unknown> = {
  attract: {
    plans: ['0/61958@0', '5/699030@3098'],
    digest: 2792855228,
    final: {
      time: 23.349999999999955,
      spawned: 15,
      bullets: 4,
      enemies: 1,
      enemyBullets: 6,
      playerDead: false,
      explosions: 0,
      lives: 3,
      bombs: 2,
      fade: 0,
      sceneId: 'battle',
    },
  },
  weaponTest: {
    samples: [
      '0|0.0000|0',
      '0|0.0000|0',
      '8|8.0000|2',
      '28|20.0000|2',
      '41|13.0000|2',
      '57|16.0000|2',
      '68|11.0000|2',
      '86|18.0000|2',
    ],
    final: {
      totalDamage: 97,
      dps: 13,
      lastHit: 2,
      mainLevel: 3,
      subLevel: 2,
      mateLevel: 0,
      bombs: 2,
      mainRate: 5,
      mainDamage: 2,
      homingRate: 1.5,
      homingDamage: 2.5,
    },
    info: {
      bombs: 2,
      bombCooldown: 0,
      bulletCount: 12,
      fireHeld: true,
      bombPressed: false,
      enemyCount: 0,
      enemyBulletCount: 0,
      score: 0,
      power: 3,
      mainWeapon: 'vulcan',
      subWeapon: 'homing',
      subLevel: 2,
      mateLevel: 0,
      missileCount: 6,
      lives: 3,
      paused: false,
      gameTime: 8.033333333333312,
      playerDead: false,
      activeExplosions: 0,
      waveSpawned: 0,
      buildingCount: 0,
      buildingDrop: 'B',
    },
  },
};

function capture(name: string, got: unknown): boolean {
  if (!process.env.REPLAY_CAPTURE) return false;
  // eslint-disable-next-line no-console
  console.log('CAPTURE ' + JSON.stringify({ [name]: got }));
  return true;
}

describe('deterministic replay, other play modes', () => {
  it('title attract demo', () => {
    forbidMathRandom();
    const demo = createTitleAttract('auto', { rng: seeded(7), worldRng: seeded(71) });
    demo.start();
    let digest = 2166136261;
    const plans: string[] = [];
    let lastPlan = '';
    for (let frame = 0; frame < 60 * 75; frame++) {
      demo.update(DT);
      const plan = demo.plan();
      const key = `${plan.routeId}/${plan.seed}`;
      if (key !== lastPlan) {
        plans.push(`${key}@${frame}`);
        lastPlan = key;
      }
      if (frame % 15 === 0) {
        const st = demo.stats();
        const view = demo.pilotView();
        digest = fnv(
          digest,
          [
            frame,
            st.time.toFixed(6),
            st.spawned,
            st.bullets,
            st.enemies,
            st.enemyBullets,
            st.playerDead,
            st.explosions,
            st.lives,
            st.bombs,
            st.fade.toFixed(6),
            view.player.x.toFixed(6),
            view.player.y.toFixed(6),
          ].join('|')
        );
      }
    }
    const got = { plans, digest, final: demo.stats() };
    if (capture('attract', got)) return;
    expect(got).toEqual(EXPECTED_MODES.attract);
  });

  it('weapon test range', () => {
    const ctx = { ...context('stage', 'easy', seeded(3)), playMode: 'weaponTest' as const };
    const scene = createBattleScene(ctx);
    scene.enter();
    const tap = (r: { x: number; y: number; w: number; h: number }) =>
      makeInput({ taps: [{ x: r.x + r.w / 2, y: r.y + r.h / 2 }] });
    scene.update(DT, tap(weaponTestMainRect(3)));
    scene.update(DT, tap(weaponTestSubRect(2)));
    const samples: string[] = [];
    for (let frame = 0; frame < 60 * 8; frame++) {
      const sx = Math.sin(frame / 40);
      scene.update(
        DT,
        makeInput({ buttonA: true, joystickX: sx, joystickMagnitude: Math.abs(sx) })
      );
      if (frame % 60 === 0) {
        const st = scene.getWeaponTestStats()!;
        samples.push(`${st.totalDamage}|${st.dps.toFixed(4)}|${st.lastHit}`);
      }
    }
    const got = { samples, final: scene.getWeaponTestStats(), info: scene.getDebugInfo!() };
    if (capture('weaponTest', got)) return;
    expect(got).toEqual(EXPECTED_MODES.weaponTest);
  });
});
