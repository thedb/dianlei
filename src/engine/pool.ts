/**
 * Generic object pool for reusable game objects
 * Avoids GC pressure during gameplay
 *
 * Free slots sit in a min-heap of indices, so `acquire` is O(log n) and always
 * hands out the lowest free slot. That keeps `forEach` order identical to a
 * front-to-back scan, which collision order and replays depend on.
 */

export interface Poolable {
  active: boolean;
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private readonly pool: T[] = [];
  private readonly slotOf = new Map<T, number>();
  private readonly factory: () => T;
  private readonly maxSize: number;
  private heap: number[] = [];
  private activeCount = 0;

  /** `maxSize` caps growth; `tryAcquire` returns null once every slot is live. */
  constructor(factory: () => T, initialSize = 0, maxSize = Infinity) {
    this.factory = factory;
    this.maxSize = maxSize;

    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      obj.active = false;
      this.slotOf.set(obj, i);
      this.pool.push(obj);
      this.heap.push(i);
    }
  }

  /** Acquire an object from the pool, growing it when every slot is live. */
  acquire(): T {
    return this.tryAcquire() ?? this.grow();
  }

  /** Like `acquire`, but returns null instead of growing past `maxSize`. */
  tryAcquire(): T | null {
    if (this.heap.length === 0) {
      return this.pool.length < this.maxSize ? this.grow() : null;
    }
    const obj = this.pool[this.popMin()]!;
    obj.active = true;
    obj.reset();
    this.activeCount++;
    return obj;
  }

  /** Release an object back to the pool */
  release(obj: T): void {
    if (!obj.active) return;
    obj.active = false;
    this.activeCount--;
    const slot = this.slotOf.get(obj);
    if (slot !== undefined) this.push(slot);
  }

  /** Release all active objects */
  releaseAll(): void {
    this.heap = [];
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i]!.active = false;
      this.heap.push(i);
    }
    this.activeCount = 0;
  }

  /** Iterate over all active objects */
  forEach(callback: (obj: T) => void): void {
    const pool = this.pool;
    for (let i = 0; i < pool.length; i++) {
      const obj = pool[i]!;
      if (obj.active) callback(obj);
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

  private grow(): T {
    const obj = this.factory();
    obj.active = true;
    obj.reset();
    this.slotOf.set(obj, this.pool.length);
    this.pool.push(obj);
    this.activeCount++;
    return obj;
  }

  private push(slot: number): void {
    const heap = this.heap;
    let i = heap.length;
    heap.push(slot);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent]! <= slot) break;
      heap[i] = heap[parent]!;
      i = parent;
    }
    heap[i] = slot;
  }

  private popMin(): number {
    const heap = this.heap;
    const min = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      let i = 0;
      const n = heap.length;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && heap[r]! < heap[l]! ? r : l;
        if (heap[c]! >= last) break;
        heap[i] = heap[c]!;
        i = c;
      }
      heap[i] = last;
    }
    return min;
  }
}
