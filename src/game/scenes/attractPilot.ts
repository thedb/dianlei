/**
 * Title-demo autopilot.
 * Six behavior-parameter routes. Motion is generated from the route plus a
 * seed, so the same pair always yields the same stick. The battle scene still
 * integrates that stick with the real player controller.
 */

import { LOGICAL_H, LOGICAL_W, PLAYER_MARGIN, PLAYER_SPEED, PLAYER_SPAWN_Y } from '@/game/config';

export interface AttractRoute {
  id: number;
  name: string;
  /** Cruise height in logical pixels. Larger Y sits lower on the screen. */
  cruiseY: number;
  centerX: number;
  /** Strafe half-width, pixels. */
  amplitude: number;
  /** Full left-hold, cross, right-hold, cross cycle, seconds. */
  period: number;
  /** Standstill at each end of the strafe, seconds. */
  hold: number;
  /** Gentle vertical wander, pixels. */
  bob: number;
  bobPeriod: number;
  /** 0–1 blend from the cruise X toward an enemy ahead. */
  track: number;
  /** Largest sideways step away from a closing bullet, pixels. */
  dodge: number;
  /** Stick cap as a fraction of PLAYER_SPEED. */
  maxStick: number;
  /** Cycle offset in seconds, before the seed slides it. */
  phase: number;
}

/**
 * Shared steering limits. Kept with the routes so the demo has one data source.
 * The ship cruises in the lower half and does not ride the screen edge.
 */
const STEER = {
  insetX: 52,
  /** Dodge targets stay off the side edges so the next slide still has room. */
  comfortX: 76,
  yMin: 400,
  yMax: LOGICAL_H - 52,
  arrive: 5,
  tau: 0.3,
  /** How far ahead a bullet's path is checked, seconds. */
  bulletLook: 0.85,
  /** A path that stays outside this radius is left alone. */
  bulletMiss: 28,
  holdCatchX: 16,
  holdCatchY: 40,
  /** Line up on enemies only while they are still this far above the ship. */
  trackLead: 160,
  /** Peel off a ship that has closed inside this vertical gap. */
  bodyRadius: 150,
  /** Center-to-center gap kept from a ship or a bullet that would hit. */
  clearGap: 72,
} as const;

export const ATTRACT_ROUTES: readonly AttractRoute[] = [
  {
    id: 0,
    name: 'center',
    cruiseY: 508,
    centerX: 180,
    amplitude: 64,
    period: 5.2,
    hold: 0.55,
    bob: 12,
    bobPeriod: 3.6,
    track: 0.34,
    dodge: 26,
    maxStick: 0.42,
    phase: 0.2,
  },
  {
    id: 1,
    name: 'left',
    cruiseY: 536,
    centerX: 118,
    amplitude: 40,
    period: 6.0,
    hold: 0.8,
    bob: 8,
    bobPeriod: 4.2,
    track: 0.22,
    dodge: 22,
    maxStick: 0.4,
    phase: 1.4,
  },
  {
    id: 2,
    name: 'right',
    cruiseY: 524,
    centerX: 242,
    amplitude: 40,
    period: 5.5,
    hold: 0.65,
    bob: 10,
    bobPeriod: 3.8,
    track: 0.28,
    dodge: 22,
    maxStick: 0.36,
    phase: 0.6,
  },
  {
    id: 3,
    name: 'low',
    cruiseY: 568,
    centerX: 180,
    amplitude: 28,
    period: 6.8,
    hold: 1.0,
    bob: 6,
    bobPeriod: 4.8,
    track: 0.48,
    dodge: 22,
    maxStick: 0.4,
    phase: 2.2,
  },
  {
    id: 4,
    name: 'high',
    cruiseY: 424,
    centerX: 168,
    amplitude: 72,
    period: 6.2,
    hold: 0.4,
    bob: 14,
    bobPeriod: 3.4,
    track: 0.26,
    dodge: 24,
    maxStick: 0.4,
    phase: 0.9,
  },
  {
    id: 5,
    name: 'reader',
    cruiseY: 488,
    centerX: 200,
    amplitude: 52,
    period: 4.4,
    hold: 0.45,
    bob: 11,
    bobPeriod: 3.1,
    track: 0.4,
    dodge: 34,
    maxStick: 0.48,
    phase: 1.7,
  },
];

export const ATTRACT_ROUTE_COUNT = ATTRACT_ROUTES.length;

export interface AttractPlan {
  routeId: number;
  seed: number;
}

export interface PilotPoint {
  x: number;
  y: number;
}

export interface PilotBullet extends PilotPoint {
  vx: number;
  vy: number;
}

export interface PilotWorld {
  player: PilotPoint;
  enemies: readonly PilotPoint[];
  bullets: readonly PilotBullet[];
}

export interface PilotStep extends PilotPoint {
  /** Commanded speed after the stick is applied, pixels/second. */
  speed: number;
}

export interface AttractStick {
  joystickX: number;
  joystickY: number;
  joystickMagnitude: number;
}

const SPAWN: PilotPoint = { x: LOGICAL_W / 2, y: PLAYER_SPAWN_Y };

