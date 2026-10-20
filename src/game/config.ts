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

/** Fire rate (shots per second, same for all levels) */
export const FIRE_RATE = 10;

/** Player bullet speed */
export const PLAYER_BULLET_SPEED = 720;

/** Player bullet damage per hit */
export const PLAYER_BULLET_DAMAGE = 1;

/** Maximum power level */
export const POWER_MAX = 3;

/** Lv2 dual laser gap */
export const LV2_GAP = 10;

/** Lv3 spread angle in degrees */
export const LV3_SPREAD_DEG = 15;

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

/** Bomb damage to regular enemies */
export const BOMB_DAMAGE = 40;

/** Bomb damage ratio to boss HP */
export const BOMB_BOSS_RATIO = 0.08;

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

/** Score for collecting P at max power */
export const P_OVERFLOW_SCORE = 1000;

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
