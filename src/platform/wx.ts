/**
 * WeChat Mini Game platform adapter implementation (stub)
 *
 * This is a minimal stub for P0. To run in WeChat DevTools:
 * 1. Run `npm run build:wx` to compile
 * 2. Open wx-shell/ in WeChat DevTools
 * 3. See README for detailed instructions
 */

import type { PlatformAdapter, SafeArea, TouchPoint } from './types';

declare const wx: {
  createCanvas: () => HTMLCanvasElement;
  createOffscreenCanvas: (options: { type: '2d'; width: number; height: number }) => {
    getContext: (type: '2d') => CanvasRenderingContext2D;
  };
  getWindowInfo: () => {
    pixelRatio: number;
    screenWidth: number;
    screenHeight: number;
    safeArea: { top: number; bottom: number; left: number; right: number };
  };
  getPerformance: () => { now: () => number };
  createImage: () => HTMLImageElement;
  setStorageSync: (key: string, value: string) => void;
  getStorageSync: (key: string) => string | undefined;
  onTouchStart: (callback: (res: { touches: TouchPoint[] }) => void) => void;
  onTouchMove: (callback: (res: { touches: TouchPoint[] }) => void) => void;
  onTouchEnd: (callback: (res: { touches: TouchPoint[] }) => void) => void;
  onTouchCancel: (callback: (res: { touches: TouchPoint[] }) => void) => void;
  onHide: (callback: () => void) => void;
  onShow: (callback: () => void) => void;
  onWindowResize?: (callback: () => void) => void;
  createWebAudioContext?: () => AudioContext;
};

export function createWxPlatform(): PlatformAdapter {
  let windowInfo = wx.getWindowInfo();
  wx.onWindowResize?.(() => {
    windowInfo = wx.getWindowInfo();
  });
  const perf = wx.getPerformance();

  return {
    createCanvas(width: number, height: number): CanvasRenderingContext2D {
      const canvas = wx.createCanvas();
      const dpr = windowInfo.pixelRatio;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      void canvas;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');

      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      return ctx;
    },

    createOffscreenCanvas(width: number, height: number): CanvasRenderingContext2D {
      const canvas = wx.createOffscreenCanvas({ type: '2d', width, height });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create offscreen canvas');
      ctx.imageSmoothingEnabled = false;
      return ctx;
    },

    getDevicePixelRatio(): number {
      return windowInfo.pixelRatio;
    },

    getScreenSize(): { width: number; height: number } {
      return {
        width: windowInfo.screenWidth,
        height: windowInfo.screenHeight,
      };
    },

    getSafeArea(): SafeArea {
      const sa = windowInfo.safeArea;
      return {
        top: sa.top,
        bottom: windowInfo.screenHeight - sa.bottom,
        left: sa.left,
        right: windowInfo.screenWidth - sa.right,
      };
    },

    requestAnimationFrame(callback: (timestamp: number) => void): number {
      return requestAnimationFrame(callback);
    },

    cancelAnimationFrame(id: number): void {
      cancelAnimationFrame(id);
    },

    now(): number {
      return perf.now();
    },

    loadImage(url: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const img = wx.createImage();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    },

    playAudio(_id: string): void {
      // One-shots go through the game audio system, not clip ids.
    },

    createAudioContext(): AudioContext | null {
      return typeof wx.createWebAudioContext === 'function' ? wx.createWebAudioContext() : null;
    },

    getStorage<T>(key: string): T | null {
      try {
        const item = wx.getStorageSync(key);
        return item ? (JSON.parse(item) as T) : null;
      } catch {
        return null;
      }
    },

    setStorage<T>(key: string, value: T): void {
      try {
        wx.setStorageSync(key, JSON.stringify(value));
      } catch {
        // Ignore storage errors
      }
    },

    onTouchStart(callback: (touches: TouchPoint[]) => void): void {
      wx.onTouchStart((res) => {
        callback(res.touches.map((t) => ({ id: t.id, x: t.x, y: t.y })));
      });
    },

    onTouchMove(callback: (touches: TouchPoint[]) => void): void {
      wx.onTouchMove((res) => {
        callback(res.touches.map((t) => ({ id: t.id, x: t.x, y: t.y })));
      });
    },

    onTouchEnd(callback: (touches: TouchPoint[]) => void): void {
      wx.onTouchEnd((res) => {
        callback(res.touches.map((t) => ({ id: t.id, x: t.x, y: t.y })));
      });
    },

    onTouchCancel(callback: (touches: TouchPoint[]) => void): void {
      wx.onTouchCancel((res) => {
        callback(res.touches.map((t) => ({ id: t.id, x: t.x, y: t.y })));
      });
    },

    onKeyDown(_callback: (key: string) => void): void {
      // No keyboard on WeChat mini games
    },

    onKeyUp(_callback: (key: string) => void): void {
      // No keyboard on WeChat mini games
    },

    onVisibilityChange(callback: (visible: boolean) => void): void {
      wx.onHide(() => callback(false));
      wx.onShow(() => callback(true));
    },
  };
}
