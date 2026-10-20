/**
 * Title-screen BGM switch and volume. Settings has the same controls.
 * Default is off; the master mute still silences music when this is on.
 */

import type { Settings } from '@/game/settings';
import { drawText, hitRect, UI_COLORS, type Rect } from './widgets';

export const HOME_BGM_TOGGLE: Rect = { x: 24, y: 312, w: 108, h: 30 };
export const HOME_BGM_TRACK: Rect = { x: 144, y: 318, w: 168, h: 18 };

export type HomeBgmHit = { kind: 'toggle' } | { kind: 'volume'; volume: number };

export function homeBgmHit(
  taps: ReadonlyArray<{ x: number; y: number }>,
  pointers: ReadonlyArray<{ x: number; y: number; startX: number; startY: number }> = []
): HomeBgmHit | null {
  for (const tap of taps) {
    if (hitRect(HOME_BGM_TOGGLE, tap.x, tap.y)) return { kind: 'toggle' };
    if (hitRect(HOME_BGM_TRACK, tap.x, tap.y))
      return { kind: 'volume', volume: volumeFromX(tap.x) };
  }
  for (const p of pointers) {
    if (hitRect(HOME_BGM_TRACK, p.startX, p.startY)) {
      return { kind: 'volume', volume: volumeFromX(p.x) };
    }
  }
  return null;
}

function volumeFromX(x: number): number {
  const t = (x - HOME_BGM_TRACK.x) / HOME_BGM_TRACK.w;
  return Math.min(1, Math.max(0, Math.round(t * 20) / 20));
}

export function drawHomeBgm(ctx: CanvasRenderingContext2D, settings: Readonly<Settings>): void {
  const on = settings.bgmEnabled;
  ctx.fillStyle = on ? UI_COLORS.accentDark : 'rgba(255,255,255,0.06)';
  ctx.fillRect(HOME_BGM_TOGGLE.x, HOME_BGM_TOGGLE.y, HOME_BGM_TOGGLE.w, HOME_BGM_TOGGLE.h);
  ctx.strokeStyle = on ? UI_COLORS.accent : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    HOME_BGM_TOGGLE.x + 0.5,
    HOME_BGM_TOGGLE.y + 0.5,
    HOME_BGM_TOGGLE.w - 1,
    HOME_BGM_TOGGLE.h - 1
  );
  drawText(
    ctx,
    on ? 'BGM 开' : 'BGM 关',
    HOME_BGM_TOGGLE.x + HOME_BGM_TOGGLE.w / 2,
    HOME_BGM_TOGGLE.y + HOME_BGM_TOGGLE.h / 2,
    14,
    on ? UI_COLORS.text : UI_COLORS.dim,
    'center'
  );

  const track = HOME_BGM_TRACK;
  const midY = track.y + track.h / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(track.x, midY - 2, track.w, 4);
  ctx.fillStyle = UI_COLORS.accent;
  ctx.fillRect(track.x, midY - 2, track.w * settings.bgmVolume, 4);
  ctx.beginPath();
  ctx.arc(track.x + track.w * settings.bgmVolume, midY, 7, 0, Math.PI * 2);
  ctx.fill();
  drawText(
    ctx,
    `${Math.round(settings.bgmVolume * 100)}%`,
    track.x + track.w + 8,
    midY,
    12,
    UI_COLORS.dim
  );
}
