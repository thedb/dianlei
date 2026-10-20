/**
 * Orbital battleship (wave table §5).
 * Pure state: rendering and bullet pools live in the battle scene.
 */

import {
  AIMED_BURST_COUNT,
  AIMED_BURST_GAP,
  BOMB_BOSS_RATIO,
  BOSS_ANCHOR_X,
  BOSS_CLEAR_HOLD,
  BOSS_ENTER_Y,
  BOSS_HP_BAR_FILL_START,
  BOSS_HULL_H,
  BOSS_HULL_W,
  BOSS_TURRET_FALL_GRAVITY,
  BOSS_TURRET_FALL_SPEED,
  HIT_FLASH_TIME,
  HITBOX_RADIUS,
  LOGICAL_H,
  SHAKE_BIG_INTENSITY,
  SHAKE_SMALL_DURATION,
  SHAKE_SMALL_INTENSITY,
} from '@/game/config';
import type { BossConfig, BossPartId, Fire, FireKind } from '@/game/levels/types';
import { checkBulletEnemyCollision, segmentCircleCollision } from '@/game/systems/collision';

export type BossPhase = 'enter' | 'phase1' | 'transition' | 'phase2' | 'death' | 'clear' | 'done';

export interface BossPartRuntime {
  id: BossPartId;
  hp: number;
  maxHp: number;
  score: number;
  offsetX: number;
  offsetY: number;
  radius: number;
  /** 1 = turret, 2 = core */
  phase: 1 | 2;
  alive: boolean;
  falling: boolean;
  fallVy: number;
  worldX: number;
  worldY: number;
}

export interface BossGun {
  timer: number;
  shots: number;
  burstLeft: number;
  burstTimer: number;
}

export interface BossLaser {
  mode: 'idle' | 'telegraph' | 'sweep';
  elapsed: number;
  dir: 1 | -1;
  /** Degrees off straight down. */
  angleDeg: number;
  sweepDuration: number;
}

export interface BossRuntime {
  phase: BossPhase;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  phaseTime: number;
  driftTime: number;
  parts: BossPartRuntime[];
  invulnerable: boolean;
  enraged: boolean;
  guns: {
    turretL: BossGun;
    turretR: BossGun;
    hull: BossGun;
    ring: BossGun;
    aimed: BossGun;
  };
  laser: BossLaser;
  laserCooldown: number;
  ringRot: number;
  deathSpawned: number;
  hitFlash: number;
  /** Multiplier on the configured fire interval (0.8 after the other turret dies). */
  intervalMulL: number;
  intervalMulR: number;
  resultSent: boolean;
}

export interface BossExplosion {
  x: number;
  y: number;
  scale: number;
  delay: number;
}

export interface BossShot {
  fire: Fire;
  x: number;
  y: number;
  rotation: number;
}

export interface BossShake {
  intensity: number;
  duration: number;
}

export interface BossEvents {
  score: number;
  explosions: BossExplosion[];
  shots: BossShot[];
  /** Phase change: on-screen enemy bullets become score. */
  convertBullets: boolean;
  /** Boss death: clear enemy bullets with no score. */
  clearBullets: boolean;
  shake: BossShake | null;
  /** STAGE CLEAR hold finished; show the result screen. */
  enterResult: boolean;
  consumedBullet: boolean;
}

export interface BulletBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEATH_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -10],
  [-68, -20],
  [72, 8],
  [-40, 28],
  [36, -32],
  [8, 18],
];

function freshGun(): BossGun {
  return { timer: 0, shots: 0, burstLeft: 0, burstTimer: 0 };
}

export function emptyBossEvents(): BossEvents {
  return {
    score: 0,
    explosions: [],
    shots: [],
    convertBullets: false,
    clearBullets: false,
    shake: null,
    enterResult: false,
    consumedBullet: false,
  };
}

export function bossTotalHp(config: BossConfig): number {
  return config.parts.reduce((sum, part) => sum + part.hp, 0);
}

