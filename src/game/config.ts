/**
 * Game configuration constants from design doc §14
 * All values are initial drafts - tune based on real device testing
 * Units: length in logical pixels, time in seconds, speed in pixels/second
 */

// ============================================================================
// §14.1 Display & Camera
// ============================================================================

/** Logical resolution width */
export const LOGICAL_W = 360;

/** Logical resolution height */
export const LOGICAL_H = 640;

/** Fixed update timestep (60Hz) */
export const FIXED_DT = 1 / 60;

/** Camera zoom baseline - adjust on device */
export const CAMERA_ZOOM = 1.0;

/** Sprite scale factor (0.9 * 1.05 = 0.945, rounded to 0.95) */
export const SPRITE_SCALE = 0.95;

/** Tile size for background */
export const TILE_SIZE = 16;

/** Background scroll speed (pixels/second) */
export const BG_SCROLL_SPEED = 40;

/** Palette color count */
export const PALETTE_SIZE = 48;

// ============================================================================
// §14.2 Controls & Movement
// ============================================================================

/** Player max speed when joystick is fully pushed */
export const PLAYER_SPEED = 280;

/** Joystick maximum radius */
export const JOYSTICK_RADIUS = 56;

/** Joystick deadzone (fraction of radius) */
export const JOYSTICK_DEADZONE = 0.12;

/** Joystick response curve (1 = linear) */
export const JOYSTICK_CURVE = 1.0;

/** Player spawn/respawn Y position */
export const PLAYER_SPAWN_Y = 560;

/** Minimum distance from screen edge */
export const PLAYER_MARGIN = 4;

/** Number of bank (tilt) animation frames */
export const BANK_FRAMES = 11;

/** Time to reach full bank from level */
export const BANK_IN_TIME = 0.2;

/** Time to return to level from full bank */
export const BANK_OUT_TIME = 0.15;

/** Bank deadzone - input below this doesn't trigger tilt */
export const BANK_DEADZONE = 0.1;

/** Bank frame change hysteresis to prevent jitter */
export const BANK_HYSTERESIS = 0.04;

// ============================================================================
// §14.3 Hitbox & Display
// ============================================================================

/** Player hitbox radius */
export const HITBOX_RADIUS = 2.5;

/** Whether to show hitbox (test version always shows) */
export const SHOW_HITBOX = true;

/** Hitbox display alpha */
export const HITBOX_ALPHA = 0.45;

/** Item pickup radius (larger than hitbox for convenience) */
export const ITEM_PICKUP_RADIUS = 14;

/** Enemy hit flash duration */
export const HIT_FLASH_TIME = 0.05;

/** Small screen shake intensity and duration */
export const SHAKE_SMALL_INTENSITY = 2;
export const SHAKE_SMALL_DURATION = 0.15;

/** Large screen shake intensity and duration (death, bomb, boss death) */
export const SHAKE_BIG_INTENSITY = 4;
export const SHAKE_BIG_DURATION = 0.4;

// ============================================================================
// §14.4 Firepower
// ============================================================================

/**
 * Vulcan volleys per second. Same at Lv1–Lv3; a higher level adds bullets.
 * Full-hit DPS is this times bullets per volley times PLAYER_BULLET_DAMAGE
 * (Lv1 10, Lv2 20, Lv3 30).
 */
export const FIRE_RATE = 5;

/** Player bullet speed */
export const PLAYER_BULLET_SPEED = 720;

/** Damage of one vulcan bullet. Lv1 full-hit DPS is FIRE_RATE times this (10). */
export const PLAYER_BULLET_DAMAGE = 2;

/** Maximum power level */
export const POWER_MAX = 3;

/** Lv2 dual laser gap */
export const LV2_GAP = 10;

/** Lv3 spread angle in degrees */
export const LV3_SPREAD_DEG = 15;

/** Distance from the ship center up to the vulcan muzzle. */
export const VULCAN_MUZZLE_Y = 16;

// ============================================================================
// §14.4.1 Sub weapon: T homing missile
// ============================================================================

/** Highest T level. Lv1 fires 1 missile per volley, Lv2 fires 2. */
export const HOMING_MAX_LEVEL = 2;

/**
 * Homing volleys per second. Pinned at 1.5.
 * P9 reached 1.5 with `(FIRE_RATE / 6) * 0.9` while FIRE_RATE was 10.
 * Do not derive this from FIRE_RATE again: the main weapon is now 5/s.
 */
export const HOMING_FIRE_RATE = 1.5;

/**
 * Damage per homing missile. Pinned at 2.5.
 * P9 reached 2.5 with `(PLAYER_BULLET_DAMAGE / 2) * 5` while each main
 * bullet dealt 1. Do not derive this from PLAYER_BULLET_DAMAGE again.
 */
export const HOMING_DAMAGE = 2.5;

/** Missile flight speed, pixels/second */
export const HOMING_SPEED = 330;

/** Maximum turn rate while steering toward a target, degrees/second */
export const HOMING_TURN_RATE = 270;

/** Seconds before an unspent missile is removed, so it never circles forever */
export const HOMING_LIFETIME = 2.5;

/** Lv2 launch offsets: missiles leave each wing this far from center, angled outward */
export const HOMING_LV2_OFFSET_X = 8;
export const HOMING_LV2_SPLAY_DEG = 20;

/** Square hitbox side used against enemies, buildings and the boss */
export const HOMING_HIT_SIZE = 6;

/** Sub-weapon levels lost on death. Lv0 means the slot is empty. */
export const DEATH_SUB_LOSS = 1;

