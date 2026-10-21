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
| Boss | ~220×140 |
| Player bullet | 4×12 |
| Enemy bullet (small) | 6×6 |
| Enemy bullet (large) | 12×12 |
| Missile | 6×12 |
| Items (P/B) | 16×18 |
| Tiles | 16×16 |

### Code-Generated Effects (NOT baked into sprites)
- Engine flames / exhaust (flicker below ships)
- Glow halos (player cyan glow, bullet glow)
- Hit flash (white tint overlay)
- Shield effects
- Particles

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
- Don't merge PRs — user reviews and merges

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
- Agents never merge — user reviews and merges

## Audio

### WebAudio Synthesis
- 8-bit style SFX and one looping BGM, both generated with WebAudio API. No binary music files
- Context comes from the platform adapter (`createAudioContext`: H5 `AudioContext`, WeChat `wx.createWebAudioContext`)
- BGM defaults **off**. The on/off switch and 0–100% volume slider live only on the settings page (title and pause), persisted with the other settings. The title and boot screens do not show them
- The mute toggle silences SFX and BGM
- Unlock audio context on first user interaction

## Performance Targets

- Maintain **60fps** on mid-range mobile devices
- Enemy bullet cap: 150 (`ENEMY_BULLET_CAP`)
- Use spatial partitioning for collision detection if needed
- Profile on real devices, not just desktop
