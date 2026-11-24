import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertWikiCoverage, moveSlots } from './sync-collection-log.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));

describe('the collection log sync refuses Wiki data that is empty or cut short', () => {
  const pages = (count: number, perPage: number) => Object.fromEntries(
    Array.from({ length: count }, (_, page) => [`Page ${page}`, Array.from({ length: perPage }, (_, item) => `Item ${page}-${item}`)]),
  );

  it('fails when the Wiki data yields no pages', () => {
    expect(() => assertWikiCoverage({}, 1944)).toThrow(/0 pages and 0 items.*1944 items in the app/);
  });

  it('fails when the Wiki data holds far fewer items than the app', () => {
    expect(() => assertWikiCoverage(pages(10, 20), 1944)).toThrow(/10 pages and 200 items.*1944 items in the app/);
  });

  it('lets a normal week through, including one where the Wiki dropped a few slots', () => {
    // 22 Nov 2026: the Wiki listed 125 pages and 1944 slots, as the app does.
    expect(() => assertWikiCoverage(pages(125, 16), 1944)).not.toThrow();
    expect(() => assertWikiCoverage(pages(120, 16), 1944)).not.toThrow();
  });

  it('checks before it prints or writes anything', () => {
    const script = readFileSync(resolve(HERE, 'sync-collection-log.mjs'), 'utf8');
    const body = script.slice(script.indexOf('const run = async'));
    const check = body.indexOf('assertWikiCoverage(wikiPages,');
    expect(check).toBeGreaterThan(0);
    for (const effect of ['console.log(', 'writeFileSync(']) expect(body.indexOf(effect)).toBeGreaterThan(check);
  });
});

describe('the collection log sync moves a slot between pages', () => {
  type Slot = { id: number; name: string };
  const page = (name: string, target: string | undefined, items: Slot[]) => ({ name, target, items, moved: 0 });
  const printed = () => vi.spyOn(console, 'log').mockImplementation(() => {});
  afterEach(() => vi.restoreAllMocks());

  it('moves a slot that left its old Wiki page to the one page that now lists it', () => {
    const from = page('Old page', 'Old page', [{ id: 1, name: 'Dragon spear' }, { id: 2, name: 'Stays' }]);
    const to = page('New page', 'New page', [{ id: 3, name: 'Other' }]);
    const log = printed();
    moveSlots([from, to], { 'Old page': ['Stays'], 'New page': ['Other', 'Dragon spear'] });
    expect(from.items).toEqual([{ id: 2, name: 'Stays' }]);
    expect(from.moved).toBe(1);
    expect(to.items).toEqual([{ id: 3, name: 'Other' }, { id: 1, name: 'Dragon spear' }]);
    expect(log.mock.calls).toEqual([['  MOVE   Old page -> New page: Dragon spear (#1)']]);
  });

  it('leaves a slot that both Wiki pages still list where it is', () => {
    const from = page('Old page', 'Old page', [{ id: 1, name: 'Dragon spear' }]);
    const to = page('New page', 'New page', []);
    const log = printed();
    moveSlots([from, to], { 'Old page': ['Dragon spear'], 'New page': ['Dragon spear'] });
    expect(log).not.toHaveBeenCalled();
    expect(from.items).toEqual([{ id: 1, name: 'Dragon spear' }]);
    expect(to.items).toEqual([]);
  });

  it('carries on when a page is matched to a Wiki title that the Wiki no longer has', () => {
    // 'Fight Caves' is matched to 'The Fight Caves' by a fixed table, so it keeps
    // that target when the Wiki renames or drops the page.
    const gone = page('Fight Caves', 'The Fight Caves', [{ id: 1, name: 'Fire cape' }]);
    const other = page('Other', 'Other', [{ id: 2, name: 'Item' }]);
    const log = printed();
    expect(() => moveSlots([gone, other], { Other: ['Item'] })).not.toThrow();
    expect(log).not.toHaveBeenCalled();
    expect(gone.items).toEqual([{ id: 1, name: 'Fire cape' }]);
    expect(gone.moved).toBe(0);
    expect(other.items).toEqual([{ id: 2, name: 'Item' }]);
  });
});