/** 8% of total boss HP, rounded to the wave table's 67. */
export function bossBombDamage(totalHp: number, ratio: number = BOMB_BOSS_RATIO): number {
  return Math.round(totalHp * ratio);
}

/**
 * Split bomb damage across living parts.
 * The earlier parts receive the remainder, so 67 across two turrets is 34 and 33.
 */
export function splitBombDamage(total: number, recipients: number): number[] {
  if (recipients <= 0 || total <= 0) return [];
  const base = Math.floor(total / recipients);
  let rem = total - base * recipients;
  const out: number[] = [];
  for (let i = 0; i < recipients; i++) {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem--;
    out.push(base + extra);
  }
  return out;
}

export function bossHpRemaining(boss: BossRuntime): number {
  return boss.parts.reduce((sum, part) => sum + Math.max(0, part.hp), 0);
}

export function bossPart(boss: BossRuntime, id: BossPartId): BossPartRuntime | undefined {
  return boss.parts.find((part) => part.id === id);
}

export function bossHullRect(boss: BossRuntime): { x: number; y: number; w: number; h: number } {
  return {
    x: boss.x - BOSS_HULL_W / 2,
    y: boss.y - BOSS_HULL_H / 2,
    w: BOSS_HULL_W,
    h: BOSS_HULL_H,
  };
}

/**
 * Cinematic fill during the warning (null before 2:33 and once the fight starts).
 * 0–1 from left to right.
 */
export function bossIntroBarFill(
  gameTime: number,
  warningAt: number,
  enterAt: number
): number | null {
  const start = warningAt + BOSS_HP_BAR_FILL_START;
  if (gameTime < start || gameTime >= enterAt) return null;
  const span = enterAt - start;
  if (span <= 0) return 1;
  return clamp01((gameTime - start) / span);
}

export function createBoss(config: BossConfig): BossRuntime {
  const boss: BossRuntime = {
    phase: 'enter',
    x: BOSS_ANCHOR_X,
    y: BOSS_ENTER_Y,
    prevX: BOSS_ANCHOR_X,
    prevY: BOSS_ENTER_Y,
    phaseTime: 0,
    driftTime: 0,
    parts: config.parts.map((part) => ({
      id: part.id,
      hp: part.hp,
      maxHp: part.hp,
      score: part.score,
      offsetX: part.offset.x,
      offsetY: part.offset.y,
      radius: part.radius,
      phase: part.phase,
      alive: true,
      falling: false,
      fallVy: 0,
      worldX: BOSS_ANCHOR_X + part.offset.x,
      worldY: BOSS_ENTER_Y + part.offset.y,
    })),
    invulnerable: true,
    enraged: false,
    guns: {
      turretL: freshGun(),
      turretR: freshGun(),
      hull: freshGun(),
      ring: freshGun(),
      aimed: freshGun(),
    },
    laser: {
      mode: 'idle',
      elapsed: 0,
      dir: 1,
      angleDeg: 0,
      sweepDuration: config.phase2.laser.sweep,
    },
    laserCooldown: 0,
    ringRot: 0,
    deathSpawned: 0,
    hitFlash: 0,
    intervalMulL: 1,
    intervalMulR: 1,
    resultSent: false,
  };
  syncParts(boss);
  return boss;
}

