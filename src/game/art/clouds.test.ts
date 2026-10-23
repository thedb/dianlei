import { describe, expect, it } from 'vitest';
import { CLOUD_SHADOW_SPAN, LOGICAL_H, LOGICAL_W } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import {
  CLOUD_KINDS,
  CLOUD_SHADOW_CELL,
  CLOUD_SKY_CELL,
  SHADOW_CLOUDS,
  SKY_CLOUDS,
  cloudExtent,
  cloudMask,
  rasterCloud,
  shadowOriginY,
  type CloudKind,
  type CloudStamp,
} from './clouds';

const BULLETS = new Set<number>([
  COLOR.BULLET_MAGENTA,
  COLOR.BULLET_PINK,
  COLOR.BULLET_DARK,
  COLOR.BULLET_CORE,
]);

function runs(row: string): number {
  let n = 0;
  let prev = false;
  for (const ch of row) {
    if (ch === '#' && !prev) n++;
    prev = ch === '#';
  }
  return n;
}

function filled(mask: readonly string[]): number {
  let n = 0;
  for (const row of mask) for (const ch of row) if (ch === '#') n++;
  return n;
}

function fillRatio(mask: readonly string[]): number {
  const w = mask[0]?.length ?? 1;
  return filled(mask) / (w * mask.length);
}

function aspect(mask: readonly string[]): number {
  return (mask[0]?.length ?? 0) / mask.length;
}

function mirrorDelta(mask: readonly string[]): number {
  let diff = 0;
  let n = 0;
  for (const row of mask) {
    const w = row.length;
    for (let c = 0; c < w; c++) {
      const a = row[c] === '#';
      const b = row[w - 1 - c] === '#';
      if (a || b) n++;
      if (a !== b) diff++;
    }
  }
  return n === 0 ? 0 : diff / n;
}

function components(mask: readonly string[]): number {
  const h = mask.length;
  const w = mask[0]?.length ?? 0;
  const seen: boolean[][] = [];
  for (let r = 0; r < h; r++) seen.push(Array.from({ length: w }, () => false));
  let n = 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (mask[r]?.[c] !== '#' || seen[r]?.[c]) continue;
      n++;
      const stack: Array<[number, number]> = [[c, r]];
      while (stack.length) {
        const next = stack.pop();
        if (!next) break;
        const [x, y] = next;
        if (y < 0 || x < 0 || y >= h || x >= w || seen[y]?.[x] || mask[y]?.[x] !== '#') continue;
        seen[y]![x] = true;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
  }
  return n;
}

function topRuns(mask: readonly string[]): number {
  const row = mask.find((line) => line.includes('#')) ?? '';
  return runs(row);
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

function boxOf(stamp: CloudStamp, role: 'sky' | 'shadow'): Box {
  const { w, h } = cloudExtent(stamp.kind, role);
  const ax = Math.floor(w * 0.5);
  const ay = Math.floor(h * 0.5);
  return { l: stamp.x - ax, t: stamp.y - ay, r: stamp.x - ax + w, b: stamp.y - ay + h };
}

/** True when the boxes meet or come within `gap` px, including a vertical wrap. */
function crowded(a: Box, b: Box, gap: number, span: number | null): boolean {
  const hit = (shift: number): boolean =>
    a.l < b.r + gap && a.r + gap > b.l && a.t < b.b + shift + gap && a.b + gap > b.t + shift;
  if (hit(0)) return true;
  if (span === null) return false;
  return hit(span) || hit(-span);
}

describe('cloud silhouettes', () => {
  it('keeps four compact shapes and drops strips', () => {
    expect(CLOUD_KINDS).toEqual(['puff', 'lobes', 'billow', 'lump']);
    const puff = cloudMask('puff');
    const lobes = cloudMask('lobes');
    const billow = cloudMask('billow');
    const lump = cloudMask('lump');

    for (const mask of [puff, lobes, billow, lump]) {
      expect(aspect(mask)).toBeGreaterThan(1.1);
      expect(aspect(mask)).toBeLessThan(2.5);
      expect(fillRatio(mask)).toBeGreaterThan(0.5);
      expect(components(mask)).toBe(1);
      expect(mask.length).toBeLessThanOrEqual(14);
      expect(mask[0]?.length ?? 0).toBeLessThanOrEqual(20);
    }

    expect(topRuns(puff)).toBe(1);
    expect(topRuns(lobes)).toBe(3);
    expect(mirrorDelta(lobes)).toBe(0);
    expect(topRuns(billow)).toBe(2);
    expect(mirrorDelta(lump)).toBeGreaterThan(0.25);
    expect(topRuns(lump)).toBe(1);
  });

  it('bakes sky and shadow from the same mask, in palette colours', () => {
    for (const kind of CLOUD_KINDS) {
      const mask = cloudMask(kind);
      const cells = filled(mask);
      const sky = rasterCloud(kind, 'sky');
      const shadow = rasterCloud(kind, 'shadow');
      expect(sky[0]?.length).toBe((mask[0]?.length ?? 0) * CLOUD_SKY_CELL);
      expect(sky.length).toBe(mask.length * CLOUD_SKY_CELL);
      expect(shadow[0]?.length).toBe((mask[0]?.length ?? 0) * CLOUD_SHADOW_CELL);
      expect(opaque(sky)).toBe(cells * CLOUD_SKY_CELL * CLOUD_SKY_CELL);
      expect(opaque(shadow)).toBe(cells * CLOUD_SHADOW_CELL * CLOUD_SHADOW_CELL);
      const skyUsed = new Set<number>();
      for (const row of sky) {
        for (const cell of row) {
          if (cell < 0) continue;
          expect(cell).toBeLessThan(PALETTE.length);
          expect(BULLETS.has(cell)).toBe(false);
          skyUsed.add(cell);
        }
      }
      expect(skyUsed.has(COLOR.PALE_GRAY)).toBe(true);
      expect(skyUsed.has(COLOR.LIGHT_GRAY)).toBe(true);
      for (const row of shadow) {
        for (const cell of row) {
          if (cell < 0) continue;
          expect(cell).toBe(COLOR.SHADOW);
        }
      }
    }
  });
});

function opaque(grid: readonly (readonly number[])[]): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell >= 0) n++;
  return n;
}