// ============================================================================
// §14.4.2 Wingmen (M). Not a WEAPONS row. The M item raises this level.
// ============================================================================

/** Highest M level. 0 is none, 1 is the left ship, 2 is one ship on each side. */
export const MATE_MAX_LEVEL = 2;

/**
 * Center-to-center gap from the player to each wingman, logical pixels.
 * 80% of the original 32px gap (32 × 0.8).
 */
export const MATE_OFFSET_X = 25.6;

/** Vertical nudge from the player center. 0 keeps the wingmen at the same height. */
export const MATE_OFFSET_Y = 0;

/**
 * Wingman sprite scale relative to the player ship.
 * Drawn size is rounded to whole pixels (28×32 becomes 9×11).
 */
export const MATE_SCALE = 1 / 3;

/** Nose offset above the wingman center. The full-ship muzzle, scaled down. */
export const MATE_MUZZLE_Y = VULCAN_MUZZLE_Y * MATE_SCALE;

/** Mate levels lost on death. 0 means no wingmen. */
export const DEATH_MATE_LOSS = 1;

// ============================================================================
// §14.5 Lives, Bombs & Invincibility
// ============================================================================

/** Starting lives */
export const LIVES_START = 3;

/** Maximum lives */
export const LIVES_MAX = 5;

/** Score needed for extra life */
export const EXTEND_EVERY = 100000;

/** Whether to give extra lives repeatedly */
export const EXTEND_REPEAT = true;

/** Starting bombs */
export const BOMBS_START = 2;

/** Maximum bombs */
export const BOMBS_MAX = 5;

/** Bombs given on respawn */
export const BOMBS_ON_RESPAWN = 2;

/** Bomb invincibility duration */
export const BOMB_INVINCIBLE_TIME = 1.0;

/** Bomb cooldown between uses */
export const BOMB_COOLDOWN = 1.0;

/**
 * Share of MAX HP a bomb takes from a medium-class object. Small-class objects
 * die outright; the boss (large) uses BOMB_BOSS_RATIO. Off-screen objects are
 * never hit.
 */
export const BOMB_MEDIUM_RATIO = 0.5;

/** Bomb damage ratio to boss HP */
export const BOMB_BOSS_RATIO = 0.08;

/**
 * Seconds the bomb shockwave takes to reach the farthest screen corner.
 * Each target is hit when the ring reaches it, so small kills explode as a
 * chain spread over at most this long.
 */
export const BOMB_WAVE_TIME = 0.4;

/** Shockwave band thickness, logical pixels */
export const BOMB_WAVE_BAND = 6;

/** White flash after a bomb, seconds */
export const BOMB_FLASH_TIME = 0.15;

/** Score per bullet cleared by bomb */
export const BOMB_BULLET_SCORE = 10;

/** Power levels lost on death */
export const DEATH_POWER_LOSS = 1;

/** Delay before respawn */
export const RESPAWN_DELAY = 1.0;

/** Respawn fly-in duration */
export const RESPAWN_FLYIN_TIME = 0.5;

/** Respawn invincibility duration */
export const RESPAWN_INVINCIBLE_TIME = 2.0;

/** Invincibility blink interval (normal) */
export const INVINCIBLE_BLINK_INTERVAL = 0.08;

/** Invincibility blink interval (fast, last 0.5s) */
export const INVINCIBLE_BLINK_FAST = 0.04;

/** Invincibility alpha minimum */
export const INVINCIBLE_ALPHA_MIN = 0.25;

/** Invincibility alpha maximum */
export const INVINCIBLE_ALPHA_MAX = 0.9;

// ============================================================================
// §14.6 Items
// ============================================================================

/** P item bounce speed */
export const ITEM_P_SPEED = 70;

/** P item lifetime before flying out */
export const ITEM_P_LIFETIME = 8;

/** B item fall speed */
export const ITEM_B_FALL_SPEED = 45;

/** Score for collecting P at max power. T at max uses this too. */
export const P_OVERFLOW_SCORE = 1000;

/**
 * Score for collecting M when wingmen are already at MATE_MAX_LEVEL.
 * Same 1000 as a maxed weapon pickup, not the bomb's 2000.
 */
export const M_OVERFLOW_SCORE = 1000;

/** Score for collecting B at max bombs */
export const B_OVERFLOW_SCORE = 2000;

/** Score for reaching extend threshold at max lives */
export const EXTEND_OVERFLOW_SCORE = 5000;

// ============================================================================
// §14.7 Enemy Bullets
// ============================================================================

/** Enemy bullet speed scale (vs arcade baseline) */
export const ENEMY_BULLET_SPEED_SCALE = 0.8;

/** Maximum enemy bullets on screen */
export const ENEMY_BULLET_CAP = 150;

/** Base speeds (multiply by ENEMY_BULLET_SPEED_SCALE) */
export const EB_SPEED_SMALL = 150;
export const EB_SPEED_BIG = 125;
export const EB_SPEED_FAST = 190;
export const EB_SPEED_MISSILE = 110;

/**
 * Enemy bullet hit radii, equal to the solid orb sprite radius
 * (small 6x6, large 12x12). The soft additive glow drawn around them is
 * deliberate visual padding and never counts as a hit.
 */
export const EB_HIT_RADIUS_SMALL = 3;
export const EB_HIT_RADIUS_LARGE = 6;

/** Missile homing duration */
export const MISSILE_HOMING_TIME = 1.2;

/** Minimum distance for aimed shots */
export const AIMED_MIN_DIST = 48;

// ============================================================================
// §14.8 Scoring
// ============================================================================

