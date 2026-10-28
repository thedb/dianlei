import { describe, expect, it } from 'vitest';
import { OBSIDIAN_ENTER_AT, OBSIDIAN_STUB_RADIUS, STAGE4_WARNING_AT } from '@/game/config';
import { CAPTION_LINES } from '@/game/story/captions';
import { BOSS_STAGE_ROWS } from '@/game/ui/bossChallenge';
import { STAGE_SELECT_ROWS, stageHeading } from '@/game/ui/stageSelect';
import { getStage, listStages, nextStageId } from './registry';

describe('stage 4 shell', () => {
  const stage = getStage('4');

  it('is 航母出击 on 海面B, then 黑曜舰空', () => {
    expect(stage.id).toBe('4');
    expect(stage.label).toBe('4');
    expect(stage.name).toBe('航母出击');
    expect(stage.stage).toBe(4);
    expect(stage.warningAt).toBe(STAGE4_WARNING_AT);
    expect(STAGE4_WARNING_AT).toBe(118);
    expect(stage.boss.id).toBe('obsidian');
    expect(stage.boss.script).toBeUndefined();
    expect(stage.boss.enterAt).toBe(OBSIDIAN_ENTER_AT);
    expect(OBSIDIAN_ENTER_AT).toBe(123);
    expect(stage.boss.parts[0]?.radius).toBe(OBSIDIAN_STUB_RADIUS);
    expect(OBSIDIAN_STUB_RADIUS).toBe(26);
    expect(stage.boss.drift.amp).toBe(0);
    expect(stage.boss.phases[0]?.attacks).toEqual([]);
    expect(stage.maps).toEqual({ run: [{ map: 'seaB', at: 0 }], boss: 'obsidianBoss' });
    expect(stage.captions).toEqual([{ id: 's4_open', at: 'open' }]);
    expect(stage.waves).toEqual([]);
    expect(stage.buildings).toEqual([]);
    expect(listStages().map((entry) => entry.id)).toEqual(['1', '2', '3', '4']);
    expect(nextStageId('3')).toBe('4');
    expect(nextStageId('4')).toBeUndefined();
  });

  it('shows up in 关卡选择 and 挑战 Boss', () => {
    expect(stageHeading(stage)).toBe('第四关');
    expect(STAGE_SELECT_ROWS.find((row) => row.action === '4')).toEqual({
      action: '4',
      title: '第四关',
      sub: '航母出击',
    });
    expect(BOSS_STAGE_ROWS.find((row) => row.action === '4')).toEqual({
      action: '4',
      title: '4',
      sub: '黑曜',
    });
  });

  it('keeps the three caption lines locked, and only wires the open cue', () => {
    expect(CAPTION_LINES.s4_open).toBe('航母甲板就绪。电雷，出击。');
    expect(CAPTION_LINES.s4_wreck).toBe('不明残骸……弹痕不像地球武器。');
    expect(CAPTION_LINES.s4_ufo).toBe('未知飞行物击毁目标后撤离。追踪。');
  });
});
