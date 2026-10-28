import { describe, expect, it } from 'vitest';
import { PLAYER_SPRITE_H } from '@/game/art/playerSprite';
import {
  CARRIER_LIGHT_COUNT,
  CARRIER_LIGHT_STEP,
  CARRIER_LIGHTS_TIME,
  CARRIER_PARK_Y,
  CARRIER_RELEASE_Y,
  CARRIER_RUSH_TIME,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_SPAWN_Y,
} from '@/game/config';
import {
  beginCarrierTakeoff,
  carrierBlocksInput,
  carrierExhaustBoost,
  carrierHoldsClock,
  carrierLightsLit,
  carrierTakeoffApplies,
  createCarrierTakeoff,
  stepCarrierTakeoff,
  type TakeoffShip,
} from './carrierTakeoff';

const DT = 1 / 60;

function ship(y = 0): TakeoffShip {
  return {
    x: 0,
    y,
    prevX: 0,
    prevY: y,
    bank: 1,
    targetBank: 1,
    lastBankFrame: 10,
    velocityY: 1,
  };
}

describe('carrier takeoff', () => {
  it('adds 2s on the rush and releases twice as far, still on screen', () => {
    expect(CARRIER_LIGHTS_TIME).toBeCloseTo(3, 5);
    expect(CARRIER_RUSH_TIME).toBeCloseTo(3.2, 5);
    expect(CARRIER_LIGHTS_TIME + CARRIER_RUSH_TIME).toBeCloseTo(6.2, 5);
    expect(CARRIER_LIGHT_COUNT * CARRIER_LIGHT_STEP).toBeLessThan(CARRIER_LIGHTS_TIME);
    expect(CARRIER_PARK_Y - CARRIER_RELEASE_Y).toBe(384);
    expect(CARRIER_RELEASE_Y).toBe(224);
    expect(CARRIER_RELEASE_Y - PLAYER_SPRITE_H / 2).toBeGreaterThan(32);
    expect(CARRIER_RELEASE_Y).toBeLessThan(PLAYER_SPAWN_Y);
    expect(CARRIER_PARK_Y + PLAYER_SPRITE_H / 2).toBeLessThan(LOGICAL_H);
  });

  it('lights five lamps from the top, then holds them', () => {
    expect(carrierLightsLit(0)).toBe(0);
    expect(carrierLightsLit(CARRIER_LIGHT_STEP - 0.01)).toBe(0);
    expect(carrierLightsLit(CARRIER_LIGHT_STEP)).toBe(1);
    expect(carrierLightsLit(CARRIER_LIGHT_COUNT * CARRIER_LIGHT_STEP)).toBe(CARRIER_LIGHT_COUNT);
    expect(carrierLightsLit(CARRIER_LIGHTS_TIME)).toBe(CARRIER_LIGHT_COUNT);
  });

  it('arms only a stage-start run of stage 4', () => {
    const play = { hud: 'stage', spawns: true };
    expect(carrierTakeoffApplies('4', 'stage', play)).toBe(true);
    expect(carrierTakeoffApplies('4', 'boss', play)).toBe(false);
    expect(carrierTakeoffApplies('3', 'stage', play)).toBe(false);
    expect(carrierTakeoffApplies('4', 'stage', { hud: 'preview', spawns: false })).toBe(false);
    expect(carrierTakeoffApplies('4', 'stage', { hud: 'range', spawns: false })).toBe(false);
    expect(carrierTakeoffApplies('4', 'stage', { hud: 'none', spawns: true })).toBe(false);
  });

  it('parks on the deck, ramps the flame, then hands over at the release height', () => {
    const takeoff = createCarrierTakeoff();
    const player = ship(LOGICAL_H + 40);
    const flying = { isFlying: true };
    beginCarrierTakeoff(takeoff, player, flying, true);
    expect(takeoff.phase).toBe('lights');
    expect(flying.isFlying).toBe(false);
    expect(player.x).toBe(LOGICAL_W / 2);
    expect(player.y).toBe(CARRIER_PARK_Y);
    expect(player.y).toBeLessThan(LOGICAL_H);
    expect(player.bank).toBe(0);
    expect(carrierHoldsClock(takeoff.phase)).toBe(true);
    expect(carrierBlocksInput(takeoff.phase)).toBe(true);
    expect(carrierExhaustBoost(takeoff)).toBeNull();

    const cold = ship(10);
    beginCarrierTakeoff(createCarrierTakeoff(), cold, { isFlying: true }, false);
    expect(cold.y).toBe(10);

    while (takeoff.phase === 'lights') stepCarrierTakeoff(takeoff, player, DT);
    expect(takeoff.phase).toBe('rush');
    expect(player.y).toBe(CARRIER_PARK_Y);
    expect(carrierHoldsClock(takeoff.phase)).toBe(false);
    expect(carrierBlocksInput(takeoff.phase)).toBe(true);

    stepCarrierTakeoff(takeoff, player, DT);
    expect(takeoff.flame).toBeGreaterThan(0);
    expect(takeoff.flame).toBeLessThan(0.05);
    expect(player.y).toBeLessThan(CARRIER_PARK_Y);
    expect(player.y).toBeGreaterThan(CARRIER_PARK_Y - 1);
    expect(player.velocityY).toBeLessThan(0);
    expect(carrierExhaustBoost(takeoff)).toBe(takeoff.flame);

    const half = Math.round(CARRIER_RUSH_TIME / 2 / DT) - 1;
    for (let i = 0; i < half; i++) stepCarrierTakeoff(takeoff, player, DT);
    const midTravel = CARRIER_PARK_Y - player.y;
    const fullTravel = CARRIER_PARK_Y - CARRIER_RELEASE_Y;
    expect(midTravel / fullTravel).toBeLessThan(0.2);
    expect(takeoff.flame).toBeLessThan(0.4);
    expect(takeoff.flame).toBeGreaterThan(midTravel / fullTravel + 0.05);
    const midFlame = takeoff.flame;

    const late = Math.round((CARRIER_RUSH_TIME * 0.85) / DT) - half - 1;
    for (let i = 0; i < late; i++) stepCarrierTakeoff(takeoff, player, DT);
    expect(takeoff.phase).toBe('rush');
    expect(takeoff.flame).toBeGreaterThan(midFlame);
    expect(takeoff.flame).toBeGreaterThan(0.6);
    expect(CARRIER_PARK_Y - player.y).toBeGreaterThan(midTravel * 3);

    while (takeoff.phase === 'rush') stepCarrierTakeoff(takeoff, player, DT);
    expect(takeoff.phase).toBe('done');
    expect(player.y).toBe(CARRIER_RELEASE_Y);
    expect(player.x).toBe(LOGICAL_W / 2);
    expect(carrierBlocksInput(takeoff.phase)).toBe(false);
    expect(carrierHoldsClock(takeoff.phase)).toBe(false);
    expect(carrierExhaustBoost(takeoff)).toBe(0);
    expect(player.velocityY).toBe(0);
  });
});
