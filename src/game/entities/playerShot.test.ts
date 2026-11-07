import { describe, expect, it } from 'vitest';
import { ObjectPool } from '@/engine/pool';
import { flushPlayerSplits } from '@/game/battle/world';
import type { Battle } from '@/game/battle/context';
import {
  FIXED_DT,
  JASON_HELIX_AMPLITUDE,
  JASON_HELIX_PERIOD,
  MANDY_P3_SHELL_DAMAGE,
  MANDY_SHARD_H,
  MANDY_SHARD_W,
  MANDY_SPLIT_ARMS,
  MANDY_SPLIT_RANGE,
} from '@/game/config';
import type { WeaponEmitter } from '@/game/systems/playerWeapons';
import {
  armPlayerBullet,
  createBullet,
  playerBulletImpactDamage,
  splitAxes,
  stepPlayerBullet,
  type Bullet,
} from './bullet';
import { shipDef } from './shipDefs';

function gun(id: 'mandy' | 'jason', level: number, x = 180, y = 560): ObjectPool<Bullet> {
  const pool = new ObjectPool(createBullet, 32);
  const emit: WeaponEmitter = {
    bullet(sx, sy, vx, vy, damage, width, height, pattern) {
      armPlayerBullet(pool.acquire(), sx, sy, vx, vy, damage, width, height, pattern);
    },
    missile() {
      throw new Error('main gun does not fire missiles');
    },
  };
  shipDef(id).fire(level, x, y, emit);
  return pool;
}

function active(pool: ObjectPool<Bullet>): Bullet[] {
  const list: Bullet[] = [];
  pool.forEach((bullet) => list.push(bullet));
  return list;
}

function stepAll(pool: ObjectPool<Bullet>, frames: number): void {
  for (let i = 0; i < frames; i++) {
    pool.forEach((bullet) => stepPlayerBullet(bullet, FIXED_DT));
  }
}

function flush(pool: ObjectPool<Bullet>): void {
  flushPlayerSplits({ bullets: pool, emitter: poolEmitter(pool) } as Battle);
}

function poolEmitter(pool: ObjectPool<Bullet>): WeaponEmitter {
  return {
    bullet(x, y, vx, vy, damage, width, height, pattern) {
      armPlayerBullet(pool.acquire(), x, y, vx, vy, damage, width, height, pattern);
    },
    missile() {
      throw new Error('shards are not missiles');
    },
  };
}

