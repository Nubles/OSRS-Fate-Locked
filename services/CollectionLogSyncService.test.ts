import { describe, it, expect, vi } from 'vitest';
import { computeSync, collectionLogSync } from './CollectionLogSyncService';
import type { CollectionLogTab } from '../data/collectionLogData';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { migrateClogIds } from '../utils/clogIdMigrations';

// Minimal app dataset standing in for COLLECTION_LOG_DATA.
const appData: Record<string, CollectionLogTab> = {
  Bosses: {
    name: 'Bosses',
    pages: {
      'Test Boss': { name: 'Test Boss', items: [
        { id: 101001, name: 'Existing item' },
        { id: 101002, name: "Hydra's claw" },
      ] },
    },
  },
  Minigames: {
    name: 'Minigames',
    pages: {
      // App calls it "Mage Training Arena"; the wiki page is "Magic Training Arena".
      'Mage Training Arena': { name: 'Mage Training Arena', items: [
        { id: 401001, name: 'Infinity hat' },
      ] },
    },
  },
};

const wiki = [
  { id: 1, name: 'Existing item', tabs: ['Test Boss'] },
  { id: 2, name: "Hydra's claw", tabs: ['Test Boss'] },     // present (apostrophe) — must not re-add
  { id: 3, name: 'Brand New Drop', tabs: ['Test Boss'] },    // NEW item on existing page
  { id: 4, name: 'Infinity top', tabs: ['Magic Training Arena'] }, // NEW via page alias
  { id: 5, name: 'Some Pet', tabs: ['Totally New Boss'] },   // brand-new page
  { id: 6, name: 'Some Drop', tabs: ['Totally New Boss'] },
];

describe('collection log runtime sync diff', () => {
  it('recomputes a stale cached addition that reused a retired identity', async () => {
    const page = COLLECTION_LOG_DATA.Bosses.pages.Araxxor;
    const original = [...page.items];
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ timestamp: Date.now(), data: { additions: [{ tab: 'Bosses', page: 'Araxxor', id: 104011, name: 'Future Araxxor drop' }], newSources: [] } }),
      setItem: vi.fn(),
    });
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => ({ query: { pages: { 1: { revisions: [{ slots: { main: { '*': url.includes('data.json')
      ? JSON.stringify([{ id: 999999, name: 'Future Araxxor drop', tabs: ['Araxxor'] }])
      : '[1] = { name = "Unused override" }' } } }] } } } }) }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await collectionLogSync.init();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(page.items.find(item => item.name === 'Future Araxxor drop')?.id).toBe(104012);
      expect(page.items.some(item => item.id === 104011)).toBe(false);
    } finally {
      page.items.splice(0, page.items.length, ...original);
      vi.unstubAllGlobals();
    }
  });
  it('reserves the retired Araxxor ID so a new drop survives save migration unchanged', () => {
    const result = computeSync([{ id: 999999, name: 'Future Araxxor drop', tabs: ['Araxxor'] }], COLLECTION_LOG_DATA);
    expect(result.additions).toEqual([{ tab: 'Bosses', page: 'Araxxor', id: 104012, name: 'Future Araxxor drop' }]);
    expect(migrateClogIds({ [result.additions[0].id]: 1 })).toEqual({ 104012: 1 });
  });
  const { additions, newSources } = computeSync(wiki, appData);

  it('appends only genuinely-new items to existing pages', () => {
    const names = additions.map(a => a.name).sort();
    expect(names).toEqual(['Brand New Drop', 'Infinity top']);
  });

  it('mints a collision-free id continuing the page scheme', () => {
    const drop = additions.find(a => a.name === 'Brand New Drop')!;
    expect(drop.tab).toBe('Bosses');
    expect(drop.page).toBe('Test Boss');
    expect(drop.id).toBe(101003); // next free after 101001/101002
  });

  it('matches pages through the alias map', () => {
    const top = additions.find(a => a.name === 'Infinity top')!;
    expect(top.page).toBe('Mage Training Arena');
    expect(top.id).toBe(401002);
  });

  it('does not re-add items already present (incl. apostrophes)', () => {
    expect(additions.some(a => a.name === "Hydra's claw")).toBe(false);
    expect(additions.some(a => a.name === 'Existing item')).toBe(false);
  });

  it('surfaces brand-new pages as newSources instead of adding them blindly', () => {
    expect(newSources).toEqual([{ name: 'Totally New Boss', itemCount: 2 }]);
  });

  it('is idempotent: re-running against the post-merge data yields nothing', () => {
    const merged: Record<string, CollectionLogTab> = JSON.parse(JSON.stringify(appData));
    for (const a of additions) {
      const page = Object.values(merged[a.tab].pages).find(p => p.name === a.page)!;
      page.items.push({ id: a.id, name: a.name });
    }
    // Only consider the pages that still exist (ignore the brand-new page).
    const again = computeSync(wiki.filter(w => w.tabs[0] !== 'Totally New Boss'), merged);
    expect(again.additions).toEqual([]);
  });
});

// Regression: the bundled data uses the wiki's override-RENDERED names, so the
// runtime sync must apply the same overrides — otherwise the raw data.json name
// looks new and a duplicate is appended (this inflated the slot count > 1906).
describe('collection log sync applies wiki display overrides', () => {
  const app: Record<string, CollectionLogTab> = {
    Other: { name: 'Other', pages: {
      'Chompy Bird Hunting': { name: 'Chompy Bird Hunting', items: [
        { id: 501001, name: 'Chompy bird hat (ogre bowman)' },
      ] },
    } },
  };
  // data.json carries the RAW name; the override renames it for display.
  const wiki = [{ id: 2978, name: 'Chompy bird hat', tabs: ['Chompy Bird Hunting'] }];
  const overrides = { 2978: 'Chompy bird hat (ogre bowman)' };

  it('adds a duplicate WITHOUT overrides (demonstrates the bug)', () => {
    expect(computeSync(wiki, app).additions).toHaveLength(1);
  });

  it('adds nothing WITH overrides applied (the fix)', () => {
    expect(computeSync(wiki, app, overrides).additions).toEqual([]);
  });
});
