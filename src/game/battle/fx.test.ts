import { describe, expect, it } from 'vitest';
import { EXPLOSION_FRAME_TIME } from '@/game/art';
import { TIEBAO_SHED_BLAST_FRAME } from '@/game/config';
import { createFx, spawnExplosion, updateFx } from './fx';

describe('explosion frame time', () => {
  it('holds a shed blast on frame 0 after a normal explosion has stepped', () => {
    const fx = createFx();
    spawnExplosion(fx, 0, 0, 'medium', 0, TIEBAO_SHED_BLAST_FRAME);
    spawnExplosion(fx, 1, 0, 'medium');
    updateFx(fx, EXPLOSION_FRAME_TIME);
    const frames: number[] = [];
    const steps: number[] = [];
    fx.explosions.forEach((exp) => {
      frames.push(exp.frame);
      steps.push(exp.frameTime);
    });
    expect(steps).toEqual([TIEBAO_SHED_BLAST_FRAME, EXPLOSION_FRAME_TIME]);
    expect(frames).toEqual([0, 1]);
  });
});
