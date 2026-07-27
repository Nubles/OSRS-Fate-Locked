import { describe, it, expect } from 'vitest';
import { importWithRetry } from './lazyRetry';

const failNTimes = (n: number, value = 'ok') => {
  let calls = 0;
  const importer = () => {
    calls++;
    return calls <= n
      ? Promise.reject(new Error('Failed to fetch dynamically imported module'))
      : Promise.resolve(value);
  };
  return { importer, calls: () => calls };
};

describe('importWithRetry', () => {
  it('resolves immediately when the import succeeds', async () => {
    const { importer, calls } = failNTimes(0);
    await expect(importWithRetry(importer, 3, 1)).resolves.toBe('ok');
    expect(calls()).toBe(1);
  });

  it('retries through transient failures and resolves', async () => {
    const { importer, calls } = failNTimes(2);
    await expect(importWithRetry(importer, 3, 1)).resolves.toBe('ok');
    expect(calls()).toBe(3);
  });

  it('rejects with the last error once attempts are exhausted', async () => {
    const { importer, calls } = failNTimes(99);
    await expect(importWithRetry(importer, 3, 1)).rejects.toThrow(/dynamically imported module/);
    expect(calls()).toBe(3);
  });

  it('surfaces the first chunk-load error even when later retries fail differently', async () => {
    // Chrome caches a failed module: retrying the same URL rejects with a
    // mangled TypeError instead of the original fetch failure. The boundary
    // keys its reload path off isChunkLoadError, so that first error must win.
    let calls = 0;
    const importer = () => {
      calls++;
      return Promise.reject(
        calls === 1
          ? new Error('Failed to fetch dynamically imported module')
          : new TypeError("Cannot read properties of undefined (reading 'QuestLog')"),
      );
    };
    await expect(importWithRetry(importer, 3, 1)).rejects.toThrow(/dynamically imported module/);
    expect(calls).toBe(3);
  });
});
