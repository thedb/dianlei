import { describe, expect, it } from 'vitest';
import { createRng } from '@/engine/rng';
import {
  FIXED_DT,
  FURNACE_CORE_HP,
  FURNACE_CORE_RADIUS,
  FURNACE_CORE_SCORE,
  FURNACE_ENTER_AT,
  FURNACE_ENTER_DURATION,
  FURNACE_IRIS_MAIN,
  FURNACE_IRIS_OVERLOAD,
  FURNACE_OVERLOAD_HP,
  FURNACE_PETAL_STEP,
  FURNACE_PHASE_INVULN,
  FURNACE_POD_HP,
  FURNACE_POD_SCORE,
  STAGE3_WARNING_AT,
} from '@/game/config';
import { prepareBossConfig } from '@/game/difficulty';
import { FURNACE } from '@/game/levels/bosses/furnace';
import {
  applyBossBomb,
  bossActiveLaser,
  bossHpBarLayout,
  bossMissileTargets,
  bossPart,
  createBoss,
  resolveBossBullet,
  updateBoss,
  type BossEvents,
  type BossRuntime,
  type BossWorld,
} from './boss';
import {
  FURNACE_CORE_ID,
  FURNACE_POD_IDS,
  furnaceCoreExposed,
  furnaceIris,
  furnacePetalBase,
  furnacePetals,
  furnaceReadout,
} from './furnace';

function world(): BossWorld {
  return { playerX: 180, playerY: 560, rng: createRng(3) };
}

interface Log {
  events: BossEvents[];
}

function step(boss: BossRuntime, around: BossWorld, seconds: number, log?: Log): void {
  const frames = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < frames; i++) {
    const ev = updateBoss(boss, FIXED_DT, around);
    log?.events.push(ev);
  }
}

function shot(boss: BossRuntime, x: number, y: number, damage = 1) {
  return resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage);
}

function easy(): BossRuntime {
  return createBoss(prepareBossConfig(FURNACE, 'easy'));
}

function hard(): BossRuntime {
  return createBoss(prepareBossConfig(FURNACE, 'hard'), { gates: ['hard'] });
}

function park(boss: BossRuntime, around: BossWorld): void {
  step(boss, around, FURNACE_ENTER_DURATION + 0.1);
  expect(boss.stage).toBe('fight');
}

function killPods(boss: BossRuntime): void {
  for (const id of FURNACE_POD_IDS) {
    const pod = bossPart(boss, id)!;
    if (!pod.alive) continue;
    shot(boss, pod.worldX, pod.worldY, 100000);
  }
}

/** Pods dead and the 1.2s invulnerable beat over: the core phase is fighting. */
function toCore(boss: BossRuntime, around: BossWorld, log?: Log): void {
  park(boss, around);
  killPods(boss);
  expect(boss.stage).toBe('transition');
  step(boss, around, FURNACE_PHASE_INVULN + 0.05, log);
  expect(boss.stage).toBe('fight');
  expect(furnaceIris(boss)).toBe('closed');
}

function core(boss: BossRuntime) {
  return bossPart(boss, FURNACE_CORE_ID)!;
}

describe('炉心 config', () => {
  it('is the furnace script with pods, a core, and no laser', () => {
    expect(FURNACE.script).toBe('furnace');
    expect(FURNACE.art).toBe('furnace');
    expect(FURNACE.title).toBe('炉心');
    expect(FURNACE.enterAt).toBe(FURNACE_ENTER_AT);
    expect(FURNACE_ENTER_AT).toBe(123);
    expect(STAGE3_WARNING_AT).toBe(118);
    expect(FURNACE.hullTransfers).toBe(true);
    expect(FURNACE.parts.map((p) => p.id)).toEqual([...FURNACE_POD_IDS, FURNACE_CORE_ID]);
    for (const phase of FURNACE.phases) {
      expect(phase.attacks).toEqual([]);
    }
    expect(FURNACE.phases.map((p) => [p.id, p.gate ?? null, p.bar])).toEqual([
      ['pods', null, 'main'],
      ['core', null, 'main'],
      ['overload', 'hard', 'extra'],
    ]);
  });

  it('scales HP without rounding: Easy 560, Medium 644, Hard 728 + 234', () => {
    const total = (d: 'easy' | 'medium' | 'hard') =>
      prepareBossConfig(FURNACE, d).parts.reduce((sum, p) => sum + p.hp, 0);
    expect(total('easy')).toBe(4 * FURNACE_POD_HP + FURNACE_CORE_HP);
    expect(total('easy')).toBe(560);
    expect(total('medium')).toBeCloseTo(644, 6);
    expect(total('hard')).toBeCloseTo(728, 6);
    expect(hard().extraMax).toBeCloseTo(FURNACE_OVERLOAD_HP * 1.3, 6);
    expect(easy().extraMax).toBe(0);
  });
});