export const SCORE_SMALL_FIGHTER = 100;
export const SCORE_INTERCEPTOR = 200;
export const SCORE_TANK = 200;
export const SCORE_DRONE = 300;
export const SCORE_MISSILE_CAR = 300;
export const SCORE_MEDIUM_FIGHTER = 1000;
export const SCORE_DUAL_TURRET = 1000;
export const SCORE_BOMBER = 2000;
export const SCORE_BOSS_PART = 5000;
export const SCORE_BOSS_CORE = 30000;
/** Any destroyed building (pillbox, fuel depot, radar station, sea gun) */
export const SCORE_BUILDING = 500;
/** Risk crate. Same as a building: the pickup is the reward, not a fighter bounty. */
export const SCORE_RISK_CRATE = 500;
export const BONUS_KILL_RATE_PER_PCT = 200;
export const BONUS_KILL_RATE_PERFECT = 10000;
export const BONUS_NO_DEATH = 30000;

// ============================================================================
// §14.9 Layout & Safe Areas
// ============================================================================

/** HUD top padding (added to safe area top) */
export const HUD_TOP_PAD = 4;

/** Control bottom padding (added to safe area bottom) */
export const CONTROL_BOTTOM_PAD = 12;

/** Control side padding */
export const CONTROL_SIDE_PAD = 16;

/** Button A diameter at 100% scale */
export const BTN_A_SIZE = 68;

/** Button B diameter at 100% scale */
export const BTN_B_SIZE = 56;

/** Control scale range */
export const CONTROL_SCALE_MIN = 0.8;
export const CONTROL_SCALE_MAX = 1.3;

/** Default control opacity */
export const CONTROL_OPACITY_DEFAULT = 0.6;

// ============================================================================
// Movement patterns (wave table §3.1 — speeds fixed by the move kind)
// ============================================================================

/** Hover: descend, then leave upward */
export const HOVER_ENTER_SPEED = 120;
export const HOVER_EXIT_SPEED = 100;
/** Hover hold drift, pixels either side of the spawn x */
export const HOVER_DRIFT = 12;

/** Slow push: descend, hold, then leave downward */
export const SLOW_PUSH_ENTER_SPEED = 30;
export const SLOW_PUSH_EXIT_SPEED = 60;
export const SLOW_PUSH_DRIFT = 20;

/** Orbit approach and the downward exit after `hold` */
export const ORBIT_APPROACH_SPEED = 120;
export const ORBIT_EXIT_SPEED = 90;

/** Side-entry arc radius before the dive */
export const SIDE_ARC_RADIUS = 140;

/** V-dive wings leave on this diagonal (degrees) */
export const V_DIVE_EXIT_DEG = 45;

/** Tank side-entry drive speed, pixels/second. 0.8× the previous 27. */
export const TANK_ENTRY_SPEED = 22;

/** Horizontal speed of a bottom-corner tank entry. 0.8× the previous 24. */
export const TANK_DIAG_VX = 19;

/**
 * Extra upward speed for a bottom-corner tank entry, pixels/second.
 * Must stay above BG_SCROLL_SPEED or bottom-entry tanks never appear.
 */
export const TANK_DIAG_CLIMB = 45;

/** Home / settings BGM slider default. Playback itself starts off. */
export const BGM_VOLUME_DEFAULT = 0.6;

/**
 * Title attract loop length, seconds.
 * Covers the ground section and the start of the coast (through the bomber),
 * then the demo restarts. Stops before the dense late waves and the boss.
 */
export const ATTRACT_LOOP_SECONDS = 72;

/** Seconds the title demo spends fading to black after the player's death explosion. */
export const ATTRACT_DEATH_FADE = 0.6;

// ============================================================================
// Enemy fire details (wave table §3.2)
// ============================================================================

/** aimed3burst: shots per burst and the gap between them */
export const AIMED_BURST_COUNT = 3;
export const AIMED_BURST_GAP = 0.12;

/** fixed2 barrel spacing, and how fast a turret may track (deg/s) */
export const FIXED2_SEPARATION = 10;
export const TURRET_TURN_RATE = 60;

/** Missile turn rate while homing (deg/s). Homing time is MISSILE_HOMING_TIME. */
export const MISSILE_TURN_RATE = 240;

// ============================================================================
// Destructible buildings (design §6.1.1, wave table §4.7)
// ============================================================================

/** Building HP. Same as a small fighter (wave table §2). */
export const BUILDING_HP = 3;

/**
 * Share of default building drops that are P while main power is below
 * POWER_MAX. The rest are B. Every building still drops one item: this is
 * not a chance to drop nothing. At POWER_MAX the default drop is B and the
 * roll is skipped. Placement locks (T / M) ignore this.
 */
export const BUILDING_DROP_P_SHARE = 0.5;

/**
 * Risk crate (P22). Shield is spent before body HP. These are the authored
 * Easy numbers; Medium and Hard go through `scaleHp` like every other enemy.
 * A bomb still uses the size class (small): the ring deals shield + body.
 */
export const RISK_CRATE_SHIELD = 12;
export const RISK_CRATE_HP = 6;

/**
 * Kill drop when mate is already at least 1. Mate 0 always drops M and does
 * not roll. T is the rest (`1 - M - P` = 0.25). Never B.
 */
export const RISK_CRATE_DROP_M = 0.5;
export const RISK_CRATE_DROP_P = 0.25;

/**
 * Stage-1 clock, seconds, same origin as `Wave.t`.
 * Easy uses t=50: the ground section ends there and the coast breather
 * (0:49–0:52, W11 at 52) is the mid-stage anchor inside the 50–60s window.
 * Medium is the two edge passes. Hard adds the off-center one.
 */
