# 《电雷》Agent Development Rules

This document defines the coding conventions and constraints for all AI agents working on this project. These rules are **mandatory** and must be followed for every code change.

## Source of Truth

- **Design Document**: `docs/电雷_设计文档_v1.1.md` — all game rules, constants, and mechanics
- **Wave Table**: `docs/电雷_第一关波次表_v1.md` — stage 1 enemy waves and timing
- When design docs and code conflict, **docs are authoritative**
- Update docs when rules change (not just code comments)

## Architecture

### No Engines or Frameworks
- Pure TypeScript + Canvas 2D — no game engines (Phaser, PixiJS, etc.)
- **No Taro** — the design doc mentions it but this is superseded
- No UI frameworks (React, Vue) for gameplay — menus will be canvas-drawn
- Platform features accessed through `src/platform/` adapter interface

### Resolution & Scaling
- Fixed logical resolution: **360×640** portrait
- Nearest-neighbor scaling (`imageSmoothingEnabled = false`)
- Integer or closest scale factor, letterboxed with black
- Handle `devicePixelRatio` correctly (combined scale = DPR × logical scale)
- Leave room for safe areas (HUD top +4, controls bottom +12)

### Game Loop
- Fixed **60Hz update** timestep (`FIXED_DT = 1/60`)
- `requestAnimationFrame` for rendering (may be 60/120/144 Hz)
- Interpolate positions in render for smooth display

## Visual Assets

### Palette
- **48-color locked palette** defined in `src/game/palette.ts`
- All sprite pixel data uses palette indices only
- Code-generated effects (glow, particles) may use semi-transparent colors

### Sprite Sizes (original pixels, before SPRITE_SCALE)
| Asset | Size |
|-------|------|
| Player | 28×32 |
| Small fighter | 24×24 |
| Medium fighter | 36×36 dedicated sprite (P2). Do not scale the 24×24 small fighter |
| Interceptor | 28×28 |
| Heavy bomber | 56×48 |
| Drone | 20×20 |
| Tank | 24×24 |
| Turret | 32×32 |
| Missile car | 24×32 |
| Pillbox | 32×32 |
| Fuel depot | 48×32 |
| Radar station | 32×32 |
| Sea gun | 32×32 (twin barrels code-drawn) |
| Boss | ~220×140 |
| Player bullet | 4×12 |
| Enemy bullet (small) | 6×6 |
| Enemy bullet (large) | 12×12 |
| Missile | 6×12 |
| Player homing missile (T) | 4×8 |
| Items (P/B/T) | 16×18 |
| Tiles | 16×16 |

### Code-Generated Effects (NOT baked into sprites)
- Engine flames / exhaust (flicker below ships)
- Glow halos (player cyan glow, bullet glow)
- Hit flash (white tint overlay)
- Shield effects
- Particles
- Bomb shockwave ring (palette pixel blocks)
- Homing missile exhaust trail

### Sprite Drawing
- Sprites defined as pixel arrays/strings with palette indices
- Rendered to offscreen canvases at boot time
- Bank animation: 11 frames (5 left + center + 5 right), right half mirrored for left
- Bank timing: ~0.2s to full bank, ~0.15s return to center

## Code Organization

### Configuration
- **All tunables in `src/game/config.ts`** — matches design doc §14
- No magic numbers in game logic
- Constants grouped by category (display, controls, combat, etc.)

### Object Pooling
- Bullets, enemies, explosions, particles must use `ObjectPool`
- Pre-allocate pools at scene enter
- Release objects when off-screen or destroyed

### Size Classes
- Every shootable object declares a size class (`small` / `medium` / `large`) and a category (`air` / `ground` / `building` / `boss`) in `src/game/entities/objectClass.ts`. Nothing else may hard-code per-type size checks
- small: small, drone, interceptor, tank, missile_car, every building. medium: medium, bomber, turret2, future mini-bosses. large: the Boss

### Bomb
- Hits only objects on screen at the moment of the bomb. Off-screen enemies and buildings are untouched
- Small dies outright (normal score, drop, explosion). Medium loses `BOMB_MEDIUM_RATIO` (50%) of MAX HP. Boss loses `BOMB_BOSS_RATIO` (8%)
- A pixel shockwave ring grows from the ship and reaches the farthest corner in `BOMB_WAVE_TIME`; each target resolves when the ring reaches it, so small kills chain
- No bomb screen shake for now (backlog item in design doc §13)
- Rules live in `src/game/systems/bomb.ts`

