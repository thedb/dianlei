/**
 * Editor playback of entity poses (pixel editor P3). The fight does not read this.
 *
 * A timeline is a list of pose keys. Each segment holds on its key for `hold`
 * seconds, then moves to the next key over `move` seconds. A looping timeline
 * wraps from the last key back to the first; otherwise it rests on the last key.
 */
import { partLinear, type EntityFile, type EntityPlacement, type EntityStage } from './entityFile';

export const BANK_LEVEL_COUNT = 5;

export type PoseEase = 'linear' | 'smooth';

export interface PoseKey {
  stage: string;
  /**
   * Draw this key mirrored about x = 0 (left bank from a right-bank stage). A move
   * that touches a mirrored key draws mirrored for its whole length.
   */
  mirror: boolean;
  label: string;
}

export interface PoseTimeline {
  keys: PoseKey[];
  move: number;
  hold: number;
  loop: boolean;
}

export interface TimelineSample {
  from: number;
  to: number;
  /** Raw progress of the move from `from` to `to`, 0–1. 0 while holding. */
  t: number;
  holding: boolean;
}

function key(entity: EntityFile, id: string, mirror = false, label?: string): PoseKey {
  const stage = entity.stages.find((item) => item.id === id);
  if (!stage) throw new Error(`没有阶段 ${id}`);
  return { stage: id, mirror, label: label ?? (stage.name ? `${id} ${stage.name}` : id) };
}

/** A → B, and back to A when looping. */
export function pairKeys(entity: EntityFile, from: string, to: string, loop: boolean): PoseKey[] {
  if (from === to) throw new Error('起点和终点是同一个阶段');
  const keys = [key(entity, from), key(entity, to)];
  if (loop) keys.push(key(entity, from));
  return keys;
}

/** Every stage in file order, back to the first when looping. */
export function chainKeys(entity: EntityFile, loop: boolean): PoseKey[] {
  if (entity.stages.length < 2) throw new Error('至少两个阶段才能依次播放');
  const keys = entity.stages.map((stage) => key(entity, stage.id));
  const first = entity.stages[0];
  if (loop && first) keys.push(key(entity, first.id));
  return keys;
}

/** Right-bank levels present without a gap from t1, 0–5. */
export function bankDepth(entity: EntityFile): number {
  if (!entity.stages.some((stage) => stage.id === 't0')) return 0;
  let depth = 0;
  while (depth < BANK_LEVEL_COUNT && entity.stages.some((stage) => stage.id === `t${depth + 1}`)) {
    depth++;
  }
  return depth;
}

/**
 * t0 → right t1…tN → t0 → left 1…N (t1…tN mirrored) → t0, like a stick pushed
 * right and then left. Left frames are not stages; they mirror the right ones.
 */
export function bankKeys(entity: EntityFile): PoseKey[] {
  const depth = bankDepth(entity);
  if (depth === 0) throw new Error('需要 t0 和 t1。先点「侧倾 t0–t5」');
  const levels: number[] = [];
  for (let level = 1; level <= depth; level++) levels.push(level);
  const out: PoseKey[] = [key(entity, 't0', false, 't0 平飞')];
  for (const mirror of [false, true]) {
    const name = (level: number): string => (mirror ? `左${level}` : `右 t${level}`);
    for (const level of levels) out.push(key(entity, `t${level}`, mirror, name(level)));
    for (const level of levels.slice(0, -1).reverse()) {
      out.push(key(entity, `t${level}`, mirror, name(level)));
    }
    out.push(key(entity, 't0', false, 't0 平飞'));
  }
  return out;
}

export function timelineDuration(timeline: PoseTimeline): number {
  const segments = timeline.keys.length - 1;
  if (segments <= 0) return 0;
  const span = segments * (timeline.hold + timeline.move);
  return timeline.loop ? span : span + timeline.hold;
}

export function sampleTimeline(timeline: PoseTimeline, time: number): TimelineSample {
  const segments = timeline.keys.length - 1;
  const total = timelineDuration(timeline);
  if (segments <= 0 || total <= 0) return { from: 0, to: 0, t: 0, holding: true };
  const at = timeline.loop ? ((time % total) + total) % total : Math.min(Math.max(time, 0), total);
  const segment = timeline.hold + timeline.move;
  let index = segment > 0 ? Math.floor(at / segment) : 0;
  if (index >= segments) {
    if (!timeline.loop) return { from: segments, to: segments, t: 0, holding: true };
    index = segments - 1;
  }
  const local = at - index * segment;
  if (local < timeline.hold) return { from: index, to: index + 1, t: 0, holding: true };
  const t = timeline.move > 0 ? Math.min(1, (local - timeline.hold) / timeline.move) : 1;
  return { from: index, to: index + 1, t, holding: false };
}