describe('cloud placement', () => {
  const skySpan = LOGICAL_H + 120;

  it('spaces sky stamps and only flips them', () => {
    expect(SKY_CLOUDS).toHaveLength(CLOUD_KINDS.length);
    const kinds = new Set<CloudKind>();
    for (const cloud of SKY_CLOUDS) {
      kinds.add(cloud.kind);
      expect(cloud).not.toHaveProperty('turns');
      const box = boxOf(cloud, 'sky');
      expect(box.l).toBeGreaterThanOrEqual(0);
      expect(box.r).toBeLessThanOrEqual(LOGICAL_W);
      expect(box.t).toBeGreaterThanOrEqual(0);
      expect(box.b).toBeLessThanOrEqual(skySpan);
    }
    for (const kind of CLOUD_KINDS) expect(kinds.has(kind)).toBe(true);
    expect(SKY_CLOUDS.some((cloud) => cloud.mirrorX)).toBe(true);
    expect(SKY_CLOUDS.some((cloud) => cloud.mirrorY)).toBe(true);
    expect(SKY_CLOUDS.some((cloud) => !cloud.mirrorY)).toBe(true);
    for (let i = 0; i < SKY_CLOUDS.length; i++) {
      for (let j = i + 1; j < SKY_CLOUDS.length; j++) {
        expect(
          crowded(boxOf(SKY_CLOUDS[i]!, 'sky'), boxOf(SKY_CLOUDS[j]!, 'sky'), 8, skySpan)
        ).toBe(false);
      }
    }
  });

  it('places one unstacked shadow of each shape', () => {
    expect(SHADOW_CLOUDS).toHaveLength(CLOUD_KINDS.length);
    const kinds = new Set<CloudKind>();
    const ys = SHADOW_CLOUDS.map((stamp) => stamp.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(360);
    for (const stamp of SHADOW_CLOUDS) {
      kinds.add(stamp.kind);
      expect(stamp).not.toHaveProperty('turns');
      expect(stamp.y).toBeGreaterThanOrEqual(0);
      expect(stamp.y).toBeLessThan(CLOUD_SHADOW_SPAN);
    }
    for (const kind of CLOUD_KINDS) expect(kinds.has(kind)).toBe(true);
    expect(SHADOW_CLOUDS.some((stamp) => stamp.mirrorX)).toBe(true);
    expect(SHADOW_CLOUDS.some((stamp) => stamp.mirrorY)).toBe(true);
    for (let i = 0; i < SHADOW_CLOUDS.length; i++) {
      for (let j = i + 1; j < SHADOW_CLOUDS.length; j++) {
        expect(
          crowded(
            boxOf(SHADOW_CLOUDS[i]!, 'shadow'),
            boxOf(SHADOW_CLOUDS[j]!, 'shadow'),
            8,
            CLOUD_SHADOW_SPAN
          )
        ).toBe(false);
      }
    }
    const visible = SHADOW_CLOUDS.filter((stamp) => {
      const y = shadowOriginY(stamp.y, 0);
      return y > -80 && y < LOGICAL_H;
    });
    expect(visible.length).toBeGreaterThanOrEqual(1);
    expect(visible.length).toBeLessThanOrEqual(2);
  });
});