### Weapons
- Weapon definitions live in the registry in `src/game/systems/playerWeapons.ts`: id, slot (`main` | `sub`), item letter (also the icon), max level, and rate / damage / fire function per level. Add weapons there, never as branches in the battle scene
- `GameState` holds `main {id, level}` and `sub {id, level} | null`. The slots never affect each other. Both fire while A is held, each on its own clock
- Pickup: same weapon +1 level up to max, then overflow score; another weapon of the same slot switches and keeps the clamped level; an empty sub slot equips at Lv1
- Death: main −1 (min Lv1), sub −1 (may become none)
- Items are table-driven (`ITEM_DEFS` in `entities/item.ts`, `ITEM_PIXELS` in `art/itemSprite.ts`)
- Buildings always drop exactly one item, chosen from the live `state.sub` at the moment of destruction: T when the sub slot is empty or homing is below `HOMING_MAX_LEVEL`, B when homing is already at max. T comes only from buildings. Wave-table P / B carriers do not change. There is no `BUILDING_DROP_CHANCE`
- The title demo uses the same weapon code paths. No demo-specific weapon logic
- Main vulcan permanent defaults (stage, boss practice, attract, and weapon-test P速 / P伤 on enter and reset): `FIRE_RATE` = 5 volleys/s, `PLAYER_BULLET_DAMAGE` = 2. All three levels share that rate; a higher level adds bullets. Full-hit DPS stays 10 / 20 / 30
- T homing is pinned and must not be derived from the main weapon: `HOMING_FIRE_RATE` = 1.5 volleys/s, `HOMING_DAMAGE` = 2.5. Weapon-test T速 / T伤 open at those same numbers. Do not reintroduce `HOMING_FIRE_RATE_SCALE` or `HOMING_DAMAGE_FACTOR`

### Level Data
- Wave data in `src/game/levels/` using TypeScript types
- Patterns driven by data, not hard-coded `if` statements
- MVP waves marked in wave table should be playable first

## Testing

### Test Framework
- **Vitest** for unit tests
- Test files: `*.test.ts` alongside source files

### Required Test Coverage
- Collision detection math
- Wave scheduler timing
- Power-up / extend / death rules
- Config sanity checks
- Object pool behavior

## Build & Deploy

### Vite Configuration
- Relative base path (`base: './'`) for production
- Dev server at `/`
- Asset hashing for cache busting

### CI Requirements
- **CI must stay green** — lint, typecheck, test, build
- Verify no absolute asset paths in index.html
- Milestone PRs merge only after the owner replies 「合并」. Agents do not merge those PRs.
- Small fixes and docs may be merged directly by the coordinator bot.

### Deployment
- OSS bucket: `it-consultis`
- Path prefix: `vibeCoding/dianlei/`
- **Never touch files outside this prefix**
- Hashed assets: long cache (1 year, immutable)
- index.html: no-cache

## Repository Rules

### What NOT to Commit
- External reference art (Raiden sprites, etc.)
- Generated files (dist/, .vite/)
- Node modules
- IDE settings

### Documentation
- Keep `docs/` design documents as source of truth
- Update docs when game rules change
- README for setup and development

### Branching
- One PR per milestone
- Branch naming: `cursor/<milestone>-<suffix>`
- Milestone PRs merge only after the owner replies 「合并」. Agents do not merge those PRs.
- Small fixes and docs may be merged directly by the coordinator bot.

## Audio

### WebAudio Synthesis
- 8-bit style SFX and one looping BGM, both generated with WebAudio API. No binary music files
- Context comes from the platform adapter (`createAudioContext`: H5 `AudioContext`, WeChat `wx.createWebAudioContext`)
- BGM defaults **off**. The on/off switch and 0–100% volume slider live only on the settings page (title and pause), persisted with the other settings. The title and boot screens do not show them
- The mute toggle silences SFX and BGM
- Unlock audio context on first user interaction

## Settings