export function easePose(t: number, ease: PoseEase): number {
  const clamped = Math.min(1, Math.max(0, t));
  return ease === 'smooth' ? clamped * clamped * (3 - 2 * clamped) : clamped;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest turn from `a` to `b`, in radians. */
function turn(a: number, b: number): number {
  const full = Math.PI * 2;
  let delta = (b - a) % full;
  if (delta > Math.PI) delta -= full;
  if (delta < -Math.PI) delta += full;
  return delta;
}

function copyPart(part: EntityPlacement): EntityPlacement {
  return JSON.parse(JSON.stringify(part)) as EntityPlacement;
}

/**
 * One part between two poses. Same grid and same flip interpolate position
 * (of `from`'s pivot pixel), angle on the short way round, scale, stretch and
 * skew. Anything else switches at the halfway point.
 */
export function tweenPart(from: EntityPlacement, to: EntityPlacement, t: number): EntityPlacement {
  if (t <= 0) return copyPart(from);
  if (t >= 1) return copyPart(to);
  const late = t >= 0.5;
  if (from.grid !== to.grid || from.flipX !== to.flipX) return copyPart(late ? to : from);
  const dx = (from.pivot.x - to.pivot.x) * (to.flipX ? -1 : 1);
  const dy = from.pivot.y - to.pivot.y;
  const m = partLinear(to);
  const toX = to.x + m[0] * dx + m[2] * dy;
  const toY = to.y + m[1] * dx + m[3] * dy;
  const out = copyPart(late ? to : from);
  out.pivot = { x: from.pivot.x, y: from.pivot.y };
  out.x = lerp(from.x, toX, t);
  out.y = lerp(from.y, toY, t);
  out.angle = from.angle + turn(from.angle, to.angle) * t;
  out.scale = lerp(from.scale, to.scale, t);
  const stretchX = lerp(from.stretchX ?? 1, to.stretchX ?? 1, t);
  const stretchY = lerp(from.stretchY ?? 1, to.stretchY ?? 1, t);
  const skewX = lerp(from.skewX ?? 0, to.skewX ?? 0, t);
  const skewY = lerp(from.skewY ?? 0, to.skewY ?? 0, t);
  if (stretchX === 1) delete out.stretchX;
  else out.stretchX = stretchX;
  if (stretchY === 1) delete out.stretchY;
  else out.stretchY = stretchY;
  if (skewX === 0) delete out.skewX;
  else out.skewX = skewX;
  if (skewY === 0) delete out.skewY;
  else out.skewY = skewY;
  return out;
}

/**
 * Parts of the pose `t` of the way from stage `a` to stage `b`, in draw order.
 * Parts match by id. A part only in `a` shows until halfway; one only in `b`
 * from halfway. `snap` rounds positions to whole entity pixels, like the game.
 */
export function tweenStages(
  a: EntityStage,
  b: EntityStage,
  t: number,
  snap: boolean
): EntityPlacement[] {
  const late = t >= 0.5;
  const inB = new Map(b.parts.map((part, index) => [part.id, { part, index }]));
  const inA = new Set(a.parts.map((part) => part.id));
  const rows: { part: EntityPlacement; order: number }[] = [];
  a.parts.forEach((part, index) => {
    const other = inB.get(part.id);
    if (!other) {
      if (!late) rows.push({ part: copyPart(part), order: index });
      return;
    }
    rows.push({ part: tweenPart(part, other.part, t), order: late ? other.index : index });
  });
  if (late) {
    b.parts.forEach((part, index) => {
      if (!inA.has(part.id)) rows.push({ part: copyPart(part), order: index });
    });
  }
  rows.sort((x, y) => x.part.layer - y.part.layer || x.order - y.order);
  return rows.map(({ part }) => {
    if (snap && t > 0 && t < 1) {
      part.x = Math.round(part.x);
      part.y = Math.round(part.y);
    }
    return part;
  });
}

export interface PlayedPose {
  parts: EntityPlacement[];
  mirror: boolean;
  sample: TimelineSample;
}

export function poseAt(
  entity: EntityFile,
  timeline: PoseTimeline,
  time: number,
  ease: PoseEase,
  snap: boolean
): PlayedPose | null {
  const sample = sampleTimeline(timeline, time);
  const fromKey = timeline.keys[sample.from];
  const toKey = timeline.keys[sample.to] ?? fromKey;
  if (!fromKey || !toKey) return null;
  const a = entity.stages.find((stage) => stage.id === fromKey.stage);
  const b = entity.stages.find((stage) => stage.id === toKey.stage);
  if (!a || !b) return null;
  const t = sample.holding ? 0 : easePose(sample.t, ease);
  return {
    parts: tweenStages(a, b, t, snap),
    mirror: fromKey.mirror || toKey.mirror,
    sample,
  };
}
