/**
 * Map scroll and layer blending for a background track (`maps/track.ts`).
 * Until the warning, tiles move at BG_SCROLL_SPEED. A starfield handoff then
 * ramps, fades the ground into clouds and stars, and stops. A tile boss
 * handoff keeps every layer opaque, stitches the boss map on past the run
 * map, and scrolls briskly until that approach fills the screen. It does not
 * draw the warning cloud band — those stamps are near-white and read as a
 * blank sheet while a map is fading out.
 */

import {
  BG_SCROLL_SPEED,
  BG_WARNING_SCROLL,
  STAR_SCROLL_SPEEDS,
  MAP_BLEND_LEAD,
  MAP_BLEND_TAIL,
  TILE_HANDOFF_FAST_END,
  TILE_HANDOFF_PEAK,
  TILE_HANDOFF_RAMP,
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
  layers: ReadonlyArray<{
    inAt: number | null;
    outAt: number | null;
    role: LayerRole;
    /** World scroll where row 0 sits on the bottom edge. Tile handoff reads the boss layer. */
    origin?: number;
  }>;
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

/**
 * Speed during a tile-boss handoff. `u` is seconds after the warning.
 * Cruise again once `u` reaches `TILE_HANDOFF_FAST_END`.
 */
export function tileHandoffSpeed(u: number): number {
  const v0 = BG_SCROLL_SPEED;
  const v1 = TILE_HANDOFF_PEAK;
  const up = TILE_HANDOFF_RAMP;
  const down0 = TILE_HANDOFF_FAST_END - TILE_HANDOFF_RAMP;
  if (u <= 0) return v0;
  if (u < up) return v0 + ((v1 - v0) * u) / up;
  if (u < down0) return v1;
  if (u < TILE_HANDOFF_FAST_END) return v1 + ((v0 - v1) * (u - down0)) / up;
  return v0;
}

/** Integral of `tileHandoffSpeed` from 0 to `u`. */
export function tileHandoffDistance(u: number): number {
  if (u <= 0) return 0;
  const v0 = BG_SCROLL_SPEED;
  const v1 = TILE_HANDOFF_PEAK;
  const up = TILE_HANDOFF_RAMP;
  const down0 = TILE_HANDOFF_FAST_END - TILE_HANDOFF_RAMP;
  const end = TILE_HANDOFF_FAST_END;
  const rampDist = (up * (v0 + v1)) / 2;
  if (u <= up) return v0 * u + ((v1 - v0) * u * u) / (2 * up);
  if (u <= down0) return rampDist + v1 * (u - up);
  if (u <= end) {
    const k = u - down0;
    const hold = v1 * (down0 - up);
    return rampDist + hold + v1 * k + ((v0 - v1) * k * k) / (2 * up);
  }
  return 2 * rampDist + v1 * (down0 - up) + v0 * (u - end);
}

/**
 * Tile boss: both maps stay opaque. The boss layer is armed at the warning
 * (drawn only once its rows enter from the top) and the run layer drops out
 * once the boss map covers the screen. Clouds stay off so the join is tiles.
 */
function tileHandoffFade(t: number, track: TrackTiming): BackgroundFade {
  const warningAt = track.warningAt;
  const warning = warningAt !== null && t >= warningAt;
  const scroll = scrollDistance(t, warningAt, 'tiles');
  const boss = track.layers.find((layer) => layer.role === 'boss');
  const origin = boss?.origin ?? Number.POSITIVE_INFINITY;
  const covered = warning && scroll >= origin;
  const layers = track.layers.map((layer) => {
    const fadeIn = layer.inAt === null ? 1 : blendAmount(t, layer.inAt);
    const fadeOut = layer.outAt === null ? 1 : 1 - blendAmount(t, layer.outAt);
    if (layer.role === 'boss') return warning ? 1 : 0;
    return covered ? 0 : fadeIn * fadeOut;
  });
  return { layers, clouds: 0, stars: 0 };
}

/** Per-layer opacity at game time `t`. */
export function backgroundFade(t: number, track: TrackTiming): BackgroundFade {
  if (track.handoff === 'tiles') return tileHandoffFade(t, track);
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
    if (layer.role === 'boss') return 0;
    return blend * runFade;
  });
  return { layers, clouds, stars };
}

/**
 * Tile scroll speed at time `t`. A starfield handoff ramps through the fade
 * and then stops. A tile boss uses `tileHandoffSpeed` and is back to
 * `BG_SCROLL_SPEED` before the boss enters, so the arena loop is not a blur.
 */
export function scrollSpeedAt(
  t: number,
  warningAt: number | null,
  handoff: MapHandoff = 'starfield'
): number {
  if (warningAt === null || handoff === 'none' || t <= warningAt) return BG_SCROLL_SPEED;
  const u = t - warningAt;
  if (handoff === 'tiles') return tileHandoffSpeed(u);
  if (pastTileFade(u)) return 0;
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
  if (handoff === 'tiles') return head + tileHandoffDistance(u);
  if (pastTileFade(u)) return head + warningTileScrollPx();
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
