const DISPOSABLE_CACHE_KEYS = [
  'fate_osrs_mapping_v1',
  'fate_osrs_prices_v1',
  'fate_osrs_monsters_v1',
  'fate_osrs_monsters_v2',
  'fate_osrs_gear_v1',
  'fate_uim_wiki_cache_v2',
  'fate_uim_wiki_cache_v3',
  'fate_clog_sync_v1',
  'fate_clog_sync_v2',
] as const;

export const isQuotaExceededError = (error: unknown): boolean =>
  error instanceof DOMException && (
    error.name === 'QuotaExceededError'
    || error.code === 22
    || error.code === 1014
  );

export const removeDisposableCaches = (
  storage: Pick<Storage, 'removeItem'>,
): void => {
  for (const key of DISPOSABLE_CACHE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      // Continue reclaiming any other cache keys that remain accessible.
    }
  }
};

export const profileMirrorMetadataKey = (storageKey: string): string =>
  `${storageKey}__mirrorMeta`;

export const profileCorruptArchiveKey = (storageKey: string): string =>
  `${storageKey}__corruptArchive`;
