/**
 * Stage 1 scroll and section crossfade.
 * Tile speed is BG_SCROLL_SPEED until warningAt, then ramps up while the
 * ground fades into clouds and a parallax starfield (wave table §1.1 / §4.5).
 */

import {
  BG_SCROLL_SPEED,
  BG_WARNING_SCROLL,
  STAR_SCROLL_SPEEDS,
  SECTION_BLEND_LEAD,
  SECTION_BLEND_TAIL,
  SECTION_COAST_END,
  SECTION_GROUND_END,
  WARNING_BULLET_FADE,
  WARNING_CLOUD_IN_END,
  WARNING_CLOUD_IN_START,
  WARNING_CLOUD_OUT_END,
  WARNING_CLOUD_OUT_START,
  WARNING_STAR_DELAY,
  WARNING_STAR_FADE,
  WARNING_TILE_FADE,
} from '@/game/config';

export interface SectionFade {
  ground: number;
  coast: number;
  base: number;
  clouds: number;
  stars: number;
}

export interface ScrollFrame {
  /** World scroll in pixels (continuous). */
  scroll: number;
  /** Whole pixels the tiles advanced this step. Ground units move by this. */
  tileDelta: number;
  fade: SectionFade;
  starScroll: readonly [number, number, number];
}

function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

/** 0 before the blend window, 1 after it. Window is lead+tail seconds around `boundary`. */
function blendAmount(t: number, boundary: number): number {
  const start = boundary - SECTION_BLEND_LEAD;
  const span = SECTION_BLEND_LEAD + SECTION_BLEND_TAIL;
  return clamp01((t - start) / span);
}

function cloudAlpha(u: number): number {
  if (u < WARNING_CLOUD_IN_START) return 0;
  if (u < WARNING_CLOUD_IN_END) {
    return (u - WARNING_CLOUD_IN_START) / (WARNING_CLOUD_IN_END - WARNING_CLOUD_IN_START);
  }
  if (u < WARNING_CLOUD_OUT_START) return 1;
  if (u < WARNING_CLOUD_OUT_END) {
    return 1 - (u - WARNING_CLOUD_OUT_START) / (WARNING_CLOUD_OUT_END - WARNING_CLOUD_OUT_START);
  }
  return 0;
}

/** Per-layer opacity at game time `t`. */
export function backgroundFade(t: number, warningAt: number): SectionFade {
  const intoCoast = blendAmount(t, SECTION_GROUND_END);
  const intoBase = blendAmount(t, SECTION_COAST_END);

  let ground = 1 - intoCoast;
  let coast = intoCoast * (1 - intoBase);
  let base = intoBase;
  let clouds = 0;
  let stars = 0;

  if (t >= warningAt) {
    const u = t - warningAt;
    const tileFade = clamp01(1 - u / WARNING_TILE_FADE);
    ground *= tileFade;
    coast *= tileFade;
    base *= tileFade;
    clouds = cloudAlpha(u);
    stars = clamp01((u - WARNING_STAR_DELAY) / WARNING_STAR_FADE);
  }

  return { ground, coast, base, clouds, stars };
}

/** Tile scroll speed at time `t`. Zero once the ground has faded. */
export function scrollSpeedAt(t: number, warningAt: number): number {
  if (t <= warningAt) return BG_SCROLL_SPEED;
  const u = t - warningAt;
  if (u >= WARNING_TILE_FADE) return 0;
  const k = u / WARNING_TILE_FADE;
  return BG_SCROLL_SPEED + (BG_WARNING_SCROLL - BG_SCROLL_SPEED) * k;
}

/** 0–1 fade of enemy bullets during the warning. 1 means fully visible. */
export function warningBulletAlpha(t: number, warningAt: number): number {
  if (t < warningAt) return 1;
  return clamp01(1 - (t - warningAt) / WARNING_BULLET_FADE);
}

/**
 * Integrates scroll. Ground units should consume `tileDelta` (integer pixels)
 * so they stay locked to the tile grid.
 */
export class Scroller {
  scroll = 0;
  private starScroll: [number, number, number] = [0, 0, 0];

  reset(): void {
    this.scroll = 0;
    this.starScroll = [0, 0, 0];
  }

  update(dt: number, t: number, warningAt: number): ScrollFrame {
    const prevTile = Math.floor(this.scroll);
    this.scroll += scrollSpeedAt(t, warningAt) * dt;
    const tileDelta = Math.floor(this.scroll) - prevTile;
    for (let i = 0; i < STAR_SCROLL_SPEEDS.length; i++) {
      const speed = STAR_SCROLL_SPEEDS[i] ?? 0;
      this.starScroll[i] = (this.starScroll[i] ?? 0) + speed * dt;
    }
    return {
      scroll: this.scroll,
      tileDelta,
      fade: backgroundFade(t, warningAt),
      starScroll: [this.starScroll[0] ?? 0, this.starScroll[1] ?? 0, this.starScroll[2] ?? 0],
    };
  }
}
