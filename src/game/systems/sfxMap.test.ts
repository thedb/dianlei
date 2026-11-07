import { existsSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { SFX_BOSS_VOICES, SFX_EXPLODE_VOICES } from '@/game/config';
import { ENEMY_TYPES } from '@/game/entities/enemyDefs';
import { SHIP_IDS } from '@/game/entities/shipDefs';
import {
  BUILDING_EXPLODE_TIER,
  ENEMY_EXPLODE_TIER,
  NORMAL_EXPLODE_POOL,
  SFX_SAMPLE_IDS,
  SFX_SAMPLE_URL,
  bossDeathCues,
  bossExplosionVoices,
  explodeSampleForTier,
  explodeTierForBuilding,
  explodeTierForEnemy,
  sampleSlot,
  shootSample,
  voicesToStop,
} from './sfxMap';

describe('sfx map', () => {
  it('points each ship at Yoan’s locked file', () => {
    expect(shootSample('eagle')).toBe('shoot_eagle');
    expect(shootSample(undefined)).toBe('shoot_eagle');
    expect(shootSample('mandy')).toBe('shoot_mandy');
    expect(shootSample('jason')).toBe('shoot_jason');
    expect(SFX_SAMPLE_URL.shoot_mandy).toBe('assets/sfx/shoot_mandy.ogg');
    expect(SFX_SAMPLE_URL.shoot_eagle).not.toContain('M1');
    for (const id of SHIP_IDS) {
      expect(SFX_SAMPLE_IDS).toContain(shootSample(id));
    }
  });

  it('keeps the picked oggs on disk', () => {
    for (const id of SFX_SAMPLE_IDS) {
      expect(existsSync(resolve(SFX_SAMPLE_URL[id]))).toBe(true);
    }
  });

  it('classifies every enemy and building', () => {
    for (const type of ENEMY_TYPES) {
      expect(explodeTierForEnemy(type)).toBe(ENEMY_EXPLODE_TIER[type]);
    }
    expect(explodeTierForEnemy('small')).toBe('normal');
    expect(explodeTierForEnemy('tank')).toBe('normal');
    expect(explodeTierForEnemy('turret2')).toBe('turret');
    expect(explodeTierForEnemy('factory_aa')).toBe('turret');
    expect(explodeTierForEnemy('medium')).toBe('elite');
    expect(explodeTierForEnemy('bomber')).toBe('elite');
    expect(explodeTierForEnemy('strike')).toBe('elite');
    expect(explodeTierForEnemy('torpedo')).toBe('elite');
    expect(explodeTierForBuilding('aa_gun')).toBe('turret');
    expect(explodeTierForBuilding('pillbox')).toBe('turret');
    expect(explodeTierForBuilding('sea_gun')).toBe('turret');
    expect(explodeTierForBuilding('fuel_depot')).toBe('normal');
    expect(explodeTierForBuilding('radar_station')).toBe('normal');
    expect(BUILDING_EXPLODE_TIER.aa_gun).toBe('turret');
  });

  it('draws normal and turret kills only from N2 / N3 / N4', () => {
    const seen = new Set<string>();
    const rolls = [0, 0.34, 0.67, 0.999, 1];
    for (const tier of ['normal', 'turret'] as const) {
      for (const roll of rolls) {
        const picked = explodeSampleForTier(tier, () => roll);
        expect(NORMAL_EXPLODE_POOL).toContain(picked);
        seen.add(picked);
      }
    }
    expect([...seen].sort()).toEqual([...NORMAL_EXPLODE_POOL].sort());
    expect(explodeSampleForTier('normal', () => 0)).toBe('explode_n2');
    expect(explodeSampleForTier('turret', () => 0.34)).toBe('explode_n3');
    expect(explodeSampleForTier('normal', () => 0.67)).toBe('explode_n4');
  });

  it('pins elites to N1 and boss blasts to B2 without rolling', () => {
    const boom = (): number => {
      throw new Error('rng');
    };
    expect(explodeSampleForTier('elite', boom)).toBe('explode_n1');
    expect(explodeSampleForTier('boss', boom)).toBe('explode_boss_b2');
    expect(SFX_SAMPLE_URL.explode_n1).toBe('assets/sfx/explode_n1.ogg');
    expect(SFX_SAMPLE_URL.explode_boss_b2).toBe('assets/sfx/explode_boss_b2.ogg');
  });

  it('asks for one B2 per large death blast and never stacks a second clip', () => {
    expect(bossDeathCues(0)).toEqual([]);
    expect(bossDeathCues(6)).toEqual([
      'explode_boss_b2',
      'explode_boss_b2',
      'explode_boss_b2',
      'explode_boss_b2',
      'explode_boss_b2',
      'explode_boss_b2',
    ]);
    const frame = bossExplosionVoices([{ size: 'large' }, { size: 'medium' }, { size: 'large' }]);
    expect(frame).toEqual({ bossBlasts: 2, otherBlasts: 1 });
    expect(bossDeathCues(frame.bossBlasts)).toEqual(['explode_boss_b2', 'explode_boss_b2']);
    expect(bossDeathCues(frame.bossBlasts).some((id) => id !== 'explode_boss_b2')).toBe(false);
  });

  it('interrupts shoot and boss, and caps the explosion pool', () => {
    expect(sampleSlot('shoot_jason')).toBe('shoot');
    expect(sampleSlot('explode_n2')).toBe('explode');
    expect(sampleSlot('explode_n1')).toBe('elite');
    expect(sampleSlot('explode_boss_b2')).toBe('boss');
    expect(SFX_BOSS_VOICES).toBe(1);
    expect(voicesToStop('shoot', 0)).toBe(0);
    expect(voicesToStop('shoot', 1)).toBe(1);
    expect(voicesToStop('boss', 1)).toBe(1);
    expect(voicesToStop('explode', SFX_EXPLODE_VOICES - 1)).toBe(0);
    expect(voicesToStop('explode', SFX_EXPLODE_VOICES)).toBe(1);
    expect(voicesToStop('elite', 1)).toBe(0);
    expect(voicesToStop('elite', 2)).toBe(1);
  });
});
