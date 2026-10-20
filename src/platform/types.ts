/**
 * Platform adapter interface - abstracts platform-specific APIs
 * allowing the game core to run on H5 browsers and WeChat mini games
 */

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface PlatformAdapter {
  /** Create the main canvas and return its 2D context */
  createCanvas(width: number, height: number): CanvasRenderingContext2D;

  /** Create an offscreen canvas for sprite atlas generation */
  createOffscreenCanvas(width: number, height: number): CanvasRenderingContext2D;

  /** Get the device pixel ratio */
  getDevicePixelRatio(): number;

  /** Get screen dimensions (physical pixels) */
  getScreenSize(): { width: number; height: number };

  /** Get safe area insets */
  getSafeArea(): SafeArea;

  /** Request animation frame */
  requestAnimationFrame(callback: (timestamp: number) => void): number;

  /** Cancel animation frame */
  cancelAnimationFrame(id: number): void;

  /** Get current high-resolution time in milliseconds */
  now(): number;

  /** Load an image from a URL, returns a promise */
  loadImage(url: string): Promise<HTMLImageElement | ImageBitmap>;

  /** Play audio (stub for now) */
  playAudio(id: string): void;

  /** Read from local storage */
  getStorage<T>(key: string): T | null;

  /** Write to local storage */
  setStorage<T>(key: string, value: T): void;

  /** Register touch event handlers */
  onTouchStart(callback: (touches: TouchPoint[]) => void): void;
  onTouchMove(callback: (touches: TouchPoint[]) => void): void;
  onTouchEnd(callback: (touches: TouchPoint[]) => void): void;
  onTouchCancel(callback: (touches: TouchPoint[]) => void): void;

  /** Register keyboard event handlers (H5 only, no-op on WeChat) */
  onKeyDown(callback: (key: string) => void): void;
  onKeyUp(callback: (key: string) => void): void;

  /** Called when the app is backgrounded/foregrounded */
  onVisibilityChange(callback: (visible: boolean) => void): void;
}
