/**
 * Boot scene - initial loading
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';

export function createBootScene(_ctx: SceneContext): Scene {
  let timer = 0;
  const BOOT_DURATION = 0.5; // Quick boot for P0

  return {
    id: 'boot',

    enter(): void {
      timer = 0;
    },

    exit(): void {},

    update(dt: number, _input: InputState) {
      timer += dt;
      if (timer >= BOOT_DURATION) {
        return 'title';
      }
      return null;
    },

    render(renderer: Renderer, _alpha: number): void {
      renderer.clear('#0a0a1a');

      const text = '电雷';
      const fontSize = 32;
      const x = LOGICAL_W / 2 - fontSize;
      const y = LOGICAL_H / 2 - fontSize / 2;

      renderer.fillText(text, x, y, '#00e5ff', fontSize);

      const subText = 'Loading...';
      renderer.fillText(subText, LOGICAL_W / 2 - 30, y + 50, '#888', 12);
    },
  };
}
