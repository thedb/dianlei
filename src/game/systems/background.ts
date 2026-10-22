/**
 * Map scroll and layer blending for a background track (`maps/track.ts`).
 * Tile speed is BG_SCROLL_SPEED until the track's warning, then ramps up while
 * the tiles fade into clouds and a parallax starfield (wave table §1.1 / §4.5).
 */

import {
  BG_SCROLL_SPEED,
  BG_WARNING_SCROLL,
  STAR_SCROLL_SPEEDS,
  MAP_BLEND_LEAD,
  MAP_BLEND_TAIL,
  WARNING_BULLET_FADE,
  WARNING_CLOUD_IN_END,
  WARNING_CLOUD_IN_START,
  WARNING_CLOUD_OUT_END,
  WARNING_CLOUD_OUT_START,
  WARNING_STAR_DELAY,
  WARNING_STAR_FADE,
  WARNING_TILE_FADE,
} from '@/game/config';

/** What the fade needs from a track. */
export interface TrackTiming {
  layers: ReadonlyArray<{ inAt: number | null; outAt: number | null }>;
  warningAt: number | null;
  starsOnly: boolean;
}

export interface BackgroundFade {
  /** Opacity per track layer, same order as `track.layers`. */
  layers: number[];
  clouds: number;
  stars: number;
}

export interface ScrollFrame {
  /** World scroll in pixels (continuous). */
  scroll: number;
  /** Whole pixels the tiles advanced this step. Ground units move by this. */
  tileDelta: number;
  fade: BackgroundFade;
  starScroll: readonly [number, number, number];
}

function clamp01(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

/** 0 before the blend window, 1 after it. Window is lead+tail seconds around `boundary`. */
function blendAmount(t: number, boundary: number): number {
  const start = boundary - MAP_BLEND_LEAD;
  const span = MAP_BLEND_LEAD + MAP_BLEND_TAIL;
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
export function backgroundFade(t: number, track: TrackTiming): BackgroundFade {
  let tileFade = 1;
  let clouds = 0;
  let stars = track.starsOnly ? 1 : 0;
  if (track.warningAt !== null && t >= track.warningAt) {
    const u = t - track.warningAt;
    tileFade = clamp01(1 - u / WARNING_TILE_FADE);
    clouds = cloudAlpha(u);
    stars = clamp01((u - WARNING_STAR_DELAY) / WARNING_STAR_FADE);
  }
  const layers = track.layers.map((layer) => {
    const fadeIn = layer.inAt === null ? 1 : blendAmount(t, layer.inAt);
    const fadeOut = layer.outAt === null ? 1 : 1 - blendAmount(t, layer.outAt);
    return fadeIn * fadeOut * tileFade;
  });
  return { layers, clouds, stars };
}

/** Tile scroll speed at time `t`. Zero once the tiles have faded. */
export function scrollSpeedAt(t: number, warningAt: number | null): number {
  if (warningAt === null || t <= warningAt) return BG_SCROLL_SPEED;
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
 * Integrates scroll. Positive `scroll` / `tileDelta` move the field downward:
 * new terrain enters from the top. Ground units should consume `tileDelta`
 * (integer pixels) so they stay locked to the tile grid.
 */
export class Scroller {
  scroll = 0;
  private starScroll: [number, number, number] = [0, 0, 0];

  constructor(private readonly track: TrackTiming) {}

  reset(): void {
    this.scroll = 0;
    this.starScroll = [0, 0, 0];
  }

  update(dt: number, t: number): ScrollFrame {
    const prevTile = Math.floor(this.scroll);
    this.scroll += scrollSpeedAt(t, this.track.warningAt) * dt;
    const tileDelta = Math.floor(this.scroll) - prevTile;
    for (let i = 0; i < STAR_SCROLL_SPEEDS.length; i++) {
      const speed = STAR_SCROLL_SPEEDS[i] ?? 0;
      this.starScroll[i] = (this.starScroll[i] ?? 0) + speed * dt;
    }
    return {
      scroll: this.scroll,
      tileDelta,
      fade: backgroundFade(t, this.track),
      starScroll: [this.starScroll[0] ?? 0, this.starScroll[1] ?? 0, this.starScroll[2] ?? 0],
    };
  }
}