export function updateBoss(boss: BossRuntime, dt: number, config: BossConfig): BossEvents {
  const ev = emptyBossEvents();
  if (boss.phase === 'done') return ev;

  boss.prevX = boss.x;
  boss.prevY = boss.y;
  let attackDt = 0;

  if (boss.phase === 'enter') {
    boss.phaseTime += dt;
    const duration = Math.max(0.0001, config.enterDuration);
    const u = Math.min(1, boss.phaseTime / duration);
    boss.x = BOSS_ANCHOR_X;
    boss.y = BOSS_ENTER_Y + (config.parkY - BOSS_ENTER_Y) * u;
    if (boss.phaseTime >= duration) {
      const leftover = boss.phaseTime - duration;
      boss.phase = 'phase1';
      boss.phaseTime = leftover;
      boss.driftTime = leftover;
      boss.y = config.parkY;
      boss.invulnerable = false;
      attackDt = leftover;
    }
  } else if (boss.phase === 'phase1') {
    boss.phaseTime += dt;
    boss.driftTime += dt;
    drift(boss, config);
    attackDt = dt;
  } else if (boss.phase === 'transition') {
    boss.phaseTime += dt;
    boss.driftTime += dt;
    drift(boss, config);
    if (boss.phaseTime >= config.transition.duration) {
      const leftover = boss.phaseTime - config.transition.duration;
      boss.phase = 'phase2';
      boss.phaseTime = leftover;
      boss.invulnerable = false;
      boss.laser.mode = 'idle';
      boss.laser.elapsed = 0;
      boss.laserCooldown = 0;
      boss.guns.ring = freshGun();
      boss.guns.aimed = freshGun();
      attackDt = leftover;
    }
  } else if (boss.phase === 'phase2') {
    boss.phaseTime += dt;
    boss.driftTime += dt;
    drift(boss, config);
    attackDt = dt;
  } else if (boss.phase === 'death') {
    boss.phaseTime += dt;
    spawnDueDeathExplosions(boss, config, ev);
    if (boss.phaseTime >= config.death.duration) {
      boss.phase = 'clear';
      boss.phaseTime = 0;
    }
  } else if (boss.phase === 'clear') {
    boss.phaseTime += dt;
    if (!boss.resultSent && boss.phaseTime >= BOSS_CLEAR_HOLD) {
      boss.resultSent = true;
      boss.phase = 'done';
      ev.enterResult = true;
    }
  }

  fallDebris(boss, dt);
  syncParts(boss);
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);

  if (attackDt > 0 && boss.phase === 'phase1') tickPhase1(boss, attackDt, config, ev);
  if (attackDt > 0 && boss.phase === 'phase2') tickPhase2(boss, attackDt, config, ev);
  return ev;
}

export function applyBossBomb(boss: BossRuntime, config: BossConfig): BossEvents {
  const ev = emptyBossEvents();
  if (boss.phase === 'phase2') interruptLaser(boss);

  if (!canTakeDamage(boss)) return ev;

  const amount = bossBombDamage(bossTotalHp(config));
  if (boss.phase === 'phase1') {
    const living = boss.parts.filter((part) => part.phase === 1 && part.alive);
    const shares = splitBombDamage(amount, living.length);
    living.forEach((part, index) => {
      hurtPart(boss, part, shares[index] ?? 0, ev, config);
    });
  } else if (boss.phase === 'phase2') {
    const core = bossPart(boss, 'core');
    if (core) hurtPart(boss, core, amount, ev, config);
  }
  return ev;
}

/** Player bullet against turrets, the core, or the invulnerable hull. */
export function resolveBossBullet(
  boss: BossRuntime,
  bullet: BulletBox,
  damage: number,
  config: BossConfig
): BossEvents {
  const ev = emptyBossEvents();
  if (!bossBlocksShots(boss)) return ev;

  const hittable = damageableParts(boss);

  const connect = (part: BossPartRuntime): BossEvents => {
    ev.consumedBullet = true;
    if (!boss.invulnerable) hurtPart(boss, part, damage, ev, config);
    return ev;
  };

  const direct = nearestPart(hittable, bullet, (part) =>
    checkBulletEnemyCollision(
      bullet.x,
      bullet.y,
      bullet.w,
      bullet.h,
      part.worldX,
      part.worldY,
      part.radius
    )
  );
  if (direct) return connect(direct);

  const hull = bossHullRect(boss);
  const left = bullet.x - bullet.w / 2;
  const top = bullet.y - bullet.h / 2;
  if (!rectsOverlap(left, top, bullet.w, bullet.h, hull.x, hull.y, hull.w, hull.h)) return ev;

  // The nose (part center down to the hull's player-facing edge) is the
  // weak-point face. A shot into that face damages the nearest living part
  // immediately, including off-center and 15° streams. Armor above the
  // part centers still stops a bullet without hurting anything.
  const faceBottom = hull.y + hull.h;
  const facing = nearestPart(hittable, bullet, (part) => {
    const bulletTop = bullet.y - bullet.h / 2;
    const bulletBottom = bullet.y + bullet.h / 2;
    return bulletBottom > part.worldY && bulletTop < faceBottom;
  });
  if (facing) return connect(facing);

  ev.consumedBullet = true;
  return ev;
}

