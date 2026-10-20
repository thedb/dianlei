/**
 * H5/Browser platform adapter implementation
 */

import type { PlatformAdapter, SafeArea, TouchPoint } from './types';

export function createH5Platform(container: HTMLElement): PlatformAdapter {
  let mainCanvas: HTMLCanvasElement | null = null;

  const toTouchPoints = (touchList: TouchList): TouchPoint[] => {
    const points: TouchPoint[] = [];
    for (let i = 0; i < touchList.length; i++) {
      const t = touchList[i];
      if (t && mainCanvas) {
        const rect = mainCanvas.getBoundingClientRect();
        points.push({
          id: t.identifier,
          x: t.clientX - rect.left,
          y: t.clientY - rect.top,
        });
      }
    }
    return points;
  };

  return {
    createCanvas(width: number, height: number): CanvasRenderingContext2D {
      const canvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.imageRendering = 'pixelated';
      canvas.style.touchAction = 'none';

      container.appendChild(canvas);
      mainCanvas = canvas;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');

      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      return ctx;
    },

    createOffscreenCanvas(width: number, height: number): CanvasRenderingContext2D {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create offscreen canvas');
      ctx.imageSmoothingEnabled = false;
      return ctx;
    },

    getDevicePixelRatio(): number {
      return window.devicePixelRatio || 1;
    },

    getScreenSize(): { width: number; height: number } {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },

    getSafeArea(): SafeArea {
      const style = getComputedStyle(document.documentElement);
      return {
        top: parseInt(style.getPropertyValue('--sat') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10),
        right: parseInt(style.getPropertyValue('--sar') || '0', 10),
      };
    },

    requestAnimationFrame(callback: (timestamp: number) => void): number {
      return window.requestAnimationFrame(callback);
    },

    cancelAnimationFrame(id: number): void {
      window.cancelAnimationFrame(id);
    },

    now(): number {
      return performance.now();
    },

    loadImage(url: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    },

    playAudio(_id: string): void {
      // Stub - audio not implemented in P0
    },

    getStorage<T>(key: string): T | null {
      try {
        const item = localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : null;
      } catch {
        return null;
      }
    },

    setStorage<T>(key: string, value: T): void {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore storage errors
      }
    },

    onTouchStart(callback: (touches: TouchPoint[]) => void): void {
      if (mainCanvas) {
        mainCanvas.addEventListener(
          'touchstart',
          (e) => {
            e.preventDefault();
            callback(toTouchPoints(e.touches));
          },
          { passive: false }
        );
      }
    },

    onTouchMove(callback: (touches: TouchPoint[]) => void): void {
      if (mainCanvas) {
        mainCanvas.addEventListener(
          'touchmove',
          (e) => {
            e.preventDefault();
            callback(toTouchPoints(e.touches));
          },
          { passive: false }
        );
      }
    },

    onTouchEnd(callback: (touches: TouchPoint[]) => void): void {
      if (mainCanvas) {
        mainCanvas.addEventListener('touchend', (e) => {
          e.preventDefault();
          callback(toTouchPoints(e.touches));
        });
      }
    },

    onTouchCancel(callback: (touches: TouchPoint[]) => void): void {
      if (mainCanvas) {
        mainCanvas.addEventListener('touchcancel', (e) => {
          e.preventDefault();
          callback(toTouchPoints(e.touches));
        });
      }
    },

    onKeyDown(callback: (key: string) => void): void {
      window.addEventListener('keydown', (e) => {
        callback(e.key);
      });
    },

    onKeyUp(callback: (key: string) => void): void {
      window.addEventListener('keyup', (e) => {
        callback(e.key);
      });
    },

    onVisibilityChange(callback: (visible: boolean) => void): void {
      document.addEventListener('visibilitychange', () => {
        callback(document.visibilityState === 'visible');
      });
    },
  };
}
