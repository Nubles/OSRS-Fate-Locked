import { COLLECTION_LOG_DATA } from './collectionLogData';

// The game tracks a log slot by the item, not the page, so one item fills
// every page that lists it (OSRS Wiki, "Collection log"). Entries with the
// same name on different pages are that one item. A name used more than once
// on one page (My Notes, Hallowed Sepulchre) names distinct items: never grouped.
let groups: Map<number, readonly number[]> | undefined;

/** Every collection log id of the item `id` names (just `[id]` when it is on one page). */
export function sharedSlotIds(id: number): readonly number[] {
  if (!groups) {
    groups = new Map();
    const byName = new Map<string, { ids: number[]; pages: Set<string>; repeat?: true }>();
    for (const [tab, { pages }] of Object.entries(COLLECTION_LOG_DATA)) for (const [page, { items }] of Object.entries(pages)) for (const item of items) {
      const key = item.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
      const group = byName.get(key) ?? { ids: [], pages: new Set<string>() };
      if (group.pages.has(tab + '/' + page)) group.repeat = true;
      group.pages.add(tab + '/' + page);
      group.ids.push(item.id);
      byName.set(key, group);
    }
    for (const { ids, repeat } of byName.values()) if (ids.length > 1 && !repeat) for (const i of ids) groups.set(i, ids);
  }
  return groups.get(id) ?? [id];
}

/** How many of the item the log holds, read across every page that lists it. Ids held for identity review count 0. */
export function sharedSlotCount(log: Readonly<Record<number, number>>, id: number, blocked?: ReadonlySet<number>): number {
  let count = 0;
  if (!blocked?.has(id)) for (const i of sharedSlotIds(id)) if (!blocked?.has(i)) count = Math.max(count, log[i] || 0);
  return count;
}

/** The log as its pages show it: an item logged on one page shows on every page that lists it. */
export function withSharedSlots(log: Readonly<Record<number, number>>, blocked?: ReadonlySet<number>): Record<number, number> {
  const view: Record<number, number> = { ...log };
  for (const id of Object.keys(log)) for (const i of sharedSlotIds(Number(id))) {
    const count = sharedSlotCount(log, i, blocked);
    if (count > 0) view[i] = count;
  }
  return view;
}