export const RISK_CRATE_EASY_T = 50;
export const RISK_CRATE_EDGE_T = 50;
export const RISK_CRATE_OFFCENTER_T = 75;
export const RISK_CRATE_LATE_T = 100;
/** Coast missile-car inset. Left lane is this; the late crate uses the other side. */
export const RISK_CRATE_EDGE_INSET = 48;
/** 40px right of center (180). Near the middle, not an edge lane. */
export const RISK_CRATE_OFFCENTER_X = 220;
/** Hover park and how long it sits there. Same `hover` move as a carrier. */
export const RISK_CRATE_STOP_Y = 160;
export const RISK_CRATE_HOLD = 6;

/** Code-drawn cyan ring while `enemy.shield` is still up. Not part of the sprite. */
export const SHIELD_RING_PAD = 4;
export const SHIELD_RING_WIDTH = 2;
export const SHIELD_RING_COLOR = 'rgba(0, 229, 255, 0.55)';

/** Sea gun fixed2 interval, seconds. Ground turrets use 1.6–1.8. */
export const SEA_GUN_FIRE_INTERVAL = 2.2;

/** Shots stop until the building's top edge is this far onto the screen */
export const BUILDING_FIRE_MIN_Y = 8;

/** Bullet hitbox is the footprint shrunk by this much on each side */
export const BUILDING_HIT_INSET = 2;

/** Tank centers stay this far outside an intact building (half a tank) */
export const BUILDING_TANK_CLEARANCE = 12;

// ============================================================================
// Map assets and the stage background track (P12, wave table §1.1 / §4.5)
// ============================================================================

/**
 * When a stage hands one map over to the next, the blend starts this long
 * before the handover time and finishes this long after it (3 seconds total).
 */
export const MAP_BLEND_LEAD = 1;
export const MAP_BLEND_TAIL = 2;

/** Map is 23 tiles wide; the 360-wide screen crops this many pixels per side */
export const MAP_TILES_X = 23;
export const MAP_CROP_X = 4;

/** Rows per map chunk: one screen (40 × 16 = 640 px). Chunks are baked and cached at this size. */
export const MAP_CHUNK_ROWS = 40;

/**
 * Baked chunk bitmaps kept at once (LRU). Each is 368×640 RGBA, about 0.9 MB.
 * Two are on screen, one is baked ahead.
 */
export const MAP_CHUNK_CACHE = 4;

/** Tile rows of the next chunk baked per frame while it is still off screen. */
export const MAP_PREFETCH_ROWS_PER_FRAME = 4;

/** 陆地A: chunk count (11 × 640 px = 7040 px) and the seed of its chunk sequence. */
export const LAND_A_CHUNKS = 11;
export const LAND_A_SEED = 7;

/**
 * 陆地B and 河流A. 9 × 640 px = 5760 px. A map preview runs
 * (5760 − 640) / BG_SCROLL_SPEED = 128 s, a little shorter than 陆地A's 160 s.
 * Stage 1 does not reference either map. P14 keeps this length.
 */
export const LAND_B_CHUNKS = 9;
export const LAND_B_SEED = 13;
export const RIVER_A_CHUNKS = 9;
export const RIVER_A_SEED = 21;

/** 宇宙A is a starfield with no tiles. 地图预览 plays it this long. */
export const SPACE_A_PREVIEW_SECONDS = 24;

/**
 * 百战要塞 (`landBoss`): one approach screen, then one courtyard that loops.
 * Stage 1's boss map. 2 × 640 px. Not used before the warning.
 */
export const LAND_BOSS_CHUNKS = 2;
export const LAND_BOSS_SEED = 41;

/**
 * 铁堡厂轨 (`factoryBoss`): one factory approach, then a triple-rail floor that
 * loops. Stage 2's boss map. Same length as 百战要塞. No cloud sheet — the
 * loop is indoors.
 */
export const FACTORY_BOSS_CHUNKS = 2;
export const FACTORY_BOSS_SEED = 23;

/**
 * Factory interior. Yoan locked A 铁皮高窗. B–E stay in the painter for the
 * stills (`npm run art:tiebao`) and are not used by the fight.
 */
export const FACTORY_LOOK = 'A' as const;

/**
 * Locked end form: A 尖头三节. Nose up-screen. The fight sheds from
 * loco + 9 cars down to this locomotive and two boxcars.
 * B 钝鼻铆甲, C 侧裙弹舱, D 脊炮车顶, E 厚钩尾梁 share the chassis.
 */
export const TIEBAO_LOOK = 'A' as const;

/**
 * Stage 2 warning. landB is 5760 px, so this keeps the boss origin on landB's
 * last row (`warning * 40 + 640` stays under 5760). `TIEBAO_ENTER_AT` is five
 * seconds later, which lands about 120 px into the approach — the same beat
 * as stage 1's `enterAt`.
 */
export const STAGE2_WARNING_AT = 118;

/**
 * Cloud shadows over maps that set `cloudShadows` (陆地A / 陆地B / 河流A / 百战要塞).
 * Alpha stays low so one silhouette reads without muddying the ground.
 * Scroll is relative to the tiles. `2` moves shadows twice as fast as the
 * ground so they drift ahead instead of sticking to it. Stamps repeat every
 * `CLOUD_SHADOW_SPAN` pixels. Placement is edge-only (partly off the left or
 * right edge); `CLOUD_SHADOW_MARGIN` only lets those edge stamps start above
 * the view. Nothing sits in a center lane.
 */
