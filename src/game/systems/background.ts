/**
 * Map scroll and layer blending for a background track (`maps/track.ts`).
 * Until the warning, tiles move at BG_SCROLL_SPEED. A starfield handoff then
 * ramps, fades the ground into clouds and stars, and stops. A tile boss
 * handoff ramps the same way, fades the run into the boss layer, and keeps
 * scrolling so the arena can loop.
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
  warningTileScrollPx,
} from '@/game/config';
import type { LayerRole, MapHandoff } from '@/game/maps/track';

/** What the fade needs from a track. */
export interface TrackTiming {
  layers: ReadonlyArray<{ inAt: number | null; outAt: number | null; role: LayerRole }>;
  warningAt: number | null;
  starsOnly: boolean;
  handoff: MapHandoff;
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

/** `(warningAt + fade) - warningAt` can land a few ulps short of the fade. */
function pastTileFade(u: number): boolean {
  return u + 1e-6 >= WARNING_TILE_FADE;
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
  let runFade = 1;
  let clouds = 0;
  let stars = track.starsOnly ? 1 : 0;
  const warning = track.warningAt !== null && track.handoff !== 'none' && t >= track.warningAt;
  const u = warning && track.warningAt !== null ? t - track.warningAt : 0;
  if (warning) {
    clouds = cloudAlpha(u);
    runFade = clamp01(1 - u / WARNING_TILE_FADE);
    if (track.handoff === 'starfield') {
      stars = clamp01((u - WARNING_STAR_DELAY) / WARNING_STAR_FADE);
    }
  }
  const layers = track.layers.map((layer) => {
    const fadeIn = layer.inAt === null ? 1 : blendAmount(t, layer.inAt);
    const fadeOut = layer.outAt === null ? 1 : 1 - blendAmount(t, layer.outAt);
    const blend = fadeIn * fadeOut;
    if (layer.role === 'boss') {
      if (!warning || track.handoff !== 'tiles') return 0;
      return blend * clamp01(u / WARNING_TILE_FADE);
    }
    return blend * runFade;
  });
  return { layers, clouds, stars };
}

/**
 * Tile scroll speed at time `t`. A starfield handoff stops once the ground has
 * faded. A tile boss keeps `BG_SCROLL_SPEED` so the arena loops. The ramp
 * during the fade is the same either way.
 */
export function scrollSpeedAt(
  t: number,
  warningAt: number | null,
  handoff: MapHandoff = 'starfield'
): number {
  if (warningAt === null || handoff === 'none' || t <= warningAt) return BG_SCROLL_SPEED;
  const u = t - warningAt;
  if (pastTileFade(u)) return handoff === 'tiles' ? BG_SCROLL_SPEED : 0;
  const k = u / WARNING_TILE_FADE;
  return BG_SCROLL_SPEED + (BG_WARNING_SCROLL - BG_SCROLL_SPEED) * k;
}

/**
 * World scroll at time `t`, the integral of `scrollSpeedAt`. Challenge Boss
 * seeks here so the arena is already on screen. The in-game scroller sums the
 * same speeds one frame at a time; before the warning both are `speed * t`.
 */
export function scrollDistance(t: number, warningAt: number | null, handoff: MapHandoff): number {
  if (t <= 0) return 0;
  if (warningAt === null || handoff === 'none' || t <= warningAt) return BG_SCROLL_SPEED * t;
  const head = BG_SCROLL_SPEED * warningAt;
  const u = t - warningAt;
  if (pastTileFade(u)) {
    const over = Math.max(0, u - WARNING_TILE_FADE);
    const tail = handoff === 'tiles' ? BG_SCROLL_SPEED * over : 0;
    return head + warningTileScrollPx() + tail;
  }
  const ramp =
    BG_SCROLL_SPEED * u + ((BG_WARNING_SCROLL - BG_SCROLL_SPEED) * u * u) / (2 * WARNING_TILE_FADE);
  return head + ramp;
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

  /** Jump the scroll to where a continuous run would be at time `t`. */
  seek(t: number): ScrollFrame {
    const time = Math.max(0, t);
    this.scroll = scrollDistance(time, this.track.warningAt, this.track.handoff);
    this.starScroll = [
      (STAR_SCROLL_SPEEDS[0] ?? 0) * time,
      (STAR_SCROLL_SPEEDS[1] ?? 0) * time,
      (STAR_SCROLL_SPEEDS[2] ?? 0) * time,
    ];
    return {
      scroll: this.scroll,
      tileDelta: 0,
      fade: backgroundFade(time, this.track),
      starScroll: [this.starScroll[0] ?? 0, this.starScroll[1] ?? 0, this.starScroll[2] ?? 0],
    };
  }

  update(dt: number, t: number): ScrollFrame {
    const prevTile = Math.floor(this.scroll);
    this.scroll += scrollSpeedAt(t, this.track.warningAt, this.track.handoff) * dt;
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