- Persisted together under `dianlei.settings.v1` (platform storage). Missing fields on old saves fall back per field
- **Debug mode defaults off** (`debugMode`). It only shows the bottom-left FPS / input / `getDebugInfo` overlay. It does not enable keyboard shortcuts. There is no F1, F2, or F3. The title menu has no 「挑战 Boss」 button, and the settings page has no 「调试模式」 row. On the title scene, six taps inside a 48×48 hot zone at the top-right of the logical canvas within 2 seconds open a debug panel (the counter resets when the window expires; taps outside the zone do not count). The panel can start a boss-practice run, toggle `debugMode`, or enter weapon-test mode. The attract demo keeps running behind the panel
- **Weapon test** (`playMode: 'weaponTest'`) reuses `createBattleScene`: same player, loadout, `stepFireClock` / `fireVolley`, collision, and input. Map scroll, the wave schedule, and enemy / building spawn stay off. The background is a solid colour. One fixed immortal target near the top only accumulates projectile damage, and homing missiles steer toward it. A left panel shows session damage, rolling 1-second DPS, main level, sub level (or none), and last hit. Top-right controls write the real loadout: main P (1–3) on `state.main`, sub T off (`state.sub = null`) or homing Lv1/Lv2, bombs B (0–3) on `state.bombs`. Under those, P速 / P伤 / T速 / T伤 step absolute volleys per second and damage per projectile for this session only. Defaults are those four constants (P速 5, P伤 2, T速 1.5, T伤 2.5). The four overrides must not mutate `WEAPONS` and must not apply in attract, stage, or boss practice. Reset clears the damage meter and puts the four values back on the constants; it does not change P/T levels or bomb stock. Leaving the mode does the same for the four values. Bomb stays one press of B, with no fire-rate row. Esc opens pause; 「返回标题」 returns to the title without a confirm dialog. Player death returns to the title and does not open the result or game-over scene and does not write a run report
- **Difficulty (P10.1)** is chosen on the title (and boot) 「开始游戏」 overlay: 简单 / 中等 / 困难, plus 返回. It is `SceneContext.difficulty` for that run, including retry, and is not persisted. Easy multiplies HP by `DIFFICULTY_HP_EASY` (1). Medium uses `DIFFICULTY_HP_MEDIUM` (1.15) and Hard `DIFFICULTY_HP_HARD` (1.3), via `scaleHp`, on every enemy, every building, and every boss part. Hard also arms boss phase 3. The attract demo pauses while the overlay is open and always fights on Easy numbers. Debug 「挑战 Boss」 skips the overlay and forces Easy. Weapon test stays on Easy numbers.
- **Victory fly-off (P10.1)** runs after the boss death animation on both a full clear and boss practice. The ship ignores input for `VICTORY_EXIT_WAIT` (2s), flies to the battle spawn `(LOGICAL_W / 2, PLAYER_SPAWN_Y)`, then accelerates off the top (`VICTORY_FLYOFF_ACCEL`). The result screen opens only after that. `releaseBossResult` is what sets `enterResult`.
- **Hard boss phase 3 (P10.1)** is its own HP segment (`BOSS_PHASE3_HP`, then the Hard scale) after the current turret → core fight. It alternates a small-bullet spiral and an `aimed_fast3` volley every `BOSS_PHASE3_PATTERN_HOLD`. Easy and Medium never enter it. The core's 30000 points are paid when the last segment dies. The hull sprite stays the open phase-2 hull; the phase-3 core glow is yellow and code-drawn.
- **The title shows the Stage 1 attract demo only after the title scene has entered.** Boot and any pre-title loading state must not create, update, or render that demo or a stage background; black plus the boot chrome is the whole frame. The shared attract is created in `title.enter`, and returning to the title starts it in that same enter (it stays stopped until then). The demo is the real battle scene (`playMode: 'attract'`): same stage data, entity classes, sprites, tiles, bullets, explosions, and config. Only the scripted input and the loop / death-fade / restart are demo-specific. Do not fork art, waves, or combat constants for the title. The demo player dies under the same collision and explosion rules; after that explosion the screen fades to black and the loop restarts. The demo stays silent and must not write the high score or settings. Title buttons stay clickable during the fade. Old saves may still contain `titleBackground`; drop that key on load

## Performance Targets

- Maintain **60fps** on mid-range mobile devices
- Enemy bullet cap: 150 (`ENEMY_BULLET_CAP`)
- Use spatial partitioning for collision detection if needed
- Profile on real devices, not just desktop
