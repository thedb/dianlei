import { describe, expect, it } from 'vitest';
import { stage1 } from '@/game/levels/stage1';
import { backgroundFade } from '@/game/systems/background';
import { STATIC_TITLE_SPECS } from './titleBackdrop';

describe('static title backdrops', () => {
  it('offers three distinct stage vistas', () => {
    expect(STATIC_TITLE_SPECS.map((s) => s.variant)).toEqual(['A1', 'A2', 'A3']);
    expect(new Set(STATIC_TITLE_SPECS.map((s) => s.id)).size).toBe(3);
    const [dawn, strait, base] = STATIC_TITLE_SPECS;
    expect(dawn!.time).toBeLessThan(strait!.time);
    expect(strait!.time).toBeLessThan(base!.time);

    const ground = backgroundFade(dawn!.time, stage1.warningAt);
    const coast = backgroundFade(strait!.time, stage1.warningAt);
    const runway = backgroundFade(base!.time, stage1.warningAt);
    expect(ground.ground).toBeGreaterThan(ground.coast);
    expect(coast.coast).toBeGreaterThan(coast.ground);
    expect(coast.coast).toBeGreaterThan(coast.base);
    expect(runway.base).toBeGreaterThan(runway.coast);
  });
});