export function bossHitsPlayer(boss: BossRuntime, px: number, py: number): boolean {
  if (!bossThreatens(boss)) return false;
  const hull = bossHullRect(boss);
  if (circleRect(px, py, HITBOX_RADIUS, hull.x, hull.y, hull.w, hull.h)) return true;
  for (const part of boss.parts) {
    if (!part.alive || part.falling) continue;
    const dx = px - part.worldX;
    const dy = py - part.worldY;
    const reach = HITBOX_RADIUS + part.radius;
    if (dx * dx + dy * dy < reach * reach) return true;
  }
  return false;
}

/** Sweeping beam only. The telegraph line does not hurt. */
export function bossLaserHits(
  boss: BossRuntime,
  config: BossConfig,
  px: number,
  py: number
): boolean {
  if (boss.phase !== 'phase2' || boss.laser.mode !== 'sweep') return false;
  const core = bossPart(boss, 'core');
  if (!core) return false;
  const ang = Math.PI / 2 + (boss.laser.angleDeg * Math.PI) / 180;
  const len = LOGICAL_H + BOSS_HULL_H;
  const x2 = core.worldX + Math.cos(ang) * len;
  const y2 = core.worldY + Math.sin(ang) * len;
  const reach = config.phase2.laser.hitWidth / 2 + HITBOX_RADIUS;
  return segmentCircleCollision(core.worldX, core.worldY, x2, y2, px, py, reach);
}

function drift(boss: BossRuntime, config: BossConfig): void {
  const { amp, period } = config.drift;
  const omega = (Math.PI * 2 * boss.driftTime) / Math.max(0.0001, period);
  boss.x = BOSS_ANCHOR_X + amp * Math.sin(omega);
  boss.y = config.parkY;
}

function tickPhase1(boss: BossRuntime, dt: number, config: BossConfig, ev: BossEvents): void {
  const phase = config.phase1;
  fireGun(boss, 'turretL', boss.guns.turretL, phase.turretL, dt, boss.intervalMulL, ev);
  fireGun(boss, 'turretR', boss.guns.turretR, phase.turretR, dt, boss.intervalMulR, ev);

  const interval = fireInterval(phase.hull);
  const first = fireFirstDelay(phase.hull, interval);
  const count = pullShots(boss.guns.hull, dt, interval, first, phase.hull.kind);
  for (let i = 0; i < count; i++) {
    ev.shots.push({ fire: phase.hull, x: boss.x, y: boss.y, rotation: 0 });
  }
}

