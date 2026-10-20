/**
 * Test doubles for platform input and per-step input state
 */

import type { PlatformAdapter, TouchPoint } from '@/platform/types';
import type { InputState } from '@/engine/input';

type TouchCb = (touches: TouchPoint[]) => void;
type KeyCb = (key: string) => void;

export interface FakePlatform {
  platform: PlatformAdapter;
  touchStart(touches: TouchPoint[]): void;
  touchMove(touches: TouchPoint[]): void;
  touchEnd(remaining: TouchPoint[]): void;
  keyDown(key: string): void;
  keyUp(key: string): void;
  advance(ms: number): void;
}

export function createFakePlatform(): FakePlatform {
  const cb: {
    start?: TouchCb;
    move?: TouchCb;
    end?: TouchCb;
    keyDown?: KeyCb;
    keyUp?: KeyCb;
  } = {};
  let now = 0;
  const unused = (): never => {
    throw new Error('not used in tests');
  };

  const platform: PlatformAdapter = {
    createCanvas: unused,
    createOffscreenCanvas: unused,
    getDevicePixelRatio: () => 1,
    getScreenSize: () => ({ width: 360, height: 640 }),
    getSafeArea: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
    now: () => now,
    loadImage: unused,
    playAudio: () => undefined,
    getStorage: () => null,
    setStorage: () => undefined,
    onTouchStart: (c) => (cb.start = c),
    onTouchMove: (c) => (cb.move = c),
    onTouchEnd: (c) => (cb.end = c),
    onTouchCancel: () => undefined,
    onKeyDown: (c) => (cb.keyDown = c),
    onKeyUp: (c) => (cb.keyUp = c),
    onVisibilityChange: () => undefined,
  };

  return {
    platform,
    touchStart: (t) => cb.start?.(t),
    touchMove: (t) => cb.move?.(t),
    touchEnd: (t) => cb.end?.(t),
    keyDown: (k) => cb.keyDown?.(k),
    keyUp: (k) => cb.keyUp?.(k),
    advance: (ms) => (now += ms),
  };
}

export function makeInput(patch: Partial<InputState> = {}): InputState {
  return {
    joystickX: 0,
    joystickY: 0,
    joystickMagnitude: 0,
    buttonA: false,
    buttonB: false,
    keyUp: false,
    keyDown: false,
    keyLeft: false,
    keyRight: false,
    keyFire: false,
    keyBomb: false,
    pausePressed: false,
    menuUp: false,
    menuDown: false,
    menuLeft: false,
    menuRight: false,
    menuConfirm: false,
    menuBack: false,
    taps: [],
    pointers: [],
    ...patch,
  };
}
