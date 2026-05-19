import { describe, it, expect } from 'vitest';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, ITEM_CATEGORY } from './resourceData';
import { ACTIVITY_REGIONS } from './activityRegions';
import {
  BOSSES_LIST, MINIGAMES_LIST, GUILDS_LIST, MOBILITY_LIST, ARCANA_LIST,
  POH_LIST, MERCHANTS_LIST, STORAGE_LIST, FARMING_PATCH_LIST, SKILLS_LIST,
  REGION_GROUPS, MISTHALIN_AREAS,
} from './items';
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

describe('boss-drop regions agree with ACTIVITY_REGIONS', () => {
  it('every unlock-gated source sits in the activity\'s region', () => {
    const mismatches: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        const expected = s.unlockId ? ACTIVITY_REGIONS[s.unlockId] : undefined;
        if (expected && !s.regions.includes(expected) && !s.regions.includes('Any')) {
          mismatches.push(`${item} / ${s.name}: [${s.regions}] != "${expected}"`);
        }
      }
    }
    expect(mismatches, 'RESOURCE_MAP regions out of sync with ACTIVITY_REGIONS').toEqual([]);
  });
});

// Recipe ingredients that intentionally aren't full RESOURCE_MAP items yet
// (Mastering Mixology potions, Sailing-era ingredients, quest-only steps).
// New unmatched inputs that aren't in this list indicate a typo or a recipe
// pointing at the wrong item name — the kind of bug we want CI to catch.
const INTENTIONAL_INPUT_LEAVES = new Set([
  'Caviar', 'Chitin', 'Corrupted Dust', 'Cotton Yarn',
  'Crystal Dust (The Gauntlet)', 'Cup of Hot Water', 'Demonic Tallow',
  'Haddock Eye', 'Haemostatic Poultice',
  'Herb Tea Mix (2 Guams and Harralander)',
  'Herb Tea Mix (2 Guams and Marrentill)',
  'Herb Tea Mix (harralander, Marrentill and Guam)',
  'Marlin Scales', 'Mixture - Step 2', 'Pharmakos Berries', 'Pillar Coral',
  'Pre-nature Amulet', 'Silver Dust', 'Snakeweed Mixture', 'Unfinished Potion',
  "Unfinished Potion (Rogue's Purse)", 'Yellow Fin',
]);

describe('every input references something real', () => {
  it('all inputs resolve to a RESOURCE_MAP key, "Coins", or the intentional-leaves allowlist', () => {
    const keys = new Set(Object.keys(RESOURCE_MAP));
    const dangling: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        if (!s.inputs) continue;
        for (const ing of Object.keys(s.inputs)) {
          if (ing === 'Coins') continue;
          if (keys.has(ing)) continue;
          if (INTENTIONAL_INPUT_LEAVES.has(ing)) continue;
          dangling.push(`${item} / ${s.name} -> ${ing}`);
        }
      }
    }
    expect(dangling, 'recipe inputs pointing at non-existent items').toEqual([]);
  });
});

describe('every unlockId references a real unlock', () => {
  const valid = new Set<string>([
    ...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST, ...MOBILITY_LIST,
    ...ARCANA_LIST, ...POH_LIST, ...MERCHANTS_LIST, ...STORAGE_LIST,
    ...FARMING_PATCH_LIST,
  ]);
  it('no source carries an unlockId that no unlock list knows about', () => {
    const bad: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        if (s.unlockId && !valid.has(s.unlockId)) {
          bad.push(`${item} / ${s.name} -> unlockId "${s.unlockId}"`);
        }
      }
    }
    expect(bad, 'sources with unlockIds that no unlock list contains').toEqual([]);
  });
});

describe('skill and region references are valid', () => {
  const validSkill = new Set(SKILLS_LIST);
  const validRegion = new Set<string>([
    'Any', 'Misthalin', ...MISTHALIN_AREAS, ...Object.keys(REGION_GROUPS),
    ...Object.values(REGION_GROUPS).flat(),
  ]);

  it('every skill key matches SKILLS_LIST', () => {
    const bad: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        if (s.skills) for (const k of Object.keys(s.skills)) {
          if (!validSkill.has(k)) bad.push(`${item} / ${s.name} -> "${k}"`);
        }
      }
    }
    expect(bad, 'sources referencing unknown skills').toEqual([]);
  });

  it('every region tag is "Any", a continent, a continent child, or a Misthalin area', () => {
    const bad: string[] = [];
    for (const [item, sources] of Object.entries(RESOURCE_MAP)) {
      for (const s of sources) {
        for (const r of s.regions || []) {
          if (!validRegion.has(r)) bad.push(`${item} / ${s.name} -> "${r}"`);
        }
      }
    }
    expect(bad, 'sources with unknown region tags').toEqual([]);
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
