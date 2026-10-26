import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BG_SCROLL_SPEED,
  FURNACE_CORE_HP,
  FURNACE_ENTER_AT,
  FURNACE_OVERLOAD_HP,
  FURNACE_POD_HP,
  STAGE3_WARNING_AT,
} from '@/game/config';
import { prepareBossConfig, scaleHp } from '@/game/difficulty';
import { getStage, nextStageId } from '@/game/levels/registry';
import { enabledBossPhases } from '@/game/systems/boss';

describe('stage 3 stub', () => {
  const stage = getStage('3');

  it('registers 叛军心脏 after stage 2 and keeps its own clocks', () => {
    const src = readFileSync(new URL('./stage3.ts', import.meta.url), 'utf8');
    expect(src).not.toContain('STAGE2_');
    expect(src).not.toContain('TIEBAO_');
    expect(stage.id).toBe('3');
    expect(stage.stage).toBe(3);
    expect(stage.name).toBe('叛军心脏');
    expect(stage.label).toBe('3');
    expect(nextStageId('2')).toBe('3');
    expect(nextStageId('3')).toBeUndefined();
    expect(STAGE3_WARNING_AT).toBe(118);
    expect(stage.warningAt).toBe(STAGE3_WARNING_AT);
    expect(stage.boss.enterAt).toBe(FURNACE_ENTER_AT);
    expect(FURNACE_ENTER_AT).toBe(123);
    expect(stage.scrollSpeed).toBe(BG_SCROLL_SPEED);
    expect(stage.maps).toEqual({ run: [{ map: 'riverA', at: 0 }], boss: 'furnaceBoss' });
    expect(stage.waves).toEqual([]);
    expect(stage.buildings).toEqual([]);
    expect(stage.riskCrates).toBeUndefined();
    expect(stage.captions).toEqual([
      { id: 's3_open', at: 'open' },
      { id: 's3_end', at: 'clear' },
    ]);
  });

  it('arms the iris boss with no laser, and overload only on hard', () => {
    expect(stage.boss.script).toBe('furnace');
    expect(stage.boss.art).toBe('furnace');
    expect(stage.boss.title).toBe('炉心');
    for (const phase of stage.boss.phases) {
      expect(phase.attacks).toEqual([]);
    }
    expect(enabledBossPhases(stage.boss).map((phase) => phase.id)).toEqual(['pods', 'core']);
    expect(enabledBossPhases(stage.boss, ['hard']).map((phase) => phase.id)).toEqual([
      'pods',
      'core',
      'overload',
    ]);
    const easy = prepareBossConfig(stage.boss, 'easy');
    const medium = prepareBossConfig(stage.boss, 'medium');
    const hard = prepareBossConfig(stage.boss, 'hard');
    expect(easy.parts.reduce((sum, part) => sum + part.hp, 0)).toBe(
      FURNACE_POD_HP * 4 + FURNACE_CORE_HP
    );
    expect(medium.parts.map((part) => part.hp)).toEqual(
      stage.boss.parts.map((part) => scaleHp(part.hp, 'medium'))
    );
    expect(hard.phases.find((phase) => phase.id === 'overload')?.segmentHp).toBeCloseTo(
      scaleHp(FURNACE_OVERLOAD_HP, 'hard')
    );
  });
});