describe('炉心 pods', () => {
  it('takes pod hits directly and moves chassis hits onto the nearest pod', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    const pod = bossPart(boss, 'pod0')!;
    const before = pod.hp;
    expect(shot(boss, pod.worldX, pod.worldY, 5).consumedBullet).toBe(true);
    expect(pod.hp).toBe(before - 5);

    const hpBefore = FURNACE_POD_IDS.map((id) => bossPart(boss, id)!.hp);
    const ev = shot(boss, boss.x + 70, boss.y - 10, 3);
    expect(ev.consumedBullet).toBe(true);
    const hpAfter = FURNACE_POD_IDS.map((id) => bossPart(boss, id)!.hp);
    expect(hpAfter.reduce((a, b) => a + b, 0)).toBe(hpBefore.reduce((a, b) => a + b, 0) - 3);
    expect(core(boss).hp).toBe(FURNACE_CORE_HP);
  });

  it('pays each pod and fires only fans, flak, and missiles while orbiting', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    const log: Log = { events: [] };
    step(boss, around, 6, log);
    const types = new Set(log.events.flatMap((ev) => ev.bolts.map((b) => b.type)));
    expect([...types].sort()).toEqual(['missile', 'small']);
    expect(bossActiveLaser(boss)).toBeNull();

    const pod = bossPart(boss, 'pod1')!;
    const ev = shot(boss, pod.worldX, pod.worldY, 100000);
    expect(ev.score).toBe(FURNACE_POD_SCORE);
    expect(pod.alive).toBe(false);
  });

  it('holds 1.2s invulnerable after the last pod, then opens the core phase closed', () => {
    const around = world();
    const boss = easy();
    park(boss, around);
    killPods(boss);
    expect(boss.stage).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    const c = core(boss);
    const ev = shot(boss, c.worldX, c.worldY, 50);
    expect(ev.consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    expect(bossMissileTargets(boss)).toEqual([]);
    expect(applyBossBomb(boss).score).toBe(0);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    step(boss, around, FURNACE_PHASE_INVULN - 0.1);
    expect(boss.stage).toBe('transition');
    step(boss, around, 0.15);
    expect(boss.stage).toBe('fight');
    expect(furnaceIris(boss)).toBe('closed');
  });
});

