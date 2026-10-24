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
- Fixed logical resolution: **360×640** portrait. Do not widen the playfield
- Nearest-neighbor scaling (`imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`)
- Integer or closest scale factor (`calculateScaling` snaps when the fractional part is under 0.2 and the integer is at least 1), letterboxed
- Handle `devicePixelRatio` correctly (combined scale = DPR × logical scale). The backing store is that product
- Window `resize`, `orientationchange`, a `ResizeObserver` on the game container, and a DPR media-query change call `renderer.resize()`. The same playfield canvas is kept. H5 `setCanvas` on that canvas refreshes the touch scale and does not stack listeners. Input stays at scale 1 because the platform already returns logical pixels
- Letterbox bars are a static exterior behind the playfield (`engine/exterior.ts`): palette deep-ocean void, sparse stars, soft vertical vignette. `pointer-events: none`. No text and no controls in the bars. iPad landscape stays a centered phone frame, so the side bars are large
- Leave room for safe areas (HUD top +4, controls bottom +12). Insets are still the values read at boot

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
| Risk crate | 32×16 (cyan shield ring is code-drawn while the shield is up) |
| Pillbox | 32×32 |
| Fuel depot | 48×32 |
| Radar station | 32×32 |
| Sea gun | 32×32 (twin barrels code-drawn) |
| Boss | ~220×140 (stage 1 百战). Stage 2 铁堡 starts at ~80×840 (loco + 9) and ends at ~80×280 (loco + 2) |
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
- small: small, drone, interceptor, tank, missile_car, risk_crate, every building. medium: medium, bomber, turret2, future mini-bosses. large: the Boss

### Bomb
- Hits only objects on screen at the moment of the bomb. Off-screen enemies and buildings are untouched
- Small dies outright (normal score, drop, explosion). Medium loses `BOMB_MEDIUM_RATIO` (50%) of MAX HP. Boss loses `BOMB_BOSS_RATIO` (8%)
- A pixel shockwave ring grows from the ship and reaches the farthest corner in `BOMB_WAVE_TIME`; each target resolves when the ring reaches it, so small kills chain
- No bomb screen shake for now (backlog item in design doc §13)
- Rules live in `src/game/systems/bomb.ts`

### Weapons
- Weapon definitions live in the registry in `src/game/systems/playerWeapons.ts`: id, slot (`main` | `sub`), item letter (also the icon), max level, and rate / damage / fire function per level. Add weapons there, never as branches in the battle scene
- `GameState` holds `main {id, level}`, `sub {id, level} | null`, and `mate` (M wingman level 0–2). Main and sub never affect each other. Both fire while A is held, each on its own clock. M is not a `WEAPONS` row (`systems/mate.ts`). Collecting the M item raises mate by 1 up to `MATE_MAX_LEVEL`, then pays `M_OVERFLOW_SCORE` (1000, same as `P_OVERFLOW_SCORE`); the pickup bounces like P/T. Ship rules: M=1 is one ship on the player's left, M=2 is one on each side, gap `MATE_OFFSET_X` (25.6, 80% of the original 32), same height, player sprite at `MATE_SCALE` (about 1/3) using the player's bank frame. Exhaust is mapped through the drawn sprite's anchor and size, so it stays on that frame's tail while banking. Wingmen have no hitbox. They fire on the main-gun beat only: one straight vulcan bullet each, damage locked to `PLAYER_BULLET_DAMAGE`, ignoring P's pattern and the weapon-test P伤 override, and they never fire T. A fresh run, boss practice, and the title demo start at M=0. Stage 1 drops M from B06 and from exactly one of B07/B08
- Pickup: same weapon +1 level up to max, then overflow score; another weapon of the same slot switches and keeps the clamped level; an empty sub slot equips at Lv1. P and T do not change `mate`
- Death: main −1 (min Lv1), sub −1 (may become none), mate −1 (min 0)
- Items are table-driven (`ITEM_DEFS` in `entities/item.ts`, `ITEM_PIXELS` in `art/itemSprite.ts`)
- Buildings always drop exactly one item. A placement `drop` locks a letter, or `{ exclusive, item }` joins a group. Battle enter rolls the stage RNG once per group (members in placement order, groups in sorted key order, index `floor(rng * count)`). Stage 1 `s1-sea-mate` is B07 then B08, so exactly one of them drops M. B01 and B05 drop T. B06 drops M. Everyone else uses `BUILDING_DROP_RULES`: `BUILDING_DROP_P_SHARE` (50%) P and the rest B while main power is below `POWER_MAX`, otherwise only B (that path does not draw). Locks beat a stage or difficulty rule list. Wave-table P / B carriers do not change. There is no chance to drop nothing
- Risk crates (P22, `risk_crate`) are shielded floaters on the stage clock, not building locks and not part of the 148-ship kill rate. Shield 12 then body 6 (`scaleHp` still applies). No shots. Destroying one drops one existing M/P/T item via `chooseRiskCrateDrop`: M when mate is 0 (no roll); otherwise M 50% / P 25% / T 25%. Never B. Stage 1: Easy one at t=50 x=180; Medium t=50 x=48 and t=100 x=312; Hard adds t=75 x=220
- The title demo uses the same weapon code paths. No demo-specific weapon logic
- Main vulcan permanent defaults (stage, boss practice, attract, and weapon-test P速 / P伤 on enter and reset): `FIRE_RATE` = 5 volleys/s, `PLAYER_BULLET_DAMAGE` = 2. All three levels share that rate; a higher level adds bullets. Full-hit DPS stays 10 / 20 / 30
- T homing is pinned and must not be derived from the main weapon: `HOMING_FIRE_RATE` = 1.5 volleys/s, `HOMING_DAMAGE` = 2.5. Weapon-test T速 / T伤 open at those same numbers. Do not reintroduce `HOMING_FIRE_RATE_SCALE` or `HOMING_DAMAGE_FACTOR`

