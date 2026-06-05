import { describe, it, expect } from 'vitest';
import { COLLECTION_LOG_DATA } from './collectionLogData';

// TAB IDs: Bosses=1, Raids=2, Clues=3, Minigames=4, Other=5
const TAB_ID: Record<string, number> = { Bosses: 1, Raids: 2, Clues: 3, Minigames: 4, Other: 5 };

describe('collection log data integrity', () => {
  it('has exactly the five expected tabs', () => {
    expect(Object.keys(COLLECTION_LOG_DATA).sort()).toEqual(['Bosses', 'Clues', 'Minigames', 'Other', 'Raids']);
  });

  it('every item id is globally unique', () => {
    const seen = new Map<number, string>();
    const dups: string[] = [];
    for (const tab of Object.values(COLLECTION_LOG_DATA))
      for (const page of Object.values(tab.pages))
        for (const item of page.items) {
          if (seen.has(item.id)) dups.push(`${item.id} (${seen.get(item.id)} & ${item.name})`);
          else seen.set(item.id, item.name);
        }
    expect(dups, 'duplicate item ids').toEqual([]);
  });

  // A few OSRS log pages legitimately have many slots that share one display
  // name (e.g. My Notes has 26 different "Ancient page" entries). Everywhere
  // else, a repeated name means a real bug (distinct items mislabelled the
  // same — as Castle Wars and Trouble Brewing's rum were before fixing).
  const SAME_NAME_OK = new Set(['My Notes', 'Hallowed Sepulchre', 'Sea Treasures']);
  it('no page lists the same item name twice (outside known multi-slot pages)', () => {
    const dups: string[] = [];
    for (const tab of Object.values(COLLECTION_LOG_DATA))
      for (const page of Object.values(tab.pages)) {
        if (SAME_NAME_OK.has(page.name)) continue;
        const seen = new Set<string>();
        for (const item of page.items) {
          if (seen.has(item.name)) dups.push(`${page.name} -> "${item.name}"`);
          seen.add(item.name);
        }
      }
    expect(dups, 'pages with duplicate item names').toEqual([]);
  });

  it('no page is empty', () => {
    const empty: string[] = [];
    for (const tab of Object.values(COLLECTION_LOG_DATA))
      for (const page of Object.values(tab.pages))
        if (page.items.length === 0) empty.push(page.name);
    expect(empty, 'empty pages').toEqual([]);
  });

  it('every item id encodes its tab (id / 100000 === tab id)', () => {
    const bad: string[] = [];
    for (const [tabName, tab] of Object.entries(COLLECTION_LOG_DATA)) {
      const tabId = TAB_ID[tabName];
      for (const page of Object.values(tab.pages))
        for (const item of page.items)
          if (Math.floor(item.id / 100000) !== tabId) bad.push(`${item.id} "${item.name}" (in ${tabName})`);
    }
    expect(bad.slice(0, 30), 'items whose id tab-prefix is wrong').toEqual([]);
  });
});
