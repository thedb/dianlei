/**
 * 48-color locked palette for pixel sprites
 *
 * Design doc §3.4 specifies the color groups but not exact hex values.
 * This palette is designed to match the arcade aesthetic:
 * - Cyan player with white accents
 * - Red/dark red enemies
 * - Olive ground units
 * - Vibrant explosions
 * - Pink/magenta enemy bullets (must stand out on any background)
 *
 * NOTE: Code-generated glow effects and particles can use semi-transparent
 * colors outside this palette. Only sprite pixel art is restricted.
 */

export const PALETTE = [
  // ============================================================================
  // Neutral (8 colors) - outlines, highlights, smoke, metal
  // ============================================================================
  '#000000', // 0: Pure black
  '#1a1a2e', // 1: Dark navy (deep shadows)
  '#2d2d44', // 2: Dark gray-blue
  '#4a4a5c', // 3: Medium gray
  '#6e6e80', // 4: Gray
  '#9090a0', // 5: Light gray
  '#c0c0cc', // 6: Pale gray
  '#ffffff', // 7: Pure white

  // ============================================================================
  // Player (6 colors) - white, cyan, light blue for ship and lasers
  // ============================================================================
  '#e8f4f8', // 8: Off-white (player hull highlight)
  '#b0e0e8', // 9: Pale cyan
  '#00e5ff', // 10: Bright cyan (primary player color)
  '#00b8d4', // 11: Medium cyan
  '#0088a8', // 12: Dark cyan
  '#4fc3f7', // 13: Light blue (cockpit, accents)

  // ============================================================================
  // Enemy Air (6 colors) - dark red, crimson, black-red
  // ============================================================================
  '#1a0a0a', // 14: Near-black red
  '#3d0f0f', // 15: Very dark red
  '#6b1c1c', // 16: Dark crimson
  '#a82828', // 17: Medium red
  '#d43030', // 18: Bright red (enemy highlight)
  '#ff4444', // 19: Vivid red (warning, damage)

  // ============================================================================
  // Ground Units (5 colors) - olive, tan, military
  // ============================================================================
  '#2d3022', // 20: Dark olive
  '#4a5038', // 21: Olive
  '#6b7050', // 22: Medium olive
  '#8a9068', // 23: Light olive
  '#b8a878', // 24: Tan/sand

  // ============================================================================
  // Terrain (10 colors) - grass, forest, dirt, asphalt, concrete
  // ============================================================================
  '#1e3820', // 25: Dark forest green
  '#2d5030', // 26: Forest green
  '#3d6840', // 27: Medium green
  '#58a050', // 28: Grass green
  '#78c068', // 29: Light grass
  '#4a3828', // 30: Dark brown (dirt)
  '#6b5038', // 31: Brown
  '#8a6848', // 32: Light brown
  '#484850', // 33: Asphalt
  '#787880', // 34: Concrete

  // ============================================================================
  // Water (5 colors) - deep blue, shallow, foam
  // ============================================================================
  '#0a1828', // 35: Deep ocean
  '#1a3050', // 36: Ocean blue
  '#2a4878', // 37: Medium blue
  '#4080b0', // 38: Shallow water
  '#90c8e8', // 39: Foam/spray

  // ============================================================================
  // Explosion (4 colors) - yellow, orange, red-orange
  // ============================================================================
  '#fff8a0', // 40: Bright yellow (explosion core)
  '#ffc040', // 41: Orange-yellow
  '#ff8820', // 42: Orange
  '#e05020', // 43: Red-orange

  // ============================================================================
  // Enemy Bullets (4 colors) - pink, magenta, white core
  // Must be highly visible against any background
  // ============================================================================
  '#ff40ff', // 44: Bright magenta
  '#ff80c0', // 45: Pink
  '#c020a0', // 46: Dark magenta (outline)
  '#ffe0ff', // 47: White-pink (bullet core)
] as const;

/** Palette color indices by semantic name */
export const COLOR = {
  // Neutrals
  BLACK: 0,
  SHADOW: 1,
  DARK_GRAY: 2,
  MEDIUM_GRAY: 3,
  GRAY: 4,
  LIGHT_GRAY: 5,
  PALE_GRAY: 6,
  WHITE: 7,

  // Player
  PLAYER_WHITE: 8,
  PLAYER_PALE_CYAN: 9,
  PLAYER_CYAN: 10,
  PLAYER_MED_CYAN: 11,
  PLAYER_DARK_CYAN: 12,
  PLAYER_BLUE: 13,

  // Enemy Air
  ENEMY_BLACK: 14,
  ENEMY_DARK_RED: 15,
  ENEMY_CRIMSON: 16,
  ENEMY_RED: 17,
  ENEMY_BRIGHT_RED: 18,
  ENEMY_VIVID_RED: 19,

  // Ground
  GROUND_DARK_OLIVE: 20,
  GROUND_OLIVE: 21,
  GROUND_MED_OLIVE: 22,
  GROUND_LIGHT_OLIVE: 23,
  GROUND_TAN: 24,

  // Terrain
  TERRAIN_DARK_GREEN: 25,
  TERRAIN_FOREST: 26,
  TERRAIN_GREEN: 27,
  TERRAIN_GRASS: 28,
  TERRAIN_LIGHT_GRASS: 29,
  TERRAIN_DARK_BROWN: 30,
  TERRAIN_BROWN: 31,
  TERRAIN_LIGHT_BROWN: 32,
  TERRAIN_ASPHALT: 33,
  TERRAIN_CONCRETE: 34,

  // Water
  WATER_DEEP: 35,
  WATER_OCEAN: 36,
  WATER_MEDIUM: 37,
  WATER_SHALLOW: 38,
  WATER_FOAM: 39,

  // Explosion
  EXPLOSION_YELLOW: 40,
  EXPLOSION_ORANGE_YELLOW: 41,
  EXPLOSION_ORANGE: 42,
  EXPLOSION_RED_ORANGE: 43,

  // Enemy Bullets
  BULLET_MAGENTA: 44,
  BULLET_PINK: 45,
  BULLET_DARK: 46,
  BULLET_CORE: 47,
} as const;

/** Get color by palette index */
export function getColor(index: number): string {
  return PALETTE[index] ?? PALETTE[0];
}
