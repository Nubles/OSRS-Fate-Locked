import migrations from '../data/clogIdMigrations.json' with { type: 'json' };

/** Preserve the checked-in page blocks; never recycle a retired save identity. */
export function createClogIdAllocator(liveIds) {
  const reserved = new Set([...liveIds, ...Object.keys(migrations).map(Number), ...Object.values(migrations)]);
  if ([...reserved].some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid collection-log identity');
  const blocks = new Set([...reserved].map(id => Math.floor(id / 1000) * 1000));
  return existingIds => {
    let base;
    if (existingIds.length) {
      base = Math.floor(existingIds[0] / 1000) * 1000;
      if (existingIds.some(id => !Number.isSafeInteger(id) || id <= 0 || Math.floor(id / 1000) * 1000 !== base)) {
        throw new Error('Collection-log page has invalid or mixed identity blocks');
      }
    } else {
      // Empty reviewed page stubs receive their own globally unused block.
      base = Math.max(0, ...blocks) + 1000;
      blocks.add(base);
    }
    let next = existingIds.length ? Math.max(...existingIds) + 1 : base + 1;
    return () => {
      while (reserved.has(next)) next++;
      if (next >= base + 1000 || !Number.isSafeInteger(next)) throw new Error('Collection-log page identity block exhausted');
      reserved.add(next);
      return next++;
    };
  };
}