export const CLOUD_SHADOW_ALPHA = 0.18;
export const CLOUD_SHADOW_SCROLL = 2;
export const CLOUD_SHADOW_SPAN = 1600;
export const CLOUD_SHADOW_MARGIN = 180;

/**
 * Starfield warning band only (a tile boss does not draw it).
 * Pixels per second, and opacity at full fade. Fast enough to cross the
 * screen during the warning instead of hanging in place.
 */
export const WARNING_CLOUD_DRIFT = 140;
export const WARNING_CLOUD_ALPHA = 0.9;

/**
 * 宇宙A planet parallax as a fraction of the far star layer
 * (`STAR_SCROLL_SPEEDS[0]`). Both stay below 1, so planets lag every star
 * layer. The large limb is the slower of the two.
 */
export const PLANET_PARALLAX_LARGE = 0.16;
export const PLANET_PARALLAX_SMALL = 0.5;

/** Large planet radius, and how many radii its center sits past the screen edge. */
export const PLANET_LARGE_RADIUS = 176;
export const PLANET_LARGE_CLIP = 0.27;

/** Starfield warning scroll ramps from BG_SCROLL_SPEED to this, then the tiles fade. */
export const BG_WARNING_SCROLL = 200;

/** Seconds of a starfield warning spent accelerating and fading the ground tiles. */
export const WARNING_TILE_FADE_NUM = 8;
export const WARNING_TILE_FADE_DEN = 5;
export const WARNING_TILE_FADE = WARNING_TILE_FADE_NUM / WARNING_TILE_FADE_DEN;

/**
 * Tile-boss handoff (P18). The run map stays opaque and the boss map is
 * stitched on past its far edge, so the scroll has to finish that edge and
 * bring the approach on screen before the boss enters. Speed rises from
 * BG_SCROLL_SPEED to this peak over TILE_HANDOFF_RAMP, holds, then falls
 * back over the same ramp, reaching cruise at TILE_HANDOFF_FAST_END
 * (before `warningAt + WARNING_DURATION`). A starfield handoff ignores these
 * and keeps the short fade above.
 */
export const TILE_HANDOFF_PEAK = 280;
export const TILE_HANDOFF_RAMP = 0.5;
export const TILE_HANDOFF_FAST_END = 4.5;

/** How long the warning sequence lasts after warningAt (2:30–2:35) */
export const WARNING_DURATION = 5;

/** Enemy bullets fade out over this long at warning start, with no score */
export const WARNING_BULLET_FADE = 1.2;

/** WARNING banner appears this long after warningAt (2:31) */
export const WARNING_BANNER_DELAY = 1;

/** Cloud band timings, seconds after warningAt: in-start, in-end, out-start, out-end */
export const WARNING_CLOUD_IN_START = 0.4;
export const WARNING_CLOUD_IN_END = 1.2;
export const WARNING_CLOUD_OUT_START = 2.0;
export const WARNING_CLOUD_OUT_END = 2.8;

/** Starfield fade-in, seconds after warningAt */
export const WARNING_STAR_DELAY = 2.0;
export const WARNING_STAR_FADE = 1.2;

/** Parallax star layers, pixels/second (near layer is fastest) */
export const STAR_SCROLL_SPEEDS = [16, 42, 88] as const;

/**
 * Pixels the tiles travel during the warning fade.
 * Average of the two speeds times the fade length: (v0 + v1) / 2 * T.
 */
export function warningTileScrollPx(): number {
  return (
    ((BG_SCROLL_SPEED + BG_WARNING_SCROLL) * WARNING_TILE_FADE_NUM) / (2 * WARNING_TILE_FADE_DEN)
  );
}

// ============================================================================
// Stage 1 boss & opening (wave table §5, design §6.2 / §7)
// ============================================================================

/** Battleship anchor x. Drift is ±BossConfig.drift.amp around this. */
export const BOSS_ANCHOR_X = 180;

/** Y the battleship enters from, above the screen. */
export const BOSS_ENTER_Y = -70;

export const BOSS_HULL_W = 220;
export const BOSS_HULL_H = 140;

/** Detached turret sprite, original pixels. */
export const BOSS_TURRET_SIZE = 40;

/**
 * Stage-clear exit, shared by every stage and every player ship.
 * After the boss death animation: freeze, ease back to the battle spawn,
 * swell the tail flame, then climb off the top. Spawn is
 * `(LOGICAL_W / 2, PLAYER_SPAWN_Y)`, the same point the fly-in parks on.
 * `stepVictoryExit` in `systems/victoryExit.ts` is the only path.
 */
export const VICTORY_EXIT_WAIT = 2;
/** Smoothstep back to the spawn, seconds. Zero speed at both ends. */
export const VICTORY_RETURN_TIME = 2;
/** Hold at the spawn while the exhaust eases from cruise to full, seconds. */
export const VICTORY_FLAME_TIME = 0.85;
/**
 * Extra length at full boost: drawn length is `base * (1 + flame * BOOST)`.
 * `flame` is 0–1 on the exit. Girth is the same for width.
 */
export const VICTORY_FLAME_BOOST = 1.75;
export const VICTORY_FLAME_GIRTH = 0.65;
/** Upward speed when the climb starts, pixels/second. The flame is already full. */
export const VICTORY_FLYOFF_SPEED = 70;
/** Upward acceleration during the climb, pixels/second². */
export const VICTORY_FLYOFF_ACCEL = 220;
/** The climb ends once the ship is this far above the top edge. */
export const VICTORY_FLYOFF_MARGIN = 48;

