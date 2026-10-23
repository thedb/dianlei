import { describe, it, expect } from 'vitest';
import {
  LOGICAL_W,
  LOGICAL_H,
  FIXED_DT,
  PLAYER_SPEED,
  LIVES_START,
  LIVES_MAX,
  BOMBS_START,
  BOMBS_MAX,
  POWER_MAX,
  ENEMY_BULLET_CAP,
  FIRE_RATE,
  PLAYER_BULLET_DAMAGE,
  HOMING_FIRE_RATE,
  HOMING_DAMAGE,
  HOMING_MAX_LEVEL,
  BUILDING_DROP_P_SHARE,
  M_OVERFLOW_SCORE,
  MATE_MAX_LEVEL,
  P_OVERFLOW_SCORE,
  MATE_OFFSET_X,
  MATE_SCALE,
  DEATH_MATE_LOSS,
  BOMB_MEDIUM_RATIO,
  BOMB_BOSS_RATIO,
  BOMB_WAVE_TIME,
  DEATH_POWER_LOSS,
  DEATH_SUB_LOSS,
  DEBUG_HOT_SIZE,
  DEBUG_HOT_TAPS,
  DEBUG_HOT_WINDOW,
  WEAPON_TEST_BOMBS_MAX,
  WEAPON_TEST_DAMAGE_MAX,
  WEAPON_TEST_DAMAGE_MIN,
  WEAPON_TEST_DAMAGE_STEP,
  WEAPON_TEST_DPS_WINDOW,
  WEAPON_TEST_RATE_MAX,
  WEAPON_TEST_RATE_MIN,
  WEAPON_TEST_RATE_STEP,
  WEAPON_TEST_SUB_MAX,
  WEAPON_TEST_TARGET_H,
  WEAPON_TEST_TARGET_W,
  WEAPON_TEST_TARGET_X,
  WEAPON_TEST_TARGET_Y,
} from './config';

describe('Game Config', () => {
  it('should have correct logical resolution', () => {
    expect(LOGICAL_W).toBe(360);
    expect(LOGICAL_H).toBe(640);
  });

  it('should have 60Hz fixed timestep', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 60);
  });

  it('should have sensible player speed', () => {
    // Should be able to cross screen in ~1.2 seconds
    const crossTime = LOGICAL_W / PLAYER_SPEED;
    expect(crossTime).toBeGreaterThan(1);
    expect(crossTime).toBeLessThan(1.5);
  });

  it('should have valid lives configuration', () => {
    expect(LIVES_START).toBeGreaterThan(0);
    expect(LIVES_MAX).toBeGreaterThanOrEqual(LIVES_START);
  });

  it('should have valid bombs configuration', () => {
    expect(BOMBS_START).toBeGreaterThan(0);
    expect(BOMBS_MAX).toBeGreaterThanOrEqual(BOMBS_START);
  });

  it('should have 3 power levels', () => {
    expect(POWER_MAX).toBe(3);
  });

  it('should have enemy bullet cap at 150', () => {
    expect(ENEMY_BULLET_CAP).toBe(150);
  });

  it('pins vulcan at 5 volleys/s and 2 damage, and pins T at 1.5 / 2.5', () => {
    expect(FIRE_RATE).toBe(5);
    expect(PLAYER_BULLET_DAMAGE).toBe(2);
    // Rate halved and per-bullet damage doubled, so full-hit DPS is unchanged.
    expect(FIRE_RATE * 1 * PLAYER_BULLET_DAMAGE).toBe(10);
    expect(FIRE_RATE * 2 * PLAYER_BULLET_DAMAGE).toBe(20);
    expect(FIRE_RATE * 3 * PLAYER_BULLET_DAMAGE).toBe(30);
    // T stays at the P9 numbers. It must not scale with the new main values
    // (that would be (5 / 6) * 0.9 ≈ 0.75 and (2 / 2) * 5 = 5).
    expect(HOMING_FIRE_RATE).toBe(1.5);
    expect(HOMING_DAMAGE).toBe(2.5);
    expect(HOMING_FIRE_RATE).not.toBeCloseTo((FIRE_RATE / 6) * 0.9);
    expect(HOMING_DAMAGE).not.toBe((PLAYER_BULLET_DAMAGE / 2) * 5);
    expect(HOMING_MAX_LEVEL).toBe(2);
    expect(DEATH_POWER_LOSS).toBe(1);
    expect(DEATH_SUB_LOSS).toBe(1);
    expect(MATE_MAX_LEVEL).toBe(2);
    expect(M_OVERFLOW_SCORE).toBe(1000);
    expect(M_OVERFLOW_SCORE).toBe(P_OVERFLOW_SCORE);
    expect(BUILDING_DROP_P_SHARE).toBe(0.5);
    expect(MATE_OFFSET_X).toBe(25.6);
    expect(MATE_OFFSET_X).toBeCloseTo(32 * 0.8);
    expect(MATE_SCALE).toBeCloseTo(1 / 3);
    expect(DEATH_MATE_LOSS).toBe(1);
  });

  it('keeps the bomb rules in range', () => {
    expect(BOMB_MEDIUM_RATIO).toBe(0.5);
    expect(BOMB_BOSS_RATIO).toBe(0.08);
    expect(BOMB_WAVE_TIME).toBeGreaterThanOrEqual(0.3);
    expect(BOMB_WAVE_TIME).toBeLessThanOrEqual(0.5);
    expect(ENEMY_BULLET_CAP).toBe(150);
  });

  it('keeps the hidden debug entry and weapon-test caps in range', () => {
    expect(DEBUG_HOT_SIZE).toBe(48);
    expect(DEBUG_HOT_TAPS).toBe(6);
    expect(DEBUG_HOT_WINDOW).toBe(2);
    expect(WEAPON_TEST_DPS_WINDOW).toBe(1);
    expect(WEAPON_TEST_SUB_MAX).toBe(HOMING_MAX_LEVEL);
    expect(WEAPON_TEST_BOMBS_MAX).toBeGreaterThan(0);
    expect(WEAPON_TEST_BOMBS_MAX).toBeLessThanOrEqual(BOMBS_MAX);
    expect(WEAPON_TEST_RATE_STEP).toBe(0.5);
    expect(WEAPON_TEST_DAMAGE_STEP).toBe(0.5);
    expect(WEAPON_TEST_RATE_MIN).toBeGreaterThan(0);
    expect(WEAPON_TEST_DAMAGE_MIN).toBeGreaterThan(0);
    expect(WEAPON_TEST_RATE_MAX).toBeGreaterThanOrEqual(FIRE_RATE);
    expect(WEAPON_TEST_DAMAGE_MAX).toBeGreaterThanOrEqual(HOMING_DAMAGE);
    expect(WEAPON_TEST_RATE_MIN).toBeLessThanOrEqual(Math.min(FIRE_RATE, HOMING_FIRE_RATE));
    expect(WEAPON_TEST_DAMAGE_MIN).toBeLessThanOrEqual(
      Math.min(PLAYER_BULLET_DAMAGE, HOMING_DAMAGE)
    );
    expect(WEAPON_TEST_TARGET_X).toBe((LOGICAL_W - WEAPON_TEST_TARGET_W) / 2);
    expect(WEAPON_TEST_TARGET_Y).toBeGreaterThanOrEqual(0);
    expect(WEAPON_TEST_TARGET_Y + WEAPON_TEST_TARGET_H).toBeLessThan(80);
  });
});
