/**
 * H5 shell entry point
 */

import { EXTERIOR_VOID } from '@/engine/exterior';
import { createH5Platform } from '@/platform/h5';
import { createGame } from '@/game';

// Get or create container
const container = document.getElementById('game') ?? document.body;

// Apply base styles
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';
document.body.style.backgroundColor = EXTERIOR_VOID;
document.documentElement.style.backgroundColor = EXTERIOR_VOID;
document.body.style.touchAction = 'none';
document.body.style.userSelect = 'none';

// Set safe area CSS variables for notch handling
const setSafeAreaVars = () => {
  const root = document.documentElement;
  root.style.setProperty('--sat', 'env(safe-area-inset-top, 0px)');
  root.style.setProperty('--sab', 'env(safe-area-inset-bottom, 0px)');
  root.style.setProperty('--sal', 'env(safe-area-inset-left, 0px)');
  root.style.setProperty('--sar', 'env(safe-area-inset-right, 0px)');
};
setSafeAreaVars();

// Create platform adapter and game
const platform = createH5Platform(container);
const game = createGame(platform);

// Prevent default touch behavior
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// Start the game
game.start();

// Expose game for debugging
declare global {
  interface Window {
    game: typeof game;
  }
}
window.game = game;
