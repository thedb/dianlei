import { describe, expect, it } from 'vitest';
import {
  BOMB_BOSS_RATIO,
  BOSS_ANCHOR_X,
  BOSS_ENTER_Y,
  BOSS_HULL_H,
  HIT_FLASH_TIME,
  PLAYER_BULLET_SPEED,
} from '@/game/config';
import { stage1 } from '@/game/levels/stage1';
import {
  applyBossBomb,
  bossBombDamage,
  bossHitsPlayer,
  bossHpRemaining,
  bossIntroBarFill,
  bossLaserHits,
  bossPart,
  bossTotalHp,
  createBoss,
  resolveBossBullet,
  splitBombDamage,
  updateBoss,
  type BossRuntime,
} from './boss';

const cfg = stage1.boss;
const DT = 1 / 60;

function park(): BossRuntime {
  const boss = createBoss(cfg);
  updateBoss(boss, cfg.enterDuration, cfg);
  return boss;
}

/** Walk a 4×12 shot up from below the hull, one frame at a time. */
function climb(boss: BossRuntime, x: number, damage: number): ReturnType<typeof resolveBossBullet> {
  let y = boss.y + BOSS_HULL_H / 2 + 24;
  let last = resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage, cfg);
  for (let i = 0; i < 40 && !last.consumedBullet; i++) {
    y -= PLAYER_BULLET_SPEED * DT;
    last = resolveBossBullet(boss, { x, y, w: 4, h: 12 }, damage, cfg);
  }
  return last;
}

function toPhase2(): BossRuntime {
  const boss = park();
  const left = bossPart(boss, 'turretL')!;
  const right = bossPart(boss, 'turretR')!;
  resolveBossBullet(boss, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp, cfg);
  const ev = resolveBossBullet(
    boss,
    { x: right.worldX, y: right.worldY, w: 4, h: 12 },
    right.hp,
    cfg
  );
  expect(ev.convertBullets).toBe(true);
  updateBoss(boss, cfg.transition.duration, cfg);
  return boss;
}

describe('boss numbers', () => {
  it('totals 840 HP and an 8% bomb of 67', () => {
    expect(bossTotalHp(cfg)).toBe(840);
    expect(bossBombDamage(840, BOMB_BOSS_RATIO)).toBe(67);
    expect(splitBombDamage(67, 2)).toEqual([34, 33]);
    expect(splitBombDamage(67, 1)).toEqual([67]);
    expect(cfg.parts.reduce((sum, part) => sum + part.score, 0)).toBe(40000);
  });

  it('fills the warning HP bar from 2:33 to 2:35', () => {
    expect(bossIntroBarFill(152.9, 150, 155)).toBeNull();
    expect(bossIntroBarFill(153, 150, 155)).toBe(0);
    expect(bossIntroBarFill(154, 150, 155)).toBeCloseTo(0.5);
    expect(bossIntroBarFill(155, 150, 155)).toBeNull();
  });
});

