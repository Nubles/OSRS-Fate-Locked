import { describe, expect, it } from 'vitest';
import {
  isQuotaExceededError,
  profileCorruptArchiveKey,
  profileMirrorMetadataKey,
  removeDisposableCaches,
} from './storageRecovery';

describe('storage recovery helpers', () => {
  it('removes only enumerated disposable caches', () => {
    const removed: string[] = [];

    removeDisposableCaches({ removeItem: (key) => removed.push(key) });

    expect(removed).toEqual(expect.arrayContaining([
      'fate_osrs_mapping_v1',
      'fate_osrs_prices_v1',
      'fate_uim_wiki_cache_v3',
    ]));
    expect(removed.some((key) => key.startsWith('FATE_PROFILE_'))).toBe(false);
  });

  it('continues removing caches when one cache cannot be removed', () => {
    const removed: string[] = [];

    removeDisposableCaches({
      removeItem: (key) => {
        removed.push(key);
        if (key === 'fate_osrs_prices_v1') throw new Error('storage unavailable');
      },
    });

    expect(removed).toEqual(expect.arrayContaining([
      'fate_osrs_mapping_v1',
      'fate_osrs_monsters_v1',
      'fate_clog_sync_v2',
    ]));
  });

  it('classifies quota errors without treating ordinary errors as quota', () => {
    expect(isQuotaExceededError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaExceededError(new DOMException('blocked', 'SecurityError'))).toBe(false);
    expect(isQuotaExceededError(new Error('quota exceeded'))).toBe(false);
  });

  it('builds profile-owned recovery sidecar keys from the durable key', () => {
    expect(profileMirrorMetadataKey('FATE_PROFILE_alpha')).toBe(
      'FATE_PROFILE_alpha__mirrorMeta',
    );
    expect(profileCorruptArchiveKey('FATE_PROFILE_alpha')).toBe(
      'FATE_PROFILE_alpha__corruptArchive',
    );
  });
});
