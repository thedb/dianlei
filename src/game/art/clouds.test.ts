import { describe, expect, it } from 'vitest';
import { CLOUD_SHADOW_SPAN, LOGICAL_H } from '@/game/config';
import { COLOR, PALETTE } from '@/game/palette';
import {
  CLOUD_KINDS,
  CLOUD_SHADOW_CELL,
  CLOUD_SKY_CELL,
  SHADOW_CLUSTERS,
  SKY_CLOUDS,
  cloudMask,
  rasterCloud,
  shadowOriginY,
  type CloudKind,
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

function maxColumn(mask: readonly string[]): number {
  const w = mask[0]?.length ?? 0;
  let max = 0;
  for (let c = 0; c < w; c++) {
    let n = 0;
    for (const row of mask) if (row[c] === '#') n++;
    max = Math.max(max, n);
  }
  return max;
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

function bottomOverMax(mask: readonly string[]): number {
  const last = mask[mask.length - 1] ?? '';
  const max = Math.max(...mask.map((row) => [...row].filter((ch) => ch === '#').length));
  return [...last].filter((ch) => ch === '#').length / max;
}

describe('cloud silhouettes', () => {
  it('defines four different shapes, none of them a filled ellipse', () => {
    expect(CLOUD_KINDS).toEqual(['shelf', 'lobes', 'streak', 'lump']);
    const shelf = cloudMask('shelf');
    const lobes = cloudMask('lobes');
    const streak = cloudMask('streak');
    const lump = cloudMask('lump');

    const aspect = (mask: readonly string[]) => (mask[0]?.length ?? 0) / mask.length;
    expect(aspect(shelf)).toBeGreaterThanOrEqual(4);
    expect(fillRatio(shelf)).toBeGreaterThan(0.7);
    expect(topRuns(shelf)).toBe(2);
    expect(bottomOverMax(shelf)).toBeGreaterThan(0.85);
    expect(components(shelf)).toBe(1);

    expect(topRuns(lobes)).toBe(3);
    expect(mirrorDelta(lobes)).toBe(0);
    expect(fillRatio(lobes)).toBeGreaterThan(0.55);
    expect(aspect(lobes)).toBeLessThan(3);
    expect(components(lobes)).toBe(1);

    expect(fillRatio(streak)).toBeLessThan(0.35);
    expect(maxColumn(streak)).toBeLessThanOrEqual(3);
    expect(aspect(streak)).toBeGreaterThanOrEqual(4.5);
    expect(Math.max(...streak.map(runs))).toBeGreaterThanOrEqual(2);

    expect(mirrorDelta(lump)).toBeGreaterThan(0.35);
    expect(Math.max(...lump.map(runs))).toBeGreaterThanOrEqual(2);
    expect(topRuns(lump)).toBe(1);
    expect(fillRatio(lump)).toBeGreaterThan(0.45);
    expect(aspect(lump)).toBeLessThan(2.6);
    expect(components(lump)).toBe(1);
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
  it('shows every shape in the sky, with a mirror and a half-turn', () => {
    expect(SKY_CLOUDS.length).toBeLessThanOrEqual(8);
    expect(SKY_CLOUDS.length).toBeGreaterThanOrEqual(CLOUD_KINDS.length);
    const kinds = new Set(SKY_CLOUDS.map((cloud) => cloud.kind));
    for (const kind of CLOUD_KINDS) expect(kinds.has(kind)).toBe(true);
    expect(SKY_CLOUDS.some((cloud) => cloud.mirrorX)).toBe(true);
    expect(SKY_CLOUDS.some((cloud) => cloud.turns !== 0)).toBe(true);
  });

  it('stacks the four shapes into a few oriented shadow clusters', () => {
    expect(SHADOW_CLUSTERS.length).toBeLessThanOrEqual(4);
    const kinds = new Set<CloudKind>();
    let stamps = 0;
    const ys = SHADOW_CLUSTERS.map((cluster) => cluster.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(360);
    for (const cluster of SHADOW_CLUSTERS) {
      expect(cluster.stamps.length).toBeGreaterThanOrEqual(2);
      expect(cluster.stamps.length).toBeLessThanOrEqual(3);
      expect(cluster.y).toBeGreaterThanOrEqual(0);
      expect(cluster.y).toBeLessThan(CLOUD_SHADOW_SPAN);
      stamps += cluster.stamps.length;
      for (const stamp of cluster.stamps) kinds.add(stamp.kind);
    }
    expect(stamps).toBeLessThanOrEqual(12);
    for (const kind of CLOUD_KINDS) expect(kinds.has(kind)).toBe(true);
    expect(
      SHADOW_CLUSTERS.some((cluster) => cluster.stamps.some((stamp) => stamp.turns === 1))
    ).toBe(true);
    expect(SHADOW_CLUSTERS.some((cluster) => cluster.stamps.some((stamp) => stamp.mirrorX))).toBe(
      true
    );
    const visible = SHADOW_CLUSTERS.filter((cluster) => {
      const y = shadowOriginY(cluster.y, 0);
      return y > -80 && y < LOGICAL_H;
    });
    expect(visible.length).toBeGreaterThanOrEqual(1);
    expect(visible.length).toBeLessThanOrEqual(3);
  });
});
