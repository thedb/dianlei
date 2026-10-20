/**
 * Title scene - main menu
 */

import type { Scene, SceneContext } from './types';
import type { Renderer } from '@/engine/renderer';
import type { InputState } from '@/engine/input';
import { LOGICAL_W, LOGICAL_H } from '@/game/config';

export function createTitleScene(_ctx: SceneContext): Scene {
  let blinkTimer = 0;
  let showPrompt = true;

  return {
    id: 'title',

    enter(): void {
      blinkTimer = 0;
      showPrompt = true;
    },

    exit(): void {},

    update(dt: number, input: InputState) {
      // Blink "Press to Start" text
      blinkTimer += dt;
      if (blinkTimer >= 0.5) {
        blinkTimer = 0;
        showPrompt = !showPrompt;
      }

      // Start game on any input
      if (input.buttonA || input.keyFire || input.joystickMagnitude > 0.5) {
        return 'battle';
      }

      return null;
    },

    render(renderer: Renderer, _alpha: number): void {
      renderer.clear('#0a0a1a');

      // Title
      const title = '电雷';
      const titleSize = 48;
      renderer.fillText(title, LOGICAL_W / 2 - titleSize, LOGICAL_H / 3, '#00e5ff', titleSize);

      // Subtitle
      renderer.fillText('DIANLEI', LOGICAL_W / 2 - 35, LOGICAL_H / 3 + 60, '#888', 14);

      // Start prompt
      if (showPrompt) {
        renderer.fillText(
          'Press A or SPACE to start',
          LOGICAL_W / 2 - 80,
          LOGICAL_H * 0.65,
          '#fff',
          12
        );
      }

      // Controls hint
      renderer.fillText('Controls:', 20, LOGICAL_H - 100, '#666', 10);
      renderer.fillText('Arrow keys / WASD - Move', 20, LOGICAL_H - 85, '#666', 10);
      renderer.fillText('Z / SPACE - Fire (A)', 20, LOGICAL_H - 70, '#666', 10);
      renderer.fillText('X - Bomb (B)', 20, LOGICAL_H - 55, '#666', 10);

      // Version
      renderer.fillText('P0 - Engine Test', LOGICAL_W - 90, LOGICAL_H - 20, '#444', 10);
    },
  };
}
