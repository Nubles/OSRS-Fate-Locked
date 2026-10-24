// @vitest-environment jsdom

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readNagRecord } from '../utils/backupNag';
import { PERSISTENT_STORAGE_EVENT } from '../utils/persistentStorage';
import { PersistentStorageDriver } from './PersistentStorageDriver';

const game = vi.hoisted(() => ({ history: [] as unknown[] }));
const profiles = vi.hoisted(() => ({ storageKeyForActiveProfile: 'FATE_PROFILE_a' }));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../context/ProfileContext', () => ({ useProfiles: () => profiles }));

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';

describe('PersistentStorageDriver', () => {
  let persist: ReturnType<typeof vi.fn>;
  let persisted: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    });
    persist = vi.fn(async () => true);
    persisted = vi.fn(async () => false);
    Object.defineProperty(window.navigator, 'storage', { configurable: true, value: { persist, persisted } });
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(CHROME);
    game.history = [];
    profiles.storageKeyForActiveProfile = 'FATE_PROFILE_a';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window.navigator as { storage?: unknown }).storage;
  });

  it('waits for the first History entry, then asks quietly once and announces a grant', async () => {
    const granted = vi.fn();
    window.addEventListener(PERSISTENT_STORAGE_EVENT, granted);
    const { rerender } = render(<PersistentStorageDriver />);
    expect(persist).not.toHaveBeenCalled();

    game.history = [{ id: 'roll-1' }];
    rerender(<PersistentStorageDriver />);
    await waitFor(() => expect(granted).toHaveBeenCalledOnce());
    expect(persist).toHaveBeenCalledOnce();
    expect(readNagRecord('FATE_PROFILE_a').persistRequestedAt).toEqual(expect.any(Number));

    game.history = [{ id: 'roll-1' }, { id: 'roll-2' }];
    rerender(<PersistentStorageDriver />);
    cleanup();
    render(<PersistentStorageDriver />);
    await Promise.resolve();
    expect(persist).toHaveBeenCalledOnce();
    window.removeEventListener(PERSISTENT_STORAGE_EVENT, granted);
  });

  it('asks again for another profile', async () => {
    game.history = [{ id: 'roll-1' }];
    const { rerender } = render(<PersistentStorageDriver />);
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    profiles.storageKeyForActiveProfile = 'FATE_PROFILE_b';
    rerender(<PersistentStorageDriver />);
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
  });

  it('never asks in Firefox, where persist() would show a permission prompt', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(FIREFOX);
    game.history = [{ id: 'roll-1' }];
    render(<PersistentStorageDriver />);
    await Promise.resolve();
    expect(persist).not.toHaveBeenCalled();
    expect(readNagRecord('FATE_PROFILE_a').persistRequestedAt).toBeUndefined();
  });

  it('survives a browser that rejects the request', async () => {
    persist.mockRejectedValue(new Error('SecurityError'));
    const granted = vi.fn();
    window.addEventListener(PERSISTENT_STORAGE_EVENT, granted);
    game.history = [{ id: 'roll-1' }];
    expect(() => render(<PersistentStorageDriver />)).not.toThrow();
    await waitFor(() => expect(persist).toHaveBeenCalledOnce());
    expect(granted).not.toHaveBeenCalled();
    window.removeEventListener(PERSISTENT_STORAGE_EVENT, granted);
  });
});
