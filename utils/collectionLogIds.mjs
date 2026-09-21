// Synthetic IDs are save identities, not positions within a page.
export const RETIRED_COLLECTION_IDS = [104011, 528089, 528090];
export const COLLECTION_TAB_IDS = { Bosses: 1, Raids: 2, Clues: 3, Minigames: 4, Other: 5 };

export function createCollectionIdAllocator(pages) {
  const used = new Set(RETIRED_COLLECTION_IDS);
  for (const page of pages) for (const item of page.items) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || used.has(item.id)) throw new Error(`Invalid, retired or duplicate collection-log ID: ${item.id}`);
    used.add(item.id);
  }
  const prefixes = new Set([...used].map(id => Math.floor(id / 1000) * 1000));
  return (tab, items) => {
    const tabId = COLLECTION_TAB_IDS[tab];
    if (!tabId) throw new Error(`Unknown collection-log tab: ${tab}`);
    let prefix = items.length ? Math.floor(items[0].id / 1000) * 1000 : tabId * 100000 + 1000;
    if (!items.length) {
      while (prefixes.has(prefix)) prefix += 1000;
      prefixes.add(prefix);
    }
    let next = Math.max(0, ...items.map(item => item.id).filter(id => Math.floor(id / 1000) * 1000 === prefix).map(id => id - prefix)) + 1;
    return () => {
      while (used.has(prefix + next)) next++;
      if (next >= 1000 || Math.floor(prefix / 100000) !== tabId) throw new Error(`Collection-log ID namespace exhausted for ${tab}`);
      const id = prefix + next++; used.add(id); return id;
    };
  };
}
