import { describe, expect, it } from 'vitest';
import { calculateScaling } from './renderer';
import { EXTERIOR_STAR_COLORS, EXTERIOR_VOID, exteriorStars, paintExterior } from './exterior';

describe('exteriorStars', () => {
  it('is deterministic and stays inside the viewport', () => {
    const first = exteriorStars(1024, 768);
    expect(first.length).toBeGreaterThan(10);
    expect(exteriorStars(1024, 768)).toEqual(first);
    for (const star of first) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.x + star.size).toBeLessThanOrEqual(1024);
      expect(star.y + star.size).toBeLessThanOrEqual(768);
      expect(star.size === 1 || star.size === 2).toBe(true);
      expect(EXTERIOR_STAR_COLORS).toContain(star.color);
    }
  });

  it('places stars in the letterbox bars of an iPad landscape viewport', () => {
    const view = calculateScaling(1024, 768);
    const stars = exteriorStars(1024, 768);
    const inBar = stars.filter(
      (star) =>
        star.x < view.offsetX ||
        star.x >= view.offsetX + view.canvasWidth ||
        star.y < view.offsetY ||
        star.y >= view.offsetY + view.canvasHeight
    );
    expect(view.offsetX).toBeGreaterThan(100);
    expect(inBar.length).toBeGreaterThan(0);
  });
});

describe('paintExterior', () => {
  it('fills the void then stars and a vertical vignette', () => {
    const fills: { style: unknown; x: number; y: number; w: number; h: number }[] = [];
    let gradients = 0;
    const ctx = {
      fillStyle: '' as unknown,
      fillRect(x: number, y: number, w: number, h: number): void {
        fills.push({ style: this.fillStyle, x, y, w, h });
      },
      createLinearGradient(): { addColorStop(): void } {
        gradients += 1;
        return { addColorStop(): void {} };
      },
    };
    paintExterior(ctx as unknown as CanvasRenderingContext2D, 1194, 834);
    expect(fills[0]).toEqual({ style: EXTERIOR_VOID, x: 0, y: 0, w: 1194, h: 834 });
    expect(gradients).toBe(2);
    const stars = fills.filter((fill) => typeof fill.style === 'string' && fill.w <= 2);
    expect(stars.length).toBe(exteriorStars(1194, 834).length);
  });
});