describe('炉心 iris', () => {
  it('blocks the core while closed and lets bullets and homing in while opening / open', () => {
    const around = world();
    const boss = easy();
    toCore(boss, around);
    const c = core(boss);

    expect(furnaceCoreExposed(boss)).toBe(false);
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    expect(shot(boss, boss.x + 60, boss.y + 40, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP);
    expect(bossMissileTargets(boss)).toEqual([]);

    step(boss, around, FURNACE_IRIS_MAIN.closed + 0.05);
    expect(furnaceIris(boss)).toBe('opening');
    expect(furnaceCoreExposed(boss)).toBe(true);
    expect(bossMissileTargets(boss).map((p) => p.id)).toEqual([FURNACE_CORE_ID]);
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 5);

    step(boss, around, FURNACE_IRIS_MAIN.opening);
    expect(furnaceIris(boss)).toBe('open');
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);

    for (const petal of furnacePetals(boss)) {
      expect(shot(boss, petal.x, petal.y, 5).consumedBullet).toBe(true);
    }
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);

    // The throat under the core is open: a shot there flies on toward the core.
    const throat = shot(boss, c.worldX, c.worldY + FURNACE_CORE_RADIUS + 30, 5);
    expect(throat.consumedBullet).toBe(false);
    // Chassis away from the throat still blocks.
    expect(shot(boss, boss.x + 80, boss.y + 40, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);

    step(boss, around, FURNACE_IRIS_MAIN.open + 0.05);
    expect(furnaceIris(boss)).toBe('closing');
    expect(furnaceCoreExposed(boss)).toBe(false);
    expect(shot(boss, c.worldX, c.worldY, 5).consumedBullet).toBe(true);
    expect(c.hp).toBe(FURNACE_CORE_HP - 10);
  });

  it('turns the petals 45° on every return to closed', () => {
    const around = world();
    const boss = easy();
    toCore(boss, around);
    const cycle =
      FURNACE_IRIS_MAIN.closed +
      FURNACE_IRIS_MAIN.opening +
      FURNACE_IRIS_MAIN.open +
      FURNACE_IRIS_MAIN.closing;
    const base0 = furnacePetalBase(boss);
    step(boss, around, cycle + 1);
    expect(furnaceReadout(boss)?.turns).toBe(1);
    expect(furnacePetalBase(boss)).toBeCloseTo(base0 + FURNACE_PETAL_STEP, 6);
    step(boss, around, cycle);
    expect(furnaceReadout(boss)?.turns).toBe(2);
    expect(furnacePetalBase(boss)).toBeCloseTo(base0 + 2 * FURNACE_PETAL_STEP, 6);
  });

  it('lets a bomb reach the core even with the petals shut', () => {
    const around = world();
    const boss = easy();
    toCore(boss, around);
    expect(furnaceIris(boss)).toBe('closed');
    const before = core(boss).hp;
    applyBossBomb(boss);
    expect(core(boss).hp).toBeLessThan(before);
  });

  it('fires flak and missiles while shut, the flame fan while open, never a laser', () => {
    const around = world();
    const boss = easy();
    const log: Log = { events: [] };
    toCore(boss, around, log);
    log.events.length = 0;
    step(boss, around, FURNACE_IRIS_MAIN.closed - 0.05, log);
    const shut = new Set(log.events.flatMap((ev) => ev.bolts.map((b) => b.type)));
    expect([...shut].sort()).toEqual(['missile', 'small']);
    log.events.length = 0;
    step(boss, around, FURNACE_IRIS_MAIN.opening + FURNACE_IRIS_MAIN.open, log);
    const open = log.events.flatMap((ev) => ev.bolts);
    expect(open.length).toBeGreaterThan(0);
    expect(new Set(open.map((b) => b.type))).toEqual(new Set(['large']));
    expect(bossActiveLaser(boss)).toBeNull();
  });
});

describe('炉心 endings', () => {
  function killCore(boss: BossRuntime, around: BossWorld): BossEvents[] {
    const out: BossEvents[] = [];
    for (let guard = 0; guard < 4000 && boss.stage === 'fight'; guard++) {
      if (furnaceCoreExposed(boss)) {
        const c = core(boss);
        out.push(shot(boss, c.worldX, c.worldY, 50));
      }
      out.push(updateBoss(boss, FIXED_DT, around));
    }
    return out;
  }

  it('Easy ends when the core dies, pays 30000, and never clears flying bullets', () => {
    const around = world();
    const boss = easy();
    const log: Log = { events: [] };
    park(boss, around);
    step(boss, around, 2, log);
    killPods(boss);
    step(boss, around, FURNACE_PHASE_INVULN + 0.05, log);
    const events = [...log.events, ...killCore(boss, around)];
    expect(boss.stage).toBe('death');
    expect(events.reduce((sum, ev) => sum + ev.score, 0)).toBe(FURNACE_CORE_SCORE);
    step(boss, around, 4, log);
    for (const ev of [...events, ...log.events]) {
      expect(ev.clearBullets).toBe(false);
      expect(ev.convertBullets).toBe(false);
    }
  });

  it('Hard revives the core for the yellow overload and pays 30000 only there', () => {
    const around = world();
    const boss = hard();
    toCore(boss, around);
    expect(bossHpBarLayout(boss).extraSpan).toBeGreaterThan(0);
    const first = killCore(boss, around);
    expect(first.reduce((sum, ev) => sum + ev.score, 0)).toBe(0);
    expect(boss.stage).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    step(boss, around, FURNACE_PHASE_INVULN + 0.05);
    expect(boss.stage).toBe('fight');
    expect(furnaceReadout(boss)?.list).toBe('overload');
    expect(furnaceIris(boss)).toBe('closed');
    step(boss, around, FURNACE_IRIS_OVERLOAD.closed + 0.05);
    expect(furnaceIris(boss)).toBe('opening');
    const second = killCore(boss, around);
    expect(second.reduce((sum, ev) => sum + ev.score, 0)).toBe(FURNACE_CORE_SCORE);
    expect(boss.stage).toBe('death');
    for (const ev of [...first, ...second]) {
      expect(ev.clearBullets).toBe(false);
      expect(ev.convertBullets).toBe(false);
    }
  });
});