function tickPhase2(boss: BossRuntime, dt: number, config: BossConfig, ev: BossEvents): void {
  tickLaser(boss, dt, config);
  const phase = config.phase2;
  const core = bossPart(boss, 'core');
  const originX = core?.worldX ?? boss.x;
  const originY = core?.worldY ?? boss.y;

  if (boss.laser.mode !== 'sweep' && phase.ring.kind === 'ring16') {
    const interval = boss.enraged ? phase.enrage.ringInterval : phase.ring.interval;
    const count = pullShots(boss.guns.ring, dt, interval, interval, phase.ring.kind);
    for (let i = 0; i < count; i++) {
      ev.shots.push({
        fire: phase.ring,
        x: originX,
        y: originY,
        rotation: boss.ringRot + i * phase.ring.rotStep,
      });
    }
    boss.ringRot += count * phase.ring.rotStep;
    if (count > 0) return;
  }

  if (boss.laser.mode === 'idle') {
    const interval = fireInterval(phase.aimed);
    const first = fireFirstDelay(phase.aimed, interval);
    const count = pullShots(boss.guns.aimed, dt, interval, first, phase.aimed.kind);
    for (let i = 0; i < count; i++) {
      ev.shots.push({ fire: phase.aimed, x: originX, y: originY, rotation: 0 });
    }
  }
}

function fireGun(
  boss: BossRuntime,
  id: 'turretL' | 'turretR',
  gun: BossGun,
  fire: Fire,
  dt: number,
  intervalMul: number,
  ev: BossEvents
): void {
  const part = bossPart(boss, id);
  if (!part?.alive) return;
  const base = fireInterval(fire);
  const interval = base * intervalMul;
  const first = fireFirstDelay(fire, base) * intervalMul;
  const count = pullShots(gun, dt, interval, first, fire.kind);
  for (let i = 0; i < count; i++) {
    ev.shots.push({ fire, x: part.worldX, y: part.worldY, rotation: 0 });
  }
}

function tickLaser(boss: BossRuntime, dt: number, config: BossConfig): void {
  const laser = config.phase2.laser;
  const enrage = config.phase2.enrage;
  let left = dt;

  for (let guard = 0; guard < 6 && left > 1e-8; guard++) {
    const every = boss.enraged ? enrage.laserEvery : laser.every;
    if (boss.laser.mode === 'idle') {
      const need = every - boss.laserCooldown;
      if (need > left) {
        boss.laserCooldown += left;
        return;
      }
      left -= Math.max(0, need);
      boss.laserCooldown = every;
      boss.laser.mode = 'telegraph';
      boss.laser.elapsed = 0;
      boss.laser.angleDeg = 0;
    } else if (boss.laser.mode === 'telegraph') {
      const need = laser.telegraph - boss.laser.elapsed;
      if (need > left) {
        boss.laser.elapsed += left;
        boss.laser.angleDeg = 0;
        return;
      }
      left -= Math.max(0, need);
      boss.laser.mode = 'sweep';
      boss.laser.elapsed = 0;
      boss.laser.sweepDuration = boss.enraged ? enrage.sweep : laser.sweep;
      boss.laser.angleDeg = sweepFrom(boss, laser.fromDeg, laser.toDeg);
    } else {
      const need = boss.laser.sweepDuration - boss.laser.elapsed;
      if (need > left) {
        boss.laser.elapsed += left;
        boss.laser.angleDeg = sweepAngle(boss, laser.fromDeg, laser.toDeg);
        return;
      }
      left -= Math.max(0, need);
      boss.laser.elapsed = boss.laser.sweepDuration;
      boss.laser.angleDeg = sweepAngle(boss, laser.fromDeg, laser.toDeg);
      boss.laser.mode = 'idle';
      boss.laser.elapsed = 0;
      boss.laserCooldown = 0;
      boss.laser.dir = boss.laser.dir === 1 ? -1 : 1;
    }
  }
}

function sweepFrom(boss: BossRuntime, fromDeg: number, toDeg: number): number {
  return boss.laser.dir > 0 ? fromDeg : toDeg;
}

function sweepAngle(boss: BossRuntime, fromDeg: number, toDeg: number): number {
  const from = sweepFrom(boss, fromDeg, toDeg);
  const to = boss.laser.dir > 0 ? toDeg : fromDeg;
  const dur = Math.max(0.0001, boss.laser.sweepDuration);
  const u = clamp01(boss.laser.elapsed / dur);
  return from + (to - from) * u;
}

