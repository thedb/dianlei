import { describe, expect, it } from 'vitest';
import { BG_SCROLL_SPEED, LOGICAL_H, TILE_SIZE, warningTileScrollPx } from '@/game/config';
import { getTileMap } from '@/game/maps';
import type { GroundEntry } from './types';
import { getMvpEnemyCount, getMvpWaves, getStageEnemyCount, stage1 } from './stage1';

/** MVP enemy total documented in docs/电雷_第一关波次表_v1.md §1 */
const DOC_MVP_ENEMY_COUNT = 94;

describe('stage1 waves', () => {
  it('matches the MVP enemy total in the wave table doc', () => {
    expect(getMvpEnemyCount()).toBe(DOC_MVP_ENEMY_COUNT);
  });

  it('schedules 148 fixed enemies and 149 with the relief ship', () => {
    expect(getStageEnemyCount(false)).toBe(148);
    expect(getStageEnemyCount(true)).toBe(149);
  });

  it('lists W01 through W27 in time order', () => {
    expect(stage1.waves).toHaveLength(27);
    expect(stage1.waves.map((w) => w.id)).toEqual(
      Array.from({ length: 27 }, (_, i) => `W${String(i + 1).padStart(2, '0')}`)
    );
    for (let i = 1; i < stage1.waves.length; i++) {
      expect(stage1.waves[i]!.t).toBeGreaterThanOrEqual(stage1.waves[i - 1]!.t);
    }
  });

  it('stops spawning before the warning', () => {
    expect(stage1.warningAt).toBe(150);
    expect(stage1.name).toBe('边境突袭');
    const last = stage1.waves[stage1.waves.length - 1]!;
    expect(last.id).toBe('W27');
    expect(last.t).toBeLessThan(stage1.warningAt);
  });

  it('runs on 陆地A until the warning, then 百战要塞 for the boss', () => {
    expect(stage1.maps.run).toEqual([{ map: 'landA', at: 0 }]);
    expect(stage1.maps.boss).toBe('landBoss');
    expect(stage1.captions).toEqual([
      { id: 's1_open', at: 'open' },
      { id: 's1_end', at: 'clear' },
    ]);
  });

  it('has 陆地A rows for the whole pre-boss run and the warning speed-up, without looping', () => {
    const rows = getTileMap('landA').rows;
    const warningScroll = stage1.warningAt * BG_SCROLL_SPEED;
    expect(rows * TILE_SIZE).toBeGreaterThanOrEqual(
      warningScroll + warningTileScrollPx() + LOGICAL_H
    );
  });

  it('only uses small and medium fighters in fully-MVP waves', () => {
    for (const wave of getMvpWaves().filter((w) => w.mvp === true)) {
      for (const group of wave.groups) {
        expect(['small', 'medium']).toContain(group.enemy);
      }
    }
  });

  it('puts the non-MVP types on the waves that introduce them', () => {
    const types = new Set<string>();
    for (const wave of stage1.waves) {
      for (const group of wave.groups) types.add(group.enemy);
    }
    expect([...types].sort()).toEqual(
      ['bomber', 'drone', 'interceptor', 'medium', 'missile_car', 'small', 'tank', 'turret2'].sort()
    );
  });

  it('has a spawn x for every enemy in each group', () => {
    for (const wave of stage1.waves) {
      for (const group of wave.groups) {
        expect(group.xs.length === 1 || group.xs.length >= group.count).toBe(true);
      }
    }
  });

  it('gives stage-1 tanks every non-top entry and keeps coast tanks off a left-side start', () => {
    const entries = new Set<GroundEntry>();
    let tanks = 0;
    for (const wave of stage1.waves) {
      for (const group of wave.groups) {
        if (group.enemy !== 'tank') continue;
        tanks += group.count;
        expect(group.move.kind).toBe('ground');
        if (group.move.kind !== 'ground') continue;
        const entry = group.move.entry ?? 'top';
        expect(entry).not.toBe('top');
        entries.add(entry);
        if (wave.section === 'coast') {
          expect(entry === 'right' || entry === 'bottomRight').toBe(true);
          expect(group.xs.every((x) => x >= 240)).toBe(true);
        }
      }
    }
    expect(tanks).toBe(14);
    expect([...entries].sort()).toEqual(['bottomLeft', 'bottomRight', 'left', 'right']);
    for (const wave of stage1.waves) {
      for (const group of wave.groups) {
        if (group.enemy !== 'tank' || group.move.kind !== 'ground') continue;
        if (group.move.vx !== undefined) expect(Math.abs(group.move.vx)).toBeLessThanOrEqual(12);
      }
    }
  });

  it('drops the documented P and B carriers', () => {
    const drops: string[] = [];
    for (const wave of stage1.waves) {
      for (const group of wave.groups) {
        for (const drop of group.drops ?? []) drops.push(`${wave.id}:${drop.item}`);
      }
    }
    expect(drops.filter((d) => d.endsWith(':P')).length).toBe(5);
    expect(drops.filter((d) => d.endsWith(':B')).length).toBe(3);
  });
});