describe('boss phases', () => {
  it('enters from y=-70 to parkY over 3s, invulnerable, then drifts', () => {
    const boss = createBoss(cfg);
    expect(boss.y).toBe(BOSS_ENTER_Y);
    expect(boss.invulnerable).toBe(true);
    updateBoss(boss, 1.5, cfg);
    expect(boss.phase).toBe('enter');
    expect(boss.y).toBeCloseTo(20);
    expect(applyBossBomb(boss, cfg).score).toBe(0);
    expect(bossHpRemaining(boss)).toBe(840);

    updateBoss(boss, 1.5, cfg);
    expect(boss.phase).toBe('phase1');
    expect(boss.y).toBeCloseTo(cfg.parkY);
    expect(boss.x).toBeCloseTo(BOSS_ANCHOR_X);
    expect(boss.invulnerable).toBe(false);

    updateBoss(boss, 1.5, cfg);
    expect(boss.x).toBeCloseTo(BOSS_ANCHOR_X + cfg.drift.amp);
  });

  it('hull shots do not damage, turret shots do', () => {
    const boss = park();
    const hull = resolveBossBullet(boss, { x: boss.x - 100, y: boss.y, w: 4, h: 12 }, 50, cfg);
    expect(hull.consumedBullet).toBe(true);
    expect(bossPart(boss, 'turretL')!.hp).toBe(140);
    expect(bossPart(boss, 'core')!.hp).toBe(560);

    const left = bossPart(boss, 'turretL')!;
    const hit = resolveBossBullet(boss, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, 10, cfg);
    expect(hit.consumedBullet).toBe(true);
    expect(left.hp).toBe(130);
    expect(hit.score).toBe(0);
    expect(boss.hitFlash).toBe(HIT_FLASH_TIME);
  });

  it('lets a shot climb through the lower hull into a turret or the core', () => {
    const boss = park();
    const left = bossPart(boss, 'turretL')!;
    const lip = {
      x: left.worldX,
      y: boss.y + BOSS_HULL_H / 2 - 2,
      w: 4,
      h: 12,
    };
    const blocked = resolveBossBullet(boss, lip, 10, cfg);
    expect(blocked.consumedBullet).toBe(false);
    expect(left.hp).toBe(140);

    const belly = resolveBossBullet(boss, { x: boss.x, y: lip.y, w: 4, h: 12 }, 50, cfg);
    expect(belly.consumedBullet).toBe(true);
    expect(left.hp).toBe(140);
    expect(boss.hitFlash).toBe(0);

    const hit = climb(boss, left.worldX, 10);
    expect(hit.consumedBullet).toBe(true);
    expect(left.hp).toBe(130);
    expect(boss.hitFlash).toBe(HIT_FLASH_TIME);

    const coreFight = toPhase2();
    const core = bossPart(coreFight, 'core')!;
    const wing = resolveBossBullet(
      coreFight,
      { x: coreFight.x - 78, y: coreFight.y + BOSS_HULL_H / 2 - 2, w: 4, h: 12 },
      10,
      cfg
    );
    expect(wing.consumedBullet).toBe(true);
    expect(core.hp).toBe(560);

    const coreHit = climb(coreFight, core.worldX, 10);
    expect(coreHit.consumedBullet).toBe(true);
    expect(core.hp).toBe(550);
    expect(coreFight.hitFlash).toBe(HIT_FLASH_TIME);
  });

  it('splits a phase-1 bomb across living turrets and dumps it on the survivor', () => {
    const both = park();
    applyBossBomb(both, cfg);
    expect(bossPart(both, 'turretL')!.hp).toBe(140 - 34);
    expect(bossPart(both, 'turretR')!.hp).toBe(140 - 33);
    expect(bossPart(both, 'core')!.hp).toBe(560);

    const one = park();
    const left = bossPart(one, 'turretL')!;
    resolveBossBullet(one, { x: left.worldX, y: left.worldY, w: 4, h: 12 }, left.hp, cfg);
    applyBossBomb(one, cfg);
    expect(bossPart(one, 'turretR')!.hp).toBe(140 - 67);
    expect(one.phase).toBe('phase1');
  });

  it('speeds the surviving turret to 0.8× interval and opens the core after both die', () => {
    const boss = park();
    const left = bossPart(boss, 'turretL')!;
    const killed = resolveBossBullet(
      boss,
      { x: left.worldX, y: left.worldY, w: 4, h: 12 },
      left.hp,
      cfg
    );
    expect(killed.score).toBe(5000);
    expect(killed.explosions.length).toBeGreaterThan(0);
    expect(left.falling).toBe(true);
    expect(boss.intervalMulR).toBeCloseTo(0.8);

    const early = updateBoss(boss, 0.63, cfg);
    expect(early.shots.some((shot) => shot.fire.kind === 'aimed3burst')).toBe(false);
    const fired = updateBoss(boss, 0.02, cfg);
    expect(fired.shots.some((shot) => shot.fire.kind === 'aimed3burst')).toBe(true);

    const right = bossPart(boss, 'turretR')!;
    const transition = resolveBossBullet(
      boss,
      { x: right.worldX, y: right.worldY, w: 4, h: 12 },
      right.hp,
      cfg
    );
    expect(transition.convertBullets).toBe(true);
    expect(transition.score).toBe(5000);
    expect(boss.phase).toBe('transition');
    expect(boss.invulnerable).toBe(true);
    expect(applyBossBomb(boss, cfg).score).toBe(0);
    expect(bossPart(boss, 'core')!.hp).toBe(560);

    updateBoss(boss, cfg.transition.duration, cfg);
    expect(boss.phase).toBe('phase2');
    expect(boss.invulnerable).toBe(false);
  });

  it('alternates phase-1 guns: right at 0.8s, left at 1.6s, hull at 5s', () => {
    const boss = park();
    const at08 = updateBoss(boss, 0.8, cfg);
    expect(at08.shots.map((shot) => shot.fire.kind)).toEqual(['aimed3burst']);
    const at16 = updateBoss(boss, 0.8, cfg);
    expect(at16.shots.some((shot) => shot.fire.kind === 'fan5')).toBe(true);
    const hull = updateBoss(boss, 3.4, cfg);
    expect(hull.shots.some((shot) => shot.fire.kind === 'fan7wide')).toBe(true);
  });

  it('puts the whole bomb into the core and enrages at half HP', () => {
    const boss = toPhase2();
    applyBossBomb(boss, cfg);
    expect(bossPart(boss, 'core')!.hp).toBe(560 - 67);

    const fresh = toPhase2();
    const core = bossPart(fresh, 'core')!;
    resolveBossBullet(fresh, { x: core.worldX, y: core.worldY, w: 4, h: 12 }, 280, cfg);
    expect(core.hp).toBe(280);
    expect(fresh.enraged).toBe(true);

    const ring = updateBoss(fresh, 1.6, cfg);
    expect(ring.shots.some((shot) => shot.fire.kind === 'ring16')).toBe(true);
  });

  it('interrupts the laser and restarts its cooldown', () => {
    const boss = toPhase2();
    let steps = 0;
    while (boss.laser.mode === 'idle' && steps < 600) {
      updateBoss(boss, DT, cfg);
      steps++;
    }
    expect(boss.laser.mode).toBe('telegraph');
    expect(steps * DT).toBeGreaterThan(6.9);
    expect(steps * DT).toBeLessThan(7.1);

    applyBossBomb(boss, cfg);
    expect(boss.laser.mode).toBe('idle');
    expect(boss.laserCooldown).toBe(0);

    for (let i = 0; i < 400; i++) updateBoss(boss, DT, cfg);
    expect(boss.laser.mode).toBe('idle');
    updateBoss(boss, 0.4, cfg);
    expect(boss.laser.mode).toBe('telegraph');
  });

  it('holds the ring still while the laser is sweeping', () => {
    const boss = toPhase2();
    let steps = 0;
    while (boss.laser.mode !== 'sweep' && steps < 800) {
      updateBoss(boss, DT, cfg);
      steps++;
    }
    expect(boss.laser.mode).toBe('sweep');
    const rot = boss.ringRot;
    const aimed = boss.guns.aimed.shots;
    for (let i = 0; i < 30; i++) updateBoss(boss, DT, cfg);
    expect(boss.laser.mode).toBe('sweep');
    expect(boss.ringRot).toBe(rot);
    expect(boss.guns.aimed.shots).toBe(aimed);
  });

  it('kills the player on the hull and with the sweeping laser', () => {
    const boss = park();
    expect(bossHitsPlayer(boss, boss.x, boss.y + 40)).toBe(true);
    expect(bossHitsPlayer(boss, 20, 600)).toBe(false);

    const phase2 = toPhase2();
    let guard = 0;
    while (phase2.laser.mode !== 'sweep' && guard < 800) {
      updateBoss(phase2, DT, cfg);
      guard++;
    }
    expect(phase2.laser.mode).toBe('sweep');
    const core = bossPart(phase2, 'core')!;
    const ang = Math.PI / 2 + (phase2.laser.angleDeg * Math.PI) / 180;
    expect(
      bossLaserHits(phase2, cfg, core.worldX + Math.cos(ang) * 90, core.worldY + Math.sin(ang) * 90)
    ).toBe(true);
    expect(bossLaserHits(phase2, cfg, 8, 600)).toBe(false);
  });

  it('scores the core, clears bullets, then STAGE CLEAR and the result', () => {
    const boss = toPhase2();
    const core = bossPart(boss, 'core')!;
    const death = resolveBossBullet(
      boss,
      { x: core.worldX, y: core.worldY, w: 4, h: 12 },
      core.hp,
      cfg
    );
    expect(death.score).toBe(30000);
    expect(death.clearBullets).toBe(true);
    expect(death.shake?.intensity).toBeGreaterThan(0);
    expect(boss.phase).toBe('death');

    let booms = death.explosions.length;
    const during = updateBoss(boss, cfg.death.duration, cfg);
    booms += during.explosions.length;
    expect(booms).toBe(cfg.death.explosions);
    expect(boss.phase).toBe('clear');

    const wait = updateBoss(boss, 2, cfg);
    expect(wait.enterResult).toBe(true);
    expect(boss.phase).toBe('done');
    expect(updateBoss(boss, 1, cfg).enterResult).toBe(false);
  });
});