/** Cancel an active laser and start its cooldown over. Idle lasers keep their timer. */
function interruptLaser(boss: BossRuntime): void {
  if (boss.laser.mode === 'idle') return;
  boss.laser.mode = 'idle';
  boss.laser.elapsed = 0;
  boss.laser.angleDeg = 0;
  boss.laserCooldown = 0;
}

function pullShots(
  gun: BossGun,
  dt: number,
  interval: number,
  firstDelay: number,
  kind: FireKind
): number {
  const step = Math.max(0.01, interval);
  const first = Math.max(0, firstDelay);
  let left = dt;
  let fired = 0;

  for (let guard = 0; guard < 8 && left > 1e-8; guard++) {
    if (gun.burstLeft > 0) {
      const need = AIMED_BURST_GAP - gun.burstTimer;
      if (left + 1e-9 < need) {
        gun.burstTimer += left;
        return fired;
      }
      left -= need;
      gun.burstTimer = 0;
      gun.burstLeft--;
      fired++;
      continue;
    }

    const threshold = gun.shots === 0 ? first : step;
    const need = threshold - gun.timer;
    if (left + 1e-9 < need) {
      gun.timer += left;
      return fired;
    }
    left -= Math.max(0, need);
    gun.timer = 0;
    gun.shots++;
    fired++;
    if (kind === 'aimed3burst') {
      gun.burstLeft = AIMED_BURST_COUNT - 1;
      gun.burstTimer = 0;
    }
  }
  return fired;
}

function hurtPart(
  boss: BossRuntime,
  part: BossPartRuntime,
  amount: number,
  ev: BossEvents,
  config: BossConfig
): void {
  if (!part.alive || amount <= 0 || boss.invulnerable) return;
  part.hp -= amount;
  boss.hitFlash = HIT_FLASH_TIME;
  if (part.hp > 0) {
    refreshEnrage(boss, config);
    return;
  }
  part.hp = 0;
  killPart(boss, part, ev, config);
}

function killPart(
  boss: BossRuntime,
  part: BossPartRuntime,
  ev: BossEvents,
  config: BossConfig
): void {
  if (!part.alive) return;
  part.alive = false;
  part.hp = 0;
  ev.score += part.score;

  if (part.id === 'turretL' || part.id === 'turretR') {
    part.falling = true;
    part.fallVy = BOSS_TURRET_FALL_SPEED;
    ev.explosions.push({ x: part.worldX, y: part.worldY, scale: 2, delay: 0 });
    ev.shake = { intensity: SHAKE_SMALL_INTENSITY, duration: SHAKE_SMALL_DURATION };
    if (part.id === 'turretL') boss.intervalMulR = survivorScale(config);
    else boss.intervalMulL = survivorScale(config);
    const turrets = boss.parts.filter((item) => item.phase === 1);
    if (boss.phase === 'phase1' && turrets.every((item) => !item.alive)) {
      beginTransition(boss, ev);
    }
    return;
  }

  if (part.id === 'core') beginDeath(boss, ev, config);
}

function survivorScale(config: BossConfig): number {
  const rate = config.phase1.survivorRateMul;
  if (rate <= 0) return 1;
  return 1 / rate;
}

function beginTransition(boss: BossRuntime, ev: BossEvents): void {
  if (boss.phase !== 'phase1') return;
  boss.phase = 'transition';
  boss.phaseTime = 0;
  boss.invulnerable = true;
  boss.laser.mode = 'idle';
  ev.convertBullets = true;
}

function beginDeath(boss: BossRuntime, ev: BossEvents, config: BossConfig): void {
  if (boss.phase === 'death' || boss.phase === 'clear' || boss.phase === 'done') return;
  boss.phase = 'death';
  boss.phaseTime = 0;
  boss.invulnerable = true;
  boss.laser.mode = 'idle';
  boss.deathSpawned = 0;
  ev.clearBullets = true;
  ev.shake = { intensity: SHAKE_BIG_INTENSITY, duration: config.death.duration };
  emitDeathExplosion(boss, 0, ev);
  boss.deathSpawned = 1;
}

