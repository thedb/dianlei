/**
 * Pause flow: the menu while open, the pause button / Esc, and app hide.
 * Modes without `pausable` (the title demo) never open it.
 */

import type { InputState } from '@/engine/input';
import { inCircle } from '@/game/controls';
import type { Battle } from './context';

function openPause(b: Battle): void {
  b.pause.open();
  b.scene.input.setControlsEnabled(false);
}

/** While the menu is open only it runs. Returns null when the menu is closed. */
export function stepPauseMenu(b: Battle, input: InputState): 'paused' | 'exit' | null {
  if (!b.rules().pausable || !b.pause.isOpen()) return null;
  const action = b.pause.update(input);
  if (action === 'resume') b.scene.input.setControlsEnabled(true);
  return action === 'exit' ? 'exit' : 'paused';
}

/** Pause button or Esc. Not after game over or during STAGE CLEAR. */
export function requestPause(b: Battle, input: InputState): boolean {
  if (!b.rules().pausable || b.state.gameOver || b.boss?.phase === 'clear') return false;
  const button = b.scene.input.getControlsView().layout.pauseButton;
  const tapped = input.taps.some((t) => inCircle(t.x, t.y, button, 8));
  if (!input.pausePressed && !tapped) return false;
  openPause(b);
  return true;
}

/** App hidden: pause unless the run is over or showing the clear. */
export function pauseOnHide(b: Battle): void {
  if (!b.rules().pausable) return;
  const showcasing = b.boss?.phase === 'clear' || b.boss?.phase === 'done';
  if (!b.pause.isOpen() && !b.state.gameOver && !showcasing) openPause(b);
}
