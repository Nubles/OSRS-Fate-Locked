import { describe, it, expect } from 'vitest';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, ITEM_CATEGORY } from './resourceData';
import { computeFullBreakdown, flattenRawMaterials } from '../utils/supplyChain';

/**
 * Resource Engine data-consistency tests.
 *
 * Guards against drift between RESOURCE_MAP and its category index, and
 * verifies the recursive breakdown can never loop forever on circular recipes.
 */

const ALL_ITEMS = Object.keys(RESOURCE_MAP);
const CATEGORISED = Object.values(RESOURCE_CATEGORIES).flat();

describe('RESOURCE_CATEGORIES covers RESOURCE_MAP exactly', () => {
  it('every item belongs to exactly one category', () => {
    const uncategorised = ALL_ITEMS.filter(i => !ITEM_CATEGORY[i]);
    expect(uncategorised, 'items missing a category').toEqual([]);
  });

  it('every categorised item exists in RESOURCE_MAP', () => {
    const orphans = CATEGORISED.filter(i => !RESOURCE_MAP[i]);
    expect(orphans, 'category entries with no RESOURCE_MAP data').toEqual([]);
  });

  it('no item appears in more than one category', () => {
    const dupes = CATEGORISED.filter((i, idx) => CATEGORISED.indexOf(i) !== idx);
    expect(dupes, 'items listed in multiple categories').toEqual([]);
  });
});

describe('RESOURCE_MAP sources are well-formed', () => {
  it('every source has at least one region', () => {
    const bad: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        if (!s.regions || s.regions.length === 0) bad.push(`${item} / ${s.name}`);
      }
    }
    expect(bad, 'sources with no regions').toEqual([]);
  });
});

describe('computeFullBreakdown always terminates', () => {
  it('resolves every item without exceeding the depth guard', () => {
    for (const item of ALL_ITEMS) {
      const tree = computeFullBreakdown(item, 1);
      expect(tree.item).toBe(item);
      // flatten must succeed and return a sorted, de-duplicated list
      const raw = flattenRawMaterials(tree);
      const names = raw.map(r => r.item);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
