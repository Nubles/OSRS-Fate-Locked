// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePersistentStorage } from './usePersistentStorage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setStorageManager = (storage: unknown): void => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: storage,
  });
};

describe('usePersistentStorage', () => {
  beforeEach(() => {
    setStorageManager(undefined);
  });

  it('reports granted when the browser accepts the explicit request', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    setStorageManager({ persist });
    const hook = renderHook(() => usePersistentStorage());

    expect(hook.result.current.status).toBe('unknown');
    await act(async () => {
      await expect(hook.result.current.requestPersistence()).resolves.toBe('granted');
    });

    expect(hook.result.current.status).toBe('granted');
    expect(persist).toHaveBeenCalledOnce();
  });

  it('reports denied when the browser declines the explicit request', async () => {
    const persist = vi.fn().mockResolvedValue(false);
    setStorageManager({ persist });
    const hook = renderHook(() => usePersistentStorage());

    await act(async () => {
      await expect(hook.result.current.requestPersistence()).resolves.toBe('denied');
    });

    expect(hook.result.current.status).toBe('denied');
  });

  it('recognizes a previously granted browser decision without prompting again', async () => {
    const persisted = vi.fn().mockResolvedValue(true);
    setStorageManager({ persisted });
    const hook = renderHook(() => usePersistentStorage());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('granted');
  });

  it('reports unsupported without attempting a request when Storage Manager is absent', async () => {
    const hook = renderHook(() => usePersistentStorage());

    await act(async () => {
      await expect(hook.result.current.requestPersistence()).resolves.toBe('unsupported');
    });

    expect(hook.result.current.status).toBe('unsupported');
  });

  it('turns a SecurityError into a safe denied result', async () => {
    const persist = vi.fn().mockRejectedValue(new DOMException('blocked', 'SecurityError'));
    setStorageManager({ persist });
    const hook = renderHook(() => usePersistentStorage());

    await act(async () => {
      await expect(hook.result.current.requestPersistence()).resolves.toBe('denied');
    });

    expect(hook.result.current.status).toBe('denied');
  });

  it('does not automatically request persistence and coalesces repeated requests', async () => {
    let resolvePersist: ((result: boolean) => void) | undefined;
    const persist = vi.fn(() => new Promise<boolean>(resolve => {
      resolvePersist = resolve;
    }));
    setStorageManager({ persist });
    const hook = renderHook(() => usePersistentStorage());

    expect(persist).not.toHaveBeenCalled();
    let first!: Promise<string>;
    let second!: Promise<string>;
    act(() => {
      first = hook.result.current.requestPersistence();
      second = hook.result.current.requestPersistence();
    });
    expect(persist).toHaveBeenCalledOnce();

    await act(async () => {
      resolvePersist?.(true);
      await expect(first).resolves.toBe('granted');
      await expect(second).resolves.toBe('granted');
    });
    expect(hook.result.current.requestPersistentStorage).toBeTypeOf('function');
  });

  it('does not let a late status check overwrite an explicit denial', async () => {
    let resolvePersisted: ((result: boolean) => void) | undefined;
    const persisted = vi.fn(() => new Promise<boolean>(resolve => {
      resolvePersisted = resolve;
    }));
    const persist = vi.fn().mockResolvedValue(false);
    setStorageManager({ persist, persisted });
    const hook = renderHook(() => usePersistentStorage());

    await act(async () => {
      await expect(hook.result.current.requestPersistence()).resolves.toBe('denied');
    });
    await act(async () => {
      resolvePersisted?.(true);
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('denied');
  });
});
