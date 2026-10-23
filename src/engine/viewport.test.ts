import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchViewport } from './viewport';

interface Listener {
  (ev?: unknown): void;
}

describe('watchViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function install() {
    const windowListeners = new Map<string, Listener>();
    let raf: Listener | null = null;
    const queries: string[] = [];
    const mediaListeners: Listener[] = [];
    let observed: unknown = null;
    let disconnected = false;
    let observerCallback: Listener | null = null;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: Listener) {
          observerCallback = cb;
        }
        observe(el: unknown): void {
          observed = el;
        }
        disconnect(): void {
          disconnected = true;
        }
      }
    );

    vi.stubGlobal('window', {
      addEventListener(type: string, fn: Listener): void {
        windowListeners.set(type, fn);
      },
      removeEventListener(type: string): void {
        windowListeners.delete(type);
      },
      requestAnimationFrame(fn: Listener): number {
        raf = fn;
        return 1;
      },
      matchMedia(query: string) {
        queries.push(query);
        return {
          addEventListener(_type: string, fn: Listener): void {
            mediaListeners.push(fn);
          },
          removeEventListener(_type: string, fn: Listener): void {
            const i = mediaListeners.indexOf(fn);
            if (i >= 0) mediaListeners.splice(i, 1);
          },
        };
      },
      devicePixelRatio: 2,
      innerWidth: 1024,
      innerHeight: 768,
    });

    return {
      windowListeners,
      queries,
      mediaListeners,
      get raf() {
        return raf;
      },
      get observed() {
        return observed;
      },
      get disconnected() {
        return disconnected;
      },
      fireObserver(): void {
        observerCallback?.();
      },
    };
  }

  it('reports resize, orientation, container size, and DPR changes', () => {
    const env = install();
    const container = { id: 'game' } as unknown as HTMLElement;
    let calls = 0;
    const stop = watchViewport(container, () => {
      calls += 1;
    });

    expect(env.observed).toBe(container);
    expect(env.queries).toEqual(['(resolution: 2dppx)']);

    env.windowListeners.get('resize')?.();
    expect(calls).toBe(1);

    env.windowListeners.get('orientationchange')?.();
    expect(calls).toBe(2);
    env.raf?.();
    expect(calls).toBe(3);

    env.fireObserver();
    expect(calls).toBe(4);

    const dprListener = env.mediaListeners[0];
    expect(dprListener).toBeTypeOf('function');
    dprListener?.();
    expect(calls).toBe(5);
    expect(env.queries).toEqual(['(resolution: 2dppx)', '(resolution: 2dppx)']);

    stop();
    expect(env.disconnected).toBe(true);
    expect(env.windowListeners.has('resize')).toBe(false);
    env.raf?.();
    expect(calls).toBe(5);
  });
});
