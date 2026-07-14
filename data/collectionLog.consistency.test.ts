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

  // A wiki micro-rename ("Araxyte venom sack" -> "…sac") once slipped past the
  // sync's matcher, so the old spelling was kept AND the new one appended —
  // a permanent duplicate slot. Near-identical names on one page are that bug.
  // Numbered variants (Godsword shard 1/2/3) are legitimate, so names whose
  // digits differ are exempt — and single-character SUBSTITUTIONS are too
  // (Team cape i/x, "(t)"/"(g)" ornament kits are real distinct items). Only
  // a single INSERTION/DELETION (the sack→sac shape) is flagged.
  it('no page lists two near-identical item names (rename-duplicate guard)', () => {
    const lev = (a: string, b: string): number => {
      const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
      for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return d[a.length][b.length];
    };
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const digits = (s: string) => s.replace(/\D/g, '');
    const sus: string[] = [];
    for (const tab of Object.values(COLLECTION_LOG_DATA))
      for (const page of Object.values(tab.pages)) {
        const items = page.items;
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const a = norm(items[i].name), b = norm(items[j].name);
            if (a === b) continue; // exact dupes are the previous test's job
            if (digits(a) !== digits(b)) continue; // numbered variants are fine
            if (Math.abs(a.length - b.length) !== 1) continue; // substitutions are fine
            if (lev(a, b) === 1) sus.push(`${page.name}: "${items[i].name}" ~ "${items[j].name}"`);
          }
      }
    expect(sus, 'near-duplicate names (likely a missed wiki rename)').toEqual([]);
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

  // Coverage regression floor. The data is a faithful mirror of the live wiki
  // log (synced from Module:Collection_log/data.json + its display overrides),
  // which totals 1,905 item-slots. This floor catches accidental bulk item/page
  // deletion; a future wiki re-sync that adds items only raises the number.
  it('retains full collection-log coverage (>= 1905 slots)', () => {
    let slots = 0;
    for (const tab of Object.values(COLLECTION_LOG_DATA))
      for (const page of Object.values(tab.pages)) slots += page.items.length;
    expect(slots).toBeGreaterThanOrEqual(1905);
  });

  // Page structure mirrors the live wiki: every wiki collection-log page is
  // present (incl. Brutus, kept for log parity though it isn't an unlockable
  // boss — see consistency.test). Bosses 56 (Maggot King, July 2026), Raids 3,
  // Minigames 22, Other 32 (Venators, July 2026);
  // Clues 11 = the 10 Treasure-Trail tiers + Scroll Cases.
  it('has the audited page count in each tab', () => {
    const counts = Object.fromEntries(
      Object.entries(COLLECTION_LOG_DATA).map(([k, t]) => [k, Object.keys(t.pages).length])
    );
    expect(counts).toEqual({ Bosses: 56, Raids: 3, Clues: 11, Minigames: 22, Other: 32 });
  });
});