### Level Data
- Wave data in `src/game/levels/` using TypeScript types
- Patterns driven by data, not hard-coded `if` statements
- MVP waves marked in wave table should be playable first

### Maps (P12)
- Maps are assets, decoupled from stages. Every map is registered in `src/game/maps/registry.ts` (`TileMapDef` with rows / `build()` / `cloudShadows` / optional `loopFrom`, or `StarfieldMapDef`). Nothing else may list maps or build map grids; use `getMap` / `getMapGrid`
- A stage says which maps it uses in `StageData.maps`: `run` is `{ map, at }[]` before the warning, `boss` is either a tile arena (`loopFrom`: one approach strip, then a seamless loop) or a starfield on a real space stage. Entry `i > 0` starts scrolling `MAP_BLEND_LEAD` before `at` and crossfades over `MAP_BLEND_LEAD + MAP_BLEND_TAIL`. `StageSection` on waves is only a label and never picks a background
- Current maps: 陆地A `landA` (chunked countryside), 陆地B `landB` (P14 airfield: outskirts → runway → drainage at the runway end → forest), 河流A `riverA` (P14 rename of 海面A: one channel, bridges, bank hamlets), 百战要塞 `landBoss` (Stage 1 boss arena: a scorched approach — road, cliff, gate — then a courtyard whose top and bottom rows match, so it loops; same land tiles, no water), 铁堡厂轨 `factoryBoss` (Stage 2 boss arena: woods and a gate on the approach, then a factory hall that fills the frame — walls, windows, and three rails at screen X 72 / 180 / 288 — and loops; tile look A locked; no cloud sheet, no water, no warning clouds, no space cut), 宇宙A `spaceA` (starfield plus a baked planet layer: one large limb with about a third of the disk on screen, and small distant discs, both slower than the near stars). Stage 1 runs on 陆地A until the warning, then landA's last row is stitched onto `landBoss` (no cloud sheet, both layers opaque) and scroll continues. `spaceA` stays for a real space stage and 地图预览; do not point stage 1 `maps.boss` at it. Stage 2's stub run is 陆地B stitched into `factoryBoss` (empty waves and buildings). 河流A stays a preview / future-stage map. Do not point stage 1 `maps.run` at 陆地B or 河流A, and do not point stage 1 `maps.boss` at `factoryBoss`
- Story captions live in `src/game/story/captions.ts`. A stage lists cues on `StageData.captions`. Stage 1 wires `s1_open` (`open`, from `CAPTION_OPEN_AT`) and `s1_end` (`clear`, when the boss enters clear). Stage 2 wires `s2_open` and `s2_end` the same way. A challenge seek starts at `enterAt`, so the open line has already elapsed. The stage HUD draws the bar for `CAPTION_HOLD` seconds; the next cue replaces it. Attract (`hud: 'none'`) does not draw them. `mid` and `cutscene` are accepted and draw nothing until a later milestone
- Terrain comes only from the mask in `src/game/maps/terrain.ts` (`land` / `water` / `feature` per tile id). Buildings, tanks and tests read the mask, never tile ids. Unlisted tiles are `feature`
- Chunk maps (`src/game/maps/chunks.ts`): a chunk is `MAP_CHUNK_ROWS` (40) × 23 tiles, painted by code from a seed. The plan is seeded and deterministic, may mirror chunks, and only joins matching edges. `sealEdges` writes the contract onto row 0 and row 39. 陆地A: the main road crosses those rows at `ROAD_COL` (11); a stream crosses at `STREAM_COLS.left` / `.right` / `.center` or not at all. 陆地B: `AIRFIELD_SPINE` (columns 9–13) is road or runway and carries no water on those edge rows. The runway-end drainage (shoulder ditches plus one transverse channel) stays inside `runwayBatteries`. Parked fighters are 2×2 `PLANE` tiles on the apron (background only), in side-by-side groups of three with at least ten rows before the next group. The last three chunks are forest: huts, cabins, footpaths, then a ruined clearing — no hangars, barracks, or grid roads. 河流A: a five-tile channel uses `RIVER_EDGE_COLS` (`left` 1–5, `center` 9–13, `right` 17–21); lakes stay inside the chunk. Banks have hamlets, crop plots, and water wheels. Nothing else puts road or water on an edge row
- Rendering: never bake a whole map. Each chunk is baked once into a 368×640 canvas held in an LRU of `MAP_CHUNK_CACHE` (4); a frame blits the ≤ 2 visible chunks and prefetches the next one `MAP_PREFETCH_ROWS_PER_FRAME` tile rows at a time. Shadows (3 px down-right, `SHADE` ramp) and autotiling live in `src/game/art/mapRaster.ts`. Cloud shadows and the starfield warning band share four baked silhouettes in `src/game/art/clouds.ts` (single puff, three-lobe, two-hump billow, irregular lump). No strip shapes. Every placed stamp hugs the left or right edge and stays partly off-screen; center-lane stamps that enter from the top are not used, and ground shadows follow the same rule so a removed cloud leaves no shadow. Different speeds stay at least 8 px apart in x so they never stack into a dark blob. Flips are horizontal or vertical only — never a 90° turn. A tile-boss handoff does not draw the warning band (those pixels are near-white and flashed over the map). Ground shadows are one pass per frame; each stamp drifts at `CLOUD_SHADOW_SCROLL` (2) times its own speed
- Building placements name a `map` that must be on the stage's `maps.run`; `placeBuildings` resolves the layer and origin. All placements must pass `validateBuildingFootprint` on their map (tests enforce it)
- New map: follow `docs/电雷_P12_地图资产说明.md` §5 (tiles → terrain mask → chunk library → slot spec → registry → stage reference → tests → 地图预览)
- **Stage registry**: `src/game/levels/registry.ts` (`getStage`, `listStages`) is the only module that imports a concrete stage table. Battle, the wave scheduler, the 挑战 Boss list, and tests go through it. A `StageData` carries its own `id`, `label`, `sections`, `warningAt`, waves, buildings, `boss: BossDef`, and optional `buildingDrops`