export function attractRoute(routeId: number): AttractRoute {
  const index = Math.max(0, Math.min(ATTRACT_ROUTES.length - 1, Math.floor(routeId)));
  const route = ATTRACT_ROUTES[index];
  if (!route) throw new Error('attract routes are empty');
  return route;
}

/** Two draws: route index, then seed. `rng` returns [0, 1). */
export function pickAttractPlan(rng: () => number = Math.random): AttractPlan {
  const raw = rng();
  const routeId = Math.min(
    ATTRACT_ROUTES.length - 1,
    Math.max(0, Math.floor(raw * ATTRACT_ROUTES.length))
  );
  const seed = Math.floor(rng() * 1_000_003) % 1_000_003;
  return { routeId, seed };
}

/**
 * Stick for one battle step.
 * Axes are a unit vector. `joystickMagnitude` is the fraction of PLAYER_SPEED,
 * which is how `updatePlayerControl` reads keyboard input.
 */
export function attractStick(plan: AttractPlan, time: number, world: PilotWorld): AttractStick {
  const route = attractRoute(plan.routeId);
  const target = aimPoint(route, plan.seed, time, world);
  const dx = target.x - world.player.x;
  const dy = target.y - world.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < STEER.arrive) {
    return { joystickX: 0, joystickY: 0, joystickMagnitude: 0 };
  }
  const speed = Math.min(PLAYER_SPEED * route.maxStick, dist / STEER.tau);
  return {
    joystickX: dx / dist,
    joystickY: dy / dist,
    joystickMagnitude: speed / PLAYER_SPEED,
  };
}

/**
 * Integrate the stick the way the battle scene does, including the play-area clamp.
 * `worldAt` may omit the player; the sampler supplies the simulated ship.
 */
export function simulateAttractRoute(
  routeId: number,
  seed: number,
  seconds: number,
  dt: number,
  worldAt: (
    time: number,
    player: PilotPoint
  ) => { enemies: readonly PilotPoint[]; bullets: readonly PilotBullet[] } = () => ({
    enemies: [],
    bullets: [],
  })
): PilotStep[] {
  const plan: AttractPlan = { routeId, seed };
  const steps = Math.max(0, Math.ceil(seconds / dt));
  const out: PilotStep[] = [];
  let player: PilotPoint = { ...SPAWN };
  for (let i = 0; i < steps; i++) {
    const time = i * dt;
    const threats = worldAt(time, player);
    const stick = attractStick(plan, time, { player, ...threats });
    const speed = PLAYER_SPEED * stick.joystickMagnitude;
    const vx = stick.joystickX * speed;
    const vy = stick.joystickY * speed;
    player = {
      x: clamp(player.x + vx * dt, PLAYER_MARGIN, LOGICAL_W - PLAYER_MARGIN),
      y: clamp(player.y + vy * dt, PLAYER_MARGIN, LOGICAL_H - PLAYER_MARGIN),
    };
    out.push({ x: player.x, y: player.y, speed: Math.hypot(vx, vy) });
  }
  return out;
}

function aimPoint(route: AttractRoute, seed: number, time: number, world: PilotWorld): PilotPoint {
  const band = strafe(route, time, seed);
  let x = clamp(route.centerX + band.offset, STEER.insetX, LOGICAL_W - STEER.insetX);
  const bob = Math.sin(((time + route.phase) / route.bobPeriod) * Math.PI * 2) * route.bob;
  let y = clamp(route.cruiseY + bob, STEER.yMin, STEER.yMax);

  x = trackX(x, world.player.y, world.enemies, route.track);
  if (
    band.holding &&
    Math.abs(x - world.player.x) < STEER.holdCatchX &&
    Math.abs(y - world.player.y) < STEER.holdCatchY
  ) {
    y = world.player.y;
  }
  x = avoidShips(x, world.player, world.enemies);
  const dodged = avoidBullets(x, y, world.player, world.bullets, route.dodge);
  return {
    x: clamp(dodged.x, STEER.insetX, LOGICAL_W - STEER.insetX),
    y: clamp(dodged.y, STEER.yMin, STEER.yMax),
  };
}

function strafe(
  route: AttractRoute,
  time: number,
  seed: number
): { offset: number; holding: boolean } {
  const period = route.period;
  const hold = Math.min(route.hold, period * 0.4);
  const move = (period - hold * 2) / 2;
  const phase = route.phase + hash01(seed + route.id * 17 + 3) * period;
  let t = (time + phase) % period;
  if (t < 0) t += period;
  if (move <= 0) return { offset: 0, holding: true };

  if (t < hold) return { offset: -route.amplitude, holding: true };
  if (t < hold + move) {
    const u = (t - hold) / move;
    return { offset: -route.amplitude + 2 * route.amplitude * smoothstep(u), holding: false };
  }
  if (t < hold * 2 + move) return { offset: route.amplitude, holding: true };
  const u = (t - hold * 2 - move) / move;
  return { offset: route.amplitude - 2 * route.amplitude * smoothstep(u), holding: false };
}