function spawnDueDeathExplosions(boss: BossRuntime, config: BossConfig, ev: BossEvents): void {
  const count = Math.max(1, config.death.explosions);
  const interval = config.death.duration / count;
  while (boss.deathSpawned < count && boss.phaseTime + 1e-9 >= boss.deathSpawned * interval) {
    emitDeathExplosion(boss, boss.deathSpawned, ev);
    boss.deathSpawned++;
  }
}

function emitDeathExplosion(boss: BossRuntime, index: number, ev: BossEvents): void {
  const spot = DEATH_OFFSETS[index % DEATH_OFFSETS.length] ?? [0, 0];
  ev.explosions.push({
    x: boss.x + spot[0],
    y: boss.y + spot[1],
    scale: 4,
    delay: 0,
  });
}

function refreshEnrage(boss: BossRuntime, config: BossConfig): void {
  const core = bossPart(boss, 'core');
  if (!core) return;
  if (core.hp <= core.maxHp * config.phase2.enrageAtHpRatio) boss.enraged = true;
}

function canTakeDamage(boss: BossRuntime): boolean {
  return (boss.phase === 'phase1' || boss.phase === 'phase2') && !boss.invulnerable;
}

function bossBlocksShots(boss: BossRuntime): boolean {
  return (
    boss.phase === 'enter' ||
    boss.phase === 'phase1' ||
    boss.phase === 'transition' ||
    boss.phase === 'phase2'
  );
}

function bossThreatens(boss: BossRuntime): boolean {
  return bossBlocksShots(boss);
}

function damageableParts(boss: BossRuntime): BossPartRuntime[] {
  if (boss.phase === 'phase2') {
    return boss.parts.filter((part) => part.phase === 2 && part.alive && !part.falling);
  }
  if (boss.phase === 'enter' || boss.phase === 'phase1' || boss.phase === 'transition') {
    return boss.parts.filter((part) => part.phase === 1 && part.alive && !part.falling);
  }
  return [];
}

function fallDebris(boss: BossRuntime, dt: number): void {
  for (const part of boss.parts) {
    if (!part.falling) continue;
    part.fallVy += BOSS_TURRET_FALL_GRAVITY * dt;
    part.worldY += part.fallVy * dt;
    if (part.worldY > LOGICAL_H + 48) part.falling = false;
  }
}

function syncParts(boss: BossRuntime): void {
  for (const part of boss.parts) {
    if (part.falling) continue;
    part.worldX = boss.x + part.offsetX;
    part.worldY = boss.y + part.offsetY;
  }
}

function fireInterval(fire: Fire): number {
  if (fire.kind === 'none') return 2;
  if (fire.kind === 'ring8' || fire.kind === 'ring16') return fire.interval;
  return fire.interval ?? 2;
}

function fireFirstDelay(fire: Fire, interval: number): number {
  switch (fire.kind) {
    case 'fan3':
    case 'fan5':
    case 'fan7wide':
    case 'aimed1':
    case 'aimed3burst':
    case 'missile':
    case 'aimed_fast3':
    case 'fixed2':
      return fire.firstDelay ?? interval;
    default:
      return interval;
  }
}

function nearestPart(
  parts: readonly BossPartRuntime[],
  bullet: BulletBox,
  hits: (part: BossPartRuntime) => boolean
): BossPartRuntime | undefined {
  let best: BossPartRuntime | undefined;
  let bestDist = Infinity;
  for (const part of parts) {
    if (!hits(part)) continue;
    const dx = part.worldX - bullet.x;
    const dy = part.worldY - bullet.y;
    const dist = dx * dx + dy * dy;
    if (!best || dist < bestDist || (dist === bestDist && part.worldX < best.worldX)) {
      best = part;
      bestDist = dist;
    }
  }
  return best;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}