### Battle Scene Layout (P11)
- `src/game/scenes/battle.ts` only orders the frame (keep it ≲600 lines). The rules live in `src/game/battle/`:
  - `context.ts` — the shared `Battle` state (pools, player, run state, stage, boss, clocks), `runDifficulty` / `runProfile`, `publishRun`, `leaveToTitle`, audio unlock
  - `playMode.ts` — `PLAY_MODE_RULES`: one row per `playMode` (`silent`, `pausable`, `pauseExit`, `publishesRun`, `onDeath`, `world`, `range`, `hud`, `difficulty`, `victoryExit`, `bossEntry`). Modules read these flags; never branch on `playMode` strings. A new mode is a new row
  - `player.ts` (steer, bank, guns, pickups, death, respawn, extend) · `combat.ts` (kills, drops, bomb, homing targets, collision pass) · `world.ts` (scroll, waves, buildings, enemies, bullets, items, boss-practice `jumpTo`) · `bossFight.ts` (boss events, victory fly-off) · `fx.ts` (explosion / spark pools, shake) · `range.ts` (weapon-test panel and stats) · `pause.ts` · `render.ts` (field) · `hud.ts` (HUD and overlays)
- Frame order is fixed and covered by replay tests: pause → range death → pause request → range taps → clock / shake / timers / buttons → ship (death, victory hold, fly-in, control + bomb) → player bullets → (world) scroll, waves, boss arrival, buildings → enemies → bomb ring hits → homing → boss + victory → enemy bullets / items → FX → collisions → extend
- Player shots find enemies through `SpatialGrid` (`systems/collision.ts`), padded by `ENEMY_MAX_HIT_RADIUS`; candidates come back in pool order, so hit order matches a full scan
- Gameplay randomness comes from `SceneContext.rng` (`engine/rng.ts`, seeded `createRng`). Never call `Math.random` in gameplay code; the replay tests make it throw