describe('Mandy P3 split', () => {
  it('uses the six hexagram directions', () => {
    const axes = splitAxes(MANDY_SPLIT_ARMS);
    expect(axes).toHaveLength(6);
    expect(axes[0]!.x).toBeCloseTo(0);
    expect(axes[0]!.y).toBeCloseTo(-1);
    expect(axes[1]!.x).toBeCloseTo(Math.sqrt(3) / 2);
    expect(axes[1]!.y).toBeCloseTo(-0.5);
    expect(axes[2]!.x).toBeCloseTo(Math.sqrt(3) / 2);
    expect(axes[2]!.y).toBeCloseTo(0.5);
    expect(axes[3]!.x).toBeCloseTo(0);
    expect(axes[3]!.y).toBeCloseTo(1);
    expect(axes[4]!.x).toBeCloseTo(-Math.sqrt(3) / 2);
    expect(axes[4]!.y).toBeCloseTo(0.5);
    expect(axes[5]!.x).toBeCloseTo(-Math.sqrt(3) / 2);
    expect(axes[5]!.y).toBeCloseTo(-0.5);
  });

  it('pays damage × 6 and does not split when the shell is hit first', () => {
    const pool = gun('mandy', 3);
    const shells = active(pool);
    expect(shells).toHaveLength(2);
    const shell = shells[0]!;
    expect(shell.pendingSplit).toBe(false);
    expect(playerBulletImpactDamage(shell)).toBeCloseTo(shell.damage * MANDY_SPLIT_ARMS);
    expect(playerBulletImpactDamage(shell)).toBeCloseTo(MANDY_P3_SHELL_DAMAGE * 6);
    pool.release(shell);
    flush(pool);
    expect(active(pool)).toHaveLength(1);
    expect(active(pool)[0]?.splitRange).toBe(MANDY_SPLIT_RANGE);
  });

  it('does not split a shell that reaches range on the frame it is hit', () => {
    const pool = gun('mandy', 3);
    const shell = active(pool)[0]!;
    const other = active(pool)[1]!;
    pool.release(other);
    const startY = shell.y;
    for (let i = 0; i < 80 && !shell.pendingSplit; i++) stepPlayerBullet(shell, FIXED_DT);
    expect(shell.pendingSplit).toBe(true);
    expect(shell.y).toBeCloseTo(startY - MANDY_SPLIT_RANGE);
    expect(playerBulletImpactDamage(shell)).toBeCloseTo(shell.damage * 6);
    pool.release(shell);
    flush(pool);
    expect(active(pool)).toHaveLength(0);
  });

  it('splits a missed shell into six smaller shards that sum to the ×6 hit', () => {
    const pool = gun('mandy', 3);
    const shell = active(pool)[0]!;
    pool.release(active(pool)[1]!);
    const startY = shell.y;
    const shellDamage = shell.damage;
    for (let i = 0; i < 80 && !shell.pendingSplit; i++) stepPlayerBullet(shell, FIXED_DT);
    expect(shell.y).toBeCloseTo(startY - MANDY_SPLIT_RANGE);
    flush(pool);
    const shards = active(pool);
    expect(shards).toHaveLength(MANDY_SPLIT_ARMS);
    expect(shards.reduce((sum, shard) => sum + shard.damage, 0)).toBeCloseTo(shellDamage * 6);
    expect(shards.every((shard) => shard.damage === shellDamage)).toBe(true);
    expect(
      shards.every((shard) => shard.impactMul === undefined && shard.splitRange === undefined)
    ).toBe(true);
    expect(
      shards.every((shard) => shard.width === MANDY_SHARD_W && shard.height === MANDY_SHARD_H)
    ).toBe(true);
    const speed = Math.hypot(shards[0]!.vx ?? 0, shards[0]!.vy ?? 0);
    const axes = splitAxes(MANDY_SPLIT_ARMS);
    for (const axis of axes) {
      const hit = shards.some(
        (shard) =>
          Math.abs((shard.vx ?? 0) / speed - axis.x) < 1e-9 &&
          Math.abs((shard.vy ?? 0) / speed - axis.y) < 1e-9
      );
      expect(hit).toBe(true);
    }
  });
});

describe('Jason helix', () => {
  it('weaves P2 streams on opposite phases at the same rate', () => {
    const pool = gun('jason', 2, 180, 500);
    const streams = active(pool);
    expect(streams).toHaveLength(2);
    expect(streams[0]?.helixPhase).toBe(0);
    expect(streams[1]?.helixPhase).toBeCloseTo(Math.PI);
    const frames = Math.round(JASON_HELIX_PERIOD / 4 / FIXED_DT);
    stepAll(pool, frames);
    const [a, b] = active(pool);
    expect(a!.x - 180).toBeCloseTo(JASON_HELIX_AMPLITUDE, 1);
    expect(b!.x - 180).toBeCloseTo(-JASON_HELIX_AMPLITUDE, 1);
    expect(a!.y).toBeCloseTo(b!.y);
    expect(a!.y).toBeLessThan(500);
  });

  it('fires P3 as one straight stream plus the dual helix', () => {
    const pool = gun('jason', 3, 180, 500);
    const shots = active(pool);
    expect(shots).toHaveLength(3);
    const straight = shots.filter((shot) => shot.helixAmp === undefined);
    const helix = shots.filter((shot) => shot.helixAmp !== undefined);
    expect(straight).toHaveLength(1);
    expect(helix).toHaveLength(2);
    expect(helix[0]!.helixPhase).toBe(0);
    expect(helix[1]!.helixPhase).toBeCloseTo(Math.PI);
    stepAll(pool, Math.round(JASON_HELIX_PERIOD / 4 / FIXED_DT));
    expect(straight[0]!.x).toBeCloseTo(180);
    expect(helix[0]!.x - 180).toBeCloseTo(-(helix[1]!.x - 180));
    expect(helix[0]!.y).toBeCloseTo(helix[1]!.y);
    expect(straight[0]!.y).toBeCloseTo(helix[0]!.y);
  });
});
