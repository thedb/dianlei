import { describe, expect, it } from 'vitest';
import {
  bankDepth,
  bankKeys,
  chainKeys,
  easePose,
  pairKeys,
  poseAt,
  sampleTimeline,
  timelineDuration,
  tweenPart,
  tweenStages,
} from './entityTween';
import {
  cloneStage,
  sampleAssemblyEntity,
  type EntityFile,
  type EntityPlacement,
} from './entityFile';

function addBankStagesForTest(entity: EntityFile): EntityFile {
  const base = entity.stages[0];
  if (!base) throw new Error('no stage');
  for (const id of ['t0', 't1', 't2', 't3', 't4', 't5']) entity.stages.push(cloneStage(base, id));
  return entity;
}

function stage(id: string) {
  const found = sampleAssemblyEntity().stages.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function part(parts: readonly EntityPlacement[], id: string): EntityPlacement {
  const found = parts.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

describe('entity pose tween', () => {
  it('holds, then moves, then rests on the last key', () => {
    const entity = sampleAssemblyEntity();
    const timeline = {
      keys: pairKeys(entity, 'folded', 'open', false),
      move: 1,
      hold: 0.5,
      loop: false,
    };
    expect(timelineDuration(timeline)).toBe(2);
    expect(sampleTimeline(timeline, 0.25)).toEqual({ from: 0, to: 1, t: 0, holding: true });
    expect(sampleTimeline(timeline, 1)).toEqual({ from: 0, to: 1, t: 0.5, holding: false });
    expect(sampleTimeline(timeline, 5)).toEqual({ from: 1, to: 1, t: 0, holding: true });
  });

  it('loops A → B → A and wraps the clock', () => {
    const entity = sampleAssemblyEntity();
    const keys = pairKeys(entity, 'folded', 'open', true);
    expect(keys.map((item) => item.stage)).toEqual(['folded', 'open', 'folded']);
    const timeline = { keys, move: 1, hold: 0, loop: true };
    expect(timelineDuration(timeline)).toBe(2);
    expect(sampleTimeline(timeline, 2.5)).toEqual({ from: 0, to: 1, t: 0.5, holding: false });
    expect(chainKeys(entity, false).map((item) => item.stage)).toEqual(['folded', 'half', 'open']);
    expect(() => pairKeys(entity, 'open', 'open', false)).toThrow();
  });

  it('turns the short way and ends exactly on both poses', () => {
    const from = part(stage('folded').parts, 'wingR');
    const to = part(stage('open').parts, 'wingR');
    expect(tweenPart(from, to, 0)).toEqual(from);
    expect(tweenPart(from, to, 1)).toEqual(to);
    expect(tweenPart(from, to, 0.5).angle).toBeCloseTo(Math.PI / 4);
    const wrap = tweenPart({ ...from, angle: 3 }, { ...from, angle: -3 }, 0.5);
    expect(Math.abs(wrap.angle)).toBeCloseTo(Math.PI);
  });

  it('interpolates stretch and skew, and keeps the pivot pixel continuous', () => {
    const from = part(stage('folded').parts, 'body');
    const to: EntityPlacement = { ...from, x: 10, stretchX: 2, skewX: 0.4, pivot: { x: 0, y: 0 } };
    const mid = tweenPart(from, to, 0.5);
    expect(mid.stretchX).toBeCloseTo(1.5);
    expect(mid.skewX).toBeCloseTo(0.2);
    expect(mid.pivot).toEqual(from.pivot);
    const end = tweenPart(from, to, 0.999);
    expect(end.x).toBeGreaterThan(10);
  });

  it('swaps flip and one-sided parts at halfway, in draw order, snapped', () => {
    const a = stage('folded');
    const b = {
      id: 'b',
      parts: [{ ...part(a.parts, 'wingR'), flipX: false, layer: 9 }, part(a.parts, 'body')],
    };
    const early = tweenStages(a, b, 0.4, true);
    expect(early.map((item) => item.id)).toContain('wingL');
    expect(part(early, 'wingR').flipX).toBe(true);
    const late = tweenStages(a, b, 0.6, true);
    expect(late.map((item) => item.id)).not.toContain('wingL');
    expect(part(late, 'wingR').flipX).toBe(false);
    expect(late.at(-1)?.id).toBe('wingR');
    for (const item of tweenStages(a, stage('open'), 0.3, true)) {
      expect(Number.isInteger(item.x) && Number.isInteger(item.y)).toBe(true);
    }
  });

  it('plays the bank loop right then mirrored left, through t0', () => {
    const entity = addBankStagesForTest(sampleAssemblyEntity());
    expect(bankDepth(entity)).toBe(5);
    const keys = bankKeys(entity);
    expect(keys.map((item) => `${item.mirror ? 'L' : 'R'}${item.stage}`)).toEqual([
      'Rt0',
      'Rt1',
      'Rt2',
      'Rt3',
      'Rt4',
      'Rt5',
      'Rt4',
      'Rt3',
      'Rt2',
      'Rt1',
      'Rt0',
      'Lt1',
      'Lt2',
      'Lt3',
      'Lt4',
      'Lt5',
      'Lt4',
      'Lt3',
      'Lt2',
      'Lt1',
      'Rt0',
    ]);
    const timeline = { keys, move: 0.1, hold: 0, loop: true };
    expect(poseAt(entity, timeline, 0.05, 'linear', true)?.mirror).toBe(false);
    expect(poseAt(entity, timeline, 1.05, 'linear', true)?.mirror).toBe(true);
    expect(() => bankKeys(sampleAssemblyEntity())).toThrow();
  });

  it('eases smoothly at the ends', () => {
    expect(easePose(0.5, 'smooth')).toBe(0.5);
    expect(easePose(0.1, 'smooth')).toBeLessThan(0.1);
    expect(easePose(2, 'linear')).toBe(1);
  });
});
