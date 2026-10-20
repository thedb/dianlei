/**
 * H5/Browser platform adapter implementation
 */

import type { PlatformAdapter, SafeArea, TouchPoint } from './types';

export interface H5Platform extends PlatformAdapter {
  /** Set the canvas element for touch coordinate conversion */
  setCanvas(canvas: HTMLCanvasElement, scale: number): void;
}

export function createH5Platform(container: HTMLElement): H5Platform {
  let canvas: HTMLCanvasElement | null = null;
  let canvasScale = 1;

  const toTouchPoints = (touchList: TouchList): TouchPoint[] => {
    const points: TouchPoint[] = [];
    if (!canvas) return points;

    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < touchList.length; i++) {
      const t = touchList[i];
      if (t) {
        // Convert screen coordinates to logical coordinates
        points.push({
          id: t.identifier,
          x: (t.clientX - rect.left) / canvasScale,
          y: (t.clientY - rect.top) / canvasScale,
        });
      }
    }
    return points;
  };

  // Touch event handlers - will be registered once canvas is set
  let touchStartCallback: ((touches: TouchPoint[]) => void) | null = null;
  let touchMoveCallback: ((touches: TouchPoint[]) => void) | null = null;
  let touchEndCallback: ((touches: TouchPoint[]) => void) | null = null;
  let touchCancelCallback: ((touches: TouchPoint[]) => void) | null = null;

  function registerTouchHandlers(): void {
    if (!canvas) return;

    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        touchStartCallback?.(toTouchPoints(e.touches));
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        touchMoveCallback?.(toTouchPoints(e.touches));
      },
      { passive: false }
    );

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      touchEndCallback?.(toTouchPoints(e.touches));
    });

    canvas.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      touchCancelCallback?.(toTouchPoints(e.touches));
    });

    // Desktop: the mouse acts as one extra touch so menus/controls are clickable
    const MOUSE_ID = -1;
    let mouseDown = false;
    const mousePoint = (e: MouseEvent): TouchPoint[] => {
      const rect = canvas!.getBoundingClientRect();
      return [
        {
          id: MOUSE_ID,
          x: (e.clientX - rect.left) / canvasScale,
          y: (e.clientY - rect.top) / canvasScale,
        },
      ];
    };
    canvas.addEventListener('mousedown', (e) => {
      mouseDown = true;
      touchStartCallback?.(mousePoint(e));
    });
    window.addEventListener('mousemove', (e) => {
      if (mouseDown) touchMoveCallback?.(mousePoint(e));
    });
    window.addEventListener('mouseup', () => {
      if (!mouseDown) return;
      mouseDown = false;
      touchEndCallback?.([]);
    });
  }

  return {
    setCanvas(c: HTMLCanvasElement, scale: number): void {
      canvas = c;
      canvasScale = scale;
      registerTouchHandlers();
    },

    createCanvas(width: number, height: number): CanvasRenderingContext2D {
      // This method is kept for compatibility but renderer creates its own canvas
      const c = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;

      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      c.style.imageRendering = 'pixelated';
      c.style.touchAction = 'none';

      container.appendChild(c);
      canvas = c;
      canvasScale = 1;

      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Failed to get 2D context');

      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      registerTouchHandlers();
      return ctx;
    },

    createOffscreenCanvas(width: number, height: number): CanvasRenderingContext2D {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
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
      touchStartCallback = callback;
      // If canvas already exists, it's already registered
    },

    onTouchMove(callback: (touches: TouchPoint[]) => void): void {
      touchMoveCallback = callback;
    },

    onTouchEnd(callback: (touches: TouchPoint[]) => void): void {
      touchEndCallback = callback;
    },

    onTouchCancel(callback: (touches: TouchPoint[]) => void): void {
      touchCancelCallback = callback;
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