### Data-Driven Content (P11)
- **Enemies**: one row per type in `ENEMY_DEFS` (`entities/enemyDefs.ts`): HP, score, footprint, hit radius, size class, category, `deathBursts`, `barrel`, `spin`, `snapAim`, `avoidsWater`, optional `shield`, `killDrop`, `countsInKillRate`. No per-type branches in battle code
- **Bullet patterns**: `systems/danmaku.ts`. Named kinds are rows in `FIRE_PRESETS`; one-off shapes use `{ kind: 'pattern', pattern: PatternSpec }`. Gun clocks (`pullShots`) and the sweeping laser (`stepLaserSweep`) are shared by enemies and bosses
- **Bosses**: a `BossDef` (`levels/bosses/*.ts`) lists parts and a phase table (targets, optional `segmentHp`, `transition`, `gate`, attacks, enrage, look, HP-bar slot). `systems/boss.ts` is the generic runner; the segmented HP bar comes from the table (`bar: 'extra'` phases are the yellow slot). Hull art is keyed by `BossDef.art` in `BOSS_ART` (`art/bossSprite.ts`). Stage 2 铁堡 sets `script: 'tiebao'`. Its rail clock and the eight weapon modes live in `systems/tiebao.ts` (a `WeakMap`, not fields on `BossRuntime`) so the roof-to-core phase change does not reset the 6s clock. The switch output window stays 4.8s. An adjacent turnout takes `TIEBAO_MOVE + TIEBAO_MOVE_EXTRA` (1.9s). A left↔right compound turnout takes twice that adjacent time (3.8s). Hard overload uses the same output and the same move rule. No telegraph and no lit rail. Attack intervals except 高射扇 use `TIEBAO_RATE_SCALE` (2/3). The ram stays off until loco+4 (main HP at or under 50%), then dashes once so the hull bottom reaches y=640 and retreats to that consist's rest center. Factory look A (铁皮高窗) and hull look A (尖头三节) are locked. The hull is a nose-up locomotive plus nine slender boxcars (the player chases from behind). One 80×840 sprite is cropped as cars shed: one rear car leaves at remaining main HP 90/80/70/60/50/40/30. The cut keeps the nose where it was, so the cars in front do not jump up into the gap. They hold for `TIEBAO_SHED_DELAY` (0.9s) while the player exhaust uses `TIEBAO_CHASE_FLAME`, then drop to that consist's locked rest pose over `TIEBAO_SHED_SLIDE` (0.4s) per car. Death, the slide-in, and Hard bar 2 snap to the end pose instead. At 30% and below the consist is loco+2, 80×280, nose at screen y=48. Easy and Medium are one bar to 0. Hard bar 2 is the overload on that loco+2 consist and does not shed. `parkY` is −260 (the 9-car encounter center, rear ~2.5 cars on screen); the end-form center is 188. Parked X is 72/180/288. A move pre-lays the turnout `TIEBAO_SWITCH_LEAD` (64px) above the nose, then the loco and each remaining car ride that same `tiebaoSwitchX` as a rigid rectangle: front and rear sample the rail, the body sits on the midpoint, and the bank is capped at `TIEBAO_CAR_MAX_BANK` (25°). Straight rails keep every car at the same X and angle 0. Shearing the long sprite into horizontal strips is obsolete. Adjacent span is `TIEBAO_SWITCH_SPAN` (240); L↔R is a longer compound turnout through the middle rail (`TIEBAO_SWITCH_CROSS_SPAN`, 480). The 1.2s move is unchanged — the lead is distance, not extra time. Map tiles stay three straight rails; those stock rails are never bent, broken, or covered by the closure. Points, the closure rail, and the frog are extra steel on `tiebaoClosureX` (the same curve as `tiebaoSwitchX`), with no highlight. Each laid turnout stays after the move, scrolls with `BossWorld.scroll`, and is removed only once it leaves the bottom of the screen. Several can be on screen together. A cancelled move still straightens the cars without incrementing the weapon, and it leaves the steel that was already laid. The switch ends only when the whole consist is on the new rail, then the weapon mode increments. Hit tests use one rigid box per car (`tiebaoHullSegments`). Muzzles stay on the path at each part's Y. Death or the overload gate settles a half-finished turnout onto the nearer rail, straightens that frame, and does not increment the weapon. The old end-of-move X snap is obsolete. B–E share the chassis for stills (`npm run art:tiebao`). Nose-row anchors, runtime offset `row − height/2`: core row 18, loco gun row 64, rear-car gun row 240 (end-form offsets `(0, −122)`, `(0, −76)`, `(0, 100)`). Optional `BossDef` fields (`script`, `title`, `subtitle`, `fightWarning`, `vulnerableEnter`, `hullTransfers`) stay unset on the stage-1 battleship. Hard overload is `gate: 'hard'` and `bar: 'extra'`, with `TIEBAO_*` constants; it does not reuse the battleship's phase-3 attacks
- **Difficulty**: `DIFFICULTY_PROFILES` (`difficulty.ts`): `hpScale`, `bulletSpeedScale`, `fireRateScale`, `bossGates`, optional `buildingDrops`. Boss phases with a `gate` run only when the profile opens it (Hard opens `hard` = phase 3)
- **Drops**: `BUILDING_DROP_RULES` in `systems/dropRules.ts` (first matching rule wins). Placement locks and exclusive groups are resolved there (`resolvePlacementDrops`, `chooseBuildingDrop`). A stage or a difficulty profile may replace the rule list; locks still win. Risk-crate kills call `chooseRiskCrateDrop` (mate 0 → M; else M/P/T 50/25/25; never B)
- **Building guns**: `BuildingSpec.fire` (`entities/building.ts`); barrel look and pivot in `BUILDING_BARRELS` (`art/buildingSprite.ts`)

