/**
 * WeChat Mini Game entry point (stub for P0)
 *
 * This is a minimal stub that compiles but doesn't run the full game.
 * For full WeChat support, the TypeScript source needs to be bundled
 * into this entry point (will be done in P1+).
 *
 * To test in WeChat DevTools:
 * 1. Open WeChat DevTools
 * 2. Import this wx-shell/ directory as a mini game project
 * 3. Fill in your AppID in project.config.json
 */

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const { screenWidth, screenHeight, pixelRatio } = wx.getWindowInfo();

// Scale for device pixel ratio
canvas.width = screenWidth * pixelRatio;
canvas.height = screenHeight * pixelRatio;
ctx.scale(pixelRatio, pixelRatio);

// Disable image smoothing for crisp pixels
ctx.imageSmoothingEnabled = false;

// Game state
let frameCount = 0;
let lastTime = 0;
let fps = 0;

// Placeholder player
const player = {
  x: screenWidth / 2,
  y: screenHeight * 0.8,
};

// Touch handling
wx.onTouchMove((res) => {
  if (res.touches.length > 0) {
    player.x = res.touches[0].clientX;
    player.y = res.touches[0].clientY;
  }
});

// Main loop
function tick(timestamp) {
  requestAnimationFrame(tick);

  // Calculate FPS
  frameCount++;
  if (timestamp - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = timestamp;
  }

  // Clear
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, screenWidth, screenHeight);

  // Draw scrolling grid
  const gridSize = 32;
  const offset = (timestamp / 25) % gridSize;
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;

  for (let y = -gridSize + offset; y < screenHeight + gridSize; y += gridSize) {
    for (let x = 0; x < screenWidth; x += gridSize) {
      ctx.strokeRect(x, y, gridSize, gridSize);
    }
  }

  // Draw player placeholder
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(player.x - 14, player.y - 16, 28, 32);

  // Draw cockpit
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(player.x - 4, player.y - 12, 8, 12);

  // Draw title
  ctx.fillStyle = '#00e5ff';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('电雷 - P0 Stub', screenWidth / 2, 60);

  // Draw instructions
  ctx.fillStyle = '#888';
  ctx.font = '14px sans-serif';
  ctx.fillText('Touch to move', screenWidth / 2, 100);
  ctx.fillText('Full game coming in P1', screenWidth / 2, 120);

  // Draw FPS
  ctx.fillStyle = '#0f0';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`FPS: ${fps}`, 10, 20);
}

requestAnimationFrame(tick);