/** Pull X partway toward the enemy ahead that is already nearest the cruise lane. */
function trackX(
  baseX: number,
  playerY: number,
  enemies: readonly PilotPoint[],
  track: number
): number {
  if (track <= 0 || enemies.length === 0) return baseX;
  let best: PilotPoint | null = null;
  let bestScore = Infinity;
  for (const enemy of enemies) {
    if (enemy.y > playerY - STEER.trackLead || enemy.y < -20) continue;
    const score = Math.abs(enemy.x - baseX) + enemy.y * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  if (!best) return baseX;
  return baseX + (best.x - baseX) * track;
}

/**
 * If the route aim or the ship sits on a bullet path, step to a point that
 * clears every close shot. A safe route aim is left alone, so stray bullets
 * do not tug the strafe back and forth.
 */
function avoidBullets(
  x: number,
  y: number,
  player: PilotPoint,
  bullets: readonly PilotBullet[],
  dodge: number
): PilotPoint {
  if (dodge <= 0 || bullets.length === 0) return { x, y };
  const threats: PilotBullet[] = [];
  for (const bullet of bullets) {
    const atShip = pathMiss(player.x, player.y, bullet, STEER.bulletLook);
    const atAim = pathMiss(x, y, bullet, STEER.bulletLook);
    if (atShip < STEER.bulletMiss || atAim < STEER.bulletMiss) threats.push(bullet);
  }
  if (threats.length === 0) return { x, y };

  const gap = Math.max(dodge, 64);
  const raw = [
    { x, y },
    { x: player.x - gap, y: player.y },
    { x: player.x + gap, y: player.y },
    { x: player.x - gap * 0.5, y: player.y },
    { x: player.x + gap * 0.5, y: player.y },
    { x: player.x, y: player.y + gap * 0.55 },
    { x: player.x, y: player.y - gap * 0.4 },
    { x: x - gap, y },
    { x: x + gap, y },
  ];
  let best = { x, y };
  let bestMiss = clearance(x, y, threats);
  for (const option of raw) {
    const cand = {
      x: clamp(option.x, STEER.comfortX, LOGICAL_W - STEER.comfortX),
      y: clamp(option.y, STEER.yMin, STEER.yMax),
    };
    const miss = clearance(cand.x, cand.y, threats);
    const nearerRoute = Math.abs(cand.x - x) < Math.abs(best.x - x) - 8;
    if (miss > bestMiss + 6 || (miss > bestMiss && nearerRoute)) {
      best = cand;
      bestMiss = miss;
    }
  }
  return best;
}

function clearance(x: number, y: number, bullets: readonly PilotBullet[]): number {
  let miss = Infinity;
  for (const bullet of bullets) {
    miss = Math.min(miss, pathMiss(x, y, bullet, STEER.bulletLook));
  }
  return miss;
}

/** Closest the bullet comes to a point during `look` seconds. */
function pathMiss(x: number, y: number, bullet: PilotBullet, look: number): number {
  const steps = 7;
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = (look * i) / steps;
    const bx = bullet.x + bullet.vx * t;
    const by = bullet.y + bullet.vy * t;
    const dist = Math.hypot(bx - x, by - y);
    if (dist < best) best = dist;
  }
  return best;
}

/** Keep the aim point off a ship that is about to cross the cruise lane. */
function avoidShips(x: number, player: PilotPoint, enemies: readonly PilotPoint[]): number {
  if (enemies.length === 0) return x;
  let threat: PilotPoint | null = null;
  let bestDy: number = STEER.bodyRadius;
  for (const enemy of enemies) {
    const dy = player.y - enemy.y;
    if (dy < -28 || dy > STEER.bodyRadius) continue;
    const onLane = Math.min(Math.abs(x - enemy.x), Math.abs(player.x - enemy.x));
    if (onLane > STEER.clearGap) continue;
    if (dy < bestDy) {
      bestDy = dy;
      threat = enemy;
    }
  }
  if (!threat) return x;
  return slideClear(x, player, threat.x, STEER.clearGap, bestDy, STEER.bodyRadius);
}

/** Move the aim to one side of `hazardX`. A full commit, so the strafe cannot cancel it. */
function slideClear(
  x: number,
  player: PilotPoint,
  hazardX: number,
  gap: number,
  dist: number,
  window: number
): number {
  const roomRight = LOGICAL_W - STEER.insetX - hazardX;
  const roomLeft = hazardX - STEER.insetX;
  const goRight = Math.abs(player.x - hazardX) < 8 ? roomRight >= roomLeft : player.x >= hazardX;
  const cleared = clamp(
    goRight ? hazardX + gap : hazardX - gap,
    STEER.insetX,
    LOGICAL_W - STEER.insetX
  );
  const closeness = 1 - Math.max(0, Math.min(1, dist / window));
  const weight = 0.7 + 0.3 * closeness;
  return clamp(x + (cleared - x) * weight, STEER.insetX, LOGICAL_W - STEER.insetX);
}

function smoothstep(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

function hash01(n: number): number {
  let x = Math.imul(n | 0, 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