/** Enemy / building / boss HP scale. Easy is the authored table. */
export const DIFFICULTY_HP_EASY = 1;
export const DIFFICULTY_HP_MEDIUM = 1.15;
export const DIFFICULTY_HP_HARD = 1.3;

/**
 * Spiral ↔ aimed pattern (scheme E). It now plays on phase 2 for every
 * difficulty. Hard phase 3 plays the old phase-2 ring and laser instead.
 * HP is still the hard-only extra segment, authored before the HP scale.
 *
 * Speeds are flight speeds in pixels/second (not multiplied by
 * `ENEMY_BULLET_SPEED_SCALE` again). The previous spiral used the small
 * bullet's 120 and two arms every 0.18s; aimed used the fast bullet's 152
 * every 1.15s. Steady-state spiral count stays under `ENEMY_BULLET_CAP`:
 * 4 / 0.12 shots per second, about 3 seconds on screen at 180 px/s.
 */
export const BOSS_PHASE3_HP = 240;
export const BOSS_PHASE3_TRANSITION = 1.2;
export const BOSS_PHASE3_PATTERN_HOLD = 3;
export const BOSS_PHASE3_SPIRAL_INTERVAL = 0.12;
export const BOSS_PHASE3_SPIRAL_ARMS = 4;
export const BOSS_PHASE3_SPIRAL_ROT = 22;
export const BOSS_PHASE3_SPIRAL_SPEED = 180;
export const BOSS_PHASE3_AIMED_INTERVAL = 0.75;
export const BOSS_PHASE3_AIMED_SPEED = 228;

/** Boss HP bar starts filling this long after warningAt (2:33). */
export const BOSS_HP_BAR_FILL_START = 3;

/** Initial speed and gravity of a destroyed turret, pixels/second. */
export const BOSS_TURRET_FALL_SPEED = 30;
export const BOSS_TURRET_FALL_GRAVITY = 220;

// ============================================================================
// Stage 2 boss 铁堡 (docs/电雷_第二关_铁堡Boss设计_v1.md §10)
// Speeds below are flight speeds after ENEMY_BULLET_SPEED_SCALE. The boss
// clock does not use fireRateScale. Prefix is TIEBAO_ so stage 1's BOSS_*
// numbers stay the battleship's.
// ============================================================================

/** Fixed screen lanes. Center matches LOGICAL_W / 2 and BOSS_ANCHOR_X. */
export const TIEBAO_RAIL_X = [72, 180, 288] as const;
/** Locomotive plus the cars that can be shed. The end form keeps two cars. */
export const TIEBAO_CARS = 9;
export const TIEBAO_END_CARS = 2;
/**
 * Nose through the cab, before the first coupler gap. Was 74px when the
 * first car started at y=74. The extra depth is the cab behind the wedge.
 */
export const TIEBAO_LOCO_H = 116;
/** One slender boxcar body. About 2:1 inside the 80px width. */
export const TIEBAO_CAR_H = 72;
export const TIEBAO_CAR_GAP = 8;
export const TIEBAO_CAR_PITCH = TIEBAO_CAR_GAP + TIEBAO_CAR_H;
/** Rows under the last car body (buffer margin). */
export const TIEBAO_TAIL = 4;
export const TIEBAO_HULL_W = 80;
/** End form, loco + 2 cars. Live hitbox height follows the cars still attached. */
export const TIEBAO_HULL_H = TIEBAO_LOCO_H + TIEBAO_END_CARS * TIEBAO_CAR_PITCH + TIEBAO_TAIL;
/** Loco + 9 cars. Most of this sits above the screen at the encounter. */
export const TIEBAO_FULL_H = TIEBAO_LOCO_H + TIEBAO_CARS * TIEBAO_CAR_PITCH + TIEBAO_TAIL;
/**
 * Remaining main-HP fractions that each drop exactly one rear car.
 * ≤30% is the last shed: loco + 2 stay. The second (Hard) bar does not shed.
 */
export const TIEBAO_SHED_AT = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3] as const;
/** End-form nose screen y. The tail has stepped down until the loco sits here. */
export const TIEBAO_END_NOSE_Y = 48;
export const TIEBAO_END_PARK_Y = TIEBAO_END_NOSE_Y + TIEBAO_HULL_H / 2;
/**
 * Buffer screen y at 100% HP. Rear 2.5 cars meet the screen: the top half-car
 * of that window is at y = -40, so about two cars are actually on screen.
 */
export const TIEBAO_ENCOUNTER_TAIL_Y = 160;
/** Tail drop per shed car. 7 × 24 brings the end-form nose to TIEBAO_END_NOSE_Y. */
export const TIEBAO_SHED_ADVANCE = 24;
/** Hull center at the encounter (9 cars, tail at TIEBAO_ENCOUNTER_TAIL_Y). */
export const TIEBAO_PARK_Y = TIEBAO_ENCOUNTER_TAIL_Y - TIEBAO_FULL_H / 2;
/** Tail just above the screen at the start of the slide-in. */
export const TIEBAO_ENTER_TAIL_Y = -12;
export const TIEBAO_ENTER_Y = TIEBAO_ENTER_TAIL_Y - TIEBAO_FULL_H / 2;
/**
 * Ram stays off until this many cars remain (loco + 4). That is the ≤50% shed.
 * A 9-car hull is 840px and would fill the screen on the dive.
 */