### Recipes
- **New enemy**: add the id to `EnemyType` and a row to `ENEMY_DEFS`, then a sprite builder in `art/enemySprite.ts` `BUILDERS`. Use it from wave data with any `Fire`
- **New bullet pattern**: add a `Fire` kind plus a `FIRE_PRESETS` row, or use `{ kind: 'pattern', pattern }` inline in the wave
- **New boss**: write a `BossDef` in `levels/bosses/`, add its art builder to `BOSS_ART`, and point the stage's `boss` at it
- **New stage**: write `levels/stageN.ts` exporting a `StageData` with a new `id` and add it to `STAGES` in the registry. The 挑战 Boss picker lists it automatically. Tile art lives in `art/tiles.ts` (factory floor and rail tiles were added for `factoryBoss`)
- **New weapon**: a registry row in `systems/playerWeapons.ts` (see Weapons)
- **New play mode**: a `PlayMode` id and a `PLAY_MODE_RULES` row

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
- Deterministic replays: `scenes/battle.replay.test.ts` (gameplay digest) and `scenes/battle.render.test.ts` (draw-call digest) run seeded Stage 1 / boss practice / attract / weapon-test sessions. Their expected values are behavior: a refactor must leave them unchanged. Only a deliberate gameplay or visual change may recapture them (`REPLAY_CAPTURE=1`), and the PR must say so

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
- **Debug mode defaults off** (`debugMode`). It only shows the bottom-left FPS / input / `getDebugInfo` overlay. It does not enable keyboard shortcuts. There is no F1, F2, or F3. The title menu has no 「挑战 Boss」 button, and the settings page has no 「调试模式」 row. On the title scene, six taps inside a 48×48 hot zone at the top-right of the logical canvas within 2 seconds open a debug panel (the counter resets when the window expires; taps outside the zone do not count). The panel can start a boss-practice run, toggle `debugMode`, enter weapon-test mode, or open 地图预览. The attract demo keeps running behind the panel
- **Weapon test** (`playMode: 'weaponTest'`) reuses `createBattleScene`: same player, loadout, `stepFireClock` / `fireVolley`, collision, and input. Map scroll, the wave schedule, and enemy / building spawn stay off. The background is a solid colour. One fixed immortal target near the top only accumulates projectile damage, and homing missiles steer toward it. A left panel shows session damage, rolling 1-second DPS, main level, sub level (or none), mate level, and last hit. Top-right controls write the real loadout: main P (1–3) on `state.main`, sub T off (`state.sub = null`) or homing Lv1/Lv2, mate M (0–2) on `state.mate`, bombs B (0–3) on `state.bombs`. Under those, P速 / P伤 / T速 / T伤 step absolute volleys per second and damage per projectile for this session only. Defaults are those four constants (P速 5, P伤 2, T速 1.5, T伤 2.5). The four overrides must not mutate `WEAPONS` and must not apply in attract, stage, or boss practice. Reset clears the damage meter and puts the four values back on the constants; it does not change P/T/M levels or bomb stock. Leaving the mode does the same for the four values. The next enter starts M at 0 with the rest of the loadout. M is not stored in settings. Bomb stays one press of B, with no fire-rate row. Esc opens pause; 「返回标题」 returns to the title without a confirm dialog. Player death returns to the title and does not open the result or game-over scene and does not write a run report
- **Map preview (P12, list trimmed in P14, 百战要塞 added in P17)** (`playMode: 'mapPreview'`) is the debug panel's 「地图预览」 row. It opens the shared choice overlay (compact rows): one row per registered map (陆地A, 陆地B, 河流A, 百战要塞, 铁堡厂轨, 宇宙A), then 返回. There is no 「第N关全程」 row. Back and Esc return to the debug panel; the attract demo pauses while the list is open. The choice is written to `SceneContext.previewMap` (`map:<id>`) for that run only. The battle scene runs with `PLAY_MODE_RULES.mapPreview` (`scroll` on, `spawns` off, `track: 'preview'`, `leaveAtTrackEnd`): only the player ship, no waves, enemies, buildings, warning, or boss, no run report or high score. A finite tile map ends when its last row reaches the top of the screen. A map with `loopFrom` (百战要塞, 铁堡厂轨) plays the approach plus one extra pass of the loop, then ends. 宇宙A ends after `SPACE_A_PREVIEW_SECONDS`. Then the scene returns to the title. Pause 「返回标题」 leaves at once. Do not add scene-level `playMode` string checks; extend the rules table
- **Difficulty (P10.1)** is chosen on the title 「开始游戏」 overlay: 简单 / 中等 / 困难, plus 返回. Boot does not show this overlay. It is `SceneContext.difficulty` for that run, including retry, and is not persisted. Easy multiplies HP by `DIFFICULTY_HP_EASY` (1). Medium uses `DIFFICULTY_HP_MEDIUM` (1.15) and Hard `DIFFICULTY_HP_HARD` (1.3), via `scaleHp`, on every enemy, every building, and every boss part. Hard also arms boss phase 3. The attract demo pauses while the overlay is open and always fights on Easy numbers. Weapon test stays on Easy numbers.
- **Challenge Boss (P10.2)** stays on the debug panel. It opens the same overlay style twice: a stage-boss list (「1」 for 百战, 「2」 for 铁堡), then 「普通」 / 「困难」 / 返回 with no Medium. 普通 writes Easy, 困难 writes Hard. Both steps are required before `battleEntry = 'boss'`. Back from difficulty returns to the stage list; back from the stage list returns to the debug panel. Those two overlays pause the attract demo the same way the formal difficulty overlay does; the debug panel itself does not. The choice is run-only and is not stored in settings. The fight still skips early waves and keeps the P10.1 victory fly-off. `jumpTo` seeks the scroller. Stage 1 opens on the 百战要塞 approach already past the stitch, with the warning cloud band off, and keeps scrolling; it does not cut to 宇宙A. Stage 2 opens on the 铁堡厂轨 approach the same way (`TIEBAO_ENTER_AT` = 123, past the 陆地B stitch, warning clouds off).
- **Stage-clear exit** (`systems/victoryExit.ts`, `stepVictoryExit`) is the only fly-off. Every stage and every player ship share it: `stepBoss` calls it when `victoryExit` is set, and the exhaust boost is `VictoryExit.flame` (0–1), not a per-ship branch. `drawEngineFlame` / `drawPlayerFlames` / `drawFittedPlayerFlames` read that value, so wingmen and a later bomber or fighter on those draws flare with the player. After the boss death animation the ship ignores input through `wait` (`VICTORY_EXIT_WAIT`, 2s), `return` (smoothstep to `(LOGICAL_W / 2, PLAYER_SPAWN_Y)` over `VICTORY_RETURN_TIME`, 2s), `flame` (hold while the tail flame eases to full over `VICTORY_FLAME_TIME`, 0.85s; length × `1 + VICTORY_FLAME_BOOST`), then `flyoff` (starts at `VICTORY_FLYOFF_SPEED` 70 px/s, accel `VICTORY_FLYOFF_ACCEL` 220). The result screen opens only after the ship leaves. `releaseBossResult` sets `enterResult`. Full clear and boss practice use this same path
- **Hard boss phase 3 (P10.1, patterns swapped afterward)** is its own HP segment (`BOSS_PHASE3_HP`, then the Hard scale) after the turret → core fight. Easy and Medium never enter it. The core's 30000 points are paid when the last segment dies. The hull sprite stays the open phase-2 hull; the phase-3 core glow is yellow and code-drawn. Phase 2 (every difficulty) alternates the tuned spiral and an `aimed_fast3` volley every `BOSS_PHASE3_PATTERN_HOLD` (4 arms / 0.12s / 180 px/s, aimed 0.75s / 228 px/s) and does not fire the laser. Hard phase 3 plays the previous phase-2 ring, sweep laser, gap `aimed_fast3`, and half-HP enrage, on that extra segment. The Hard HP bar is two slots in one track: red for phases 1–2, yellow for phase 3, split by the HP ratio. The yellow slot stays full until phase 3 is the live target. Easy and Medium keep a single red bar.
- **The title shows the Stage 1 attract demo only after the title scene has entered.** Boot and any pre-title loading state must not create, update, or render that demo or a stage background; black plus the boot chrome is the whole frame. That chrome is the name 「电雷」 and the loading bar for `BOOT_DURATION` (1.5s): no start button, no difficulty overlay, and taps / confirm do nothing until the title scene. The shared attract is created in `title.enter`, and returning to the title starts it in that same enter (it stays stopped until then). The demo is the real battle scene (`playMode: 'attract'`): same stage data, entity classes, sprites, tiles, bullets, explosions, and config. Only the scripted input and the loop / death-fade / restart are demo-specific. Do not fork art, waves, or combat constants for the title. The demo player dies under the same collision and explosion rules; after that explosion the screen fades to black and the loop restarts. The demo stays silent and must not write the high score or settings. Title buttons stay clickable during the fade. Old saves may still contain `titleBackground`; drop that key on load

## Performance Targets

- Maintain **60fps** on mid-range mobile devices
- Enemy bullet cap: 150 (`ENEMY_BULLET_CAP`)
- Use spatial partitioning for collision detection if needed
- Profile on real devices, not just desktop
