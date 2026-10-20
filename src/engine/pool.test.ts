import { describe, it, expect } from 'vitest';
import { ObjectPool, type Poolable } from './pool';

class TestObject implements Poolable {
  active = false;
  value = 0;

  reset(): void {
    this.value = 0;
  }
}

describe('ObjectPool', () => {
  it('should acquire and release objects', () => {
    const pool = new ObjectPool(() => new TestObject());

    const obj1 = pool.acquire();
    expect(obj1.active).toBe(true);
    expect(pool.getActiveCount()).toBe(1);

    const obj2 = pool.acquire();
    expect(pool.getActiveCount()).toBe(2);

    pool.release(obj1);
    expect(obj1.active).toBe(false);
    expect(pool.getActiveCount()).toBe(1);

    pool.release(obj2);
    expect(pool.getActiveCount()).toBe(0);
  });

  it('should reuse released objects', () => {
    const pool = new ObjectPool(() => new TestObject());

    const obj1 = pool.acquire();
    obj1.value = 42;
    pool.release(obj1);

    const obj2 = pool.acquire();
    expect(obj2).toBe(obj1);
    expect(obj2.value).toBe(0); // reset() should have been called
  });

  it('should pre-allocate objects with initialSize', () => {
    const pool = new ObjectPool(() => new TestObject(), 10);
    expect(pool.getTotalSize()).toBe(10);
    expect(pool.getActiveCount()).toBe(0);
  });

  it('should iterate over active objects only', () => {
    const pool = new ObjectPool(() => new TestObject());

    const obj1 = pool.acquire();
    const obj2 = pool.acquire();
    pool.acquire();

    pool.release(obj2);

    const activeValues: number[] = [];
    pool.forEach((obj) => {
      obj.value = 1;
      activeValues.push(obj.value);
    });

    expect(activeValues).toHaveLength(2);
    expect(obj1.value).toBe(1);
    expect(obj2.value).toBe(0); // not iterated, but was reset on release check
  });

  it('should releaseAll objects', () => {
    const pool = new ObjectPool(() => new TestObject());

    pool.acquire();
    pool.acquire();
    pool.acquire();

    expect(pool.getActiveCount()).toBe(3);

    pool.releaseAll();
    expect(pool.getActiveCount()).toBe(0);
  });
});
