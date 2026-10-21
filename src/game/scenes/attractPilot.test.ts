import { describe, expect, it } from 'vitest';
import { LOGICAL_H, LOGICAL_W, PLAYER_MARGIN, PLAYER_SPEED } from '@/game/config';
import {
  ATTRACT_ROUTE_COUNT,
  ATTRACT_ROUTES,
  pickAttractPlan,
  simulateAttractRoute,
  type PilotStep,
} from './attractPilot';

const DT = 1 / 60;
const SECONDS = 20;

function bounds(steps: PilotStep[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  maxSpeed: number;
  paused: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxSpeed = 0;
  let paused = 0;
  for (const step of steps) {
    minX = Math.min(minX, step.x);
    maxX = Math.max(maxX, step.x);
    minY = Math.min(minY, step.y);
    maxY = Math.max(maxY, step.y);
    maxSpeed = Math.max(maxSpeed, step.speed);
    if (step.speed < 8) paused++;
  }
  return { minX, maxX, minY, maxY, maxSpeed, paused };
}

describe('attract autopilot routes', () => {
  it('defines six distinct routes', () => {
    expect(ATTRACT_ROUTES).toHaveLength(6);
    expect(ATTRACT_ROUTE_COUNT).toBe(6);
    expect(new Set(ATTRACT_ROUTES.map((route) => route.id)).size).toBe(6);
    expect(new Set(ATTRACT_ROUTES.map((route) => route.name)).size).toBe(6);
    ATTRACT_ROUTES.forEach((route, index) => expect(route.id).toBe(index));

    const traces = ATTRACT_ROUTES.map((route) =>
      simulateAttractRoute(route.id, 1, 12, 1 / 30)
        .map((step) => `${step.x.toFixed(2)},${step.y.toFixed(2)}`)
        .join('|')
    );
    expect(new Set(traces).size).toBe(6);
  });

  it('stays in the play area, in the lower half, and within player speed', () => {
    for (const route of ATTRACT_ROUTES) {
      for (const seed of [1, 19, 88]) {
        const calm = simulateAttractRoute(route.id, seed, SECONDS, DT);
        const pressed = simulateAttractRoute(route.id, seed, SECONDS, DT, (time, player) => ({
          enemies: [{ x: 36 + ((time * 40) % 280), y: 90 }],
          bullets: [{ x: player.x - 12, y: player.y - 30, vx: 20, vy: 180 }],
        }));
        for (const steps of [calm, pressed]) {
          const box = bounds(steps);
          expect(box.minX).toBeGreaterThanOrEqual(PLAYER_MARGIN);
          expect(box.maxX).toBeLessThanOrEqual(LOGICAL_W - PLAYER_MARGIN);
          expect(box.minY).toBeGreaterThanOrEqual(LOGICAL_H / 2);
          expect(box.maxY).toBeLessThanOrEqual(LOGICAL_H - PLAYER_MARGIN);
          expect(box.minX).toBeGreaterThanOrEqual(40);
          expect(box.maxX).toBeLessThanOrEqual(LOGICAL_W - 40);
          expect(box.maxSpeed).toBeLessThanOrEqual(PLAYER_SPEED + 1e-4);
          expect(box.maxSpeed).toBeGreaterThan(12);
          expect(box.maxX - box.minX).toBeGreaterThan(18);
        }
        const calmBox = bounds(calm);
        expect(calmBox.paused).toBeGreaterThan(calm.length * 0.05);
      }
    }
  });

  it('is deterministic for a route and seed, and the seed changes the path', () => {
    const a = simulateAttractRoute(2, 7, 8, DT);
    const b = simulateAttractRoute(2, 7, 8, DT);
    const c = simulateAttractRoute(2, 8, 8, DT);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('drifts toward an enemy ahead and steps away from a closing bullet', () => {
    const empty = simulateAttractRoute(0, 1, 6, DT);
    const tracked = simulateAttractRoute(0, 1, 6, DT, () => ({
      enemies: [{ x: 300, y: 120 }],
      bullets: [],
    }));
    const dodged = simulateAttractRoute(0, 1, 4, DT, (_time, player) => ({
      enemies: [],
      bullets: [{ x: player.x - 8, y: player.y - 28, vx: 10, vy: 160 }],
    }));
    const meanX = (steps: PilotStep[]) =>
      steps.reduce((sum, step) => sum + step.x, 0) / steps.length;
    expect(meanX(tracked)).toBeGreaterThan(meanX(empty) + 8);
    expect(meanX(dodged)).toBeGreaterThan(meanX(empty.slice(0, dodged.length)) + 4);
  });

  it('selects every route, and a seeded stream covers more than one', () => {
    for (let i = 0; i < ATTRACT_ROUTE_COUNT; i++) {
      let n = 0;
      const plan = pickAttractPlan(() => {
        n += 1;
        return n === 1 ? (i + 0.1) / ATTRACT_ROUTE_COUNT : 0.25;
      });
      expect(plan.routeId).toBe(i);
    }

    let state = 1;
    const rng = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const seen = new Set<number>();
    for (let i = 0; i < 80; i++) seen.add(pickAttractPlan(rng).routeId);
    expect(seen.size).toBe(ATTRACT_ROUTE_COUNT);
  });
});
