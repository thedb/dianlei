/**
 * Draws the virtual joystick and A/B buttons (design doc §4.1, §4.2)
 */

import type { ControlsView } from '@/engine/input';
import type { Circle } from '@/game/controls';
import { UI_FONT } from './widgets';

export interface ControlsDrawOptions {
  /** B greyed out: no bombs or cooldown */
  bDisabled: boolean;
}

function circle(ctx: CanvasRenderingContext2D, c: Circle, fill: string, stroke: string): void {
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  c: Circle,
  label: string,
  pressed: boolean,
  rgb: string
): void {
  // Pressed: darker and 4% smaller
  const r = pressed ? c.r * 0.96 : c.r;
  circle(
    ctx,
    { x: c.x, y: c.y, r },
    `rgba(${rgb}, ${pressed ? 0.45 : 0.22})`,
    `rgba(${rgb}, ${pressed ? 0.7 : 0.95})`
  );
  ctx.font = `bold ${Math.round(r * 0.75)}px ${UI_FONT}`;
  ctx.fillStyle = `rgba(255, 255, 255, ${pressed ? 0.7 : 0.95})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, c.x, c.y + 1);
  ctx.textAlign = 'left';
}

export function drawControls(
  ctx: CanvasRenderingContext2D,
  view: ControlsView,
  opts: ControlsDrawOptions
): void {
  const { layout, settings, joystick } = view;
  const prevAlpha = ctx.globalAlpha;
  ctx.save();

  ctx.globalAlpha = prevAlpha * settings.controlOpacity * joystick.alpha;
  circle(
    ctx,
    { x: joystick.baseX, y: joystick.baseY, r: layout.joystickRadius },
    'rgba(255, 255, 255, 0.08)',
    'rgba(255, 255, 255, 0.7)'
  );
  circle(
    ctx,
    { x: joystick.knobX, y: joystick.knobY, r: layout.joystickRadius * 0.42 },
    joystick.active ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 255, 255, 0.35)',
    'rgba(255, 255, 255, 0.9)'
  );

  ctx.globalAlpha = prevAlpha * settings.controlOpacity;
  drawButton(ctx, layout.buttonA, 'A', view.buttonAPressed, '0, 229, 255');
  drawButton(
    ctx,
    layout.buttonB,
    'B',
    view.buttonBPressed && !opts.bDisabled,
    opts.bDisabled ? '120, 120, 130' : '255, 160, 40'
  );

  ctx.restore();
}

export function drawPauseButton(ctx: CanvasRenderingContext2D, c: Circle, opacity: number): void {
  ctx.save();
  ctx.globalAlpha *= Math.max(0.5, opacity);
  circle(ctx, c, 'rgba(0, 0, 0, 0.35)', 'rgba(255, 255, 255, 0.8)');
  ctx.fillStyle = '#ffffff';
  const barW = Math.max(2, c.r * 0.22);
  const barH = c.r * 0.9;
  ctx.fillRect(c.x - barW * 1.6, c.y - barH / 2, barW, barH);
  ctx.fillRect(c.x + barW * 0.6, c.y - barH / 2, barW, barH);
  ctx.restore();
}
