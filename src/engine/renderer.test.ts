import { describe, it, expect } from 'vitest';
import { calculateScaling } from './renderer';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';

describe('calculateScaling', () => {
  it('should calculate correct scale for exact fit', () => {
    // Screen is exactly 2x logical resolution
    const result = calculateScaling(720, 1280, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(2);
    expect(result.canvasWidth).toBe(720);
    expect(result.canvasHeight).toBe(1280);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('should use integer scaling when close to integer', () => {
    // Screen is slightly larger than 2x - should snap to 2
    const result = calculateScaling(750, 1320, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(2);
    expect(result.canvasWidth).toBe(720);
    expect(result.canvasHeight).toBe(1280);
    // Should have letterboxing
    expect(result.offsetX).toBe(Math.floor((750 - 720) / 2));
    expect(result.offsetY).toBe(Math.floor((1320 - 1280) / 2));
  });

  it('should letterbox horizontally for wide screens', () => {
    // Wide screen: 1920x1080 (16:9)
    const result = calculateScaling(1920, 1080, LOGICAL_W, LOGICAL_H);

    // Height is limiting factor: 1080 / 640 = 1.6875
    // Should snap to 1 since 1.6875 - 1 = 0.6875 > 0.2
    // Actually 1.6875 is not close to 1 or 2, so it won't snap
    expect(result.scale).toBeLessThanOrEqual(1080 / LOGICAL_H);

    // Canvas should fit within screen
    expect(result.canvasWidth).toBeLessThanOrEqual(1920);
    expect(result.canvasHeight).toBeLessThanOrEqual(1080);

    // Should have horizontal letterboxing (black bars on sides)
    expect(result.offsetX).toBeGreaterThan(0);
  });

  it('should letterbox vertically for tall screens', () => {
    // Very tall screen
    const result = calculateScaling(400, 2000, LOGICAL_W, LOGICAL_H);

    // Width is limiting factor: 400 / 360 = 1.11
    // Should snap to 1
    expect(result.scale).toBe(1);
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);

    // Should have vertical letterboxing
    expect(result.offsetY).toBeGreaterThan(0);
  });

  it('should handle DPR 1 correctly', () => {
    const result = calculateScaling(360, 640, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(1);
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('should handle DPR 2 screen (e.g., iPhone)', () => {
    // iPhone-like: 375x667 CSS pixels at 2x DPR
    // Note: calculateScaling works with CSS pixels, DPR is handled separately
    const result = calculateScaling(375, 667, LOGICAL_W, LOGICAL_H);

    // Should fit with scale ~1.04
    expect(result.scale).toBe(1); // Snaps to integer
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);
  });

  it('should handle DPR 3 screen (e.g., iPhone Plus)', () => {
    // iPhone Plus-like: 414x736 CSS pixels at 3x DPR
    const result = calculateScaling(414, 736, LOGICAL_W, LOGICAL_H);

    expect(result.scale).toBe(1); // 414/360 = 1.15, snaps to 1
    expect(result.canvasWidth).toBe(360);
    expect(result.canvasHeight).toBe(640);
  });

  it('should maintain aspect ratio', () => {
    // Use a screen size that doesn't trigger integer scaling snap
    const result = calculateScaling(800, 1200, LOGICAL_W, LOGICAL_H);

    const canvasAspect = result.canvasWidth / result.canvasHeight;
    const logicalAspect = LOGICAL_W / LOGICAL_H;

    // Aspect ratio is preserved (allowing for integer rounding of dimensions)
    expect(canvasAspect).toBeCloseTo(logicalAspect, 2);
  });

  it('should center canvas with correct offsets', () => {
    const screenW = 1000;
    const screenH = 800;
    const result = calculateScaling(screenW, screenH, LOGICAL_W, LOGICAL_H);

    // Canvas should be centered
    const expectedOffsetX = Math.floor((screenW - result.canvasWidth) / 2);
    const expectedOffsetY = Math.floor((screenH - result.canvasHeight) / 2);

    expect(result.offsetX).toBe(expectedOffsetX);
    expect(result.offsetY).toBe(expectedOffsetY);

    // Verify canvas + offsets equals screen
    expect(result.canvasWidth + result.offsetX * 2).toBeLessThanOrEqual(screenW + 1);
    expect(result.canvasHeight + result.offsetY * 2).toBeLessThanOrEqual(screenH + 1);
  });
});