export const TIEBAO_RAM_MAX_CARS = 4;
/** Bottom rows of the full sprite pasted onto the live tail (beam + lamps). */
export const TIEBAO_BUFFER = 20;
export const TIEBAO_ENTER_DURATION = 2;
/** Fight starts this many seconds after the stage clock's zero. See STAGE2_WARNING_AT. */
export const TIEBAO_ENTER_AT = 123;
/** Name-plate WARNING, seconds after the train parks. */
export const TIEBAO_WARNING = 1.5;

/**
 * Park-to-park. Output, then the consist rides a turnout. No telegraph and no
 * lit rail. Parked X is a rail center. The move stays 1.2s: the turnout is
 * pre-laid by `TIEBAO_SWITCH_LEAD` (distance, not extra time) and finishes only
 * once the whole consist is on the new rail. Hard overload uses the same 6s.
 * The end-of-move X snap and the strip-sheared hull are both obsolete.
 * Stock rails stay straight. The closure is extra steel and stays on the map
 * after the move, scrolling off with the factory.
 */
export const TIEBAO_SWITCH_PERIOD = 6;
export const TIEBAO_MOVE = 1.2;
/**
 * Vertical length of one turnout (points through frog). Adjacent rails use this.
 * Lengthened from 176 so the chord is gentler under the bank cap.
 * The heel starts `TIEBAO_SWITCH_LEAD` above the nose and finishes at the tail.
 */
export const TIEBAO_SWITCH_SPAN = 240;
/** L↔R crossover: two turnouts in series. The path passes through the middle rail. */
export const TIEBAO_SWITCH_CROSS_SPAN = TIEBAO_SWITCH_SPAN * 2;
/**
 * Pixels of turnout already laid ahead of the nose at the start of a move.
 * Cars stay on the old rail until the heel reaches them. Not added to the 1.2s.
 */
export const TIEBAO_SWITCH_LEAD = 64;
/** Max rigid-car bank, degrees. A steeper chord clamps; pixels are never sheared. */
export const TIEBAO_CAR_MAX_BANK = 25;
/** Where on one turnout (0 = heel, 1 = toe) the point blades sit. */
export const TIEBAO_POINT_AT = 0.14;
/** Where on one turnout the frog sits. */
export const TIEBAO_FROG_AT = 0.9;

/** Hard overload. Same period as the main fight; weapons and smoke still differ. */
export const TIEBAO_OVERLOAD_PERIOD = 6;
export const TIEBAO_OVERLOAD_MOVE = 1.2;
export const TIEBAO_OVERLOAD_HP = 240;
export const TIEBAO_OVERLOAD_TRANSITION = 1.2;

export const TIEBAO_ROOF_HP = 140;
export const TIEBAO_ROOF_SCORE = 5000;
export const TIEBAO_CORE_HP = 560;
export const TIEBAO_CORE_SCORE = 30000;
export const TIEBAO_ROOF_RADIUS = 14;
export const TIEBAO_CORE_RADIUS = 18;
/**
 * Pixel rows from the nose (sprite top), not from the live hull center.
 * The center moves as cars shed, so runtime offsets are `row - height / 2`.
 * Core on the nose, loco gun on the cab, rear gun on the second boxcar
 * (the rear car of the end form). +y in the center offsets points at the player.
 */
export const TIEBAO_CORE_ROW = 18;
export const TIEBAO_ROOF_LOCO_ROW = 64;
export const TIEBAO_ROOF_CAR_ROW =
  TIEBAO_LOCO_H + TIEBAO_CAR_PITCH + TIEBAO_CAR_GAP + TIEBAO_CAR_H / 2;
const TIEBAO_END_CY = TIEBAO_HULL_H / 2;
export const TIEBAO_ROOF_CAR = { x: 0, y: TIEBAO_ROOF_CAR_ROW - TIEBAO_END_CY } as const;
export const TIEBAO_ROOF_LOCO = { x: 0, y: TIEBAO_ROOF_LOCO_ROW - TIEBAO_END_CY } as const;
export const TIEBAO_CORE = { x: 0, y: TIEBAO_CORE_ROW - TIEBAO_END_CY } as const;

export const TIEBAO_FAN_INTERVAL = 1.4;
export const TIEBAO_FAN_FIRST = 0.4;
export const TIEBAO_FAN_SPREAD = 60;

/** Every attack interval except the fan is the P24 draft times this (+50% rate). */
export const TIEBAO_RATE_SCALE = 2 / 3;

export const TIEBAO_MISSILE_COUNT = 5;
export const TIEBAO_MISSILE_GAP = 0.12 * TIEBAO_RATE_SCALE;
export const TIEBAO_MISSILE_HOMING = 0.55;
export const TIEBAO_MISSILE_SPEED = 88;
export const TIEBAO_MISSILE_WAVES = [0.3 * TIEBAO_RATE_SCALE, 4 * TIEBAO_RATE_SCALE] as const;
export const TIEBAO_OVERLOAD_MISSILE_COUNT = 6;

export const TIEBAO_RAIN_COUNT = 4;
export const TIEBAO_RAIN_WARN = 0.8 * TIEBAO_RATE_SCALE;
export const TIEBAO_RAIN_RADIUS = 26;
export const TIEBAO_RAIN_SEPARATION = 48;
export const TIEBAO_RAIN_FIRST = 0.4 * TIEBAO_RATE_SCALE;
export const TIEBAO_RAIN_SECOND = 4.0 * TIEBAO_RATE_SCALE;
export const TIEBAO_OVERLOAD_RAIN_WARN = 0.55 * TIEBAO_RATE_SCALE;

