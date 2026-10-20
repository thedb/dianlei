/**
 * Generic object pool for reusable game objects
 * Avoids GC pressure during gameplay
 */

export interface Poolable {
  active: boolean;
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private readonly pool: T[] = [];
  private readonly factory: () => T;
  private activeCount = 0;

  constructor(factory: () => T, initialSize = 0) {
    this.factory = factory;

    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      obj.active = false;
      this.pool.push(obj);
    }
  }

  /** Acquire an object from the pool */
  acquire(): T {
    for (const obj of this.pool) {
      if (!obj.active) {
        obj.active = true;
        obj.reset();
        this.activeCount++;
        return obj;
      }
    }

    const obj = this.factory();
    obj.active = true;
    obj.reset();
    this.pool.push(obj);
    this.activeCount++;
    return obj;
  }

  /** Release an object back to the pool */
  release(obj: T): void {
    if (obj.active) {
      obj.active = false;
      this.activeCount--;
    }
  }

  /** Release all active objects */
  releaseAll(): void {
    for (const obj of this.pool) {
      obj.active = false;
    }
    this.activeCount = 0;
  }

  /** Iterate over all active objects */
  forEach(callback: (obj: T) => void): void {
    for (const obj of this.pool) {
      if (obj.active) {
        callback(obj);
      }
    }
  }

  /** Filter active objects */
  filter(predicate: (obj: T) => boolean): T[] {
    return this.pool.filter((obj) => obj.active && predicate(obj));
  }

  /** Get count of active objects */
  getActiveCount(): number {
    return this.activeCount;
  }

  /** Get total pool size (active + inactive) */
  getTotalSize(): number {
    return this.pool.length;
  }
}