/** Degrees off straight down. The sweep starts outward and crosses the lane. */
export const TIEBAO_BROADSIDE_FROM = 40;
export const TIEBAO_BROADSIDE_TO = 15;
export const TIEBAO_BROADSIDE_STEP = 0.08 * TIEBAO_RATE_SCALE;
export const TIEBAO_BROADSIDE_SWEEP = 1 * TIEBAO_RATE_SCALE;
export const TIEBAO_BROADSIDE_GAP = 0.6 * TIEBAO_RATE_SCALE;
export const TIEBAO_BROADSIDE_COUNT = 3;
export const TIEBAO_BROADSIDE_FIRST = 0.35 * TIEBAO_RATE_SCALE;
export const TIEBAO_BROADSIDE_SPEED = 120;

export const TIEBAO_WALL_COUNT = 8;
export const TIEBAO_WALL_GAP = 18;
export const TIEBAO_WALL_SPEED = 70;
export const TIEBAO_WALL_FIRST = 0.4 * TIEBAO_RATE_SCALE;
export const TIEBAO_WALL_REPEAT = 1.6 * TIEBAO_RATE_SCALE;
export const TIEBAO_WALL_VOLLEYS = 2;
export const TIEBAO_OVERLOAD_WALL_REPEAT = 1 * TIEBAO_RATE_SCALE;

/** Dash starts quickly, reaches the bottom edge, then crawls back to the current rest center. */
export const TIEBAO_RAM_START = 0.35;
export const TIEBAO_RAM_WARN = 0;
export const TIEBAO_RAM_DIVE = 0.12;
export const TIEBAO_RAM_RETURN = 1.9;
/** Screen y the hull bottom reaches at the end of the dive. */
export const TIEBAO_RAM_BOTTOM = LOGICAL_H;

export const TIEBAO_ROCKET_SPEED = 64;
export const TIEBAO_ROCKET_Y = -16;
export const TIEBAO_ROCKET_WARN = 0.45 * TIEBAO_RATE_SCALE;
export const TIEBAO_ROCKET_START = 0.8 * TIEBAO_RATE_SCALE;
export const TIEBAO_ROCKET_RADIUS = 6;

export const TIEBAO_CRATE_HP = 6;
export const TIEBAO_CRATE_SCORE = 300;
/** Screen y of the crate's bottom edge when it blasts. */
export const TIEBAO_CRATE_LAND_Y = 480;
export const TIEBAO_CRATE_BLAST = 22;
export const TIEBAO_CRATE_SIZE = 12;
export const TIEBAO_CRATE_FIRST = 0.5 * TIEBAO_RATE_SCALE;
export const TIEBAO_CRATE_GAP = 1.2 * TIEBAO_RATE_SCALE;
export const TIEBAO_CRATE_PER_WINDOW = 2;
export const TIEBAO_CRATE_FLIGHT = 1.15;
export const TIEBAO_OVERLOAD_CRATE_EVERY = 2.2 * TIEBAO_RATE_SCALE;

export const TIEBAO_DEATH_EXPLOSIONS = 8;
export const TIEBAO_DEATH_DURATION = 2.8;

/** Opening cards, seconds from stage start (0:00–0:05). */
export const INTRO_STAGE_UNTIL = 1.6;
export const INTRO_READY_UNTIL = 3.6;
export const INTRO_GO_UNTIL = 4.4;

/**
 * Story subtitle hold, seconds. The next beat replaces the line immediately.
 * The stage-open line starts at `CAPTION_OPEN_AT` and ends with the GO card.
 */
export const CAPTION_HOLD = 4;
export const CAPTION_OPEN_AT = 0.4;
/** Subtitle bar height. Its top sits above the tallest joystick. */
export const CAPTION_BAR_H = 22;

// ============================================================================
// Title debug entry & weapon test (design §7.1, §14.11)
// ============================================================================

/** Logical-pixel hot zone on the title screen, top-right. */
export const DEBUG_HOT_SIZE = 48;

/** Taps inside the hot zone that open the debug panel. */
export const DEBUG_HOT_TAPS = 6;

/** Seconds after the first tap before the hot-zone counter resets. Inclusive. */
export const DEBUG_HOT_WINDOW = 2;

/** Rolling window for weapon-test DPS, in seconds. */
export const WEAPON_TEST_DPS_WINDOW = 1;

/** Highest T level the weapon-test panel can set. 0 is off. Same cap as combat. */
export const WEAPON_TEST_SUB_MAX = HOMING_MAX_LEVEL;

/** Bomb stock the weapon-test panel can set. A real stage still uses BOMBS_MAX. */
export const WEAPON_TEST_BOMBS_MAX = 3;

/** Fixed immortal target near the top of the weapon-test screen. */
export const WEAPON_TEST_TARGET_W = 80;
export const WEAPON_TEST_TARGET_H = 22;
export const WEAPON_TEST_TARGET_X = (LOGICAL_W - WEAPON_TEST_TARGET_W) / 2;
export const WEAPON_TEST_TARGET_Y = 8;

/**
 * Weapon-test live tune. Session only — stage, boss practice, and the title
 * demo keep FIRE_RATE / PLAYER_BULLET_DAMAGE / HOMING_*.
 * Steps are absolute volleys per second and damage per projectile.
 */
export const WEAPON_TEST_RATE_STEP = 0.5;
export const WEAPON_TEST_DAMAGE_STEP = 0.5;

/** Inclusive clamps. Both floors stay above 0 so the fire interval stays finite. */
export const WEAPON_TEST_RATE_MIN = 0.5;
export const WEAPON_TEST_RATE_MAX = 30;
export const WEAPON_TEST_DAMAGE_MIN = 0.5;
export const WEAPON_TEST_DAMAGE_MAX = 20;
